import { create } from "zustand";
import type {
  Platform,
  EnrichmentConfig,
  ParsedFileData,
  PreviewResult,
  ProcessingStatus,
  EnrichedRow,
  CategoryGroup,
  AIExtractionResult,
} from "@/lib/enrichment/types";

interface EnrichmentStore {
  // Step tracking (3 steps: Upload, Configure, Process)
  // Results editing is on a separate page
  currentStep: 1 | 2 | 3;

  // Step 1: Upload
  platform: Platform | null;
  file: File | null;
  parsedData: ParsedFileData | null;

  // Step 2: Configuration
  config: EnrichmentConfig;

  // Step 3: Preview (disabled)
  previewResults: PreviewResult | null;
  isPreviewLoading: boolean;

  // Step 3: Processing
  processingStatus: ProcessingStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  enrichedData: EnrichedRow[];
  errors: string[];

  // Step 4: Results
  categoryGroups: CategoryGroup[];
  selectedCategory: string | null;
  selectedProductIndex: number | null;

  // Actions
  setStep: (step: 1 | 2 | 3) => void;
  nextStep: () => void;
  prevStep: () => void;
  setPlatform: (platform: Platform) => void;
  setFile: (file: File | null) => void;
  setParsedData: (data: ParsedFileData | null) => void;
  setConfig: (config: Partial<EnrichmentConfig>) => void;
  setPreviewResults: (results: PreviewResult | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  updateProgress: (processed: number, total: number) => void;
  setEnrichedData: (data: EnrichedRow[]) => void;
  addError: (error: string) => void;
  reset: () => void;

  // Step 4 actions
  setCategoryGroups: (groups: CategoryGroup[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedProductIndex: (index: number | null) => void;
  updateProductParams: (
    rowIndex: number,
    params: AIExtractionResult
  ) => void;
  bulkRemoveParam: (
    categoryName: string,
    paramType: "filtering" | "text",
    paramName: string
  ) => void;
}

const initialConfig: EnrichmentConfig = {
  platform: "shoptet",
  generateFiltering: true,
  generateTextProperties: true,
  filteringInstructions: "",
  textPropertyInstructions: "",
  sourceColumns: ["name", "shortDescription", "description"],
  maxFilteringParams: 5,
  maxTextParams: 5,
  clearExistingProperties: true,
};

export const useEnrichmentStore = create<EnrichmentStore>()((set, get) => ({
  // Initial state
  currentStep: 1,
  platform: null,
  file: null,
  parsedData: null,
  config: initialConfig,
  previewResults: null,
  isPreviewLoading: false,
  processingStatus: "idle",
  progress: 0,
  totalRows: 0,
  processedRows: 0,
  enrichedData: [],
  errors: [],
  categoryGroups: [],
  selectedCategory: null,
  selectedProductIndex: null,

  // Actions
  setStep: (step) => set({ currentStep: step }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, 3) as 1 | 2 | 3,
    })),

  prevStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 1) as 1 | 2 | 3,
    })),

  setPlatform: (platform) =>
    set((state) => ({
      platform,
      config: { ...state.config, platform },
    })),

  setFile: (file) => set({ file }),

  setParsedData: (parsedData) =>
    set({
      parsedData,
      totalRows: parsedData?.totalRows ?? 0,
    }),

  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),

  setPreviewResults: (previewResults) => set({ previewResults }),

  setPreviewLoading: (isPreviewLoading) => set({ isPreviewLoading }),

  setProcessingStatus: (processingStatus) => set({ processingStatus }),

  updateProgress: (processedRows, totalRows) =>
    set({
      processedRows,
      totalRows,
      progress: totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0,
    }),

  setEnrichedData: (enrichedData) => set({ enrichedData }),

  addError: (error) =>
    set((state) => ({
      errors: [...state.errors, error],
    })),

  reset: () =>
    set({
      currentStep: 1,
      platform: null,
      file: null,
      parsedData: null,
      config: initialConfig,
      previewResults: null,
      isPreviewLoading: false,
      processingStatus: "idle",
      progress: 0,
      totalRows: 0,
      processedRows: 0,
      enrichedData: [],
      errors: [],
      categoryGroups: [],
      selectedCategory: null,
      selectedProductIndex: null,
    }),

  // Step 4 actions
  setCategoryGroups: (categoryGroups) => set({ categoryGroups }),

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setSelectedProductIndex: (selectedProductIndex) => set({ selectedProductIndex }),

  updateProductParams: (rowIndex, params) => {
    const { enrichedData, categoryGroups } = get();

    // Update enrichedData
    const updatedEnrichedData = enrichedData.map((row) =>
      row.rowIndex === rowIndex ? { ...row, aiResult: params } : row
    );

    // Update categoryGroups
    const updatedCategoryGroups = categoryGroups.map((group) => ({
      ...group,
      products: group.products.map((product) =>
        product.rowIndex === rowIndex ? { ...product, aiResult: params } : product
      ),
    }));

    set({
      enrichedData: updatedEnrichedData,
      categoryGroups: updatedCategoryGroups,
    });
  },

  bulkRemoveParam: (categoryName, paramType, paramName) => {
    const { enrichedData, categoryGroups } = get();

    // Find products in this category
    const categoryGroup = categoryGroups.find((g) => g.categoryName === categoryName);
    if (!categoryGroup) return;

    const productIndices = new Set(categoryGroup.products.map((p) => p.rowIndex));

    // Update enrichedData
    const updatedEnrichedData = enrichedData.map((row) => {
      if (!productIndices.has(row.rowIndex) || !row.aiResult) return row;

      const updatedAiResult = { ...row.aiResult };
      if (paramType === "filtering") {
        updatedAiResult.filtering = updatedAiResult.filtering.filter(
          (p) => p.name !== paramName
        );
      } else {
        updatedAiResult.text = updatedAiResult.text.filter((p) => p.key !== paramName);
      }

      return { ...row, aiResult: updatedAiResult };
    });

    // Update categoryGroups
    const updatedCategoryGroups = categoryGroups.map((group) => {
      if (group.categoryName !== categoryName) return group;

      const updatedProducts = group.products.map((product) => {
        if (!product.aiResult) return product;

        const updatedAiResult = { ...product.aiResult };
        if (paramType === "filtering") {
          updatedAiResult.filtering = updatedAiResult.filtering.filter(
            (p) => p.name !== paramName
          );
        } else {
          updatedAiResult.text = updatedAiResult.text.filter((p) => p.key !== paramName);
        }

        return { ...product, aiResult: updatedAiResult };
      });

      // Recalculate common params
      const allFilteringNames = new Set<string>();
      const allTextKeys = new Set<string>();
      updatedProducts.forEach((p) => {
        p.aiResult?.filtering.forEach((f) => allFilteringNames.add(f.name));
        p.aiResult?.text.forEach((t) => allTextKeys.add(t.key));
      });

      return {
        ...group,
        products: updatedProducts,
        commonParams: {
          filtering: Array.from(allFilteringNames),
          text: Array.from(allTextKeys),
        },
      };
    });

    set({
      enrichedData: updatedEnrichedData,
      categoryGroups: updatedCategoryGroups,
    });
  },
}));
