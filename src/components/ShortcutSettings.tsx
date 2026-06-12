import { Keyboard, RotateCcw } from "lucide-solid";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { toast } from "solid-sonner";
import {
  applyWindowToggleShortcut,
  DEFAULT_WINDOW_TOGGLE_SHORTCUT,
  formatShortcutLabel,
  pauseWindowToggleShortcut,
  readWindowToggleShortcut,
  resumeWindowToggleShortcut,
  shortcutFromKeyboardEvent,
  validateWindowToggleShortcut,
} from "../lib/windowToggleShortcut";

export function ShortcutSettings() {
  const [shortcut, setShortcut] = createSignal(readWindowToggleShortcut());
  const [isRecording, setIsRecording] = createSignal(false);
  const [error, setError] = createSignal("");

  async function commitShortcut(nextShortcut: string) {
    const validationError = validateWindowToggleShortcut(nextShortcut);
    if (validationError) {
      setError(validationError);
      return false;
    }

    try {
      await applyWindowToggleShortcut(nextShortcut);
      setShortcut(nextShortcut);
      setError("");
      toast.success("快捷键已更新");
      return true;
    } catch (commitError) {
      const message = commitError instanceof Error ? commitError.message : "快捷键更新失败";
      setError(message);
      toast.error(message);
      return false;
    }
  }

  async function startRecording() {
    setError("");
    try {
      await pauseWindowToggleShortcut();
      setIsRecording(true);
    } catch {
      toast.error("暂时无法录制快捷键");
    }
  }

  async function stopRecording(restorePrevious: boolean) {
    setIsRecording(false);
    if (restorePrevious) {
      try {
        await resumeWindowToggleShortcut();
        setShortcut(readWindowToggleShortcut());
      } catch {
        toast.error("恢复快捷键失败，请重启应用");
      }
    }
  }

  function handleRecordingKeydown(event: KeyboardEvent) {
    if (!isRecording()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      void stopRecording(true);
      return;
    }

    const nextShortcut = shortcutFromKeyboardEvent(event);
    if (!nextShortcut) {
      return;
    }

    void (async () => {
      setIsRecording(false);
      const saved = await commitShortcut(nextShortcut);
      if (!saved) {
        await resumeWindowToggleShortcut();
        setShortcut(readWindowToggleShortcut());
      }
    })();
  }

  onCleanup(() => {
    if (isRecording()) {
      void resumeWindowToggleShortcut();
    }
  });

  createEffect(() => {
    if (!isRecording()) {
      return;
    }

    window.addEventListener("keydown", handleRecordingKeydown, true);
    onCleanup(() => {
      window.removeEventListener("keydown", handleRecordingKeydown, true);
    });
  });

  return (
    <div class="shortcut-settings">
      <div class="shortcut-settings-row">
        <div class="shortcut-settings-copy">
          <strong>显示 / 隐藏主窗口</strong>
          <span>全局快捷键，可在游戏或其他应用前台时使用</span>
        </div>
        <div class="shortcut-settings-controls">
          <button
            class="shortcut-display"
            classList={{ "is-recording": isRecording() }}
            type="button"
            onClick={() => {
              if (isRecording()) {
                void stopRecording(true);
                return;
              }
              void startRecording();
            }}
          >
            <Keyboard size={13} />
            {isRecording() ? "按下新组合键…（Esc 取消）" : formatShortcutLabel(shortcut())}
          </button>
          <button
            class="ghost-button compact"
            type="button"
            title="恢复默认"
            onClick={() => {
              void commitShortcut(DEFAULT_WINDOW_TOGGLE_SHORTCUT);
            }}
          >
            <RotateCcw size={12} />
            默认
          </button>
        </div>
      </div>
      <Show when={error()}>
        <p class="shortcut-settings-error">{error()}</p>
      </Show>
      <p class="settings-tab-desc shortcut-settings-hint">
        默认值为 Alt + `。录制时需包含 Ctrl、Alt、Shift 或 Win 之一；若注册失败，说明组合已被其他程序占用。
      </p>
    </div>
  );
}
