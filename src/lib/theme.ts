import { getCurrentWindow } from "@tauri-apps/api/window";
import { resolveBackgroundImageUrl } from "./appearanceAssets";
import { isTauriRuntime } from "./tauri";

export type ThemePresetId = "aurora" | "midnight" | "ocean" | "ember" | "slate";
export type BackgroundMode = "preset" | "solid" | "minimal";

export type AppearancePreferences = {
  preset: ThemePresetId;
  panelOpacity: number;
  blurStrength: number;
  borderRadius: number;
  accentColor?: string;
  backgroundMode: BackgroundMode;
  tintColor: string;
  tintOpacity: number;
  backgroundImagePath?: string;
};

export type ThemePresetMeta = {
  id: ThemePresetId;
  label: string;
  preview: string;
  windowBackground: string;
  background: string;
  tokens: {
    glassPanelRgb: string;
    accentA: string;
    accentB: string;
    accentC: string;
    eyebrow: string;
    shadowGlow: string;
  };
};

const APPEARANCE_KEY = "hudagee.appearance";

const PANEL_OPACITY_MIN = 0.35;
const PANEL_OPACITY_MAX = 0.9;
const BLUR_MIN = 0;
const BLUR_MAX = 32;
const RADIUS_MIN = 0;
const RADIUS_MAX = 16;
const TINT_OPACITY_MIN = 0;
const TINT_OPACITY_MAX = 0.85;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  preset: "aurora",
  panelOpacity: 0.62,
  blurStrength: 22,
  borderRadius: 4,
  backgroundMode: "preset",
  tintColor: "#050816",
  tintOpacity: 0.35,
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetMeta> = {
  aurora: {
    id: "aurora",
    label: "极光玻璃",
    preview: "linear-gradient(135deg, #3b82f6, #22d3ee 58%, #8b5cf6)",
    windowBackground: "#050816",
    background:
      "radial-gradient(circle at 12% 4%, rgba(37, 99, 235, 0.28), transparent 28rem), radial-gradient(circle at 82% 14%, rgba(34, 211, 238, 0.22), transparent 24rem), radial-gradient(circle at 64% 88%, rgba(168, 85, 247, 0.14), transparent 26rem), linear-gradient(135deg, #050816 0%, #08111f 45%, #020617 100%)",
    tokens: {
      glassPanelRgb: "15, 23, 42",
      accentA: "#60a5fa",
      accentB: "#22d3ee",
      accentC: "#a78bfa",
      eyebrow: "#67e8f9",
      shadowGlow: "0 0 32px rgba(34, 211, 238, 0.14)",
    },
  },
  midnight: {
    id: "midnight",
    label: "午夜纯色",
    preview: "linear-gradient(135deg, #0f172a, #020617)",
    windowBackground: "#050816",
    background: "#050816",
    tokens: {
      glassPanelRgb: "10, 14, 26",
      accentA: "#64748b",
      accentB: "#94a3b8",
      accentC: "#cbd5e1",
      eyebrow: "#94a3b8",
      shadowGlow: "0 0 24px rgba(148, 163, 184, 0.08)",
    },
  },
  ocean: {
    id: "ocean",
    label: "深海",
    preview: "linear-gradient(135deg, #0369a1, #0891b2)",
    windowBackground: "#041018",
    background:
      "radial-gradient(circle at 14% 6%, rgba(6, 182, 212, 0.24), transparent 26rem), radial-gradient(circle at 84% 18%, rgba(14, 165, 233, 0.18), transparent 22rem), linear-gradient(160deg, #041018 0%, #062032 48%, #020a10 100%)",
    tokens: {
      glassPanelRgb: "8, 28, 46",
      accentA: "#38bdf8",
      accentB: "#06b6d4",
      accentC: "#22d3ee",
      eyebrow: "#67e8f9",
      shadowGlow: "0 0 32px rgba(6, 182, 212, 0.16)",
    },
  },
  ember: {
    id: "ember",
    label: "余烬",
    preview: "linear-gradient(135deg, #ea580c, #ef4444)",
    windowBackground: "#120808",
    background:
      "radial-gradient(circle at 16% 8%, rgba(234, 88, 12, 0.22), transparent 24rem), radial-gradient(circle at 80% 16%, rgba(239, 68, 68, 0.16), transparent 22rem), linear-gradient(135deg, #120808 0%, #1a0e0e 45%, #0a0606 100%)",
    tokens: {
      glassPanelRgb: "38, 18, 18",
      accentA: "#fb923c",
      accentB: "#f97316",
      accentC: "#f87171",
      eyebrow: "#fdba74",
      shadowGlow: "0 0 32px rgba(249, 115, 22, 0.14)",
    },
  },
  slate: {
    id: "slate",
    label: "薄雾灰",
    preview: "linear-gradient(135deg, #475569, #64748b)",
    windowBackground: "#0a0e14",
    background:
      "radial-gradient(circle at 20% 10%, rgba(100, 116, 139, 0.16), transparent 24rem), radial-gradient(circle at 78% 82%, rgba(71, 85, 105, 0.12), transparent 26rem), linear-gradient(135deg, #0a0e14 0%, #111827 50%, #070b10 100%)",
    tokens: {
      glassPanelRgb: "20, 26, 36",
      accentA: "#94a3b8",
      accentB: "#cbd5e1",
      accentC: "#e2e8f0",
      eyebrow: "#cbd5e1",
      shadowGlow: "0 0 28px rgba(148, 163, 184, 0.1)",
    },
  },
};

export const THEME_PRESET_LIST = Object.values(THEME_PRESETS);

export const BACKGROUND_MODE_OPTIONS: { id: BackgroundMode; label: string; hint: string }[] = [
  { id: "preset", label: "预设渐变", hint: "使用当前主题的渐变背景" },
  { id: "solid", label: "纯色着色", hint: "以着色层覆盖背景" },
  { id: "minimal", label: "极简", hint: "弱化渐变与网格，突出面板" },
];

function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && value in THEME_PRESETS;
}

function isBackgroundMode(value: unknown): value is BackgroundMode {
  return value === "preset" || value === "solid" || value === "minimal";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return value;
}

export function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed.toLowerCase();
}

function parseHexColor(hex: string) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexColor(r: number, g: number, b: number) {
  const channel = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function lightenChannel(value: number, amount: number) {
  return value + (255 - value) * amount;
}

export function deriveAccentPalette(hex: string) {
  const { r, g, b } = parseHexColor(hex);
  return {
    accentA: normalizeHexColor(hex, DEFAULT_APPEARANCE.tintColor),
    accentB: toHexColor(lightenChannel(r, 0.18), lightenChannel(g, 0.18), lightenChannel(b, 0.18)),
    accentC: toHexColor(lightenChannel(r, 0.34), lightenChannel(g, 0.28), lightenChannel(b, 0.42)),
    eyebrow: toHexColor(lightenChannel(r, 0.42), lightenChannel(g, 0.42), lightenChannel(b, 0.42)),
  };
}

function hexToRgbString(hex: string) {
  const { r, g, b } = parseHexColor(hex);
  return `${r}, ${g}, ${b}`;
}

function rgbaFromHex(hex: string, alpha: number) {
  const { r, g, b } = parseHexColor(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveBodyBackground(prefs: AppearancePreferences, preset: ThemePresetMeta) {
  if (prefs.backgroundImagePath) {
    return "transparent";
  }

  if (prefs.backgroundMode === "solid") {
    return rgbaFromHex(prefs.tintColor, prefs.tintOpacity);
  }

  if (prefs.backgroundMode === "minimal") {
    return rgbaFromHex(prefs.tintColor, prefs.tintOpacity * 0.45);
  }

  return preset.background;
}

function normalizeAppearance(raw: Partial<AppearancePreferences> | null | undefined): AppearancePreferences {
  const preset = isThemePresetId(raw?.preset) ? raw.preset : DEFAULT_APPEARANCE.preset;
  const accentColor =
    typeof raw?.accentColor === "string" && raw.accentColor.length > 0
      ? normalizeHexColor(raw.accentColor, DEFAULT_APPEARANCE.tintColor)
      : undefined;
  const backgroundImagePath =
    typeof raw?.backgroundImagePath === "string" && raw.backgroundImagePath.length > 0
      ? raw.backgroundImagePath
      : undefined;

  return {
    preset,
    panelOpacity: clamp(
      toNumber(raw?.panelOpacity, DEFAULT_APPEARANCE.panelOpacity),
      PANEL_OPACITY_MIN,
      PANEL_OPACITY_MAX,
    ),
    blurStrength: clamp(toNumber(raw?.blurStrength, DEFAULT_APPEARANCE.blurStrength), BLUR_MIN, BLUR_MAX),
    borderRadius: clamp(toNumber(raw?.borderRadius, DEFAULT_APPEARANCE.borderRadius), RADIUS_MIN, RADIUS_MAX),
    accentColor,
    backgroundMode: isBackgroundMode(raw?.backgroundMode) ? raw.backgroundMode : DEFAULT_APPEARANCE.backgroundMode,
    tintColor: normalizeHexColor(raw?.tintColor, DEFAULT_APPEARANCE.tintColor),
    tintOpacity: clamp(toNumber(raw?.tintOpacity, DEFAULT_APPEARANCE.tintOpacity), TINT_OPACITY_MIN, TINT_OPACITY_MAX),
    backgroundImagePath,
  };
}

export function readAppearance(): AppearancePreferences {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) {
      return { ...DEFAULT_APPEARANCE };
    }
    return normalizeAppearance(JSON.parse(raw) as Partial<AppearancePreferences>);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function writeAppearance(prefs: AppearancePreferences) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(prefs)));
  } catch {
    // ignore quota or privacy mode errors
  }
}

function syncWindowBackground(color: string) {
  if (!isTauriRuntime()) {
    return;
  }

  void getCurrentWindow()
    .setBackgroundColor(color)
    .catch(() => {
      // ignore unsupported platforms
    });
}

export async function applyAppearance(prefs: AppearancePreferences) {
  let normalized = normalizeAppearance(prefs);
  const preset = THEME_PRESETS[normalized.preset];
  const accent = normalized.accentColor ? deriveAccentPalette(normalized.accentColor) : preset.tokens;
  const root = document.documentElement;
  let backgroundImageUrl = await resolveBackgroundImageUrl(normalized.backgroundImagePath);
  if (normalized.backgroundImagePath && !backgroundImageUrl) {
    normalized = { ...normalized };
    delete normalized.backgroundImagePath;
    writeAppearance(normalized);
  }

  root.setAttribute("data-theme", normalized.preset);
  root.setAttribute("data-background-mode", normalized.backgroundMode);
  root.toggleAttribute("data-custom-accent", Boolean(normalized.accentColor));
  root.toggleAttribute("data-has-bg-image", Boolean(backgroundImageUrl));

  root.style.setProperty("--radius-base", `${normalized.borderRadius}px`);
  root.style.setProperty("--glass-blur", `${normalized.blurStrength}px`);
  root.style.setProperty("--glass-panel-alpha", String(normalized.panelOpacity));
  root.style.setProperty("--glass-panel-rgb", preset.tokens.glassPanelRgb);
  root.style.setProperty("--accent-a", accent.accentA);
  root.style.setProperty("--accent-b", accent.accentB);
  root.style.setProperty("--accent-c", accent.accentC);
  root.style.setProperty("--accent-eyebrow", accent.eyebrow);
  root.style.setProperty("--shadow-glow", preset.tokens.shadowGlow);
  root.style.setProperty("--tint-rgb", hexToRgbString(normalized.tintColor));
  root.style.setProperty("--tint-opacity", String(normalized.tintOpacity));
  root.style.setProperty("--body-background", resolveBodyBackground(normalized, preset));
  root.style.setProperty("--bg-image-url", backgroundImageUrl ? `url("${backgroundImageUrl}")` : "none");
  root.style.setProperty(
    "--bg-image-overlay",
    rgbaFromHex(normalized.tintColor, clamp(normalized.tintOpacity + 0.2, 0.35, 0.78)),
  );

  syncWindowBackground(preset.windowBackground);
  return normalized;
}

export const APPEARANCE_LIMITS = {
  panelOpacity: { min: PANEL_OPACITY_MIN, max: PANEL_OPACITY_MAX },
  blurStrength: { min: BLUR_MIN, max: BLUR_MAX },
  borderRadius: { min: RADIUS_MIN, max: RADIUS_MAX },
  tintOpacity: { min: TINT_OPACITY_MIN, max: TINT_OPACITY_MAX },
} as const;

export function formatPanelOpacity(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatTintOpacity(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function getPresetAccentColor(presetId: ThemePresetId) {
  return THEME_PRESETS[presetId].tokens.accentA;
}
