import type {
  ValidationResult,
  ProductRow,
  EnrichedRow,
  EnrichmentConfig,
  ParsedFileData,
} from "./types";

/**
 * Platform Adapter Interface
 * Defines the contract for platform-specific file processing logic.
 * Implement this interface for each supported platform (Shoptet, UpGates, etc.)
 */
export interface PlatformAdapter {
  /**
   * Platform identifier
   */
  readonly platform: string;

  /**
   * Validates the uploaded file structure
   * Checks for required headers and data format
   */
  validateFile(headers: string[], sampleRows: Record<string, unknown>[]): ValidationResult;

  /**
   * Parses a raw row from the file into a ProductRow
   */
  parseRow(rawRow: Record<string, unknown>, rowIndex: number): ProductRow;

  /**
   * Formats the enriched data back into the output format
   * Handles dynamic column creation and value formatting
   */
  formatOutput(
    originalData: ParsedFileData,
    enrichedRows: EnrichedRow[],
    config: EnrichmentConfig
  ): Record<string, unknown>[];

  /**
   * Gets the source text for AI processing based on configuration
   */
  getSourceText(row: ProductRow, config: EnrichmentConfig): string;

  /**
   * Finds the next available text property column index for a row
   */
  findNextTextPropertyColumn(row: ProductRow | EnrichedRow, headers: string[]): number;

  /**
   * Gets all existing filtering property columns from headers
   */
  getExistingFilteringColumns(headers: string[]): string[];
}

/**
 * Factory function to get the appropriate adapter for a platform
 */
export function getPlatformAdapter(platform: string): PlatformAdapter {
  switch (platform) {
    case "shoptet":
      // Import dynamically to avoid circular dependencies
      const { ShoptetAdapter } = require("./shoptet-adapter");
      return new ShoptetAdapter();
    // case "upgates":
    //   const { UpGatesAdapter } = require("./upgates-adapter");
    //   return new UpGatesAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
