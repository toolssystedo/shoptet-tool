"use client";

import { useState } from "react";
import { useEnrichmentStore } from "@/lib/stores/enrichment-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "./file-dropzone";
import { parseFile } from "../actions";
import { toast } from "sonner";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import type { Platform } from "@/lib/enrichment/types";
import { useTranslations } from "next-intl";

export function StepUpload() {
  const {
    platform,
    setPlatform,
    file,
    setFile,
    setParsedData,
    parsedData,
    nextStep,
  } = useEnrichmentStore();

  const t = useTranslations("enrichment.upload");
  const tCommon = useTranslations("common");

  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setValidationErrors([]);
    setValidationWarnings([]);

    if (!platform) {
      toast.error(t("selectPlatformFirst"));
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("platform", platform);

      const result = await parseFile(formData);

      if (!result.validation.valid) {
        setValidationErrors(result.validation.errors);
        setParsedData(null);
        return;
      }

      if (result.validation.warnings.length > 0) {
        setValidationWarnings(result.validation.warnings);
      }

      setParsedData(result.data);
      toast.success(t("fileParseSuccess", { rows: result.data.totalRows }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("fileParseError")
      );
      setParsedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setParsedData(null);
    setValidationErrors([]);
    setValidationWarnings([]);
  };

  const canContinue = platform && file && parsedData && validationErrors.length === 0;

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <div className="space-y-2">
        <Label htmlFor="platform">{t("selectPlatform")}</Label>
        <Select
          value={platform || ""}
          onValueChange={(value: Platform) => {
            setPlatform(value);
            if (file) {
              handleClearFile();
            }
          }}
        >
          <SelectTrigger id="platform" className="w-full max-w-xs">
            <SelectValue placeholder={t("choosePlatform")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shoptet">{t("shoptet")}</SelectItem>
            <SelectItem value="upgates" disabled>
              {t("upgates")}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t("platformDescription")}
        </p>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label>{t("uploadExport")}</Label>
        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={file}
          onClear={handleClearFile}
        />
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("parsing")}</span>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t("validationFailed")}</p>
              <ul className="mt-1 text-sm text-destructive/90 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-600">{t("warnings")}</p>
              <ul className="mt-1 text-sm text-yellow-600/90 list-disc list-inside">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* File Info */}
      {parsedData && (
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">{t("fileSummary")}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t("fileName")}:</span>
              <span className="ml-2">{parsedData.fileName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("totalRows")}:</span>
              <span className="ml-2">{parsedData.totalRows}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t("headers")}:</span>
              <span className="ml-2">{parsedData.headers.length} {t("columns")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={nextStep} disabled={!canContinue}>
          {tCommon("continue")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
