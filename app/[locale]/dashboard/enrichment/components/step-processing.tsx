"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  StopCircle,
  AlertTriangle,
  Info,
  Calculator,
} from "lucide-react";
import type { EnrichedRow, ProductRow } from "@/lib/enrichment/types";
import { groupByCategory } from "@/lib/enrichment/category-utils";
import { useTranslations } from "next-intl";

// Constants for timeouts
const FETCH_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes total (for large files)
const STREAM_IDLE_TIMEOUT_MS = 120 * 1000; // 120 seconds without data = stalled

// Pre-flight check constants
const ROW_LIMIT_WARNING = 200; // Show warning above this
const ROW_LIMIT_HARD = 5000; // Soft limit - show strong warning but allow processing

// Token estimation constants (approximate)
const TOKENS_PER_ROW_INPUT = 800; // ~800 input tokens per product (prompt + product data)
const TOKENS_PER_ROW_OUTPUT = 200; // ~200 output tokens per product (JSON response)
const HAIKU_INPUT_PRICE_PER_1M = 0.25; // $0.25 per 1M input tokens
const HAIKU_OUTPUT_PRICE_PER_1M = 1.25; // $1.25 per 1M output tokens

interface PreflightEstimate {
  rowCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  isOverWarningLimit: boolean;
  isOverHardLimit: boolean;
  estimatedTimeMinutes: number;
}

function calculatePreflightEstimate(rows: ProductRow[]): PreflightEstimate {
  const rowCount = rows.length;
  const estimatedInputTokens = rowCount * TOKENS_PER_ROW_INPUT;
  const estimatedOutputTokens = rowCount * TOKENS_PER_ROW_OUTPUT;

  const inputCost = (estimatedInputTokens / 1_000_000) * HAIKU_INPUT_PRICE_PER_1M;
  const outputCost = (estimatedOutputTokens / 1_000_000) * HAIKU_OUTPUT_PRICE_PER_1M;
  const estimatedCostUSD = inputCost + outputCost;

  // Estimate time: ~10 rows per batch, ~3 seconds per batch (2.5s processing + 0.5s delay)
  const batchCount = Math.ceil(rowCount / 10);
  const estimatedTimeMinutes = Math.max(1, Math.ceil((batchCount * 3) / 60));

  return {
    rowCount,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUSD,
    isOverWarningLimit: rowCount > ROW_LIMIT_WARNING,
    isOverHardLimit: rowCount > ROW_LIMIT_HARD,
    estimatedTimeMinutes,
  };
}

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamIdleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (streamIdleTimeoutRef.current) {
        clearTimeout(streamIdleTimeoutRef.current);
      }
    };
  }, []);

  const stopProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    if (streamIdleTimeoutRef.current) {
      clearTimeout(streamIdleTimeoutRef.current);
    }
    setProcessingStatus("error");
    addError(t("processingCancelled") || "Zpracování bylo zrušeno");
    toast.info(t("processingCancelled") || "Zpracování bylo zrušeno");
  }, [setProcessingStatus, addError, t]);

  const startProcessing = useCallback(async () => {
    if (!parsedData?.rows.length) {
      toast.error(t("noData"));
      return;
    }

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setProcessingStatus("processing");
    updateProgress(0, parsedData.rows.length);
    setProcessingComplete(false);

    // Reset stream idle timeout helper
    const resetIdleTimeout = () => {
      if (streamIdleTimeoutRef.current) {
        clearTimeout(streamIdleTimeoutRef.current);
      }
      streamIdleTimeoutRef.current = setTimeout(() => {
        console.error("Stream idle timeout - no data received for 60s");
        abortControllerRef.current?.abort();
      }, STREAM_IDLE_TIMEOUT_MS);
    };

    try {
      // Start with fetch timeout
      const fetchTimeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, FETCH_TIMEOUT_MS);

      const response = await fetch("/api/enrichment/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: parsedData.rows,
          config,
        }),
        signal,
      });

      clearTimeout(fetchTimeoutId);

      if (!response.ok) {
        throw new Error(t("processingFailed"));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error(t("readError"));
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Start idle timeout tracking
      resetIdleTimeout();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (streamIdleTimeoutRef.current) {
            clearTimeout(streamIdleTimeoutRef.current);
          }
          break;
        }

        // Reset idle timeout on each data chunk
        resetIdleTimeout();

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
                if (streamIdleTimeoutRef.current) {
                  clearTimeout(streamIdleTimeoutRef.current);
                }

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
      if (streamIdleTimeoutRef.current) {
        clearTimeout(streamIdleTimeoutRef.current);
      }

      // Check if aborted
      if (signal.aborted) {
        setProcessingStatus("error");
        const msg = t("processingTimeout") || "Zpracování vypršelo nebo bylo zrušeno";
        addError(msg);
        toast.error(msg);
        return;
      }

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

      {/* Not Started State - Pre-flight Check */}
      {processingStatus === "idle" && (() => {
        const estimate = parsedData?.rows
          ? calculatePreflightEstimate(parsedData.rows)
          : null;

        return (
          <div className="space-y-6">
            {/* Row Count Summary */}
            <div className="text-center">
              <div className="bg-muted/50 rounded-lg p-6 inline-block">
                <p className="text-2xl font-bold">{parsedData?.totalRows || 0}</p>
                <p className="text-muted-foreground">{t("rowsToProcess")}</p>
              </div>
            </div>

            {/* Pre-flight Estimates */}
            {estimate && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
                  <p className="font-medium text-blue-600">
                    {t("preflightEstimate") || "Odhad zpracování"}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t("estimatedTokens") || "Tokeny (odhad)"}</p>
                    <p className="font-medium">
                      ~{Math.round((estimate.estimatedInputTokens + estimate.estimatedOutputTokens) / 1000)}k
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("estimatedCost") || "Náklady (odhad)"}</p>
                    <p className="font-medium">${estimate.estimatedCostUSD.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("estimatedTime") || "Čas (odhad)"}</p>
                    <p className="font-medium">~{estimate.estimatedTimeMinutes} min</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("model") || "Model"}</p>
                    <p className="font-medium">Claude Haiku</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("estimateDisclaimer") || "* Odhady jsou přibližné a mohou se lišit podle délky popisů produktů"}
                </p>
              </div>
            )}

            {/* Very large file warning */}
            {estimate?.isOverHardLimit && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-600">
                      Velmi velký soubor
                    </p>
                    <p className="text-sm text-orange-600/80 mt-1">
                      Soubor obsahuje {estimate.rowCount} řádků. Zpracování bude trvat delší dobu (~{estimate.estimatedTimeMinutes} min)
                      a bude stát ~${estimate.estimatedCostUSD.toFixed(2)}. Soubor bude zpracován automaticky po částech.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for large files (but under very large limit) */}
            {estimate?.isOverWarningLimit && !estimate?.isOverHardLimit && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-600">
                      {t("largeFileWarning") || "Velký soubor"}
                    </p>
                    <p className="text-sm text-yellow-600/80 mt-1">
                      {t("largeFileWarningDescription", { count: estimate.rowCount }) ||
                        `Soubor obsahuje ${estimate.rowCount} řádků. Zpracování může trvat déle a náklady budou vyšší. Zvažte rozdělení souboru na menší části.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Tips */}
            {!estimate?.isOverHardLimit && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">{t("processingTips") || "Tipy pro zpracování"}</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{t("tipKeepWindow") || "Nechte okno prohlížeče otevřené během zpracování"}</li>
                      <li>{t("tipStableConnection") || "Ujistěte se, že máte stabilní internetové připojení"}</li>
                      <li>{t("tipCanStop") || "Zpracování můžete kdykoli zastavit tlačítkem Stop"}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Start Button */}
            <div className="text-center">
              <Button
                size="lg"
                onClick={startProcessing}
              >
                <Play className="mr-2 h-5 w-5" />
                {t("startProcessing")}
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                {estimate?.isOverWarningLimit
                  ? "Soubor bude automaticky zpracován po částech (10 produktů najednou)"
                  : t("processingNote")}
              </p>
            </div>
          </div>
        );
      })()}

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

          <div className="flex justify-center">
            <Button variant="destructive" size="sm" onClick={stopProcessing}>
              <StopCircle className="mr-2 h-4 w-4" />
              {t("stopProcessing") || "Zastavit zpracování"}
            </Button>
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
