import type { PlatformAdapter } from "./platform-adapter";
import type {
  ValidationResult,
  ProductRow,
  EnrichedRow,
  EnrichmentConfig,
  ParsedFileData,
} from "./types";
import {
  SHOPTET_REQUIRED_HEADERS,
  SHOPTET_FILTERING_PREFIX,
  SHOPTET_TEXT_PROPERTY_PREFIX,
} from "./types";

/**
 * Shoptet Platform Adapter
 * Implements file processing logic specific to Shoptet e-commerce exports
 */
export class ShoptetAdapter implements PlatformAdapter {
  readonly platform = "shoptet";

  /**
   * Validates Shoptet file structure
   * Required headers: shortDescription, description, textProperty
   */
  validateFile(
    headers: string[],
    sampleRows: Record<string, unknown>[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers
    for (const required of SHOPTET_REQUIRED_HEADERS) {
      const found = normalizedHeaders.some(
        (h) => h === required.toLowerCase() || h.startsWith(required.toLowerCase())
      );
      if (!found) {
        errors.push(`Chybí povinná hlavička: ${required}`);
      }
    }

    // Check if file has data
    if (sampleRows.length === 0) {
      errors.push("Soubor neobsahuje žádné datové řádky");
    }

    // Check how many rows have no text content at all
    const emptyRowsCount = sampleRows.filter((row) => {
      const hasShortDesc = row.shortDescription && String(row.shortDescription).trim();
      const hasDesc = row.description && String(row.description).trim();
      const hasName = row.name && String(row.name).trim();
      return !hasShortDesc && !hasDesc && !hasName;
    }).length;

    if (emptyRowsCount > 0) {
      const percentage = Math.round((emptyRowsCount / sampleRows.length) * 100);
      if (emptyRowsCount === sampleRows.length) {
        errors.push(
          "Všechny řádky jsou bez textového obsahu (shortDescription, description, name). AI extrakce nebude fungovat."
        );
      } else if (percentage > 50) {
        warnings.push(
          `${emptyRowsCount} z ${sampleRows.length} řádků (${percentage}%) nemá textový obsah. Tyto produkty nebudou obohaceny.`
        );
      }
    }

    // Warnings for potential issues
    const hasFilteringColumns = headers.some((h) =>
      h.startsWith(SHOPTET_FILTERING_PREFIX)
    );
    if (hasFilteringColumns) {
      warnings.push(
        "Soubor již obsahuje filteringProperty sloupce. Tyto budou vymazány a nahrazeny novými."
      );
    }

    const hasTextPropertyColumns = headers.some((h) =>
      h.startsWith(SHOPTET_TEXT_PROPERTY_PREFIX)
    );
    if (hasTextPropertyColumns) {
      warnings.push(
        "Soubor již obsahuje textProperty sloupce. Tyto budou vymazány a nahrazeny novými."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      headers,
      rowCount: sampleRows.length,
    };
  }

  /**
   * Parses a raw row into ProductRow format
   */
  parseRow(rawRow: Record<string, unknown>, rowIndex: number): ProductRow {
    const row: ProductRow = { rowIndex };

    for (const [key, value] of Object.entries(rawRow)) {
      const normalizedKey = key.trim();
      if (value !== undefined && value !== null) {
        row[normalizedKey] = String(value);
      }
    }

    return row;
  }

  /**
   * Formats enriched data back to Shoptet export format
   */
  formatOutput(
    originalData: ParsedFileData,
    enrichedRows: EnrichedRow[],
    config: EnrichmentConfig
  ): Record<string, unknown>[] {
    const output: Record<string, unknown>[] = [];

    // Identify columns to clear if clearExistingProperties is true
    const columnsToSkip = new Set<string>();
    if (config.clearExistingProperties) {
      for (const header of originalData.headers) {
        if (header.startsWith(SHOPTET_FILTERING_PREFIX)) {
          columnsToSkip.add(header);
        }
        if (header.startsWith(SHOPTET_TEXT_PROPERTY_PREFIX)) {
          columnsToSkip.add(header);
        }
      }
    }

    // Create output rows
    for (const enrichedRow of enrichedRows) {
      const outputRow: Record<string, unknown> = {};

      // Copy original values (except columns to clear)
      for (const header of originalData.headers) {
        if (columnsToSkip.has(header)) {
          outputRow[header] = ""; // Clear existing property columns
        } else {
          outputRow[header] = enrichedRow[header] ?? "";
        }
      }

      // Add filtering properties
      if (config.generateFiltering && enrichedRow.aiResult?.filtering) {
        // Limit to max params
        const filteringProps = enrichedRow.aiResult.filtering.slice(0, config.maxFilteringParams);
        for (const prop of filteringProps) {
          const columnName = `${SHOPTET_FILTERING_PREFIX}${prop.name}`;
          outputRow[columnName] = prop.value;
        }
      }

      // Add text properties starting from textProperty
      if (config.generateTextProperties && enrichedRow.aiResult?.text) {
        // Limit to max params
        const textProps = enrichedRow.aiResult.text.slice(0, config.maxTextParams);
        let textPropertyIndex = 1;

        for (const prop of textProps) {
          const columnName =
            textPropertyIndex === 1
              ? SHOPTET_TEXT_PROPERTY_PREFIX
              : `${SHOPTET_TEXT_PROPERTY_PREFIX}${textPropertyIndex}`;

          outputRow[columnName] = `${prop.key};${prop.value}`;
          textPropertyIndex++;
        }
      }

      output.push(outputRow);
    }

    return output;
  }

  /**
   * Gets source text for AI processing
   * Combines selected columns into a structured text for AI analysis
   */
  getSourceText(row: ProductRow, config: EnrichmentConfig): string {
    const parts: string[] = [];

    // Product name - important context
    if (config.sourceColumns.includes("name") && row.name) {
      parts.push(`Název produktu: ${row.name}`);
    }

    // Short description
    if (config.sourceColumns.includes("shortDescription") && row.shortDescription) {
      parts.push(`Krátký popis: ${row.shortDescription}`);
    }

    // Full description
    if (config.sourceColumns.includes("description") && row.description) {
      parts.push(`Popis: ${row.description}`);
    }

    // Weight - useful for physical products
    if (config.sourceColumns.includes("weight") && row.weight) {
      parts.push(`Hmotnost: ${row.weight}`);
    }

    // Warranty info
    if (config.sourceColumns.includes("warranty") && row.warranty) {
      parts.push(`Záruka: ${row.warranty}`);
    }

    // Manufacturer
    if (config.sourceColumns.includes("manufacturer") && row.manufacturer) {
      parts.push(`Výrobce: ${row.manufacturer}`);
    }

    // Supplier
    if (config.sourceColumns.includes("supplier") && row.supplier) {
      parts.push(`Dodavatel: ${row.supplier}`);
    }

    return parts.join("\n\n");
  }

  /**
   * Finds the next available textProperty column index
   * Returns 1 for "textProperty", 2 for "textProperty2", etc.
   */
  findNextTextPropertyColumn(row: ProductRow | EnrichedRow, headers: string[]): number {
    let index = 1;

    while (true) {
      const columnName =
        index === 1
          ? SHOPTET_TEXT_PROPERTY_PREFIX
          : `${SHOPTET_TEXT_PROPERTY_PREFIX}${index}`;

      // Check if this column exists and has a value
      const existsInHeaders = headers.includes(columnName);
      const hasValue = row[columnName] && String(row[columnName]).trim() !== "";

      if (!existsInHeaders || !hasValue) {
        return index;
      }

      index++;

      // Safety limit
      if (index > 100) {
        return index;
      }
    }
  }

  /**
   * Gets existing filtering property columns from headers
   */
  getExistingFilteringColumns(headers: string[]): string[] {
    return headers.filter((h) => h.startsWith(SHOPTET_FILTERING_PREFIX));
  }
}
