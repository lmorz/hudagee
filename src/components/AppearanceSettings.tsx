import { ImagePlus, RotateCcw, Trash2 } from "lucide-solid";
import { createSignal, For, onMount, Show } from "solid-js";
import { toast } from "solid-sonner";
import { importBackgroundImage, removeStoredBackgroundImage, resolveBackgroundImageUrl } from "../lib/appearanceAssets";
import {
  APPEARANCE_LIMITS,
  BACKGROUND_MODE_OPTIONS,
  DEFAULT_APPEARANCE,
  formatPanelOpacity,
  formatTintOpacity,
  getPresetAccentColor,
  applyAppearance,
  readAppearance,
  THEME_PRESET_LIST,
  writeAppearance,
  type AppearancePreferences,
  type BackgroundMode,
  type ThemePresetId,
} from "../lib/theme";

export function AppearanceSettings() {
  const [prefs, setPrefs] = createSignal<AppearancePreferences>(readAppearance());
  const [bgPreviewUrl, setBgPreviewUrl] = createSignal<string | null>(null);
  let fileInput: HTMLInputElement | undefined;
  let applyGeneration = 0;

  onMount(() => {
    void resolveBackgroundImageUrl(prefs().backgroundImagePath).then((url) => {
      setBgPreviewUrl(url);
    });
  });

  async function commit(next: AppearancePreferences) {
    const generation = ++applyGeneration;
    const applied = await applyAppearance(next);
    if (generation !== applyGeneration) {
      return;
    }
    setPrefs(applied);
    writeAppearance(applied);
  }

  async function update(patch: Partial<AppearancePreferences>) {
    await commit({ ...prefs(), ...patch });
  }

  async function selectPreset(preset: ThemePresetId) {
    const next = { ...prefs(), preset };
    delete next.accentColor;
    await commit(next);
  }

  async function selectBackgroundMode(backgroundMode: BackgroundMode) {
    await update({ backgroundMode });
  }

  async function clearAccentColor() {
    const next = { ...prefs() };
    delete next.accentColor;
    await commit(next);
  }

  async function resetAppearance() {
    await removeStoredBackgroundImage(prefs().backgroundImagePath);
    const next = { ...DEFAULT_APPEARANCE };
    setPrefs(next);
    setBgPreviewUrl(null);
    await applyAppearance(next);
    writeAppearance(next);
  }

  async function clearBackgroundImage() {
    await removeStoredBackgroundImage(prefs().backgroundImagePath);
    const next = { ...prefs() };
    delete next.backgroundImagePath;
    setBgPreviewUrl(null);
    await commit(next);
  }

  async function handleBackgroundFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件。");
      return;
    }

    try {
      const previousPath = prefs().backgroundImagePath;
      const result = await importBackgroundImage(file);
      if (result.warning) {
        toast.warning(result.warning);
      }
      setBgPreviewUrl(result.previewUrl);
      const next = { ...prefs() };
      if (result.relativePath) {
        next.backgroundImagePath = result.relativePath;
        await removeStoredBackgroundImage(
          previousPath && previousPath !== result.relativePath ? previousPath : undefined,
        );
      } else {
        delete next.backgroundImagePath;
        toast.info("浏览器预览模式不会保存背景图，请使用桌面版持久化。");
      }
      await commit(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "背景图导入失败。");
    }
  }

  const accentPickerValue = () => prefs().accentColor ?? getPresetAccentColor(prefs().preset);
  const accentStatusLabel = () => (prefs().accentColor ? "自定义" : "跟随预设");

  return (
    <div class="appearance-settings">
      <section class="appearance-section">
        <p class="appearance-section-title">主题</p>
        <p class="appearance-section-desc">
          预设决定背景与整体色调；强调色可单独覆盖按钮、标签与高亮（不影响背景渐变）。
        </p>
        <div class="theme-preset-grid">
          <For each={THEME_PRESET_LIST}>
            {(preset) => (
              <button
                class="theme-preset-card"
                classList={{ "is-active": prefs().preset === preset.id }}
                type="button"
                onClick={() => {
                  void selectPreset(preset.id);
                }}
              >
                <span
                  class="theme-preset-swatch"
                  style={{ background: preset.preview }}
                  aria-hidden="true"
                />
                {preset.label}
              </button>
            )}
          </For>
        </div>

        <div class="appearance-accent-row">
          <label class="appearance-slider-label" for="accent-color-input">
            <span>强调色</span>
            <strong>{accentStatusLabel()}</strong>
          </label>
          <div class="appearance-color-row">
            <input
              id="accent-color-input"
              class="appearance-color-input"
              type="color"
              value={accentPickerValue()}
              onInput={(event) => {
                void update({ accentColor: event.currentTarget.value });
              }}
            />
            <button
              class="ghost-button compact"
              type="button"
              disabled={!prefs().accentColor}
              onClick={() => void clearAccentColor()}
            >
              <RotateCcw size={12} />
              跟随预设
            </button>
          </div>
        </div>
      </section>

      <section class="appearance-section">
        <p class="appearance-section-title">面板样式</p>
        <div class="appearance-slider-row">
          <label class="appearance-slider-label" for="panel-opacity-slider">
            <span>面板透明度</span>
            <strong>{formatPanelOpacity(prefs().panelOpacity)}</strong>
          </label>
          <input
            id="panel-opacity-slider"
            class="appearance-slider"
            type="range"
            min={APPEARANCE_LIMITS.panelOpacity.min}
            max={APPEARANCE_LIMITS.panelOpacity.max}
            step={0.01}
            value={prefs().panelOpacity}
            onInput={(event) => {
              void update({ panelOpacity: Number(event.currentTarget.value) });
            }}
          />
        </div>

        <div class="appearance-slider-row">
          <label class="appearance-slider-label" for="blur-strength-slider">
            <span>模糊强度</span>
            <strong>{prefs().blurStrength}px</strong>
          </label>
          <input
            id="blur-strength-slider"
            class="appearance-slider"
            type="range"
            min={APPEARANCE_LIMITS.blurStrength.min}
            max={APPEARANCE_LIMITS.blurStrength.max}
            step={1}
            value={prefs().blurStrength}
            onInput={(event) => {
              void update({ blurStrength: Number(event.currentTarget.value) });
            }}
          />
        </div>

        <div class="appearance-slider-row">
          <label class="appearance-slider-label" for="border-radius-slider">
            <span>圆角</span>
            <strong>{prefs().borderRadius}px</strong>
          </label>
          <input
            id="border-radius-slider"
            class="appearance-slider"
            type="range"
            min={APPEARANCE_LIMITS.borderRadius.min}
            max={APPEARANCE_LIMITS.borderRadius.max}
            step={1}
            value={prefs().borderRadius}
            onInput={(event) => {
              void update({ borderRadius: Number(event.currentTarget.value) });
            }}
          />
        </div>
      </section>

      <section class="appearance-section">
        <p class="appearance-section-title">背景</p>

        <div class="appearance-slider-row">
          <p class="appearance-section-title">背景类型</p>
          <div class="appearance-option-grid">
            <For each={BACKGROUND_MODE_OPTIONS}>
              {(option) => (
                <button
                  class="appearance-option"
                  classList={{ "is-active": prefs().backgroundMode === option.id }}
                  type="button"
                  onClick={() => {
                    void selectBackgroundMode(option.id);
                  }}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="appearance-slider-row">
          <label class="appearance-slider-label" for="tint-color-input">
            <span>背景着色</span>
            <strong>{prefs().tintColor}</strong>
          </label>
          <div class="appearance-color-row">
            <input
              id="tint-color-input"
              class="appearance-color-input"
              type="color"
              value={prefs().tintColor}
              onInput={(event) => {
                void update({ tintColor: event.currentTarget.value });
              }}
            />
            <input
              class="appearance-slider"
              type="range"
              min={APPEARANCE_LIMITS.tintOpacity.min}
              max={APPEARANCE_LIMITS.tintOpacity.max}
              step={0.01}
              value={prefs().tintOpacity}
              onInput={(event) => {
                void update({ tintOpacity: Number(event.currentTarget.value) });
              }}
            />
            <strong>{formatTintOpacity(prefs().tintOpacity)}</strong>
          </div>
        </div>

        <div class="appearance-slider-row">
          <label class="appearance-slider-label">
            <span>背景图片</span>
            <strong>{prefs().backgroundImagePath ? "已设置" : "未设置"}</strong>
          </label>
          <Show when={bgPreviewUrl()}>
            {(url) => (
              <div
                class="appearance-bg-preview"
                style={{ "background-image": `url("${url()}")` }}
                aria-hidden="true"
              />
            )}
          </Show>
          <div class="appearance-bg-actions">
            <button class="ghost-button compact" type="button" onClick={() => fileInput?.click()}>
              <ImagePlus size={12} />
              选择图片
            </button>
            <Show when={prefs().backgroundImagePath ?? bgPreviewUrl()}>
              <button class="ghost-button compact" type="button" onClick={() => void clearBackgroundImage()}>
                <Trash2 size={12} />
                移除图片
              </button>
            </Show>
          </div>
          <input
            ref={fileInput}
            class="appearance-hidden-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              void handleBackgroundFile(event);
            }}
          />
        </div>
      </section>

      <div class="appearance-actions">
        <button class="ghost-button compact" type="button" onClick={() => void resetAppearance()}>
          恢复默认
        </button>
      </div>
    </div>
  );
}
