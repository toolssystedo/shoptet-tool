"use client";

import { useState } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { runPreview } from "../actions";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { PreviewComparison } from "./preview-comparison";
import type { ProductRow } from "@/lib/enrichment/types";

export function StepPreview() {
  const {
    parsedData,
    config,
    previewResults,
    setPreviewResults,
    isPreviewLoading,
    setPreviewLoading,
    nextStep,
    prevStep,
  } = useEnrichmentStore();

  const [sampleRows, setSampleRows] = useState<ProductRow[]>([]);

  const getRandomSampleRows = (): ProductRow[] => {
    if (!parsedData?.rows.length) return [];

    const rows = [...parsedData.rows];
    const sampleSize = Math.min(3, rows.length);
    const sampled: ProductRow[] = [];

    // Random sampling
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * rows.length);
      sampled.push(rows.splice(randomIndex, 1)[0]);
    }

    return sampled;
  };

  const handleRunPreview = async () => {
    const samples = sampleRows.length > 0 ? sampleRows : getRandomSampleRows();

    if (samples.length === 0) {
      toast.error("No rows available for preview");
      return;
    }

    setSampleRows(samples);
    setPreviewLoading(true);
    setPreviewResults(null);

    try {
      const result = await runPreview(samples, config);
      setPreviewResults(result);

      if (result.success) {
        toast.success("Preview completed successfully");
      } else {
        toast.warning(
          `Preview completed with ${result.errors.length} error(s)`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run preview"
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleNewSample = async () => {
    setSampleRows([]);
    const newSamples = getRandomSampleRows();
    setSampleRows(newSamples);
    setPreviewLoading(true);
    setPreviewResults(null);

    try {
      const result = await runPreview(newSamples, config);
      setPreviewResults(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run preview"
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const canContinue = previewResults?.success;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">AI Preview</h3>
        <p className="text-sm text-muted-foreground">
          Test the AI extraction on a sample of 3 random rows before processing
          the entire file.
        </p>
      </div>

      {/* Preview Info */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Configuration Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Total Rows:</span>
            <span className="ml-2">{parsedData?.totalRows || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Mode:</span>
            <span className="ml-2">
              {[
                config.generateFiltering && "Filtering",
                config.generateTextProperties && "Text Properties",
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Source:</span>
            <span className="ml-2">{config.sourceColumns.join(", ")}</span>
          </div>
        </div>
      </div>

      {/* Run Preview Button */}
      {!previewResults && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleRunPreview}
            disabled={isPreviewLoading}
          >
            {isPreviewLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Preview...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Run Test Preview
              </>
            )}
          </Button>
        </div>
      )}

      {/* Preview Results */}
      {previewResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Preview Results</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSample}
              disabled={isPreviewLoading}
            >
              {isPreviewLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Try Different Rows
            </Button>
          </div>

          <PreviewComparison
            originalRows={previewResults.originalRows}
            enrichedRows={previewResults.enrichedRows}
          />

          {/* Errors Summary */}
          {previewResults.errors && previewResults.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="font-medium text-destructive mb-2">
                Errors Occurred
              </p>
              <ul className="text-sm text-destructive/90 list-disc list-inside">
                {previewResults.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                You may want to adjust your instructions and try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Configure
        </Button>
        <Button onClick={nextStep} disabled={!canContinue}>
          Process All Rows
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Warning if preview has errors */}
      {previewResults && !previewResults.success && (
        <p className="text-sm text-center text-muted-foreground">
          Fix the errors above before continuing, or{" "}
          <button
            onClick={nextStep}
            className="text-primary hover:underline"
          >
            continue anyway
          </button>{" "}
          if you want to proceed with potential issues.
        </p>
      )}
    </div>
  );
}
