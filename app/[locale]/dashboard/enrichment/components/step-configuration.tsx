"use client";

import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SourceColumn, GenerationMode } from "@/lib/enrichment/types";
import { useTranslations } from "next-intl";

// Source column IDs for iteration
const SOURCE_COLUMN_IDS: SourceColumn[] = [
  "name",
  "shortDescription",
  "description",
  "weight",
  "warranty",
  "manufacturer",
  "supplier",
];

const HEADER_MATCHES: Record<SourceColumn, string> = {
  name: "name",
  shortDescription: "shortdescription",
  description: "description",
  weight: "weight",
  warranty: "warranty",
  manufacturer: "manufacturer",
  supplier: "supplier",
};

export function StepConfiguration() {
  const { config, setConfig, nextStep, prevStep, parsedData } =
    useEnrichmentStore();

  const t = useTranslations("enrichment.configuration");
  const tCommon = useTranslations("common");

  const toggleSourceColumn = (column: SourceColumn) => {
    const current = config.sourceColumns;
    const newColumns = current.includes(column)
      ? current.filter((c) => c !== column)
      : [...current, column];

    // Ensure at least one column is selected
    if (newColumns.length > 0) {
      setConfig({ sourceColumns: newColumns });
    }
  };

  // In strict mode, require instructions for enabled generation types
  const hasRequiredInstructions = () => {
    if (config.generationMode === "expand") {
      // In expand mode, AI can suggest parameters even without instructions
      return true;
    }
    // In strict mode, at least one of the enabled types must have instructions
    const filteringOk = !config.generateFiltering || config.filteringInstructions.trim().length > 0;
    const textOk = !config.generateTextProperties || config.textPropertyInstructions.trim().length > 0;

    // At least one must have instructions if that type is enabled
    if (config.generateFiltering && config.generateTextProperties) {
      return filteringOk || textOk; // At least one must have instructions
    }
    return filteringOk && textOk; // The enabled one must have instructions
  };

  const canContinue =
    (config.generateFiltering || config.generateTextProperties) &&
    config.sourceColumns.length > 0 &&
    hasRequiredInstructions();

  // Check which columns exist in the file
  const availableColumns = new Set(
    parsedData?.headers.map((h) => h.toLowerCase()) || []
  );

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("extractionMode")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("extractionModeDescription")}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="filtering"
              checked={config.generateFiltering}
              onCheckedChange={(checked) =>
                setConfig({ generateFiltering: !!checked })
              }
            />
            <div className="space-y-1">
              <Label htmlFor="filtering" className="font-medium cursor-pointer">
                {t("generateFiltering")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("generateFilteringDescription")}
                {" "}
                <code className="bg-muted px-1 rounded">
                  filteringProperty:Barva
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="textProperties"
              checked={config.generateTextProperties}
              onCheckedChange={(checked) =>
                setConfig({ generateTextProperties: !!checked })
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="textProperties"
                className="font-medium cursor-pointer"
              >
                {t("generateTextProperties")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("generateTextPropertiesDescription")}
                {" "}
                <code className="bg-muted px-1 rounded">Key;Value</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Limits */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("limits")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("limitsDescription")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {config.generateFiltering && (
            <div className="space-y-2">
              <Label htmlFor="maxFiltering">{t("maxFiltering")}</Label>
              <Input
                id="maxFiltering"
                type="number"
                min={1}
                max={20}
                value={config.maxFilteringParams}
                onChange={(e) =>
                  setConfig({ maxFilteringParams: parseInt(e.target.value) || 5 })
                }
                className="w-24"
              />
            </div>
          )}

          {config.generateTextProperties && (
            <div className="space-y-2">
              <Label htmlFor="maxText">{t("maxText")}</Label>
              <Input
                id="maxText"
                type="number"
                min={1}
                max={20}
                value={config.maxTextParams}
                onChange={(e) =>
                  setConfig({ maxTextParams: parseInt(e.target.value) || 5 })
                }
                className="w-24"
              />
            </div>
          )}
        </div>
      </div>

      {/* Clear existing properties */}
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="clearExisting"
            checked={config.clearExistingProperties}
            onCheckedChange={(checked) =>
              setConfig({ clearExistingProperties: !!checked })
            }
          />
          <div className="space-y-1">
            <Label htmlFor="clearExisting" className="font-medium cursor-pointer">
              {t("clearExisting")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("clearExistingDescription")}
            </p>
          </div>
        </div>
      </div>

      {/* Product Context */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("productContext")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("productContextDescription")}
          </p>
        </div>

        <div className="space-y-2">
          <Textarea
            id="productContext"
            placeholder={t("productContextPlaceholder")}
            value={config.productContext}
            onChange={(e) => setConfig({ productContext: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("extractionInstructions")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("extractionInstructionsDescription")}
          </p>
        </div>

        {config.generateFiltering && (
          <div className="space-y-2">
            <Label htmlFor="filteringInstructions">
              {t("filteringInstructions")}
            </Label>
            <Textarea
              id="filteringInstructions"
              placeholder={t("filteringInstructionsPlaceholder")}
              value={config.filteringInstructions}
              onChange={(e) =>
                setConfig({ filteringInstructions: e.target.value })
              }
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("filteringInstructionsDescription")}
            </p>
          </div>
        )}

        {config.generateTextProperties && (
          <div className="space-y-2">
            <Label htmlFor="textPropertyInstructions">
              {t("textInstructions")}
            </Label>
            <Textarea
              id="textPropertyInstructions"
              placeholder={t("textInstructionsPlaceholder")}
              value={config.textPropertyInstructions}
              onChange={(e) =>
                setConfig({ textPropertyInstructions: e.target.value })
              }
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("textInstructionsDescription")}
            </p>
          </div>
        )}
      </div>

      {/* Generation Mode */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("generationMode")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("generationModeDescription")}
          </p>
        </div>

        <RadioGroup
          value={config.generationMode}
          onValueChange={(value) => setConfig({ generationMode: value as GenerationMode })}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="strict" id="strict" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="strict" className="font-medium cursor-pointer">
                {t("generationModeStrict")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("generationModeStrictDescription")}
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="expand" id="expand" className="mt-1" />
            <div className="space-y-1">
              <Label htmlFor="expand" className="font-medium cursor-pointer">
                {t("generationModeExpand")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("generationModeExpandDescription")}
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Source Column Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("sourceColumns")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("sourceColumnsDescription")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOURCE_COLUMN_IDS.map((colId) => {
            const exists = availableColumns.has(HEADER_MATCHES[colId]);
            return (
              <div key={colId} className="flex items-center space-x-3">
                <Checkbox
                  id={colId}
                  checked={config.sourceColumns.includes(colId)}
                  onCheckedChange={() => toggleSourceColumn(colId)}
                  disabled={!exists}
                />
                <Label
                  htmlFor={colId}
                  className={!exists ? "text-muted-foreground" : "cursor-pointer"}
                >
                  {t(`columns.${colId}`)}
                  {!exists && ` (${t("notFound")})`}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      {/* Warning when strict mode but no instructions */}
      {config.generationMode === "strict" && !hasRequiredInstructions() && (
        <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-sm">
          {t("strictModeRequiresInstructions")}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("back")}
        </Button>
        <Button onClick={nextStep} disabled={!canContinue}>
          {t("startProcessing")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
