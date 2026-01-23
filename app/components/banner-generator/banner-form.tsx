"use client";

import { useTranslations } from "next-intl";
import {
  BannerConfig,
  BannerType,
  BannerPosition,
  BANNER_TYPE_PRESETS,
  TextAlignment,
} from "@/lib/banner-generator/types";

interface BannerFormProps {
  config: BannerConfig;
  onChange: (updates: Partial<BannerConfig>) => void;
}

const COMMON_ICONS = ["🚚", "💰", "🎁", "⏰", "🔥", "❄️", "🎄", "💝", "📦", "✨"];

export function BannerForm({ config, onChange }: BannerFormProps) {
  const t = useTranslations("bannerGenerator");

  const BANNER_TYPES: { value: BannerType; label: string; emoji: string }[] = [
    { value: "custom", label: t("form.types.custom"), emoji: "🎨" },
    { value: "info", label: t("form.types.info"), emoji: "ℹ️" },
    { value: "warning", label: t("form.types.warning"), emoji: "⚠️" },
    { value: "success", label: t("form.types.success"), emoji: "✅" },
    { value: "promo", label: t("form.types.promo"), emoji: "🎉" },
  ];

  const BANNER_POSITIONS: { value: BannerPosition; label: string; description: string }[] = [
    { value: "top", label: t("form.positions.top"), description: t("form.positions.topDesc") },
    { value: "bottom-left", label: t("form.positions.bottomLeft"), description: t("form.positions.bottomLeftDesc") },
    { value: "bottom-right", label: t("form.positions.bottomRight"), description: t("form.positions.bottomRightDesc") },
  ];

  const handleTypeChange = (type: BannerType) => {
    const preset = BANNER_TYPE_PRESETS[type];
    onChange({
      type,
      styles: { ...config.styles, ...preset },
    });
  };

  const updateStyles = (updates: Partial<BannerConfig["styles"]>) => {
    onChange({ styles: { ...config.styles, ...updates } });
  };

  const updateVisibility = (updates: Partial<BannerConfig["visibility"]>) => {
    onChange({ visibility: { ...config.visibility, ...updates } });
  };

  const updateTargeting = (updates: Partial<BannerConfig["targeting"]>) => {
    onChange({ targeting: { ...config.targeting, ...updates } });
  };

  const updateButton = (updates: Partial<NonNullable<BannerConfig["button"]>>) => {
    if (config.button) {
      onChange({ button: { ...config.button, ...updates } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Position */}
      <Section title={t("form.position")}>
        <div className="space-y-2">
          {BANNER_POSITIONS.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => onChange({ position: value })}
              className={`w-full px-4 py-3 rounded-lg border text-left transition-all ${
                config.position === value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className={`text-sm font-medium ${config.position === value ? "text-primary" : "text-foreground"}`}>
                {label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Color Preset */}
      <div className="border border-border rounded-xl overflow-hidden">
        <details className="group" open={config.type !== "custom"}>
          <summary className="px-4 py-3 bg-muted/50 cursor-pointer flex items-center justify-between hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">🎨 {t("form.colorScheme")}</span>
              <span className="text-xs text-muted-foreground">({t("form.optional")})</span>
            </div>
            <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              {t("form.colorSchemeDesc")}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {BANNER_TYPES.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => handleTypeChange(value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    config.type === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/50 text-foreground"
                  }`}
                >
                  <span className="text-lg">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Text */}
      <Section title={t("form.text")} htmlFor="banner-text">
        <textarea
          id="banner-text"
          value={config.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={t("form.textPlaceholder")}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-background"
          rows={2}
          maxLength={200}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{t("form.textRecommended")}</span>
          <span className={`text-xs ${config.text.length > 150 ? "text-amber-600" : "text-muted-foreground"}`}>
            {config.text.length}/200
          </span>
        </div>
      </Section>

      {/* Icon */}
      <Section title={t("form.icon")}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onChange({ icon: null })}
            className={`w-10 h-10 rounded-lg border text-sm transition-all ${
              config.icon === null
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            ✕
          </button>
          {COMMON_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => onChange({ icon })}
              className={`w-10 h-10 rounded-lg border text-lg transition-all ${
                config.icon === icon
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={config.icon || ""}
          onChange={(e) => onChange({ icon: e.target.value || null })}
          placeholder={t("form.iconPlaceholder")}
          className="w-full mt-2 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
        />
      </Section>

      {/* Coupon Code */}
      <Section title={t("form.couponCode")} htmlFor="banner-coupon">
        <input
          id="banner-coupon"
          type="text"
          value={config.couponCode || ""}
          onChange={(e) => onChange({ couponCode: e.target.value || null })}
          placeholder={t("form.couponPlaceholder")}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
        />
      </Section>

      {/* Button */}
      <Section title={t("form.button")}>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config.button !== null}
            onChange={(e) =>
              onChange({
                button: e.target.checked
                  ? {
                      text: t("form.buttonDefaultText"),
                      url: "#",
                      backgroundColor: "#FFFFFF",
                      textColor: config.styles.backgroundColor,
                    }
                  : null,
              })
            }
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">{t("form.showButton")}</span>
        </label>
        {config.button && (
          <div className="space-y-3 pl-6">
            <div>
              <label htmlFor="banner-button-text" className="block text-sm text-muted-foreground mb-1">{t("form.buttonText")}</label>
              <input
                id="banner-button-text"
                type="text"
                value={config.button.text}
                onChange={(e) => updateButton({ text: e.target.value })}
                placeholder={t("form.buttonTextPlaceholder")}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              />
            </div>
            <div>
              <label htmlFor="banner-button-url" className="block text-sm text-muted-foreground mb-1">{t("form.buttonUrl")}</label>
              <input
                id="banner-button-url"
                type="url"
                value={config.button.url}
                onChange={(e) => updateButton({ url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker
                label={t("form.buttonBg")}
                value={config.button.backgroundColor}
                onChange={(v) => updateButton({ backgroundColor: v })}
              />
              <ColorPicker
                label={t("form.buttonTextColor")}
                value={config.button.textColor}
                onChange={(v) => updateButton({ textColor: v })}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Colors */}
      <Section title={t("form.colors")}>
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker
            label={t("form.background")}
            value={config.styles.backgroundColor}
            onChange={(v) => updateStyles({ backgroundColor: v })}
          />
          <ColorPicker
            label={t("form.textColor")}
            value={config.styles.textColor}
            onChange={(v) => updateStyles({ textColor: v })}
          />
        </div>
      </Section>

      {/* Appearance */}
      <Section title={t("form.appearance")}>
        <div className="space-y-4">
          <RangeInput
            label={t("form.height")}
            value={config.styles.height}
            min={32}
            max={80}
            unit="px"
            onChange={(v) => updateStyles({ height: v })}
          />
          <RangeInput
            label={t("form.fontSize")}
            value={config.styles.fontSize}
            min={12}
            max={20}
            unit="px"
            onChange={(v) => updateStyles({ fontSize: v })}
          />
          <RangeInput
            label={t("form.padding")}
            value={config.styles.padding}
            min={8}
            max={24}
            unit="px"
            onChange={(v) => updateStyles({ padding: v })}
          />

          <div>
            <label htmlFor="banner-font-weight" className="block text-sm text-muted-foreground mb-2">{t("form.fontWeight")}</label>
            <select
              id="banner-font-weight"
              value={config.styles.fontWeight}
              onChange={(e) =>
                updateStyles({
                  fontWeight: e.target.value as BannerConfig["styles"]["fontWeight"],
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
            >
              <option value="normal">{t("form.fontWeights.normal")}</option>
              <option value="medium">{t("form.fontWeights.medium")}</option>
              <option value="semibold">{t("form.fontWeights.semibold")}</option>
              <option value="bold">{t("form.fontWeights.bold")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">{t("form.textAlign")}</label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                <button
                  key={align}
                  onClick={() => updateStyles({ textAlignment: align })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${
                    config.styles.textAlignment === align
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground/50 text-foreground"
                  }`}
                >
                  {align === "left" && `↤ ${t("form.alignLeft")}`}
                  {align === "center" && `↔ ${t("form.alignCenter")}`}
                  {align === "right" && `↦ ${t("form.alignRight")}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Close Button */}
      <Section title={t("form.closeButton")}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.closable}
            onChange={(e) => onChange({ closable: e.target.checked })}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">
            {t("form.closeButtonDesc")}
          </span>
        </label>
      </Section>

      {/* Visibility */}
      <Section title={t("form.visibility")}>
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config.visibility.alwaysVisible}
            onChange={(e) =>
              updateVisibility({ alwaysVisible: e.target.checked })
            }
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">{t("form.alwaysVisible")}</span>
        </label>
        {!config.visibility.alwaysVisible && (
          <div className="space-y-3 pl-6">
            <div>
              <label htmlFor="banner-date-start" className="block text-sm text-muted-foreground mb-1">{t("form.dateFrom")}</label>
              <input
                id="banner-date-start"
                type="date"
                value={config.visibility.startDate?.split("T")[0] || ""}
                onChange={(e) => {
                  updateVisibility({ startDate: e.target.value ? `${e.target.value}T00:00` : null });
                }}
                max={config.visibility.endDate?.split("T")[0] || undefined}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              />
            </div>
            <div>
              <label htmlFor="banner-date-end" className="block text-sm text-muted-foreground mb-1">{t("form.dateTo")}</label>
              <input
                id="banner-date-end"
                type="date"
                value={config.visibility.endDate?.split("T")[0] || ""}
                onChange={(e) => {
                  updateVisibility({ endDate: e.target.value ? `${e.target.value}T23:59` : null });
                }}
                min={config.visibility.startDate?.split("T")[0] || undefined}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              />
            </div>
            {config.visibility.startDate && config.visibility.endDate &&
              new Date(config.visibility.startDate) > new Date(config.visibility.endDate) && (
              <p className="text-xs text-red-600">⚠️ {t("form.dateError")}</p>
            )}
          </div>
        )}
      </Section>

      {/* Targeting */}
      <Section title={t("form.targeting")}>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.targeting.showOnDesktop}
              onChange={(e) =>
                updateTargeting({ showOnDesktop: e.target.checked })
              }
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">🖥️ Desktop</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.targeting.showOnMobile}
              onChange={(e) =>
                updateTargeting({ showOnMobile: e.target.checked })
              }
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">📱 {t("form.mobile")}</span>
          </label>
        </div>
      </Section>
    </div>
  );
}

// Helper components
function Section({
  title,
  children,
  htmlFor,
}: {
  title: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-3">{title}</label>
      ) : (
        <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
        />
      </div>
    </div>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
