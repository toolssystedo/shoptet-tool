"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BannerForm } from "@/components/banner-generator/banner-form";
import { BannerPreview } from "@/components/banner-generator/banner-preview";
import { CodeExport } from "@/components/banner-generator/code-export";
import { BannerConfig, DEFAULT_BANNER_CONFIG } from "@/lib/banner-generator/types";
import { Paintbrush, Eye, Code } from "lucide-react";

export function BannerGeneratorClient() {
  const t = useTranslations("bannerGenerator");
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_BANNER_CONFIG);
  const [activeTab, setActiveTab] = useState("editor");

  const updateConfig = useCallback((updates: Partial<BannerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReset = () => {
    setConfig(DEFAULT_BANNER_CONFIG);
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          {t("reset")}
        </button>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paintbrush className="h-5 w-5" />
              {t("editor")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
              <BannerForm config={config} onChange={updateConfig} />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Preview & Export */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t("tabs.preview")}
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                {t("tabs.export")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    {t("preview.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BannerPreview config={config} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    {t("export.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeExport config={config} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
