"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Image,
  Link2,
  FileX,
  Loader2,
  Gauge,
  Code,
  Settings,
  Shield,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import type { AuditReport, CrawlResult, PerformanceIssue, HtmlIssue, ConfigIssue, SecurityIssue } from "@/lib/site-audit/crawler";

interface ProgressData {
  phase: "sitemap" | "config" | "crawling" | "checking" | "complete" | "error";
  current?: number;
  total?: number;
  currentUrl?: string;
  message?: string;
  report?: AuditReport;
}

// Score color helpers
function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 70) return "bg-yellow-500/10";
  if (score >= 50) return "bg-orange-500/10";
  return "bg-red-500/10";
}

// Normalize URL - add https://www. if needed
function normalizeUrl(input: string): string {
  let url = input.trim();

  // If no protocol, add https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // If no www., add it
    if (!url.startsWith('www.')) {
      url = 'www.' + url;
    }
    url = 'https://' + url;
  } else {
    // Has protocol but check if www. is needed
    try {
      const parsed = new URL(url);
      // If hostname doesn't start with www. and is a simple domain, add www.
      if (!parsed.hostname.startsWith('www.') && !parsed.hostname.includes('localhost')) {
        const parts = parsed.hostname.split('.');
        // Only add www. if it's a simple domain (e.g., domain.cz, not subdomain.domain.cz)
        if (parts.length === 2) {
          parsed.hostname = 'www.' + parsed.hostname;
          url = parsed.toString();
        }
      }
    } catch {
      // If URL parsing fails, return as-is
    }
  }

  return url;
}

export function SiteAuditClient() {
  const t = useTranslations("siteAudit");
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAudit = useCallback(async () => {
    if (!url.trim()) return;

    const normalizedUrl = normalizeUrl(url);

    setIsScanning(true);
    setError(null);
    setReport(null);
    setProgress({ phase: "config", message: t("progress.starting"), current: 0, total: 1 });

    try {
      const response = await fetch("/api/site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to start audit");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data: ProgressData = JSON.parse(jsonStr);
                setProgress(data);

                if (data.phase === "complete" && data.report) {
                  setReport(data.report);
                } else if (data.phase === "error") {
                  setError(data.message || "Unknown error");
                }
              }
            } catch (e) {
              console.error("Parse error:", e, "Line:", line);
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.startsWith("data: ")) {
        try {
          const jsonStr = buffer.slice(6).trim();
          if (jsonStr) {
            const data: ProgressData = JSON.parse(jsonStr);
            if (data.phase === "complete" && data.report) {
              setReport(data.report);
            }
          }
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      console.error("Audit error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsScanning(false);
    }
  }, [url, t]);

  const getProgressPercent = () => {
    if (!progress || !progress.total) return 0;
    return Math.round((progress.current || 0) / progress.total * 100);
  };

  const getPhaseLabel = () => {
    if (!progress) return "";
    switch (progress.phase) {
      case "config": return t("progress.config");
      case "sitemap": return t("progress.sitemap");
      case "crawling": return t("progress.crawling");
      case "checking": return t("progress.checking");
      default: return "";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("pageDescription")}</p>
      </div>

      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle>{t("inputTitle")}</CardTitle>
          <CardDescription>{t("inputDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="example.cz"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isScanning}
              onKeyDown={(e) => e.key === "Enter" && startAudit()}
            />
            <Button onClick={startAudit} disabled={isScanning || !url.trim()}>
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("scanning")}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  {t("startAudit")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {isScanning && progress && (
        <Card>
          <CardHeader>
            <CardTitle>{t("progress.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{getPhaseLabel()}</span>
                {progress.total && (
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                )}
              </div>
              <Progress value={getProgressPercent()} />
            </div>
            {progress.currentUrl && (
              <p className="text-sm text-muted-foreground truncate">
                {progress.currentUrl}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {report && (
        <div className="space-y-6">
          {/* Score Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t("scores.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <ScoreCard
                  label={t("scores.overall")}
                  score={report.scores.overall}
                  isMain
                  tooltip={t("tooltips.overall")}
                />
                <ScoreCard
                  label={t("scores.links")}
                  score={report.scores.links}
                  tooltip={t("tooltips.links")}
                />
                <ScoreCard
                  label={t("scores.performance")}
                  score={report.scores.performance}
                  tooltip={t("tooltips.performance")}
                />
                <ScoreCard
                  label={t("scores.html")}
                  score={report.scores.html}
                  tooltip={t("tooltips.html")}
                />
                <ScoreCard
                  label={t("scores.config")}
                  score={report.scores.config}
                  tooltip={t("tooltips.config")}
                />
                <ScoreCard
                  label={t("scores.security")}
                  score={report.scores.security}
                  tooltip={t("tooltips.security")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{report.totalPages}</div>
                  <div className="text-sm text-muted-foreground">{t("results.pagesScanned")}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{report.totalLinks}</div>
                  <div className="text-sm text-muted-foreground">{t("results.linksChecked")}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{report.totalImages}</div>
                  <div className="text-sm text-muted-foreground">{t("results.imagesChecked")}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">
                    {getTotalIssues(report)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t("results.errorsTotal")}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results Tabs */}
          <Tabs defaultValue="links" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="links" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("tabs.links")}</span>
                <Badge variant="secondary" className="ml-1">
                  {getLinkErrorCount(report)}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                <span className="hidden sm:inline">{t("tabs.performance")}</span>
                <Badge variant="secondary" className="ml-1">
                  {report.performance.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="html" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">{t("tabs.html")}</span>
                <Badge variant="secondary" className="ml-1">
                  {report.html.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{t("tabs.config")}</span>
                <Badge variant="secondary" className="ml-1">
                  {report.config.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">{t("tabs.security")}</span>
                <Badge variant="secondary" className="ml-1">
                  {report.security.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Links Tab */}
            <TabsContent value="links" className="space-y-4 mt-4">
              {report.errors.pages404.length > 0 && (
                <IssueSection
                  title={t("errors.pages404")}
                  icon={<FileX className="h-5 w-5" />}
                  items={report.errors.pages404.map(i => ({
                    url: i.url,
                    source: i.source,
                    severity: "error" as const,
                    details: `Status: ${i.status}`,
                  }))}
                  t={t}
                />
              )}
              {report.errors.internalLinks404.length > 0 && (
                <IssueSection
                  title={t("errors.internalLinks404")}
                  icon={<Link2 className="h-5 w-5" />}
                  items={report.errors.internalLinks404.map(i => ({
                    url: i.url,
                    source: i.source,
                    severity: "error" as const,
                    details: `Status: ${i.status}`,
                  }))}
                  t={t}
                />
              )}
              {report.errors.brokenImages.length > 0 && (
                <IssueSection
                  title={t("errors.brokenImages")}
                  icon={<Image className="h-5 w-5" />}
                  items={report.errors.brokenImages.map(i => ({
                    url: i.url,
                    source: i.source,
                    severity: "warning" as const,
                    details: `Status: ${i.status}`,
                  }))}
                  t={t}
                />
              )}
              {report.errors.externalLinks404.length > 0 && (
                <IssueSection
                  title={t("errors.externalLinks404")}
                  icon={<ExternalLink className="h-5 w-5" />}
                  items={report.errors.externalLinks404.map(i => ({
                    url: i.url,
                    source: i.source,
                    severity: "warning" as const,
                    details: `Status: ${i.status}`,
                  }))}
                  t={t}
                />
              )}
              {getLinkErrorCount(report) === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t("results.noErrors")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4 mt-4">
              {report.performance.length > 0 ? (
                <IssueSection
                  title={t("tabs.performance")}
                  icon={<Gauge className="h-5 w-5" />}
                  items={report.performance.map(i => ({
                    url: i.url,
                    severity: i.severity,
                    details: t(`performance.${i.type}`) + (i.details ? `: ${i.details}` : ""),
                  }))}
                  t={t}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t("results.noErrors")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* HTML Tab */}
            <TabsContent value="html" className="space-y-4 mt-4">
              {report.html.length > 0 ? (
                <IssueSection
                  title={t("tabs.html")}
                  icon={<Code className="h-5 w-5" />}
                  items={report.html.map(i => ({
                    url: i.url,
                    severity: i.severity,
                    details: t(`html.${i.type}`) + (i.details ? `: ${i.details}` : ""),
                    elements: i.elements,
                  }))}
                  t={t}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t("results.noErrors")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-4 mt-4">
              {report.config.length > 0 ? (
                <IssueSection
                  title={t("tabs.config")}
                  icon={<Settings className="h-5 w-5" />}
                  items={report.config.map(i => ({
                    url: i.url || report.siteUrl,
                    severity: i.severity,
                    details: t(`config.${i.type}`) + (i.details ? `: ${i.details}` : ""),
                  }))}
                  t={t}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t("results.noErrors")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4 mt-4">
              {report.security.length > 0 ? (
                <SecuritySection
                  items={report.security.map(i => ({
                    url: i.url,
                    source: i.source,
                    severity: i.severity,
                    type: i.type,
                    details: t(`security.${i.type}`) + (i.details ? `: ${i.details}` : ""),
                  }))}
                  t={t}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t("results.noErrors")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// Helper components

function ScoreCard({ label, score, isMain = false, tooltip }: { label: string; score: number; isMain?: boolean; tooltip?: string }) {
  return (
    <div className={`text-center p-4 rounded-lg ${getScoreBgColor(score)} ${isMain ? "col-span-2 md:col-span-1" : ""}`}>
      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</div>
      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

interface IssueItem {
  url: string;
  source?: string;
  severity: "warning" | "error";
  details?: string;
  elements?: string[]; // Specific problematic elements (e.g., empty link texts)
}

interface IssueSectionProps {
  title: string;
  icon: React.ReactNode;
  items: IssueItem[];
  t: ReturnType<typeof useTranslations<"siteAudit">>;
}

function IssueSection({ title, icon, items, t }: IssueSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, 5);

  const errorCount = items.filter(i => i.severity === "error").length;
  const warningCount = items.filter(i => i.severity === "warning").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          {errorCount > 0 && <Badge variant="destructive">{errorCount}</Badge>}
          {warningCount > 0 && <Badge variant="secondary">{warningCount}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {displayItems.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-1 p-3 bg-muted rounded-lg text-sm"
            >
              <div className="flex items-center gap-2">
                {item.severity === "error" ? (
                  <Badge variant="destructive">Error</Badge>
                ) : (
                  <Badge variant="secondary">Warning</Badge>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate flex-1"
                >
                  {item.url}
                </a>
              </div>
              {item.details && (
                <p className="text-muted-foreground text-xs ml-16">
                  {item.details}
                </p>
              )}
              {item.elements && item.elements.length > 0 && (
                <div className="text-muted-foreground text-xs ml-16 mt-1">
                  <ul className="list-disc list-inside space-y-0.5">
                    {item.elements.slice(0, 5).map((el, idx) => (
                      <li key={idx} className="truncate font-mono text-[11px]">{el}</li>
                    ))}
                    {item.elements.length > 5 && (
                      <li className="text-muted-foreground/70">...a dalších {item.elements.length - 5}</li>
                    )}
                  </ul>
                </div>
              )}
              {item.source && (
                <div className="text-muted-foreground text-xs ml-16">
                  {t("foundOn")}:{" "}
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {item.source}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length > 5 && (
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? t("showLess")
              : t("showMore", { count: items.length - 5 })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Security section with grouping by source type
interface SecurityItem {
  url: string;
  source?: string;
  severity: "warning" | "error";
  details: string;
  type: string;
}

interface SecuritySectionProps {
  items: SecurityItem[];
  t: ReturnType<typeof useTranslations<"siteAudit">>;
}

function SecuritySection({ items, t }: SecuritySectionProps) {
  // Categorize scripts by source
  const categorizeSource = (source?: string): string => {
    if (!source) return "other";
    const lowerSource = source.toLowerCase();

    // Shoptet libraries (trusted)
    if (lowerSource.includes("shoptet") || lowerSource.includes("cdn.shoptet")) {
      return "shoptet";
    }
    // Common trusted third-party services
    if (
      lowerSource.includes("google") ||
      lowerSource.includes("facebook") ||
      lowerSource.includes("fbcdn") ||
      lowerSource.includes("cloudflare") ||
      lowerSource.includes("jsdelivr") ||
      lowerSource.includes("cdnjs") ||
      lowerSource.includes("unpkg") ||
      lowerSource.includes("jquery") ||
      lowerSource.includes("bootstrap")
    ) {
      return "trusted";
    }
    // FTP or custom domains (potentially risky)
    if (
      lowerSource.includes("ftp") ||
      lowerSource.includes("/user/") ||
      lowerSource.includes("/custom/")
    ) {
      return "custom";
    }
    return "other";
  };

  // Sort: errors first, then warnings
  const sortedItems = [...items].sort((a, b) => {
    if (a.severity === "error" && b.severity === "warning") return -1;
    if (a.severity === "warning" && b.severity === "error") return 1;
    return 0;
  });

  // Group by category
  const grouped = sortedItems.reduce((acc, item) => {
    const category = categorizeSource(item.source);
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, SecurityItem[]>);

  const categoryLabels: Record<string, { label: string; description: string }> = {
    custom: { label: "Vlastní skripty", description: "Skripty z FTP nebo vlastních domén - vyžadují kontrolu" },
    other: { label: "Ostatní externí", description: "Externí skripty z neznámých zdrojů" },
    trusted: { label: "Důvěryhodné služby", description: "Google, Facebook a další známé služby" },
    shoptet: { label: "Shoptet", description: "Oficiální Shoptet knihovny" },
  };

  // Order: custom first (most risky), then other, trusted, shoptet
  const categoryOrder = ["custom", "other", "trusted", "shoptet"];

  const errorCount = items.filter(i => i.severity === "error").length;
  const warningCount = items.filter(i => i.severity === "warning").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Bezpečnostní problémy
          {errorCount > 0 && <Badge variant="destructive">{errorCount}</Badge>}
          {warningCount > 0 && <Badge variant="secondary">{warningCount}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categoryOrder.map(category => {
          const categoryItems = grouped[category];
          if (!categoryItems || categoryItems.length === 0) return null;

          const categoryInfo = categoryLabels[category];

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{categoryInfo.label}</h4>
                <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
                <span className="text-xs text-muted-foreground/70">— {categoryInfo.description}</span>
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-muted">
                {categoryItems.slice(0, 10).map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 p-2 bg-muted/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {item.severity === "error" ? (
                        <Badge variant="destructive" className="text-xs">Error</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Warning</Badge>
                      )}
                      <span className="truncate flex-1 text-xs">{item.details}</span>
                    </div>
                    {item.source && (
                      <code className="text-xs text-muted-foreground truncate ml-14 font-mono">
                        {item.source}
                      </code>
                    )}
                  </div>
                ))}
                {categoryItems.length > 10 && (
                  <p className="text-xs text-muted-foreground pl-2">
                    ...a dalších {categoryItems.length - 10}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Helper functions
function getTotalIssues(report: AuditReport): number {
  return (
    getLinkErrorCount(report) +
    report.performance.length +
    report.html.length +
    report.config.length +
    report.security.length
  );
}

function getLinkErrorCount(report: AuditReport): number {
  return (
    report.errors.pages404.length +
    report.errors.internalLinks404.length +
    report.errors.brokenImages.length +
    report.errors.externalLinks404.length
  );
}
