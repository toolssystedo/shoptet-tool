"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BannerConfig } from "@/lib/banner-generator/types";

interface BannerPreviewProps {
  config: BannerConfig;
}

type PreviewMode = "desktop" | "mobile";

export function BannerPreview({ config }: BannerPreviewProps) {
  const t = useTranslations("bannerGenerator");
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [isClosed, setIsClosed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Listen for dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  // Preview color scheme
  const previewColors = isDark
    ? {
        containerBg: "#1f2937",
        containerBorder: "#374151",
        chromeBg: "#111827",
        chromeBorder: "#374151",
        urlBarBg: "#1f2937",
        urlBarText: "#9ca3af",
        contentBg: "#111827",
        skeletonBg: "#374151",
      }
    : {
        containerBg: "#ffffff",
        containerBorder: "#e5e7eb",
        chromeBg: "#f3f4f6",
        chromeBorder: "#e5e7eb",
        urlBarBg: "#ffffff",
        urlBarText: "#6b7280",
        contentBg: "#f9fafb",
        skeletonBg: "#e5e7eb",
      };

  const fontWeightMap = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };

  const alignmentMap = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  const isFloating = config.position === "bottom-left" || config.position === "bottom-right";

  const bannerStyle: React.CSSProperties = {
    backgroundColor: config.styles.backgroundColor,
    color: config.styles.textColor,
    minHeight: isFloating ? undefined : `${config.styles.height}px`,
    fontSize: `${config.styles.fontSize}px`,
    fontWeight: fontWeightMap[config.styles.fontWeight],
    textAlign: config.styles.textAlignment,
    padding: `${config.styles.padding}px`,
    ...(isFloating && {
      maxWidth: "280px",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    }),
  };

  const shouldShow = () => {
    if (isClosed) return false;
    if (mode === "desktop" && !config.targeting.showOnDesktop) return false;
    if (mode === "mobile" && !config.targeting.showOnMobile) return false;
    return true;
  };

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode("desktop");
            setIsClosed(false);
          }}
          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
            mode === "desktop"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "border-border hover:border-muted-foreground/50 text-foreground"
          }`}
        >
          🖥️ Desktop
        </button>
        <button
          onClick={() => {
            setMode("mobile");
            setIsClosed(false);
          }}
          className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
            mode === "mobile"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "border-border hover:border-muted-foreground/50 text-foreground"
          }`}
        >
          📱 {t("preview.mobile")}
        </button>
      </div>

      {/* Preview container */}
      <div
        className={`rounded-lg overflow-hidden mx-auto transition-all ${
          mode === "desktop" ? "w-full" : "w-[375px]"
        }`}
        style={{ border: `1px solid ${previewColors.containerBorder}`, backgroundColor: previewColors.containerBg }}
      >
        {/* Browser chrome */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: previewColors.chromeBg, borderBottom: `1px solid ${previewColors.chromeBorder}` }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f87171" }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#facc15" }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#4ade80" }} />
          </div>
          <div className="flex-1 mx-2">
            <div className="rounded px-3 py-1 text-xs truncate" style={{ backgroundColor: previewColors.urlBarBg, color: previewColors.urlBarText }}>
              https://www.example-eshop.cz
            </div>
          </div>
        </div>

        {/* Banner preview */}
        {shouldShow() ? (
          isFloating ? (
            // Floating box layout - positioned in corner
            <div className="relative min-h-[250px]" style={{ backgroundColor: previewColors.contentBg }}>
              {/* Fake content behind */}
              <div className="p-4">
                <div className="h-6 rounded mb-3 w-2/3" style={{ backgroundColor: previewColors.skeletonBg }} />
                <div className="h-3 rounded mb-2 w-full" style={{ backgroundColor: previewColors.skeletonBg }} />
                <div className="h-3 rounded w-4/5" style={{ backgroundColor: previewColors.skeletonBg }} />
              </div>

              {/* Floating banner */}
              <div
                style={bannerStyle}
                className={`absolute bottom-4 ${config.position === "bottom-left" ? "left-4" : "right-4"} flex flex-col items-center gap-2 text-center`}
              >
                {/* Close button for floating */}
                {config.closable && (
                  <button
                    onClick={() => setIsClosed(true)}
                    className="absolute right-2 top-2 p-1 rounded hover:bg-black/10 transition-colors"
                    style={{ color: config.styles.textColor }}
                    aria-label={t("preview.close")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}

                {config.icon && <span className="text-xl">{config.icon}</span>}
                <span>{config.text}</span>

                {config.couponCode && (
                  <code
                    className="px-2 py-0.5 rounded font-mono text-sm"
                    style={{
                      backgroundColor: `${config.styles.textColor}20`,
                      border: `1px dashed ${config.styles.textColor}50`,
                    }}
                  >
                    {config.couponCode}
                  </code>
                )}

                {config.button && (
                  <a
                    href={config.button.url}
                    onClick={(e) => e.preventDefault()}
                    className="px-4 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90 mt-1"
                    style={{
                      backgroundColor: config.button.backgroundColor,
                      color: config.button.textColor,
                    }}
                  >
                    {config.button.text}
                  </a>
                )}
              </div>
            </div>
          ) : (
            // Top bar layout
            <div
              style={bannerStyle}
              className={`flex items-center ${alignmentMap[config.styles.textAlignment]} gap-3 relative`}
            >
              {/* Icon */}
              {config.icon && <span className="flex-shrink-0">{config.icon}</span>}

              {/* Text content */}
              <div className={`flex items-center gap-3 flex-wrap ${alignmentMap[config.styles.textAlignment]}`}>
                <span>{config.text}</span>

                {/* Coupon code */}
                {config.couponCode && (
                  <code
                    className="px-2 py-0.5 rounded font-mono text-sm"
                    style={{
                      backgroundColor: `${config.styles.textColor}20`,
                      border: `1px dashed ${config.styles.textColor}50`,
                    }}
                  >
                    {config.couponCode}
                  </code>
                )}

                {/* Button */}
                {config.button && (
                  <a
                    href={config.button.url}
                    onClick={(e) => e.preventDefault()}
                    className="px-3 py-1 rounded text-sm font-medium transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: config.button.backgroundColor,
                      color: config.button.textColor,
                    }}
                  >
                    {config.button.text}
                  </a>
                )}
              </div>

              {/* Close button */}
              {config.closable && (
                <button
                  onClick={() => setIsClosed(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 transition-colors"
                  style={{ color: config.styles.textColor }}
                  aria-label={t("preview.close")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {isClosed
              ? t("preview.closedMessage")
              : t("preview.notConfigured", { device: mode === "desktop" ? "desktop" : t("preview.mobile") })}
          </div>
        )}

        {/* Fake page content - only for top bar */}
        {!isFloating && (
          <div className="p-4 min-h-[200px]" style={{ backgroundColor: previewColors.contentBg }}>
            <div className="h-8 rounded mb-4 w-3/4" style={{ backgroundColor: previewColors.skeletonBg }} />
            <div className="h-4 rounded mb-2 w-full" style={{ backgroundColor: previewColors.skeletonBg }} />
            <div className="h-4 rounded mb-2 w-5/6" style={{ backgroundColor: previewColors.skeletonBg }} />
            <div className="h-4 rounded w-4/6" style={{ backgroundColor: previewColors.skeletonBg }} />
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="h-24 rounded" style={{ backgroundColor: previewColors.skeletonBg }} />
              <div className="h-24 rounded" style={{ backgroundColor: previewColors.skeletonBg }} />
              <div className="h-24 rounded" style={{ backgroundColor: previewColors.skeletonBg }} />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <div>
          {t("preview.visibility")}: {config.visibility.alwaysVisible ? `✓ ${t("preview.always")}` : `⏰ ${t("preview.limited")}`}
        </div>
        {!config.visibility.alwaysVisible && (
          <div>
            {config.visibility.startDate && (
              <span>
                {t("preview.from")}: {new Date(config.visibility.startDate).toLocaleDateString()}
              </span>
            )}
            {config.visibility.startDate && config.visibility.endDate && " → "}
            {config.visibility.endDate && (
              <span>
                {t("preview.to")}: {new Date(config.visibility.endDate).toLocaleDateString()}
              </span>
            )}
            {!config.visibility.startDate && !config.visibility.endDate && (
              <span className="text-amber-600">⚠️ {t("preview.noDateSet")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
