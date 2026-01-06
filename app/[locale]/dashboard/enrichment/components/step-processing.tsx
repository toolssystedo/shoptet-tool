"use client";

import { useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
} from "lucide-react";
import type { EnrichedRow } from "@/lib/enrichment/types";
import { groupByCategory } from "@/lib/enrichment/category-utils";
import { useTranslations } from "next-intl";

export function StepProcessing() {
  const router = useRouter();
  const {
    parsedData,
    config,
    processingStatus,
    setProcessingStatus,
    progress,
    processedRows,
    totalRows,
    updateProgress,
    enrichedData,
    setEnrichedData,
    setCategoryGroups,
    errors,
    addError,
    prevStep,
  } = useEnrichmentStore();

  const t = useTranslations("enrichment.processing");
  const tCommon = useTranslations("common");

  const [processingComplete, setProcessingComplete] = useState(false);

  const startProcessing = useCallback(async () => {
    if (!parsedData?.rows.length) {
      toast.error(t("noData"));
      return;
    }

    setProcessingStatus("processing");
    updateProgress(0, parsedData.rows.length);
    setProcessingComplete(false);

    try {
      const response = await fetch("/api/enrichment/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: parsedData.rows,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(t("processingFailed"));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(t("readError"));
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                updateProgress(data.processed, data.total);
              } else if (data.type === "complete") {
                const enrichedRows = data.enrichedRows as EnrichedRow[];
                setEnrichedData(enrichedRows);
                updateProgress(data.total, data.total);
                setProcessingStatus("completed");
                setProcessingComplete(true);

                // Group products by category
                const groups = groupByCategory(enrichedRows);
                setCategoryGroups(groups);

                const errorCount = enrichedRows.filter(
                  (r: EnrichedRow) => r.error
                ).length;

                if (errorCount > 0) {
                  toast.warning(t("completedWithErrors", { count: errorCount }));
                } else {
                  toast.success(t("completedSuccess"));
                }
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
          }
        }
      }
    } catch (error) {
      setProcessingStatus("error");
      const errorMessage =
        error instanceof Error ? error.message : t("processingFailed");
      addError(errorMessage);
      toast.error(errorMessage);
    }
  }, [
    parsedData,
    config,
    setProcessingStatus,
    updateProgress,
    setEnrichedData,
    setCategoryGroups,
    addError,
    t,
  ]);

  const handleContinue = () => {
    router.push("/dashboard/enrichment/results");
  };

  const errorCount = enrichedData.filter((r) => r.error).length;
  const successCount = enrichedData.length - errorCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("description", { count: parsedData?.totalRows || 0 })}
        </p>
      </div>

      {/* Not Started State */}
      {processingStatus === "idle" && (
        <div className="text-center py-8">
          <div className="mb-6">
            <div className="bg-muted/50 rounded-lg p-6 inline-block">
              <p className="text-2xl font-bold">{parsedData?.totalRows || 0}</p>
              <p className="text-muted-foreground">{t("rowsToProcess")}</p>
            </div>
          </div>
          <Button size="lg" onClick={startProcessing}>
            <Play className="mr-2 h-5 w-5" />
            {t("startProcessing")}
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            {t("processingNote")}
          </p>
        </div>
      )}

      {/* Processing State */}
      {processingStatus === "processing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-lg font-medium">{t("processing")}</span>
          </div>

          <Progress value={progress} className="h-3" />

          <div className="text-center text-muted-foreground">
            {t("processed", { processed: processedRows, total: totalRows })} ({progress}%)
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground text-center">
            {t("keepWindowOpen")}
          </div>
        </div>
      )}

      {/* Completed State */}
      {processingStatus === "completed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <span className="text-xl font-medium">{t("complete")}</span>
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{enrichedData.length}</p>
              <p className="text-sm text-muted-foreground">{t("totalProcessed")}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-sm text-muted-foreground">{t("successful")}</p>
            </div>
            <div
              className={`rounded-lg p-4 text-center ${
                errorCount > 0 ? "bg-destructive/10" : "bg-muted/50"
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  errorCount > 0 ? "text-destructive" : ""
                }`}
              >
                {errorCount}
              </p>
              <p className="text-sm text-muted-foreground">{t("errorsLabel")}</p>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-center">
            <Button size="lg" onClick={handleContinue}>
              {t("continueToEdit")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Errors List */}
          {errorCount > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="font-medium text-destructive mb-2">
                {t("errors", { count: errorCount })}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 mt-3">
                {enrichedData
                  .filter((r) => r.error)
                  .slice(0, 10)
                  .map((r) => (
                    <p key={r.rowIndex} className="text-sm text-destructive/80 font-mono">
                      {r.error}
                    </p>
                  ))}
                {errorCount > 10 && (
                  <p className="text-sm text-muted-foreground italic mt-2">
                    {t("andMoreErrors", { count: errorCount - 10 })}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-destructive/20">
                {t("errorsIncluded")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {processingStatus === "error" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <span className="text-xl font-medium text-destructive">
              {t("failed")}
            </span>
          </div>

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <ul className="text-sm text-destructive list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => setProcessingStatus("idle")}>
              {t("tryAgain")}
            </Button>
            <Button variant="outline" onClick={prevStep}>
              {t("goBack")}
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={processingStatus === "processing"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("back")}
        </Button>

        {processingStatus === "completed" && (
          <Button onClick={handleContinue}>
            {tCommon("continue")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
