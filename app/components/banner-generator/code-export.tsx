"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BannerConfig } from "@/lib/banner-generator/types";
import { generateBannerFiles } from "@/lib/banner-generator/code-generator";

interface CodeExportProps {
  config: BannerConfig;
}

type ExportMode = "quick" | "files";

export function CodeExport({ config }: CodeExportProps) {
  const t = useTranslations("bannerGenerator");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("files");

  const { css, js, inlineSnippet } = generateBannerFiles(config);

  const copyToClipboard = async (text: string, label: string) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      setCopyError(t("export.copyError"));
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = () => {
    downloadFile(css, "info-lista.css", "text/css");
    setTimeout(() => downloadFile(js, "info-lista.js", "text/javascript"), 100);
  };

  return (
    <div className="space-y-5">
      {/* Copy error message */}
      {copyError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {copyError}
        </div>
      )}

      {/* Export mode toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => setExportMode("files")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            exportMode === "files"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📁 {t("export.separateFiles")}
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-primary text-primary-foreground rounded">
            {t("export.recommended")}
          </span>
        </button>
        <button
          onClick={() => setExportMode("quick")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            exportMode === "quick"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📄 {t("export.allInOne")}
        </button>
      </div>

      {exportMode === "files" ? (
        <>
          {/* Step 1: Download files */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">{t("export.step1Title")}</div>
                <p className="text-muted-foreground text-sm mb-3">
                  {t("export.step1Desc")}
                </p>
                <button
                  onClick={downloadAllFiles}
                  className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <span>⬇️</span> {t("export.downloadBoth")}
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("export.filesNote")}: <strong>info-lista.css</strong> + <strong>info-lista.js</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: Upload to Shoptet */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">{t("export.step2Title")}</div>
                <p className="text-muted-foreground text-sm mb-2">
                  {t("export.step2Desc")}
                </p>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm font-medium text-foreground mb-2">
                  {t("export.step2Path")}
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("export.step2Note")} <code className="bg-muted px-1 rounded text-xs">/user/documents/upload/</code>
                </p>
              </div>
            </div>
          </div>

          {/* Step 3: Add CSS link */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">{t("export.step3Title")}</div>
                <p className="text-muted-foreground text-sm mb-2">
                  {t("export.step3Desc")}
                </p>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm font-medium text-foreground mb-2">
                  {t("export.step3Path")} → <span className="text-blue-600 dark:text-blue-400">{t("export.headSection")}</span>
                </div>
                <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-blue-800 dark:text-blue-300">{t("export.codeForHead")}</span>
                    <button
                      onClick={() => copyToClipboard(`<link rel="stylesheet" href="/user/documents/upload/info-lista.css">`, "cssLink")}
                      className={`px-3 py-1 text-xs rounded-lg transition-all flex-shrink-0 ${
                        copied === "cssLink"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-background border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800"
                      }`}
                    >
                      {copied === "cssLink" ? `✓ ${t("export.copied")}` : t("export.copy")}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{`<link rel="stylesheet" href="/user/documents/upload/info-lista.css">`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Add JS link */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">{t("export.step4Title")}</div>
                <p className="text-muted-foreground text-sm mb-2">
                  {t("export.step4Desc")}
                </p>
                <div className="bg-muted rounded-lg px-3 py-2 text-sm font-medium text-foreground mb-2">
                  <span className="text-amber-600 dark:text-amber-400">{t("export.bodySection")}</span>
                </div>
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">{t("export.codeForBody")}</span>
                    <button
                      onClick={() => copyToClipboard(`<script src="/user/documents/upload/info-lista.js"></script>`, "jsLink")}
                      className={`px-3 py-1 text-xs rounded-lg transition-all flex-shrink-0 ${
                        copied === "jsLink"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-background border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800"
                      }`}
                    >
                      {copied === "jsLink" ? `✓ ${t("export.copied")}` : t("export.copy")}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    <code>{`<script src="/user/documents/upload/info-lista.js"></script>`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5: Save and done */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">✓</div>
              <div className="flex-1">
                <div className="font-medium text-foreground mb-1">{t("export.step5Title")}</div>
                <p className="text-muted-foreground text-sm">
                  {t("export.step5Desc")}
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-2">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300">
              💡 <strong>{t("export.tip")}:</strong> {t("export.tipText")}
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
              🔄 <strong>Cache:</strong> {t("export.cacheNote")}
            </div>
          </div>

          {/* Collapsible: Show source code */}
          <details className="border border-border rounded-xl overflow-hidden">
            <summary className="px-4 py-3 bg-muted/50 cursor-pointer text-sm font-medium text-foreground hover:bg-muted">
              🔧 {t("export.showSourceCode")}
            </summary>
            <div className="p-4 space-y-4">
              {/* CSS File */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">📄 info-lista.css</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(css, "css")}
                      className={`px-3 py-1 text-xs rounded-lg transition-all ${
                        copied === "css"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-background border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {copied === "css" ? `✓ ${t("export.copied")}` : t("export.copy")}
                    </button>
                    <button
                      onClick={() => downloadFile(css, "info-lista.css", "text/css")}
                      className="px-3 py-1 text-xs bg-background border border-border text-muted-foreground hover:bg-muted rounded-lg"
                    >
                      {t("export.download")}
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3 text-xs overflow-x-auto max-h-[150px] overflow-y-auto">
                  <code>{css}</code>
                </pre>
              </div>

              {/* JS File */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">📄 info-lista.js</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(js, "js")}
                      className={`px-3 py-1 text-xs rounded-lg transition-all ${
                        copied === "js"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-background border border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {copied === "js" ? `✓ ${t("export.copied")}` : t("export.copy")}
                    </button>
                    <button
                      onClick={() => downloadFile(js, "info-lista.js", "text/javascript")}
                      className="px-3 py-1 text-xs bg-background border border-border text-muted-foreground hover:bg-muted rounded-lg"
                    >
                      {t("export.download")}
                    </button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-3 text-xs overflow-x-auto max-h-[150px] overflow-y-auto">
                  <code>{js}</code>
                </pre>
              </div>
            </div>
          </details>
        </>
      ) : (
        <>
          {/* Quick inline export */}
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(inlineSnippet, "inline")}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                copied === "inline"
                  ? "bg-green-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {copied === "inline" ? `✓ ${t("export.copied")}!` : `📋 ${t("export.copyCode")}`}
            </button>
            <button
              onClick={() => downloadFile(inlineSnippet, `info-lista-${config.name || "banner"}.html`, "text/html")}
              className="px-4 py-3 rounded-xl border border-border font-medium text-foreground hover:bg-muted transition-all"
            >
              ⬇️ {t("export.download")}
            </button>
          </div>

          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
              <code>{inlineSnippet}</code>
            </pre>
          </div>

          {/* Instructions for inline */}
          <div className="bg-muted/50 rounded-xl p-4">
            <h4 className="font-medium text-primary mb-2">
              📖 {t("export.inlineGuideTitle")}
            </h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>{t("export.inlineStep1")}</li>
              <li>{t("export.inlineStep2")}</li>
              <li>{t("export.inlineStep3")}</li>
            </ol>
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              ⚠️ {t("export.inlineNote")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
