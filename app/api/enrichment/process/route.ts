import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdapter } from "@/lib/enrichment/platform-adapter";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { aiExtractionResultSchema } from "@/lib/enrichment/types";
import type {
  EnrichmentConfig,
  ProductRow,
  EnrichedRow,
  AIExtractionResult,
} from "@/lib/enrichment/types";

export const maxDuration = 3600; // 60 minutes max for large file processing

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rows, config } = body as {
      rows: ProductRow[];
      config: EnrichmentConfig;
    };

    if (!rows || !config) {
      return NextResponse.json(
        { error: "Missing rows or config" },
        { status: 400 }
      );
    }

    const adapter = getPlatformAdapter(config.platform);

    // Create a streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const enrichedRows: EnrichedRow[] = [];
        let processed = 0;
        const total = rows.length;

        // Send initial progress
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "progress",
              processed: 0,
              total,
            })}\n\n`
          )
        );

        // Process rows in batches to avoid overwhelming the AI API
        // Increased to 10 for faster processing (Haiku handles this well)
        const batchSize = 10;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

          const batchResults = await Promise.all(
            batch.map(async (row) => {
              // Get product identifier for error messages
              const productId =
                row.name || row.code || `Řádek ${row.rowIndex + 1}`;

              try {
                const sourceText = adapter.getSourceText(row, config);

                if (!sourceText.trim()) {
                  return {
                    ...row,
                    error: `${productId}: Žádný zdrojový text (shortDescription, description, name jsou prázdné)`,
                  } as EnrichedRow;
                }

                const aiResult = await extractWithAI(sourceText, config);
                return {
                  ...row,
                  aiResult,
                } as EnrichedRow;
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "AI extraction failed";
                return {
                  ...row,
                  error: `${productId}: ${errorMsg}`,
                } as EnrichedRow;
              }
            })
          );

          enrichedRows.push(...batchResults);
          processed += batch.length;

          // Send progress update
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "progress",
                processed,
                total,
              })}\n\n`
            )
          );

          // Small delay between batches to avoid rate limiting (500ms)
          if (i + batchSize < rows.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        // Send final result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "complete",
              enrichedRows,
              processed: total,
              total,
            })}\n\n`
          )
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Batch processing error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Batch processing failed",
      },
      { status: 500 }
    );
  }
}

// Helper: Promise with timeout
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// Helper: Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on schema mismatch - it won't help
      if (lastError.message.includes("did not match schema")) {
        throw lastError;
      }

      // Last attempt - throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(
        `AI extraction attempt ${attempt + 1} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function extractWithAI(
  sourceText: string,
  config: EnrichmentConfig
): Promise<AIExtractionResult> {
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(sourceText, config);

  try {
    // Wrap AI call with retry and timeout (30s per attempt)
    const result = await withRetry(async () => {
      return withTimeout(
        generateObject({
          // Using Haiku for cost efficiency (Sonnet requires higher API tier)
          // Sonnet: $3/$15 per 1M tokens, Haiku: $0.25/$1.25 per 1M tokens
          model: anthropic("claude-3-5-haiku-20241022"),
          schema: aiExtractionResultSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0,
        }),
        60000, // 60 second timeout per AI call (Sonnet needs more time)
        "AI požadavek vypršel (timeout 30s)"
      );
    }, 2); // 2 retries = 3 total attempts

    // Post-process AI output to fix common issues
    return sanitizeAiOutput(result.object);
  } catch (error) {
    // If AI fails to generate valid object, return empty result instead of throwing
    // This can happen with very short/empty descriptions
    console.error("AI extraction error:", error);

    // Check if it's a schema mismatch error - return empty result
    if (
      error instanceof Error &&
      error.message.includes("did not match schema")
    ) {
      return { filtering: [], text: [] };
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Helper: Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper: Lowercase first letter (except proper nouns, brands, certifications, abbreviations)
 */
function lowercaseFirst(str: string): string {
  if (!str) return str;

  const firstWord = str.split(/[\s,;-]/)[0];

  // 1. Check if the first word is an abbreviation (all uppercase letters, optionally with numbers)
  // Examples: "CD", "DVD", "BD", "USB", "HDMI", "LED", "4K"
  if (firstWord && /^[A-Z0-9]+$/.test(firstWord)) {
    return str;
  }

  // 2. Check if the first word looks like a proper noun/brand (Title Case: first uppercase, rest lowercase)
  // Examples: "Sonberk", "Apple", "Samsung", "Ryzlink" - these are likely brands/names
  // But NOT: "Modrá" (color), "Bavlna" (material) - these should be lowercased
  // Heuristic: if it's a single word starting with capital and has 2+ lowercase letters,
  // and doesn't look like a common Czech word ending, assume it's a proper noun
  if (firstWord && firstWord.length >= 3) {
    const isProperNounPattern =
      /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]{2,}$/.test(firstWord);
    // Common Czech word endings that are NOT proper nouns (adjectives, materials, etc.)
    const commonWordEndings = [
      "á",
      "é",
      "í",
      "ý",
      "ová",
      "ový",
      "ná",
      "ný",
      "ka",
      "ko",
      "na",
      "no",
    ];
    const hasCommonEnding = commonWordEndings.some((ending) =>
      firstWord.toLowerCase().endsWith(ending)
    );

    if (isProperNounPattern && !hasCommonEnding) {
      // Likely a proper noun/brand - keep as is
      return str;
    }
  }

  // 3. List of explicit exceptions that should keep their capitalization
  const exceptions = [
    // Media formats
    "CD",
    "DVD",
    "BD",
    "Blu-ray",
    "VHS",
    "LP",
    "EP",
    // Tech abbreviations
    "USB",
    "HDMI",
    "LED",
    "LCD",
    "OLED",
    "WiFi",
    "Bluetooth",
    "HD",
    "4K",
    "UHD",
    "MP3",
    "AAC",
    "FLAC",
    // Brands & Certifications
    "BIO",
    "ISO",
    "CE",
    "EU",
    "USA",
    "ČR",
    // Countries (keep capitalized)
    "Česká republika",
    "Francie",
    "Itálie",
    "Španělsko",
    "Německo",
    "Rakousko",
    "Polsko",
    "Maďarsko",
    "Slovensko",
    // Regions
    "Morava",
    "Čechy",
    "Praha",
    "Brno",
  ];

  // Check if the value starts with any exception
  for (const exc of exceptions) {
    if (str.startsWith(exc)) {
      return str;
    }
  }

  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Force uppercase for known acronyms in a value string.
 * "dvd" -> "DVD", "usb kabel" -> "USB kabel"
 */
function normalizeAcronyms(value: string): string {
  const acronyms: Record<string, string> = {
    "dvd": "DVD",
    "cd": "CD",
    "bd": "BD",
    "usb": "USB",
    "hdmi": "HDMI",
    "led": "LED",
    "lcd": "LCD",
    "oled": "OLED",
    "4k": "4K",
    "hd": "HD",
    "uhd": "UHD",
    "mp3": "MP3",
    "aac": "AAC",
    "flac": "FLAC",
    "bio": "BIO",
    "wifi": "WiFi",
    "wi-fi": "WiFi",
    "bluetooth": "Bluetooth",
  };

  let result = value;
  for (const [lower, upper] of Object.entries(acronyms)) {
    // Match whole word only (case insensitive)
    const regex = new RegExp(`\\b${lower}\\b`, "gi");
    result = result.replace(regex, upper);
  }
  return result;
}

/**
 * Normalize parameter names to canonical form.
 * "Typ média" -> "Typ produktu", "Výrobce" -> "Značka", etc.
 */
function normalizeParameterName(name: string): string {
  const nameMapping: Record<string, string> = {
    // Media type variations
    "typ média": "Typ produktu",
    "médium": "Typ produktu",
    "formát": "Typ produktu",
    "druh": "Typ produktu",
    // Name variations
    "název": "Název produktu",
    "jméno": "Název produktu",
    "titul": "Název produktu",
    // Brand/manufacturer
    "výrobce": "Značka",
    "producent": "Značka",
    "brand": "Značka",
    // Count variations
    "počet ks": "Počet kusů",
    "počet knůtů": "Počet knotů",
    // Material variations
    "složení": "Materiál",
    "látka": "Materiál",
  };

  const lowerName = name.toLowerCase().trim();
  return nameMapping[lowerName] || capitalizeFirst(name.trim());
}

/**
 * Remove duplicate parameters where different names refer to the same thing.
 * E.g., if both "Značka: X" and "Výrobce: X" exist, keep only "Značka: X".
 */
function removeDuplicateFiltering(
  filtering: AIExtractionResult["filtering"]
): AIExtractionResult["filtering"] {
  const seen = new Map<string, { name: string; value: string }>();
  const result: AIExtractionResult["filtering"] = [];

  // Priority order: prefer these canonical names
  const priorityNames = ["Značka", "Typ produktu", "Materiál", "Počet kusů", "Počet knotů"];

  for (const item of filtering) {
    const normalizedName = normalizeParameterName(item.name);
    const key = `${normalizedName}:${item.value.toLowerCase()}`;

    // Check if we already have this exact name:value pair
    if (seen.has(key)) {
      continue; // Skip duplicate
    }

    // Check if we have same value under a synonym name
    const valueKey = item.value.toLowerCase();
    let isDuplicate = false;

    for (const [existingKey, existingItem] of seen.entries()) {
      const existingValue = existingItem.value.toLowerCase();
      if (existingValue === valueKey) {
        // Same value exists - check if current or existing should be kept
        const existingIsPriority = priorityNames.includes(existingItem.name);
        const currentIsPriority = priorityNames.includes(normalizedName);

        if (currentIsPriority && !existingIsPriority) {
          // Current is better - remove existing and add current
          seen.delete(existingKey);
        } else {
          // Keep existing
          isDuplicate = true;
        }
        break;
      }
    }

    if (!isDuplicate) {
      const normalizedItem = { name: normalizedName, value: item.value };
      seen.set(key, normalizedItem);
      result.push(normalizedItem);
    }
  }

  return result;
}

/**
 * Post-processing function to sanitize AI output.
 * Fixes common issues like:
 * - Multiple values in one string (split by comma or " a ")
 * - Capitalization inconsistencies
 * - Acronym casing (dvd -> DVD)
 * - Duplicate parameters with different names
 */
function sanitizeAiOutput(aiJson: AIExtractionResult): AIExtractionResult {
  const cleanFiltering: AIExtractionResult["filtering"] = [];

  for (const item of aiJson.filtering) {
    // Skip empty values
    if (!item.value || !item.value.trim()) continue;

    // 1. Fix: If AI left commas in the value (e.g., "bavlna, elastan")
    if (item.value.includes(",")) {
      const splitted = item.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const subValue of splitted) {
        cleanFiltering.push({ name: item.name, value: subValue });
      }
    }
    // 2. Fix: If AI left " a " connector (e.g., "červená a bílá")
    else if (item.value.includes(" a ")) {
      const splitted = item.value
        .split(" a ")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const subValue of splitted) {
        cleanFiltering.push({ name: item.name, value: subValue });
      }
    }
    // 3. Fix: If AI left " i " connector (e.g., "dřevo i kov")
    else if (item.value.includes(" i ")) {
      const splitted = item.value
        .split(" i ")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const subValue of splitted) {
        cleanFiltering.push({ name: item.name, value: subValue });
      }
    }
    // 4. Fix: If AI left " + " connector (e.g., "bavlna + polyester")
    else if (item.value.includes(" + ")) {
      const splitted = item.value
        .split(" + ")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const subValue of splitted) {
        cleanFiltering.push({ name: item.name, value: subValue });
      }
    } else {
      cleanFiltering.push(item);
    }
  }

  // Step 1: Normalize parameter names and values
  const normalizedFiltering = cleanFiltering.map((item) => ({
    name: normalizeParameterName(item.name),
    value: normalizeAcronyms(lowercaseFirst(item.value.trim())),
  }));

  // Step 2: Remove duplicates (e.g., Značka and Výrobce with same value)
  const deduplicatedFiltering = removeDuplicateFiltering(normalizedFiltering);

  // Normalize text params
  const normalizedText = aiJson.text
    .filter((item) => item.key && item.value) // Skip empty
    .map((item) => ({
      key: normalizeParameterName(item.key),
      value: normalizeAcronyms(item.value.trim()),
    }));

  // Remove duplicate text params too
  const seenTextKeys = new Set<string>();
  const deduplicatedText = normalizedText.filter((item) => {
    const key = `${item.key}:${item.value.toLowerCase()}`;
    if (seenTextKeys.has(key)) return false;
    seenTextKeys.add(key);
    return true;
  });

  return {
    filtering: deduplicatedFiltering,
    text: deduplicatedText,
  };
}

function buildSystemPrompt(config: EnrichmentConfig): string {
  return `You are an expert Data Engineer specializing in e-commerce product feed enrichment for the Czech market (Shoptet platform).

YOUR GOAL: Extract structured technical parameters from unstructured product descriptions.
OUTPUT FORMAT: JSON containing "filtering" (for faceted search) and "text" (for product detail table).

<rules_critical>
1. ACCURACY: Only extract information EXPLICITLY stated in the text. Do not guess.
2. LANGUAGE: Output values in Czech grammar (lowercase usually, correct declension).
3. FORMAT:
   - "filtering": Use [{"name": "Param", "value": "value"}]
   - "text": Use [{"key": "Param", "value": "value"}] (Note: "key" vs "name")
4. STANDARDIZATION: You MUST align varied inputs to standard parameter names (see MAPPING below).
5. CONSISTENCY: All products of the same type MUST have identical parameter structure.
</rules_critical>

<mandatory_replacements>
IF YOU WANT TO OUTPUT [LEFT], YOU MUST OUTPUT [RIGHT] INSTEAD:

Parameter Names (STRICT - never use left side):
- "Název" → "Název produktu"
- "Jméno" → "Název produktu"
- "Titul" → "Název produktu"
- "Typ média" → "Typ produktu"
- "Druh" → "Typ produktu"
- "Kategorie" → "Typ produktu"
- "Výrobce" → "Značka" (if same as brand, use only Značka)
- "Producent" → "Značka"
- "Počet ks" → "Počet kusů"
- "Počet knůtů" → "Počet knotů"

Value Casing (ALWAYS UPPERCASE these):
- "dvd" → "DVD"
- "cd" → "CD"
- "bd" → "BD"
- "usb" → "USB"
- "hdmi" → "HDMI"
- "led" → "LED"
- "lcd" → "LCD"
- "oled" → "OLED"
- "4k" → "4K"
- "hd" → "HD"
- "uhd" → "UHD"
- "mp3" → "MP3"
- "bio" → "BIO"
- "wifi" → "WiFi"

Value Format:
- "papírový" → "papír" (use noun form, not adjective)
- "plastový" → "plast"
- "skleněný" → "sklo"
- "dřevěný" → "dřevo"
- "kovový" → "kov"
</mandatory_replacements>

<value_rules>
1. ACRONYMS: DVD, CD, USB, HDMI, LED, 4K, BIO, MP3 - ALWAYS UPPERCASE. Never "dvd" or "Dvd".
2. UNITS: Always with space: "100 min", "500 ml", "12 V", "48 %". Never "100min".
3. COUNTS: If parameter name contains unit, value is just number: "Počet kusů: 12" NOT "Počet kusů: 12 ks".
4. BOOLEANS: Instead of "BIO: ano" use "Certifikace: BIO". Instead of "Cukr: ne" use "Vlastnosti: bez cukru".
5. MATERIALS: Use noun form: "bavlna" not "bavlněný", "plast" not "plastový".
</value_rules>

<canonical_parameter_mapping>
Use these standard names (Left side) if you encounter synonyms (Right side):

[Global]
- "Barva" <= barvička, barevné provedení, odstín
- "Materiál" <= složení, látka, material
- "Značka" <= výrobce, brand, producent (NEVER duplicate with Výrobce)
- "Hmotnost" <= váha, weight
- "Rozměry" <= velikost (pro předměty), šířka/výška/hloubka, dimensions
- "Objem" <= kapacita, velikost balení, obsah
- "Počet kusů" <= balení obsahuje, počet ks, ks v balení
- "Záruka" <= garance, záruční doba
- "Typ produktu" <= typ média, druh, kategorie, formát

[Fashion/Textile]
- "Velikost" <= konfekční velikost, size
- "Střih" <= fit, tvar
- "Vzor" <= design, potisk

[Electronics]
- "Výkon" <= power, watty
- "Napětí" <= voltáž
- "Rozhraní" <= konektivita, porty, připojení

[Food/Drink]
- "Alergeny" <= obsahuje
- "Obsah alkoholu" <= % alkoholu
- "Odrůda" <= druh vína
- "Původ" <= země původu, oblast, region

[Media - CD/DVD/Blu-ray]
- "Typ produktu" <= typ média, médium, formát (use ONLY "Typ produktu")
- "Žánr" <= styl, kategorie hudby/filmu
- "Délka" <= stopáž, doba trvání
</canonical_parameter_mapping>

<duplicate_prevention>
CRITICAL: Never output the same information twice under different names!
- If you have "Značka: X", do NOT also add "Výrobce: X"
- If you have "Typ produktu: DVD", do NOT also add "Typ média: DVD" or "Formát: DVD"
- Pick ONE canonical name and use it consistently
</duplicate_prevention>

<processing_logic>
Step 1: CLASSIFY the product category based on input text.
Step 2: SELECT relevant parameters for that category.
Step 3: STANDARDIZE parameter names using mandatory_replacements and canonical_parameter_mapping.
Step 4: FORMAT values according to value_rules.
Step 5: CHECK for duplicates - remove any redundant parameters.
Step 6: SPLIT multi-value parameters into separate entries.
</processing_logic>

<filtering_vs_text_guide>
- USE "filtering" for: Short (1-3 words), standardized attributes for faceted search.
- USE "text" for: Long descriptions, complex specs, detailed information.
</filtering_vs_text_guide>

<limits>
Max filtering params: ${config.maxFilteringParams}
Max text params: ${config.maxTextParams}
</limits>

${config.productContext ? `<context>\n${config.productContext}\n</context>` : ""}
`;
}

// function buildSystemPrompt(config: EnrichmentConfig): string {
//   return `# Role
// Jsi zkušený e-commerce specialista na produktová data pro český trh. Tvým úkolem je analyzovat popisy produktů a extrahovat strukturované parametry, které budou použity pro filtry a specifikace v e-shopu na platformě Shoptet.

// ## Vstup
// Dostaneš:
// - **Název produktu** (name)
// - **Krátký popis** (shortDescription) – stručné shrnutí produktu
// - **Dlouhý popis** (description) – detailní informace, specifikace, vlastnosti
// - Případně další údaje (hmotnost, výrobce, dodavatel, záruka)

// ### Formát vstupního popisu
// Popis produktu může být:
// - **Čistý text** – prostý text bez formátování
// - **HTML** – obsahuje tagy jako \`<ul>\`, \`<li>\`, \`<p>\`, \`<strong>\`, \`<br>\` apod.

// Pokud je popis v HTML, interpretuj obsah správně:
// - \`<li>\` položky čti jako jednotlivé vlastnosti/specifikace
// - \`<strong>\` nebo \`<b>\` značí důležité informace
// - Ignoruj inline styly a zaměř se na obsah

// ## Výstup
// Vrať JSON objekt se dvěma poli:
// \`\`\`json
// {
//   "filtering": [{"name": "Parametr", "value": "hodnota"}],
//   "text": [{"key": "Parametr", "value": "hodnota"}]
// }
// \`\`\`

// ### KRITICKY DŮLEŽITÉ - formát výstupu
// - **filtering** pole používá klíč **"name"** pro název parametru
// - **text** pole používá klíč **"key"** pro název parametru (NE "name"!)

// ### Rozdíl mezi filtering a text
// - **filtering** = parametry pro FILTRY v e-shopu (barva, velikost, materiál, značka) – zákazník podle nich vybírá produkty. Formát: {"name": "...", "value": "..."}
// - **text** = informační SPECIFIKACE produktu (záruka, rozměry, údržba, certifikace) – detaily zobrazené na kartě produktu. Formát: {"key": "...", "value": "..."}

// ## Pravidla formátování (DŮLEŽITÉ)

// ### Názvy parametrů (name/key)
// 1. **Vždy s VELKÝM počátečním písmenem** – "Materiál", "Objem", "Barva"
// 2. **Jednotný tvar** – používej stejné názvy pro stejné typy parametrů napříč produkty
// 3. **Bez zkratek** – "Obsah alkoholu" nikoliv "Alk."

// ### Hodnoty parametrů (value)
// 1. **S MALÝM počátečním písmenem** – "modrá", "100% bavlna", "nerezová ocel"
// 2. **Výjimka - vlastní jména, značky, certifikace**: "Apple", "ISO 9001", "Samsung", "Německo"
// 3. **Výjimka - ZKRATKY/ABREVIATURY VŽDY VELKÝMI**: pokud slovo je celé z velkých písmen, ZACHOVEJ JE – "CD", "DVD", "USB", "LED", "4K", "HDMI" – NIKDY "cD" nebo "dVD"!
// 4. **Jednotky vždy s mezerou** – "500 g", "12 V", "250 ml", "48 % obj."
// 5. **Jednotné číslo, základní tvar** – "meruňka" ne "meruňky", "bavlna" ne "bavlny"
// 6. **Krátké hodnoty** – max 3-4 slova, žádné celé věty
// 7. **Jednoduché hodnoty** – "DVD" ne "hudební DVD", "CD" ne "audio CD" – přívlastky patří do jiného parametru
// 8. **NEOPAKUJ jednotku, pokud je v názvu parametru!**
//    - ❌ "Počet kusů: 12 ks" → ✅ "Počet kusů: 12"
//    - ❌ "Počet stran: 200 stran" → ✅ "Počet stran: 200"
//    - Pokud název parametru obsahuje jednotku (Počet X), hodnota je jen číslo
// 9. **Správný pravopis v češtině** – kontroluj diakritiku a tvary slov:
//    - Používej správné tvary: "kusů" ne "ksů", "knotů" ne "knůtů"
//    - Konzistentní diakritika napříč produkty

// ### KRITICKÉ pravidlo pro FILTERING parametry
// **Každý filtering parametr musí mít JEDNU JEDNODUCHOU hodnotu!**

// Pokud produkt má více vlastností stejného typu, vytvoř SAMOSTATNÉ parametry:

// ❌ ŠPATNĚ (více hodnot v jednom parametru):
// - { "name": "Speciální vlastnosti", "value": "bez pecek, bez síry, bez přidaného cukru" }

// ✅ SPRÁVNĚ (každá vlastnost jako samostatný parametr):
// - { "name": "Bez pecek", "value": "ano" }
// - { "name": "Bez síry", "value": "ano" }
// - { "name": "Bez přidaného cukru", "value": "ano" }

// Nebo ještě lépe – použij kategorii jako název:
// - { "name": "Vlastnosti", "value": "bez pecek" }
// - { "name": "Vlastnosti", "value": "bez síry" }
// - { "name": "Vlastnosti", "value": "bez cukru" }

// **Proč?** Filtering parametry slouží pro filtry v e-shopu. Zákazník chce filtrovat podle jedné konkrétní vlastnosti, ne podle kombinace.

// ### Příklady správného formátu
// ✅ Správně:
// - { "name": "Materiál", "value": "100% bavlna" }
// - { "name": "Objem", "value": "250 ml" }
// - { "name": "Obsah alkoholu", "value": "48 % obj." }
// - { "name": "Barva", "value": "tmavě modrá" }
// - { "key": "Záruka", "value": "24 měsíců" }

// ❌ Špatně:
// - { "name": "materiál", "value": "Bavlna" } – malé písmeno v názvu, velké v hodnotě
// - { "name": "Objem", "value": "250ml" } – chybí mezera před jednotkou
// - { "name": "Popis", "value": "Tento produkt je vyroben z kvalitního materiálu..." } – celá věta

// ## Pravidla extrakce (KRITICKY DŮLEŽITÉ)

// ### Co extrahovat
// 1. **Pouze EXPLICITNĚ zmíněné informace** – nikdy si nevymýšlej hodnoty
// 2. **Objektivní, měřitelné vlastnosti** – materiál, rozměry, objem, hmotnost, barva
// 3. **Technické specifikace** – výkon, napětí, kapacita, kompatibilita
// 4. **Certifikace a standardy** – BIO, Vegan, ISO, CE

// ### Co NEEXTRAHOVAT
// 1. **Subjektivní hodnocení** – "kvalitní", "nejlepší", "luxusní"
// 2. **Marketingové fráze** – "ideální pro", "perfektní na", "skvělý dárek"
// 3. **Zřejmé informace** – barva oranžová u pomeranče, mokrý efekt u vody
// 4. **Celé věty nebo popisy** – hodnota musí být krátká a konkrétní
// 5. **DUPLICITNÍ parametry** – pokud máš "Typ produktu: DVD", NEPŘIDÁVEJ "Médium: DVD" nebo "Typ média: DVD" – stejná informace jednou!
// 6. **NÁHODNÉ/IRELEVANTNÍ parametry** – nepřidávej parametry, které nejsou klíčové pro danou kategorii:
//    - Původ přidávej pouze u produktů, kde je KLÍČOVÝ pro filtrování (víno, potraviny, regionální produkty)
//    - Objem/Hmotnost jako FILTERING pouze pokud zákazníci podle toho skutečně filtrují

// ### Speciální případy

// #### Sady a balení
// Pokud je produkt sada/box/set více položek:
// - Vytvoř parametr "Obsah balení" nebo "Složení setu"
// - Hodnota = výčet položek (např. "3× sprchový gel, 2× šampon")
// - Neextrahuj parametry jednotlivých položek zvlášť

// #### Rozpoznání kategorie produktu
// Přizpůsob extrakci typu produktu:
// - **POTRAVINY/NÁPOJE**: Chuť, Složení, Původ, Obsah alkoholu, Hmotnost
// - **MÓDA/OBLEČENÍ**: Materiál, Střih, Velikost, Barva, Sezóna
// - **KOSMETIKA**: Typ pleti, Objem, Složení, Vůně, Účinek
// - **TECHNIKA/ELEKTRONIKA**: Výkon, Napětí, Rozměry, Kompatibilita, Připojení
// - **AUTO-MOTO**: Typ motoru, Objem, Kompatibilita s modelem, Materiál
// - **MÉDIA (CD/DVD/LP)**: Žánr, Typ média, Jazyk | Délka, Popis, Interpreti

// #### Pravidla pro ZKRATKY a ABREVIATURY (KRITICKY DŮLEŽITÉ)
// Zkratky a abreviatury VŽDY piš VELKÝMI písmeny:
// - ✅ "CD", "DVD", "BD", "USB", "HDMI", "LED", "LCD", "MP3", "4K", "HD"
// - ❌ NIKDY "cD", "dVD", "uSB", "hDMI"

// #### Pravidla proti DUPLICITĚ (KRITICKY DŮLEŽITÉ)
// - Každou informaci uveď pouze JEDNOU a pouze pod JEDNÍM názvem parametru
// - ❌ ŠPATNĚ: "Typ produktu: DVD" + "Médium: DVD" + "Formát: DVD" (3× stejná info!)
// - ✅ SPRÁVNĚ: "Typ média: DVD" (jednou)
// - Pokud existuje obecnější název parametru, použij ho místo specifického
// - Příklady duplicit k VYHNUTÍ:
//   - "Typ produktu" vs "Typ média" vs "Médium" vs "Formát" → vyber JEDEN
//   - "Materiál" vs "Složení" → vyber podle kontextu

// #### Značka vs Výrobce (KRITICKY DŮLEŽITÉ!)
// - **"Značka"** = filtering parametr pro filtrování podle brandu
// - **"Výrobce"** = NEPOUŽÍVEJ jako samostatný parametr, pokud je stejný jako značka!
// - ❌ ŠPATNĚ: filtering: "Značka: Pure Integrity" + text: "Výrobce: Pure Integrity" (duplicita!)
// - ✅ SPRÁVNĚ: filtering: "Značka: Pure Integrity" (stačí jednou)
// - Výrobce uvádět POUZE pokud je JINÝ než značka (např. značka "iPhone", výrobce "Apple")

// #### Boolean hodnoty
// Místo "Konzervanty: ne" použij "Vlastnosti: bez konzervantů"
// Místo "BIO: ano" použij "Certifikace: BIO"

// #### Produktové varianty
// Pokud v popisu vidíš více variant produktu (např. "100 g" a "1 kg", nebo "S, M, L, XL"):
// - **NEEXTRAHUJ více hodnot** pro jeden parametr
// - Pro každý parametr vrať **pouze jednu hodnotu**
// - Pokud jsou varianty, extrahuj parametry **základního produktu**, ne jednotlivých variant
// - Varianty jsou obvykle na výběr a nepatří do parametrů produktu

// ## Limity
// - Maximální počet **filtering** parametrů: ${config.maxFilteringParams}
// - Maximální počet **text** parametrů: ${config.maxTextParams}
// - Pokud nelze extrahovat žádné relevantní parametry, vrať prázdná pole
// ${
//   config.productContext
//     ? `
// ## Kontext produktů (DŮLEŽITÉ)
// ${config.productContext}

// Tato informace ti pomůže lépe pochopit, o jaké produkty se jedná, a extrahovat relevantní parametry specifické pro toto odvětví.
// `
//     : ""
// }
// ## Konzistence napříč produkty (KRITICKY DŮLEŽITÉ)
// Při zpracování více produktů ze stejné kategorie:
// 1. Používej **identické názvy parametrů** – vždy "Objem" ne někdy "Velikost balení"
// 2. Používej **stejný formát hodnot** – vždy "250 ml" ne někdy "250ml" a jindy "0,25 l"
// 3. Extrahuj **stejné typy parametrů** – pokud u jednoho produktu extrahuješ barvu, extrahuj ji i u podobných produktů
// 4. **Stejný parametr = stejný typ (filtering NEBO text)** – NIKDY nemíchej!

// ### STEJNÉ PRODUKTY = STEJNÉ PARAMETRY (EXTRÉMNĚ DŮLEŽITÉ!)
// Všechny produkty stejného typu MUSÍ mít IDENTICKOU strukturu parametrů.

// **UNIVERZÁLNÍ PRAVIDLA:**
// 1. **Konzistentní sekce** – pokud parametr X je filtering u jednoho produktu, MUSÍ být filtering u VŠECH produktů
// 2. **Konzistentní názvy** – používej PŘESNĚ stejné názvy parametrů (žádné překlepy, synonyma)
// 3. **Konzistentní formát** – hodnoty ve stejném formátu ("250 ml" ne někdy "0,25 l")
// 4. Pokud parametr chybí v popisu, prostě ho nevytvářej – ale NIKDY ho nepřesouvej do jiné sekce!

// **ZAKÁZANÉ CHOVÁNÍ:**
// - ❌ Produkt A: filtering "Objem" / Produkt B: text "Objem" (míchání sekcí!)
// - ❌ Produkt A: "Počet kusů" / Produkt B: "Počet ks" (různé názvy!)
// - ❌ Produkt A: "250 ml" / Produkt B: "0,25 l" (různé formáty!)
// - ❌ Překlepy v názvech parametrů mezi produkty

// ### Pravidlo pro filtering vs text
// **Filtering** = hodnota je KRÁTKÁ a STANDARDIZOVANÁ (1-2 slova), vhodná pro filtr:
// - Původ: "Morava", "Čechy", "Francie" ✅
// - Barva: "červená", "bílá" ✅
// - Odrůda: "Ryzlink rýnský" ✅

// **Text** = hodnota je DLOUHÁ nebo SPECIFICKÁ (více slov, adresy, detaily):
// - Původ: "Gálovy sady, Velké Pavlovice" → příliš specifické pro filtr ❌
// - Složení: "100% bio hroznová šťáva z odrůdy..." → příliš dlouhé ❌

// ### Příklad pro parametr "Původ"
// Pokud vidíš různé formáty původu v produktech:
// - "Morava" → filtering: { "name": "Původ", "value": "Morava" }
// - "Gálovy sady, Velké Pavlovice" → text: { "key": "Vinařství", "value": "Gálovy sady, Velké Pavlovice" }
// - "tuzemské" → filtering: { "name": "Původ", "value": "tuzemské" }

// **Pravidlo:** Pokud hodnota obsahuje čárku, více slov než 2, nebo je to specifická adresa/název vinařství → použij TEXT.
// Pokud je to jednoduchý region/země → použij FILTERING.`;
// }

function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
  const parts: string[] = [];

  parts.push(`## Analyzuj následující produkt a extrahuj parametry:

---
${sourceText}
---`);

  // Add generation mode instruction
  if (config.generationMode === "strict") {
    parts.push(`
### REŽIM: Pouze zadané parametry
**DŮLEŽITÉ:** Extrahuj POUZE parametry, které jsou explicitně uvedeny níže. NEPŘIDÁVEJ žádné další parametry, i když je v textu najdeš. Pokud zadané parametry nejsou v textu zmíněny, vrať prázdná pole.`);
  } else {
    parts.push(`
### REŽIM: Rozšířený
Extrahuj zadané parametry a navíc můžeš přidat další relevantní parametry, které najdeš v textu produktu.`);
  }

  // Add specific instructions based on what user wants to extract
  if (config.generateFiltering && config.filteringInstructions) {
    parts.push(`
### Požadované FILTROVACÍ parametry (filtering)
Uživatel chce extrahovat tyto parametry pro filtry v e-shopu:
${config.filteringInstructions}

**Poznámka:** Extrahuj POUZE pokud jsou tyto informace explicitně zmíněny v textu. Nevymýšlej hodnoty.`);
  }

  if (config.generateTextProperties && config.textPropertyInstructions) {
    parts.push(`
### Požadované TEXTOVÉ parametry (text)
Uživatel chce extrahovat tyto informační specifikace:
${config.textPropertyInstructions}

**Poznámka:** Extrahuj POUZE pokud jsou tyto informace explicitně zmíněny v textu. Nevymýšlej hodnoty.`);
  }

  // If no specific instructions and expand mode, provide general guidance
  if (
    !config.filteringInstructions &&
    !config.textPropertyInstructions &&
    config.generationMode === "expand"
  ) {
    parts.push(`
### Obecné pokyny
Extrahuj relevantní parametry, které najdeš v textu:
- Do **filtering** zařaď: barva, materiál, velikost, značka, typ produktu
- Do **text** zařaď: rozměry, hmotnost, záruka, certifikace, návod k údržbě`);
  }

  parts.push(`
### Připomenutí formátu
- Název parametru: velké počáteční písmeno (např. "Materiál", "Objem")
- Hodnota: malé počáteční písmeno, krátká (např. "100% bavlna", "250 ml")
- Jednotky s mezerou (např. "500 g", "12 V")

**KRITICKY DŮLEŽITÉ - struktura JSON:**
- filtering: [{"name": "...", "value": "..."}]
- text: [{"key": "...", "value": "..."}] (použij "key", NE "name"!)

Vrať výsledek jako JSON objekt.`);

  return parts.join("\n");
}

// =============================================================================
// BACKUP: Previous version of buildSystemPrompt (v2 - 2024-01)
// =============================================================================
// function buildSystemPrompt_v2(config: EnrichmentConfig): string {
//   const maxFilters = config.maxFilteringParams || 15;
//   const maxText = config.maxTextParams || 20;
//   let categorySchemaSection = "";
//   if (config.existingAttributes && (config.existingAttributes.filtering.length > 0 || config.existingAttributes.text.length > 0)) {
//     categorySchemaSection = `## SCHEMA KATEGORIE...`; // truncated for brevity
//   }
//   return `# Role
// Jsi Senior Data Architect pro e-commerce platformu Shoptet...
// # CÍL
// Rozděl data do dvou klíčových sekcí:
// 1. **FILTERING** (Fasetová navigace): Data pro levé menu e-shopu.
// 2. **TEXT** (Technické parametry): Data pro tabulku pod produktem.
// ... (full version available in git history)`;
// }
// =============================================================================

// =============================================================================
// NEW VERSION (v3 - chain-of-thought) - COMMENTED OUT FOR TESTING
// =============================================================================
// function buildSystemPrompt_v3(config: EnrichmentConfig): string {
//   const maxFilters = config.maxFilteringParams || 15;
//   const maxText = config.maxTextParams || 20;
//
//   // Build category schema section if existingAttributes provided
//   let categorySchemaSection = "";
//   if (
//     config.existingAttributes &&
//     (config.existingAttributes.filtering.length > 0 ||
//       config.existingAttributes.text.length > 0)
//   ) {
//     categorySchemaSection = `
// ## SCHEMA KATEGORIE (POVINNÉ POUŽÍT)
// Kategorie "${config.categoryName || "Neznámá"}" již používá tyto parametry.
// **MUSÍŠ používat PŘESNĚ tyto názvy**, pokud odpovídají obsahu produktu.
//
// ${
//   config.existingAttributes.filtering.length > 0
//     ? `### Povolené FILTERING parametry:
// ${config.existingAttributes.filtering.map((f) => `- "${f}"`).join("\n")}
// `
//     : ""
// }
// ${
//   config.existingAttributes.text.length > 0
//     ? `### Povolené TEXT parametry:
// ${config.existingAttributes.text.map((t) => `- "${t}"`).join("\n")}
// `
//     : ""
// }
// ---
// `;
//   }
//
//   return `# ROLE
// Jsi Senior Data Architect pro e-commerce Shoptet. Extrahuješ strukturované parametry z produktových popisů.
//
// # VÝSTUPNÍ FORMÁT (Strict JSON)
// {
//   "filtering": [{"name": "NázevFiltru", "value": "hodnota"}],
//   "text": [{"key": "NázevParametru", "value": "Hodnota"}]
// }
//
// # DVĚ SEKCE - ROZDÍL
//
// | FILTERING | TEXT |
// |-----------|------|
// | Pro filtry v levém menu | Pro tabulku specifikací |
// | Max 1-3 slova | Může být delší |
// | Standardizované hodnoty | Specifické detaily |
// | Příklad: "Barva: modrá" | Příklad: "Rozměry: 120×80×45 cm" |
//
// ---
// ${categorySchemaSection}
// # PŘED ODPOVĚDÍ SE ZAMYSLI (Chain-of-Thought)
//
// 1. **Jaký typ produktu to je?**
//    - Potraviny/nápoje → Objem, Původ, Složení, Chuť
//    - Móda/oblečení → Materiál, Barva, Velikost, Střih
//    - Elektronika → Výkon, Připojení, Kompatibilita
//    - Kosmetika → Objem, Typ pleti, Vůně
//
// 2. **Co jsou FAKTA vs MARKETING?**
//    - FAKT: "100% bavlna" → extrahuj
//    - MARKETING: "luxusní kvalita" → IGNORUJ
//
// 3. **Je informace EXPLICITNĚ uvedena?**
//    - Ano → extrahuj
//    - Ne (jen odhaduji) → NEEXTRAHUJ
//
// 4. **Nekopíruji stejnou informaci do obou sekcí?**
//
// ---
//
// # KRITICKÁ PRAVIDLA
//
// ## 1. ATOMICITA (filtering)
// Každá hodnota = JEDNA entita.
// - ❌ "bavlna a elastan" → ✅ dva objekty: "bavlna", "elastan"
// - ❌ "červená/modrá" → ✅ dva objekty: "červená", "modrá"
//
// ## 2. ŽÁDNÉ VYMYŠLENÉ HODNOTY
// Extrahuj POUZE to, co je EXPLICITNĚ v textu.
// - ❌ Text: "Kvalitní tričko" → Materiál: "bavlna" (NEVÍME!)
// - ✅ Text: "Kvalitní tričko" → {} (prázdné - materiál neuveden)
//
// ## 3. ŽÁDNÝ MARKETING
// - ❌ "ideální na léto" → Sezóna: "léto"
// - ❌ "perfektní dárek" → (nic)
// - ✅ "letní kolekce 2024" → Sezóna: "léto", Kolekce: "2024"
//
// ## 4. ŽÁDNÉ DUPLICITY
// Informace buď ve filtering NEBO v text, ne v obou.
// - ❌ filtering: "Značka: Nike" + text: "Výrobce: Nike"
// - ✅ filtering: "Značka: Nike" (stačí)
//
// ## 5. FORMÁT HODNOT
// - Názvy: Velké První Písmeno ("Materiál", "Objem")
// - Hodnoty: malé písmeno ("bavlna", "250 ml")
// - Výjimka: vlastní jména ("Německo", "Samsung", "BIO")
// - Jednotky s mezerou: "500 g", "12 V", "250 ml"
//
// ---
//
// # ČASTÉ CHYBY (VYHNI SE!)
//
// ❌ **Vymyšlené hodnoty:**
// Vstup: "Elegantní šaty"
// Špatně: { "name": "Materiál", "value": "hedvábí" }
// Správně: {} // Materiál není uveden!
//
// ❌ **Celé věty jako hodnoty:**
// Vstup: "Vyrobeno z prémiové italské kůže"
// Špatně: { "name": "Materiál", "value": "prémiová italská kůže" }
// Správně: { "name": "Materiál", "value": "kůže" }, { "name": "Původ", "value": "Itálie" }
//
// ❌ **Více hodnot v jednom:**
// Vstup: "Dostupné v barvách červená, modrá, zelená"
// Špatně: { "name": "Barva", "value": "červená, modrá, zelená" }
// Správně: Tři objekty - jeden pro každou barvu
//
// ❌ **Boolean jako text:**
// Špatně: { "name": "BIO", "value": "ano" }
// Správně: { "name": "Certifikace", "value": "BIO" }
//
// ---
//
// # PRAVIDLA PODLE TYPU PRODUKTU
//
// ## POTRAVINY/NÁPOJE
// - Filtering: Chuť, Odrůda, Ročník, Původ (region), Certifikace
// - Text: Alergeny, Skladování, Složení, Párování
//
// ## MÓDA/OBLEČENÍ
// - Filtering: Materiál, Barva, Střih, Sezóna, Pohlaví
// - Text: Složení (%), Údržba, Rozměry tabulka
//
// ## ELEKTRONIKA
// - Filtering: Značka, Výkon, Připojení, Kompatibilita
// - Text: Rozměry, Hmotnost, Záruka, Obsah balení
//
// ## KOSMETIKA
// - Filtering: Typ pleti, Objem, Vůně, Certifikace
// - Text: Složení, Způsob použití, Účinky
//
// ---
//
// # PŘED ODESLÁNÍM ZKONTROLUJ
// □ Každá hodnota ve filtering má MAX 3 slova?
// □ Žádná hodnota neobsahuje čárku nebo " a "?
// □ Žádný parametr se neopakuje v obou sekcích?
// □ Všechny informace jsou EXPLICITNĚ v textu?
// □ Názvy začínají velkým písmenem?
// □ Hodnoty začínají malým písmenem (kromě vlastních jmen)?
//
// ---
//
// ## LIMITY
// - Max filtering: ${maxFilters}
// - Max text: ${maxText}
// ${config.productContext ? `\n## KONTEXT KATEGORIE:\n${config.productContext}` : ""}
// `;
// }
// =============================================================================

// =============================================================================
// BACKUP: Previous version of buildUserPrompt (v2 - 2024-01)
// =============================================================================
// function buildUserPrompt_v2(sourceText: string, config: EnrichmentConfig): string {
//   const parts: string[] = [];
//   parts.push(`## VSTUPNÍ DATA PRODUKTU`);
//   parts.push(`"""\n${sourceText}\n"""`);
//   if (config.generationMode === "strict") {
//     parts.push(`\n### MÓD: STRICT\nExtrahuj POUZE parametry explicitně uvedené v textu.`);
//   } else {
//     parts.push(`\n### MÓD: EXPAND\nExtrahuj parametry z textu a logicky odvoď chybějící standardní atributy.`);
//   }
//   // ... (full version available in git history)
//   return parts.join("\n");
// }
// =============================================================================

// =============================================================================
// NEW VERSION (v3 - with examples) - COMMENTED OUT FOR TESTING
// =============================================================================
// function buildUserPrompt_v3(sourceText: string, config: EnrichmentConfig): string {
//   const parts: string[] = [];
//
//   // 1. INPUT DATA
//   parts.push(`## VSTUPNÍ DATA PRODUKTU`);
//   parts.push(`"""
// ${sourceText}
// """`);
//
//   // 2. GENERATION MODE
//   if (config.generationMode === "strict") {
//     parts.push(`
// ### MÓD: STRICT
// ⚠️ Extrahuj POUZE parametry EXPLICITNĚ uvedené v textu.
// ⚠️ Pokud informace není v textu, NEVYMÝŠLEJ ji.
// ⚠️ Raději vrať méně parametrů, ale správných.`);
//   } else {
//     parts.push(`
// ### MÓD: EXPAND
// Extrahuj parametry z textu. Můžeš logicky odvodit zřejmé atributy (např. "dámské šaty" → Pohlaví: "dámské").
// Ale NEVYMÝŠLEJ specifické hodnoty jako materiál nebo barvu, pokud nejsou uvedeny.`);
//   }
//
//   // 3. USER INSTRUCTIONS
//   if (config.filteringInstructions) {
//     parts.push(`
// **Prioritní FILTERING parametry (od uživatele):**
// ${config.filteringInstructions}`);
//   }
//   if (config.textPropertyInstructions) {
//     parts.push(`
// **Prioritní TEXT parametry (od uživatele):**
// ${config.textPropertyInstructions}`);
//   }
//
//   // 4. FEW-SHOT EXAMPLES
//   parts.push(`... examples ...`);
//
//   // 5. CALL TO ACTION
//   parts.push(`
// ## TVŮJ ÚKOL
// Analyzuj vstupní data výše a vygeneruj JSON.
// Odpověz POUZE JSON objektem, žádný další text.`);
//
//   return parts.join("\n");
// }
// =============================================================================
