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

export const maxDuration = 300; // 5 minutes max for batch processing

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
        // Reduced to 3 to help with rate limiting (30k tokens/min on basic plans)
        const batchSize = 3;
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

          // Delay between batches to avoid rate limiting (2 seconds)
          if (i + batchSize < rows.length) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
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

async function extractWithAI(
  sourceText: string,
  config: EnrichmentConfig
): Promise<AIExtractionResult> {
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(sourceText, config);

  try {
    const { object } = await generateObject({
      // Using Haiku for cost efficiency (~10-15x cheaper than Sonnet)
      // Sonnet: $3/$15 per 1M tokens, Haiku: $0.25/$1.25 per 1M tokens
      model: anthropic("claude-3-5-haiku-20241022"),
      schema: aiExtractionResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Post-process AI output to fix common issues
    return sanitizeAiOutput(object);
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
 * Helper: Lowercase first letter (except proper nouns, brands, certifications)
 */
function lowercaseFirst(str: string): string {
  if (!str) return str;

  // List of exceptions that should keep their capitalization
  const exceptions = [
    // Brands & Certifications
    "BIO",
    "ISO",
    "CE",
    "EU",
    "USA",
    "ČR",
    // Common proper nouns in Czech e-commerce
    "Morava",
    "Čechy",
    "Praha",
    "Brno",
    // Countries
    "Česká republika",
    "Francie",
    "Itálie",
    "Španělsko",
    "Německo",
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
 * Post-processing function to sanitize AI output.
 * Fixes common issues like:
 * - Multiple values in one string (split by comma or " a ")
 * - Capitalization inconsistencies
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

  // Normalize capitalization for filtering params
  const normalizedFiltering = cleanFiltering.map((item) => ({
    name: capitalizeFirst(item.name.trim()),
    value: lowercaseFirst(item.value.trim()),
  }));

  // Normalize capitalization for text params
  const normalizedText = aiJson.text
    .filter((item) => item.key && item.value) // Skip empty
    .map((item) => ({
      key: capitalizeFirst(item.key.trim()),
      value: item.value.trim(), // Keep original case for text values (can be longer descriptions)
    }));

  return {
    filtering: normalizedFiltering,
    text: normalizedText,
  };
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
// 2. **Výjimka**: Vlastní jména, značky, certifikace – "Apple", "ISO 9001", "Samsung"
// 3. **Jednotky vždy s mezerou** – "500 g", "12 V", "250 ml", "48 % obj."
// 4. **Jednotné číslo, základní tvar** – "meruňka" ne "meruňky", "bavlna" ne "bavlny"
// 5. **Krátké hodnoty** – max 3-4 slova, žádné celé věty

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
// ${config.productContext ? `
// ## Kontext produktů (DŮLEŽITÉ)
// ${config.productContext}

// Tato informace ti pomůže lépe pochopit, o jaké produkty se jedná, a extrahovat relevantní parametry specifické pro toto odvětví.
// ` : ""}
// ## Konzistence napříč produkty (KRITICKY DŮLEŽITÉ)
// Při zpracování více produktů ze stejné kategorie:
// 1. Používej **identické názvy parametrů** – vždy "Objem" ne někdy "Velikost balení"
// 2. Používej **stejný formát hodnot** – vždy "250 ml" ne někdy "250ml" a jindy "0,25 l"
// 3. Extrahuj **stejné typy parametrů** – pokud u jednoho produktu extrahuješ barvu, extrahuj ji i u podobných produktů
// 4. **Stejný parametr = stejný typ (filtering NEBO text)** – NIKDY nemíchej!

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

function buildSystemPrompt(config: EnrichmentConfig): string {
  // Определяем лимиты заранее
  const maxFilters = config.maxFilteringParams || 15;
  const maxText = config.maxTextParams || 20;

  // Build category schema section if existingAttributes provided
  let categorySchemaSection = "";
  if (
    config.existingAttributes &&
    (config.existingAttributes.filtering.length > 0 ||
      config.existingAttributes.text.length > 0)
  ) {
    categorySchemaSection = `
## SCHEMA KATEGORIE (KRITICKY DŮLEŽITÉ)
Tato kategorie "${config.categoryName || "Neznámá"}" již používá níže uvedené parametry.
**MUSÍŠ používat PŘESNĚ tyto názvy parametrů**, pokud odpovídají obsahu produktu.

${
  config.existingAttributes.filtering.length > 0
    ? `### Povolené FILTERING parametry:
${config.existingAttributes.filtering.map((f) => `- "${f}"`).join("\n")}

Používej POUZE tyto názvy pro filtering. Pokud chceš přidat nový filtr, který není v seznamu, nejprve zvaž, zda ho nelze namapovat na existující.
`
    : ""
}
${
  config.existingAttributes.text.length > 0
    ? `### Povolené TEXT parametry:
${config.existingAttributes.text.map((t) => `- "${t}"`).join("\n")}

Pro textové parametry také preferuj tyto názvy, ale můžeš přidat nové, pokud jsou specifické pro tento produkt.
`
    : ""
}
---
`;
  }

  return `# Role
Jsi Senior Data Architect pro e-commerce platformu Shoptet. Tvou specializací je čištění a strukturování produktových dat.
Tvým úkolem je převést nestrukturovaný text na čistý JSON objekt rozdělený na "Filtry" (pro strojové hledání) a "Parametry" (pro lidské čtení).

# CÍL
Rozděl data do dvou klíčových sekcí:
1. **FILTERING** (Fasetová navigace): Data pro levé menu e-shopu. Musí být atomická, standardizovaná a krátká.
2. **TEXT** (Technické parametry): Data pro tabulku pod produktem. Specifické, detailní informace.

# VÝSTUPNÍ FORMÁT (Strict JSON)
Odpověz POUZE validním JSON objektem. Žádný markdown, žádný úvodní text.
{
  "filtering": [{"name": "NázevFiltru", "value": "hodnota"}],
  "text": [{"key": "NázevParametru", "value": "Hodnota"}]
}

---
${categorySchemaSection}
# LOGICKÁ PRAVIDLA (Závazná)

## 1. Pravidlo ATOMICITY (Pro Filtering)
Hodnota ve filtru MUSÍ být jedna entita.
- ❌ Špatně: "Bavlna a Elastan", "Červená/Modrá"
- ✅ Správně: Vytvoř dva objekty. Jeden pro "Bavlna", druhý pro "Elastan".

## 2. Pravidlo EXKLUZIVITY (Proti duplicitám)
To je kritické: **Neopakuj stejnou informaci v "text" sekci, pokud už je ve "filtering", ledaže by to přinášelo nový kontext.**
- Příklad chyby: Filtering "Značka: Adidas" A ZÁROVEŇ Text "Výrobce: Adidas". -> Toto je redundance. Nech jen Značku.
- Příklad správně: Filtering "Značka: Gálovy sady" A Text "Vinařská obec: Velké Pavlovice". (Různé informace).

## 3. Hierarchie entit (Značka vs. Výrobce)
Pokud narazíš na název firmy/výrobce:
1. Primárně to dej do **FILTERING** pod názvem "Značka".
2. Do **TEXT** to dej pouze tehdy, pokud jde o specifický detail (např. "Distributor", "Vinařství" ve smyslu konkrétní trati), který se liší od Značky.

## 4. Standardizace hodnot
- **Barvy:** Vždy základní spektrum (Smaragdová -> "zelená").
- **Země:** Pouze substantiva (Česká -> "Česká republika").
- **Boolean:** Převeď na vlastnost (Bio: Ano -> "Vlastnosti: bio").
- **Velikost písmen:**
   - Názvy (name/key): Vždy Velké První Písmeno (např. "Materiál").
   - Hodnoty (value): Vždy malé písmeno, pokud nejde o vlastní jméno (např. "bavlna", ale "Německo").

## LIMITY
- Max položek ve filtering: ${maxFilters}
- Max položek v text: ${maxText}
${config.productContext ? `\n## KONTEXT KATEGORIE:\n${config.productContext}` : ""}
`;
}

function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
  const parts: string[] = [];

  // 1. ZADÁNÍ
  parts.push(`## VSTUPNÍ DATA PRODUKTU`);
  parts.push(`"""\n${sourceText}\n"""`);

  // 2. REŽIM GENEROVÁNÍ
  if (config.generationMode === "strict") {
    parts.push(
      `\n### MÓD: STRICT\nExtrahuj POUZE parametry explicitně uvedené v textu. Nevymýšlej si.`
    );
  } else {
    parts.push(
      `\n### MÓD: EXPAND\nExtrahuj parametry z textu a logicky odvoď chybějící standardní atributy (např. typ produktu), je-li to zřejmé.`
    );
  }

  // 3. SPECIFICKÉ INSTRUKCE OD UŽIVATELE
  if (config.filteringInstructions) {
    parts.push(
      `\n**Priority pro FILTERING:**\n${config.filteringInstructions}`
    );
  }
  if (config.textPropertyInstructions) {
    parts.push(`\n**Priority pro TEXT:**\n${config.textPropertyInstructions}`);
  }

  // 4. MENTAL MODEL (Few-Shot) - Opravený pro řešení проблемы дублирования
  parts.push(`
---
### PŘÍKLAD SPRÁVNÉHO MYŠLENÍ (Mental Model)

**Vstup:**
"Exkluzivní víno z vinařství Gálovy sady. Odrůda Pálava, ročník 2021. Obsahuje siřičitany. Vhodné k asijské kuchyni a sýrům."

**Analýza:**
1. "Gálovy sady" je výrobce -> Jde do FILTERING jako "Značka". NEBUDU to dávat znovu do Text jako "Vinařství" (duplicita).
2. "Pálava" -> Odrůda (Filtering).
3. "asijské kuchyni a sýrům" -> Dvě hodnoty, musím rozdělit.

**Výstup JSON:**
{
  "filtering": [
    { "name": "Značka", "value": "Gálovy sady" },
    { "name": "Odrůda", "value": "Pálava" },
    { "name": "Ročník", "value": "2021" },
    { "name": "Párování", "value": "asijská kuchyně" },
    { "name": "Párování", "value": "sýry" }
  ],
  "text": [
    { "key": "Alergeny", "value": "oxid siřičitý" }
  ]
}
---
`);

  // 5. VÝZVA K AKCI
  parts.push(`
Nyní analyzuj vstupní data a vygeneruj JSON.
Dbej na to, aby ve "filtering" nebyly čárky (rozděl to) a aby se **data neopakovala** zbytečně v obou sekcích.
`);

  return parts.join("\n");
}

// function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
//   const parts: string[] = [];

//   parts.push(`## Analyzuj následující produkt a extrahuj parametry:

// ---
// ${sourceText}
// ---`);

//   // Add generation mode instruction
//   if (config.generationMode === "strict") {
//     parts.push(`
// ### REŽIM: Pouze zadané parametry
// **DŮLEŽITÉ:** Extrahuj POUZE parametry, které jsou explicitně uvedeny níže. NEPŘIDÁVEJ žádné další parametry, i když je v textu najdeš. Pokud zadané parametry nejsou v textu zmíněny, vrať prázdná pole.`);
//   } else {
//     parts.push(`
// ### REŽIM: Rozšířený
// Extrahuj zadané parametry a navíc můžeš přidat další relevantní parametry, které najdeš v textu produktu.`);
//   }

//   // Add specific instructions based on what user wants to extract
//   if (config.generateFiltering && config.filteringInstructions) {
//     parts.push(`
// ### Požadované FILTROVACÍ parametry (filtering)
// Uživatel chce extrahovat tyto parametry pro filtry v e-shopu:
// ${config.filteringInstructions}

// **Poznámka:** Extrahuj POUZE pokud jsou tyto informace explicitně zmíněny v textu. Nevymýšlej hodnoty.`);
//   }

//   if (config.generateTextProperties && config.textPropertyInstructions) {
//     parts.push(`
// ### Požadované TEXTOVÉ parametry (text)
// Uživatel chce extrahovat tyto informační specifikace:
// ${config.textPropertyInstructions}

// **Poznámka:** Extrahuj POUZE pokud jsou tyto informace explicitně zmíněny v textu. Nevymýšlej hodnoty.`);
//   }

//   // If no specific instructions and expand mode, provide general guidance
//   if (
//     !config.filteringInstructions &&
//     !config.textPropertyInstructions &&
//     config.generationMode === "expand"
//   ) {
//     parts.push(`
// ### Obecné pokyny
// Extrahuj relevantní parametry, které najdeš v textu:
// - Do **filtering** zařaď: barva, materiál, velikost, značka, typ produktu
// - Do **text** zařaď: rozměry, hmotnost, záruka, certifikace, návod k údržbě`);
//   }

//   parts.push(`
// ### Připomenutí formátu
// - Název parametru: velké počáteční písmeno (např. "Materiál", "Objem")
// - Hodnota: malé počáteční písmeno, krátká (např. "100% bavlna", "250 ml")
// - Jednotky s mezerou (např. "500 g", "12 V")

// **KRITICKY DŮLEŽITÉ - struktura JSON:**
// - filtering: [{"name": "...", "value": "..."}]
// - text: [{"key": "...", "value": "..."}] (použij "key", NE "name"!)

// Vrať výsledek jako JSON objekt.`);

//   return parts.join("\n");
// }
