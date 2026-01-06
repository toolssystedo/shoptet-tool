import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdapter } from "@/lib/enrichment/platform-adapter";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
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
        const batchSize = 5;
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

          // Small delay between batches to avoid rate limiting
          if (i + batchSize < rows.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
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
      model: openai("gpt-4o-mini"),
      schema: aiExtractionResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return object;
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

// function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
//   const parts: string[] = [];

//   parts.push("Analyzuj následující popis produktu a extrahuj atributy:\n");
//   parts.push(`---\n${sourceText}\n---\n`);

//   if (config.generateFiltering && config.filteringInstructions) {
//     parts.push(
//       `\nExtrahuj tyto FILTROVACÍ vlastnosti (pro produktové filtry, max ${config.maxFilteringParams}):\n${config.filteringInstructions}`
//     );
//     parts.push(
//       "\nPříklad správného formátu: { name: 'Barva', value: 'Modrá' }"
//     );
//   }

//   if (config.generateTextProperties && config.textPropertyInstructions) {
//     parts.push(
//       `\nExtrahuj tyto TEXTOVÉ vlastnosti (pro informační zobrazení, max ${config.maxTextParams}):\n${config.textPropertyInstructions}`
//     );
//     parts.push(
//       "\nPříklad správného formátu: { key: 'Záruka', value: '2 roky' }"
//     );
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
