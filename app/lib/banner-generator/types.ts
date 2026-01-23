export type BannerType = "custom" | "info" | "warning" | "success" | "promo";

export type BannerPosition = "top" | "bottom-left" | "bottom-right";

export type TextAlignment = "left" | "center" | "right";

export interface BannerButton {
  text: string;
  url: string;
  backgroundColor: string;
  textColor: string;
}

export interface BannerVisibility {
  startDate: string | null;
  endDate: string | null;
  showOnDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  alwaysVisible: boolean;
}

export interface BannerTargeting {
  showOnDesktop: boolean;
  showOnMobile: boolean;
  language: string | null; // null = all languages
}

export interface BannerStyles {
  backgroundColor: string;
  textColor: string;
  height: number; // in pixels
  fontSize: number; // in pixels
  fontWeight: "normal" | "medium" | "semibold" | "bold";
  textAlignment: TextAlignment;
  padding: number; // in pixels
}

export interface BannerConfig {
  id?: string;
  name: string;
  type: BannerType;
  text: string;
  icon: string | null;
  couponCode: string | null;
  button: BannerButton | null;
  styles: BannerStyles;
  visibility: BannerVisibility;
  targeting: BannerTargeting;
  position: BannerPosition;
  closable: boolean;
}

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  name: "",
  type: "custom",
  text: "Zadejte text informacni listy",
  icon: null,
  couponCode: null,
  button: null,
  styles: {
    backgroundColor: "#3B82F6",
    textColor: "#FFFFFF",
    height: 48,
    fontSize: 14,
    fontWeight: "medium",
    textAlignment: "center",
    padding: 12,
  },
  visibility: {
    startDate: null,
    endDate: null,
    showOnDays: [0, 1, 2, 3, 4, 5, 6],
    alwaysVisible: true,
  },
  targeting: {
    showOnDesktop: true,
    showOnMobile: true,
    language: null,
  },
  position: "top",
  closable: false,
};

export const BANNER_TYPE_PRESETS: Record<BannerType, Partial<BannerStyles>> = {
  custom: {}, // No preset - keep current colors
  info: {
    backgroundColor: "#3B82F6",
    textColor: "#FFFFFF",
  },
  warning: {
    backgroundColor: "#F59E0B",
    textColor: "#1F2937",
  },
  success: {
    backgroundColor: "#10B981",
    textColor: "#FFFFFF",
  },
  promo: {
    backgroundColor: "#8B5CF6",
    textColor: "#FFFFFF",
  },
};
