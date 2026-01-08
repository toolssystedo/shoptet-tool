"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { SHOPTET_EXPORT_RECOMMENDED_COLUMNS, SHOPTET_ALLOWED_COLUMNS } from "@/lib/enrichment/types";

export function ExportInstructionsModal() {
  const t = useTranslations("enrichment.upload");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          {t("howToExport")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("exportInstructionsTitle")}</DialogTitle>
          <DialogDescription>
            {t("exportInstructionsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Required columns */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {t("requiredColumns")}
            </h4>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <ul className="space-y-1">
                {SHOPTET_EXPORT_RECOMMENDED_COLUMNS.filter(col => col.required).map((col) => (
                  <li key={col.name} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-destructive" />
                    <span className="font-mono">{col.name}</span>
                    <span className="text-muted-foreground">— {col.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Optional columns */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t("optionalColumns")}
            </h4>
            <div className="bg-muted/50 border rounded-lg p-3">
              <ul className="space-y-1">
                {SHOPTET_EXPORT_RECOMMENDED_COLUMNS.filter(col => !col.required).map((col) => (
                  <li key={col.name} className="flex items-center gap-2 text-sm">
                    <span className="font-mono">{col.name}</span>
                    <span className="text-muted-foreground">— {col.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* All allowed columns */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{t("allAllowedColumns")}</h4>
            <div className="bg-muted/30 border rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-2">
                {t("allowedColumnsDescription")}
              </p>
              <div className="flex flex-wrap gap-1">
                {SHOPTET_ALLOWED_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 bg-background border rounded text-xs font-mono"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {t("specialColumnsNote")}
              </p>
            </div>
          </div>

          {/* Step by step instructions */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{t("howToExportSteps")}</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>{t("step1")}</li>
              <li>{t("step2")}</li>
              <li>{t("step3")}</li>
              <li>{t("step4")}</li>
              <li>{t("step5")}</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
