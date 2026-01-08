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
  SHOPTET_ALLOWED_COLUMNS,
} from "./types";

/**
 * Shoptet Platform Adapter
 * Implements file processing logic specific to Shoptet e-commerce exports
 */
export class ShoptetAdapter implements PlatformAdapter {
  readonly platform = "shoptet";

  /**
   * Validates Shoptet file structure
   * Required headers: name, shortDescription, description
   */
  validateFile(
    headers: string[],
    sampleRows: Record<string, unknown>[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required headers
    for (const required of SHOPTET_REQUIRED_HEADERS) {
      const found = headers.some(
        (h) => h.toLowerCase() === required.toLowerCase()
      );
      if (!found) {
        errors.push(`Chybí povinná hlavička: ${required}`);
      }
    }

    // Check for unknown columns (not in allowed list and not special prefixes)
    const unknownColumns: string[] = [];
    for (const header of headers) {
      const isAllowed = SHOPTET_ALLOWED_COLUMNS.some(
        (allowed) => header.toLowerCase() === allowed.toLowerCase()
      );
      const isFilteringProperty = header.startsWith(SHOPTET_FILTERING_PREFIX);
      const isTextProperty = header.toLowerCase().startsWith(SHOPTET_TEXT_PROPERTY_PREFIX.toLowerCase());

      if (!isAllowed && !isFilteringProperty && !isTextProperty) {
        unknownColumns.push(header);
      }
    }

    if (unknownColumns.length > 0) {
      errors.push(
        `Soubor obsahuje nepovolené sloupce: ${unknownColumns.join(", ")}. Prosím, exportujte pouze povolené sloupce ze Shoptetu.`
      );
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

    if (emptyRowsCount > 0 && sampleRows.length > 0) {
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

    // Info about existing columns
    const hasFilteringColumns = headers.some((h) =>
      h.startsWith(SHOPTET_FILTERING_PREFIX)
    );
    if (hasFilteringColumns) {
      warnings.push(
        "Soubor již obsahuje filteringProperty sloupce. Nové hodnoty budou přidány k existujícím."
      );
    }

    const hasTextPropertyColumns = headers.some((h) =>
      h.startsWith(SHOPTET_TEXT_PROPERTY_PREFIX)
    );
    if (hasTextPropertyColumns) {
      warnings.push(
        "Soubor již obsahuje textProperty sloupce. Nové hodnoty budou přidány k existujícím."
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

    // Get existing filtering columns
    const existingFilteringColumns = originalData.headers.filter((h) =>
      h.startsWith(SHOPTET_FILTERING_PREFIX)
    );

    // Create output rows
    for (const enrichedRow of enrichedRows) {
      const outputRow: Record<string, unknown> = {};

      // Copy all original values (keep existing properties)
      for (const header of originalData.headers) {
        outputRow[header] = enrichedRow[header] ?? "";
      }

      // Add new filtering properties (with unique column names)
      if (config.generateFiltering && enrichedRow.aiResult?.filtering) {
        const filteringProps = enrichedRow.aiResult.filtering.slice(0, config.maxFilteringParams);
        for (const prop of filteringProps) {
          const columnName = `${SHOPTET_FILTERING_PREFIX}${prop.name}`;
          // Only add if this column doesn't exist or is empty
          if (!existingFilteringColumns.includes(columnName) || !outputRow[columnName]) {
            outputRow[columnName] = prop.value;
          }
        }
      }

      // Add new text properties starting from first available index
      if (config.generateTextProperties && enrichedRow.aiResult?.text) {
        const textProps = enrichedRow.aiResult.text.slice(0, config.maxTextParams);

        // Find the next available textProperty index
        let textPropertyIndex = this.findNextTextPropertyColumn(enrichedRow, originalData.headers);

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
