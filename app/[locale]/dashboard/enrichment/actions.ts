"use server";

import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { getPlatformAdapter } from "@/lib/enrichment/platform-adapter";
import type {
  ParsedFileData,
  ValidationResult,
  ProductRow,
  EnrichmentConfig,
  EnrichedRow,
  AIExtractionResult,
} from "@/lib/enrichment/types";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { aiExtractionResultSchema } from "@/lib/enrichment/types";

/**
 * Parse uploaded file and validate its structure
 */
export async function parseFile(formData: FormData): Promise<{
  validation: ValidationResult;
  data: ParsedFileData;
}> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("file") as File;
  const platform = formData.get("platform") as string;

  if (!file) {
    throw new Error("No file provided");
  }

  if (!platform) {
    throw new Error("No platform specified");
  }

  const adapter = getPlatformAdapter(platform);

  // Read file content
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with headers
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false, // Convert all values to strings
  });

  // Clean _x000d_ characters (carriage returns from Windows Excel)
  const cleanedData = rawData.map((row) => {
    const cleanRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string") {
        cleanRow[key] = value
          .replace(/_x000d_/g, "")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");
      } else {
        cleanRow[key] = value;
      }
    }
    return cleanRow;
  });

  if (cleanedData.length === 0) {
    return {
      validation: {
        valid: false,
        errors: ["Soubor neobsahuje žádná data"],
        warnings: [],
      },
      data: {
        headers: [],
        rows: [],
        totalRows: 0,
        fileName: file.name,
      },
    };
  }

  // Get headers from first row
  const headers = Object.keys(cleanedData[0]);

  // Validate file structure
  const validation = adapter.validateFile(headers, cleanedData.slice(0, 5));

  // Parse rows
  const rows: ProductRow[] = cleanedData.map((row, index) =>
    adapter.parseRow(row, index)
  );

  return {
    validation,
    data: {
      headers,
      rows,
      totalRows: rows.length,
      fileName: file.name,
    },
  };
}

/**
 * Run AI preview on sample rows
 */
export async function runPreview(
  sampleRows: ProductRow[],
  config: EnrichmentConfig
): Promise<{
  originalRows: ProductRow[];
  enrichedRows: EnrichedRow[];
  success: boolean;
  errors: string[];
}> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const adapter = getPlatformAdapter(config.platform);
  const enrichedRows: EnrichedRow[] = [];
  const errors: string[] = [];

  for (const row of sampleRows) {
    try {
      const sourceText = adapter.getSourceText(row, config);

      if (!sourceText.trim()) {
        enrichedRows.push({
          ...row,
          error: "No source text available for this row",
        });
        continue;
      }

      const aiResult = await extractWithAI(sourceText, config);
      enrichedRows.push({
        ...row,
        aiResult,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI extraction failed";
      errors.push(`Row ${row.rowIndex}: ${errorMessage}`);
      enrichedRows.push({
        ...row,
        error: errorMessage,
      });
    }
  }

  return {
    originalRows: sampleRows,
    enrichedRows,
    success: errors.length === 0,
    errors,
  };
}

/**
 * Process a single row with AI
 */
export async function processRow(
  row: ProductRow,
  config: EnrichmentConfig
): Promise<EnrichedRow> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const adapter = getPlatformAdapter(config.platform);
  const sourceText = adapter.getSourceText(row, config);

  if (!sourceText.trim()) {
    return {
      ...row,
      error: "No source text available",
    };
  }

  try {
    const aiResult = await extractWithAI(sourceText, config);
    return {
      ...row,
      aiResult,
    };
  } catch (error) {
    return {
      ...row,
      error: error instanceof Error ? error.message : "AI extraction failed",
    };
  }
}

/**
 * Extract structured data using AI
 */
async function extractWithAI(
  sourceText: string,
  config: EnrichmentConfig
): Promise<AIExtractionResult> {
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(sourceText, config);

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: aiExtractionResultSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return object;
}

/**
 * Build system prompt for AI
 */
// function buildSystemPrompt(config: EnrichmentConfig): string {
//   return `Jsi asistent pro extrakci produktových dat. Tvým úkolem je analyzovat popisy produktů a extrahovat strukturované atributy.

// Musíš vrátit JSON objekt se dvěma poli:
// - "filtering": Pole objektů s klíči "name" a "value" (MALÁ písmena!) - pro produktové filtry
// - "text": Pole objektů s klíči "key" a "value" (MALÁ písmena!) - pro textové vlastnosti

// PŘESNÝ FORMÁT (KRITICKY DŮLEŽITÉ - použij PŘESNĚ tyto názvy klíčů):
// - filtering: [{ "name": "Barva", "value": "modrá" }]
// - text: [{ "key": "Vůně", "value": "meruňka" }]
// POZOR: Klíče "name", "key", "value" musí být s MALÝM počátečním písmenem!

// DŮLEŽITÁ PRAVIDLA:
// 1. Extrahuj POUZE informace, které jsou EXPLICITNĚ zmíněny v textu
// 2. NEVYMÝŠLEJ a nepředpokládej hodnoty
// 3. Používej PŘESNĚ názvy vlastností, které uživatel specifikoval
// 4. Hodnoty musí být STRUČNÉ - maximálně 1-3 slova (např. "modrá", "100% bavlna", "XL")
// 5. NIKDY nepoužívej celé věty nebo popisy jako hodnoty
// 6. NIKDY nepoužívej "description" nebo "popis" jako název parametru
// 7. Pokud vlastnost nelze najít, NEZAHRNUJ ji do výstupu
// 8. Vrať prázdná pole, pokud nejsou nalezeny žádné relevantní informace
// 9. Maximálně ${config.maxFilteringParams} filtrovacích vlastností
// 10. Maximálně ${config.maxTextParams} textových vlastností
// 11. Všechny hodnoty musí být v ČEŠTINĚ

// PRAVIDLA KONZISTENCE (VELMI DŮLEŽITÉ):
// 12. Názvy parametrů VŽDY piš s VELKÝM počátečním písmenem (např. "Barva", "Vůně", "Objem")
// 13. Hodnoty parametrů piš s MALÝM počátečním písmenem, pokud nejde o vlastní jméno (např. "modrá", "meruňka", "vanilka")
// 14. Používej jednotné číslo a základní tvar slova v 1. pádě (např. "meruňka" NE "meruňky" nebo "meruněk")
// 15. Pro vůně/aroma používej jednoslovné názvy v základním tvaru: "meruňka", "vanilka", "levandule"
// 16. Pro barvy používej jednoslovné názvy: "modrá", "červená", "zelená"
// 17. Pro objem/hmotnost VŽDY uváděj s jednotkou: "100 ml", "250 g", "1 l"
// 18. Extrahuj STEJNÉ parametry pro podobné produkty - pokud má jeden produkt parametr "Vůně", musí ho mít i podobný produkt
// 19. Počet extrahovaných parametrů by měl být konzistentní pro podobné produkty ve stejné kategorii`;
// }

/**
 * Build user prompt for AI
 */
// function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
//   const parts: string[] = [];

//   parts.push("Analyzuj následující popis produktu a extrahuj atributy:\n");
//   parts.push(`---\n${sourceText}\n---\n`);

//   if (config.generateFiltering && config.filteringInstructions) {
//     parts.push(
//       `\nExtrahuj tyto FILTROVACÍ vlastnosti (pro produktové filtry, max ${config.maxFilteringParams}):\n${config.filteringInstructions}`
//     );
//     parts.push("\nPříklad správného formátu: { name: 'Barva', value: 'Modrá' }");
//   }

//   if (config.generateTextProperties && config.textPropertyInstructions) {
//     parts.push(
//       `\nExtrahuj tyto TEXTOVÉ vlastnosti (pro informační zobrazení, max ${config.maxTextParams}):\n${config.textPropertyInstructions}`
//     );
//     parts.push("\nPříklad správného formátu: { key: 'Záruka', value: '2 roky' }");
//   }

//   if (!config.filteringInstructions && !config.textPropertyInstructions) {
//     parts.push(
//       `\nExtrahuj relevantní produktové atributy, které najdeš. Rozděl je na filtrovací vlastnosti (barva, velikost, materiál - max ${config.maxFilteringParams}) nebo textové vlastnosti (záruka, péče, specifikace - max ${config.maxTextParams}).`
//     );
//   }

//   parts.push(`

// DŮLEŽITÉ PRO KONZISTENCI:
// - Názvy parametrů s VELKÝM počátečním písmenem: "Barva", "Vůně", "Objem"
// - Hodnoty s MALÝM písmenem v základním tvaru: "modrá", "meruňka", "vanilka"
// - Objem vždy s jednotkou: "100 ml", "250 g"
// - Hodnoty musí být krátké (1-3 slova), v češtině, pouze z textu!`);

//   return parts.join("\n");
// }

// function buildSystemPrompt(config: EnrichmentConfig): string {
//   return `Jsi expert na e-commerce data. Tvým úkolem je extrahovat parametry produktů do strukturovaného JSON.

// STRUKTURA:
// {
//   "filtering": [{"name": "Parametr", "value": "hodnota"}],
//   "text": [{"key": "Parametr", "value": "hodnota"}]
// }

// ZÁKLADNÍ PRAVIDLA FORMÁTU:
// 1. Název (name/key): VŽDY začíná VELKÝM písmenem (např. "Materiál", "Objem", "Kompatibilita").
// 2. Hodnota (value): VŽDY začíná MALÝM písmenem (např. "100% bavlna", "černá"), pokud nejde o vlastní jméno, značku nebo specifické označení (např. "Apple", "v8", "ISO 9001").
// 3. Jednotky: VŽDY s mezerou (např. "500 g", "12 V", "20 l").

// UNIVERZÁLNÍ LOGIKA EXTRAKCE:
// 1. PRINCIP SETU: Pokud je produktem sada (box, set, balení více kusů), neextrahuj parametry jednotlivě (např. 3 různé objemy). Vytvoř parametr "Obsah balení" (nebo "Složení setu") a uveď výčet produktů jako hodnotu.
// 2. KONZISTENCE KATEGORIÍ: Pokud extrahuješ parametry pro více podobných produktů, používej identické názvy klíčů.
//    - Např. pro alkohol vždy "Obsah alkoholu", nikoliv jednou "Voltáž" a podruhé "Alk.".
//    - Pro rozměry vždy "Rozměry", nikoliv "Velikost" u jednoho a "Délka x šířka" u druhého.
// 3. LOGIKA ODVĚTVÍ:
//    - POTRAVINY: Místo "Vůně" u jídla použij "Chuť". Místo "Barva" (pokud není klíčová) se zaměř na "Složení" nebo "Původ".
//    - MÓDA: Zaměř se na "Materiál", "Střih", "Velikost".
//    - TECHNIKA/AUTO: Zaměř se na "Napětí", "Výkon", "Kompatibilita", "Typ motoru".
// 4. ELIMINACE BALASTU: Neextrahuj subjektivní nebo zřejmé věci (např. u sušeného ovoce není barva "oranžová" užitečný parametr, pokud to není klíčová vlastnost).
// 5. BOOLEAN HODNOTY: Místo "Konzervanty: ne" piš "Vlastnosti: bez konzervantů".

// MAXIMÁLNÍ POČET:
// - Filtering: ${config.maxFilteringParams}
// - Text: ${config.maxTextParams}`;
// }

function buildSystemPrompt(config: EnrichmentConfig): string {
  return `Jsi expert na e-commerce data. Tvým úkolem je extrahovat parametry produktů do strukturovaného JSON.

STRUKTURA:
{
  "filtering": [{"name": "Parametr", "value": "hodnota"}],
  "text": [{"key": "Parametr", "value": "hodnota"}]
}

ZÁKLADNÍ PRAVIDLA FORMÁTU:
1. Název (name/key): VŽDY začíná VELKÝM písmenem (např. "Materiál", "Objem", "Kompatibilita").
2. Hodnota (value): VŽDY začíná MALÝM písmenem (např. "100% bavlna", "černá"), pokud nejde o vlastní jméno, značku nebo specifické označení (např. "Apple", "v8", "ISO 9001").
3. Jednotky: VŽDY s mezerou (např. "500 g", "12 V", "20 l").

UNIVERZÁLNÍ LOGIKA EXTRAKCE:
1. PRINCIP SETU: Pokud je produktem sada (box, set, balení více kusů), neextrahuj parametry jednotlivě (např. 3 různé objemy). Vytvoř parametr "Obsah balení" (nebo "Složení setu") a uveď výčet produktů jako hodnotu.
2. KONZISTENCE KATEGORIÍ: Pokud extrahuješ parametry pro více podobných produktů, používej identické názvy klíčů. 
   - Např. pro alkohol vždy "Obsah alkoholu", nikoliv jednou "Voltáž" a podruhé "Alk.".
   - Pro rozměry vždy "Rozměry", nikoliv "Velikost" u jednoho a "Délka x šířka" u druhého.
3. LOGIKA ODVĚTVÍ:
   - POTRAVINY: Místo "Vůně" u jídla použij "Chuť". Místo "Barva" (pokud není klíčová) se zaměř na "Složení" nebo "Původ".
   - MÓDA: Zaměř se na "Materiál", "Střih", "Velikost".
   - TECHNIKA/AUTO: Zaměř se na "Napětí", "Výkon", "Kompatibilita", "Typ motoru".
4. ELIMINACE BALASTU: Neextrahuj subjektivní nebo zřejmé věci (např. u sušeného ovoce není barva "oranžová" užitečný parametr, pokud to není klíčová vlastnost).
5. BOOLEAN HODNOTY: Místo "Konzervanty: ne" piš "Vlastnosti: bez konzervantů".

MAXIMÁLNÍ POČET:
- Filtering: ${config.maxFilteringParams}
- Text: ${config.maxTextParams}`;
}

function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
  const parts: string[] = [];

  parts.push(`Analyzuj produkt a extrahuj klíčové specifikace:
---
${sourceText}
---`);

  parts.push(`
POKYNY PRO ZPRACOVÁNÍ:
1. IDENTIFIKACE: Urči, co je to za produkt. Pokud je to dárkový box nebo sada, seskup informace o obsahu do jednoho parametru "Obsah balení".
2. NORMALIZACE: 
   - Názvy parametrů: Velké počáteční písmeno.
   - Hodnoty: Malé počáteční písmeno, jednotné číslo (pokud lze), základní tvar.
3. RELEVANCE: Extrahuj jen to, co by zákazník hledal ve filtrech nebo technických specifikacích. Vyhni se obecným popisům.
4. JEDNOTNOST: Pokud vidíš v textu hodnoty jako "48% obj." a u jiného produktu "48 %", sjednoť to na "48 % obj.".

Příklady správné transformace:
- "Džemy: jahoda, meruňka, hruška" -> Name: "Příchuť", Value: "jahoda, meruňka, hruška"
- "0,5l láhev" -> Name: "Objem", Value: "0,5 l"
- "48% alkoholu" -> Name: "Obsah alkoholu", Value: "48 % obj."
- "Materiál je 100% Bavlna" -> Name: "Materiál", Value: "100% bavlna"
`);

  if (config.filteringInstructions) {
    parts.push(
      `Upřednostni tyto FILTROVACÍ parametry: ${config.filteringInstructions}`
    );
  }

  if (config.textPropertyInstructions) {
    parts.push(
      `Upřednostni tyto TEXTOVÉ parametry: ${config.textPropertyInstructions}`
    );
  }

  parts.push("\nVrať výsledek v JSON formátu.");

  return parts.join("\n");
}

/**
 * Generate output file from enriched data
 */
export async function generateOutputFile(
  originalData: ParsedFileData,
  enrichedRows: EnrichedRow[],
  config: EnrichmentConfig
): Promise<{ base64: string; filename: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const adapter = getPlatformAdapter(config.platform);
  const outputData = adapter.formatOutput(originalData, enrichedRows, config);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(outputData);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Enriched Data");

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

  // Generate filename
  const baseName = originalData.fileName.replace(/\.[^/.]+$/, "");
  const filename = `${baseName}_enriched.xlsx`;

  return { base64: buffer, filename };
}
