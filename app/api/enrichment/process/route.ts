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

function buildSystemPrompt(config: EnrichmentConfig): string {
  return `# Role
Jsi zkušený e-commerce specialista na produktová data pro český trh. Tvým úkolem je analyzovat popisy produktů a extrahovat strukturované parametry, které budou použity pro filtry a specifikace v e-shopu na platformě Shoptet.

## Vstup
Dostaneš:
- **Název produktu** (name)
- **Krátký popis** (shortDescription) – stručné shrnutí produktu
- **Dlouhý popis** (description) – detailní informace, specifikace, vlastnosti
- Případně další údaje (hmotnost, výrobce, dodavatel, záruka)

### Formát vstupního popisu
Popis produktu může být:
- **Čistý text** – prostý text bez formátování
- **HTML** – obsahuje tagy jako \`<ul>\`, \`<li>\`, \`<p>\`, \`<strong>\`, \`<br>\` apod.

Pokud je popis v HTML, interpretuj obsah správně:
- \`<li>\` položky čti jako jednotlivé vlastnosti/specifikace
- \`<strong>\` nebo \`<b>\` značí důležité informace
- Ignoruj inline styly a zaměř se na obsah

## Výstup
Vrať JSON objekt se dvěma poli:
\`\`\`json
{
  "filtering": [{"name": "Parametr", "value": "hodnota"}],
  "text": [{"key": "Parametr", "value": "hodnota"}]
}
\`\`\`

### Rozdíl mezi filtering a text
- **filtering** = parametry pro FILTRY v e-shopu (barva, velikost, materiál, značka) – zákazník podle nich vybírá produkty
- **text** = informační SPECIFIKACE produktu (záruka, rozměry, údržba, certifikace) – detaily zobrazené na kartě produktu

## Pravidla formátování (DŮLEŽITÉ)

### Názvy parametrů (name/key)
1. **Vždy s VELKÝM počátečním písmenem** – "Materiál", "Objem", "Barva"
2. **Jednotný tvar** – používej stejné názvy pro stejné typy parametrů napříč produkty
3. **Bez zkratek** – "Obsah alkoholu" nikoliv "Alk."

### Hodnoty parametrů (value)
1. **S MALÝM počátečním písmenem** – "modrá", "100% bavlna", "nerezová ocel"
2. **Výjimka**: Vlastní jména, značky, certifikace – "Apple", "ISO 9001", "Samsung"
3. **Jednotky vždy s mezerou** – "500 g", "12 V", "250 ml", "48 % obj."
4. **Jednotné číslo, základní tvar** – "meruňka" ne "meruňky", "bavlna" ne "bavlny"
5. **Krátké hodnoty** – max 3-4 slova, žádné celé věty

### Příklady správného formátu
✅ Správně:
- { "name": "Materiál", "value": "100% bavlna" }
- { "name": "Objem", "value": "250 ml" }
- { "name": "Obsah alkoholu", "value": "48 % obj." }
- { "name": "Barva", "value": "tmavě modrá" }
- { "key": "Záruka", "value": "24 měsíců" }

❌ Špatně:
- { "name": "materiál", "value": "Bavlna" } – malé písmeno v názvu, velké v hodnotě
- { "name": "Objem", "value": "250ml" } – chybí mezera před jednotkou
- { "name": "Popis", "value": "Tento produkt je vyroben z kvalitního materiálu..." } – celá věta

## Pravidla extrakce (KRITICKY DŮLEŽITÉ)

### Co extrahovat
1. **Pouze EXPLICITNĚ zmíněné informace** – nikdy si nevymýšlej hodnoty
2. **Objektivní, měřitelné vlastnosti** – materiál, rozměry, objem, hmotnost, barva
3. **Technické specifikace** – výkon, napětí, kapacita, kompatibilita
4. **Certifikace a standardy** – BIO, Vegan, ISO, CE

### Co NEEXTRAHOVAT
1. **Subjektivní hodnocení** – "kvalitní", "nejlepší", "luxusní"
2. **Marketingové fráze** – "ideální pro", "perfektní na", "skvělý dárek"
3. **Zřejmé informace** – barva oranžová u pomeranče, mokrý efekt u vody
4. **Celé věty nebo popisy** – hodnota musí být krátká a konkrétní

### Speciální případy

#### Sady a balení
Pokud je produkt sada/box/set více položek:
- Vytvoř parametr "Obsah balení" nebo "Složení setu"
- Hodnota = výčet položek (např. "3× sprchový gel, 2× šampon")
- Neextrahuj parametry jednotlivých položek zvlášť

#### Rozpoznání kategorie produktu
Přizpůsob extrakci typu produktu:
- **POTRAVINY/NÁPOJE**: Chuť, Složení, Původ, Obsah alkoholu, Hmotnost
- **MÓDA/OBLEČENÍ**: Materiál, Střih, Velikost, Barva, Sezóna
- **KOSMETIKA**: Typ pleti, Objem, Složení, Vůně, Účinek
- **TECHNIKA/ELEKTRONIKA**: Výkon, Napětí, Rozměry, Kompatibilita, Připojení
- **AUTO-MOTO**: Typ motoru, Objem, Kompatibilita s modelem, Materiál

#### Boolean hodnoty
Místo "Konzervanty: ne" použij "Vlastnosti: bez konzervantů"
Místo "BIO: ano" použij "Certifikace: BIO"

## Limity
- Maximální počet **filtering** parametrů: ${config.maxFilteringParams}
- Maximální počet **text** parametrů: ${config.maxTextParams}
- Pokud nelze extrahovat žádné relevantní parametry, vrať prázdná pole

## Konzistence napříč produkty
Při zpracování více produktů ze stejné kategorie:
1. Používej **identické názvy parametrů** – vždy "Objem" ne někdy "Velikost balení"
2. Používej **stejný formát hodnot** – vždy "250 ml" ne někdy "250ml" a jindy "0,25 l"
3. Extrahuj **stejné typy parametrů** – pokud u jednoho produktu extrahuješ barvu, extrahuj ji i u podobných produktů`;
}

function buildUserPrompt(sourceText: string, config: EnrichmentConfig): string {
  const parts: string[] = [];

  parts.push(`## Analyzuj následující produkt a extrahuj parametry:

---
${sourceText}
---`);

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

  // If no specific instructions, provide general guidance
  if (!config.filteringInstructions && !config.textPropertyInstructions) {
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

Vrať výsledek jako JSON objekt.`);

  return parts.join("\n");
}
