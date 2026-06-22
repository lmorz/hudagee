import { createSignal, onMount } from "solid-js";
import { toast } from "solid-sonner";
import {
  applyLaunchAtStartup,
  readLaunchAtStartupPreference,
  syncLaunchAtStartupFromSystem,
} from "../lib/autostart";
import { isTauriRuntime } from "../lib/tauri";

export function GeneralSettings() {
  const [launchAtStartup, setLaunchAtStartup] = createSignal(false);
  const [isUpdating, setIsUpdating] = createSignal(false);

  onMount(() => {
    void syncLaunchAtStartupFromSystem()
      .then(setLaunchAtStartup)
      .catch(() => {
        setLaunchAtStartup(readLaunchAtStartupPreference());
      });
  });

  async function toggleLaunchAtStartup() {
    if (!isTauriRuntime()) {
      toast.error("当前环境不支持开机启动");
      return;
    }

    const next = !launchAtStartup();
    setIsUpdating(true);

    try {
      await applyLaunchAtStartup(next);
      setLaunchAtStartup(next);
      toast.success(next ? "已开启开机启动" : "已关闭开机启动");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "开机启动设置失败");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div class="general-settings">
      <div class="general-settings-row">
        <div class="general-settings-copy">
          <strong>开机启动</strong>
          <span>登录 Windows 后自动在后台运行，可通过托盘图标打开主窗口</span>
        </div>
        <button
          class="setting-toggle"
          classList={{ "is-on": launchAtStartup() }}
          type="button"
          role="switch"
          aria-checked={launchAtStartup()}
          aria-label="开机启动"
          disabled={isUpdating()}
          onClick={() => {
            void toggleLaunchAtStartup();
          }}
        >
          <span class="setting-toggle-thumb" />
        </button>
      </div>
    </div>
  );
}
