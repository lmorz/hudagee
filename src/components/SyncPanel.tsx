import { Wifi } from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import type { VaultData } from "../types";
import { isMobilePlatform, isTauriRuntime } from "../lib/tauri";
import {
  DEFAULT_SYNC_HOST,
  DEFAULT_SYNC_PORT,
  normalizeSyncRemoteUrl,
  readSyncClientPreferences,
  writeSyncClientPreferences,
} from "../lib/preferences";
import {
  getLocalIp,
  getSyncStatus,
  performLanSync,
  startSyncServer,
  stopSyncServer,
  syncPing,
  type SyncStatus,
} from "../lib/sync";

type SyncPanelProps = {
  variant?: "desktop" | "mobile";
  vault: VaultData;
  masterPassword: string;
  onVaultChange: (vault: VaultData) => void;
};

export function SyncPanel(props: SyncPanelProps) {
  const saved = readSyncClientPreferences();
  const variant = () => props.variant ?? (isMobilePlatform() ? "mobile" : "desktop");
  const [mode, setMode] = createSignal<"server" | "client">(
    isMobilePlatform() ? "client" : "server",
  );
  const [status, setStatus] = createSignal<SyncStatus>({ running: false, port: 0, pair_code: "" });
  const [localIp, setLocalIp] = createSignal("");
  const [remoteHost, setRemoteHost] = createSignal(saved.host || DEFAULT_SYNC_HOST);
  const [remotePort, setRemotePort] = createSignal(saved.port || DEFAULT_SYNC_PORT);
  const [serverPort, setServerPort] = createSignal(DEFAULT_SYNC_PORT);
  const [pairCodeInput, setPairCodeInput] = createSignal(saved.pairCode);
  const [busyAction, setBusyAction] = createSignal<"start" | "stop" | "ping" | "sync" | null>(null);
  const isBusy = () => busyAction() !== null;

  createEffect(() => {
    if (!isTauriRuntime()) return;
    void refreshStatus();
  });

  function persistClientPrefs(patch?: { host?: string; port?: number; pairCode?: string }) {
    writeSyncClientPreferences({
      host: patch?.host ?? remoteHost(),
      port: patch?.port ?? remotePort(),
      pairCode: patch?.pairCode ?? pairCodeInput(),
    });
  }

  function resolvedRemoteUrl() {
    return normalizeSyncRemoteUrl(remoteHost(), remotePort());
  }

  async function refreshStatus() {
    try {
      setStatus(await getSyncStatus());
    } catch {
      /* ignore */
    }
  }

  async function refreshLocalIp() {
    try {
      setLocalIp(await getLocalIp());
    } catch {
      setLocalIp("无法获取");
    }
  }

  async function handleStartServer() {
    setBusyAction("start");
    try {
      const pairCode = await startSyncServer(serverPort());
      setStatus({ running: true, port: serverPort(), pair_code: pairCode });
      await refreshLocalIp();
      toast.success("同步服务已启动");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "启动同步服务失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStopServer() {
    setBusyAction("stop");
    try {
      await stopSyncServer();
      setStatus({ running: false, port: 0, pair_code: "" });
      setLocalIp("");
      toast.success("同步服务已停止");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "停止同步服务失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePing() {
    const url = resolvedRemoteUrl();
    if (!url) {
      toast.error("请输入目标 IP");
      return;
    }
    persistClientPrefs();
    setBusyAction("ping");
    try {
      const ok = await syncPing(url);
      toast.success(ok ? "连接成功" : "连接失败，请检查目标设备和端口");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试连接失败");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSync() {
    const url = resolvedRemoteUrl();
    if (!url) {
      toast.error("请输入目标 IP");
      return;
    }
    persistClientPrefs();
    setBusyAction("sync");
    try {
      const result = await performLanSync({
        remoteUrl: url,
        pairCode: pairCodeInput(),
        localVault: props.vault,
        masterPassword: props.masterPassword,
      });
      if (result.success) {
        if (result.vault) {
          props.onVaultChange(result.vault);
        }
        toast.success("同步完成", { description: result.message });
      } else {
        toast.error(result.message);
      }
    } finally {
      setBusyAction(null);
    }
  }

  const isMobile = () => variant() === "mobile";

  return (
    <div classList={{ "sync-panel": true, "sync-panel-mobile": isMobile() }}>
      <Show when={!isMobile()}>
        <p class="settings-tab-desc">
          同一 Wi-Fi 下，建议在电脑端启动服务，手机端一键同步。两端主密码需一致。
        </p>
      </Show>

      <div classList={{ "sync-mode-switch": true, "mobile-card": isMobile() }}>
        <button
          classList={{
            "sync-mode-btn": true,
            "mobile-action-btn": isMobile(),
            "is-active": mode() === "server",
            "mobile-action-active": isMobile() && mode() === "server",
          }}
          type="button"
          onClick={() => setMode("server")}
        >
          服务端
        </button>
        <button
          classList={{
            "sync-mode-btn": true,
            "mobile-action-btn": isMobile(),
            "is-active": mode() === "client",
            "mobile-action-active": isMobile() && mode() === "client",
          }}
          type="button"
          onClick={() => setMode("client")}
        >
          客户端
        </button>
      </div>

      <Show when={mode() === "server"}>
        <div classList={{ "sync-card": true, "mobile-card": isMobile() }}>
          <label>
            端口
            <input
              type="number"
              value={serverPort()}
              disabled={status().running}
              onInput={(event) => setServerPort(Number(event.currentTarget.value))}
              placeholder={String(DEFAULT_SYNC_PORT)}
            />
          </label>

          <Show when={status().running}>
            <div class="sync-running">
              <Wifi size={16} /> 服务运行中
            </div>
            <div class="sync-meta">
              <div>
                本机 IP: <strong>{localIp() || "获取中..."}</strong>
              </div>
              <div>
                端口: <strong>{status().port}</strong>
              </div>
              <div>
                配对码: <strong class="sync-pair-code">{status().pair_code}</strong>
              </div>
            </div>
          </Show>

          <Show when={!status().running}>
            <button
              classList={{ "primary-button": !isMobile(), "mobile-btn-primary mobile-btn-full": isMobile() }}
              type="button"
              onClick={handleStartServer}
              disabled={isBusy()}
            >
              {busyAction() === "start" ? "启动中..." : "启动服务"}
            </button>
          </Show>
          <Show when={status().running}>
            <button
              classList={{ "ghost-button": !isMobile(), "mobile-btn-ghost mobile-btn-full": isMobile() }}
              type="button"
              onClick={handleStopServer}
              disabled={isBusy()}
            >
              {busyAction() === "stop" ? "停止中..." : "停止服务"}
            </button>
          </Show>
        </div>
      </Show>

      <Show when={mode() === "client"}>
        <div classList={{ "sync-card": true, "mobile-card": isMobile() }}>
          <div class="sync-host-port">
            <label class="sync-host-field">
              目标 IP
              <input
                type="text"
                inputMode="decimal"
                value={remoteHost()}
                onInput={(event) => {
                  setRemoteHost(event.currentTarget.value);
                  persistClientPrefs({ host: event.currentTarget.value });
                }}
                placeholder={DEFAULT_SYNC_HOST}
              />
            </label>
            <label class="sync-port-field">
              端口
              <input
                type="number"
                value={remotePort()}
                onInput={(event) => {
                  const next = Number(event.currentTarget.value);
                  setRemotePort(next);
                  persistClientPrefs({ port: next });
                }}
                placeholder={String(DEFAULT_SYNC_PORT)}
              />
            </label>
          </div>
          <label>
            配对码
            <input
              type="text"
              inputMode="numeric"
              value={pairCodeInput()}
              onInput={(event) => {
                setPairCodeInput(event.currentTarget.value);
                persistClientPrefs({ pairCode: event.currentTarget.value });
              }}
              placeholder="6 位数字"
              class="sync-pair-input"
            />
          </label>

          <div class="sync-actions">
            <button
              classList={{ "ghost-button": !isMobile(), "mobile-btn-ghost": isMobile() }}
              type="button"
              onClick={handlePing}
              disabled={isBusy()}
            >
              {busyAction() === "ping" ? "测试中..." : "测试连接"}
            </button>
            <button
              classList={{ "primary-button": !isMobile(), "mobile-btn-primary": isMobile() }}
              type="button"
              onClick={handleSync}
              disabled={isBusy()}
            >
              {busyAction() === "sync" ? "同步中..." : "一键同步"}
            </button>
          </div>
        </div>
      </Show>

      <div classList={{ "sync-hint": true, "mobile-card": isMobile() }}>
        <p>1. 在电脑端启动同步服务，记下 IP 与配对码</p>
        <p>2. 在手机端填写 IP / 端口与配对码（无需 http://），点击「一键同步」</p>
        <p>3. 流程为：拉取 → 合并 → 保存 → 推回，两端数据都会保留</p>
        <p class="sync-hint-warn">两端主密码需一致，否则无法解密。地址与配对码会自动记住。</p>
      </div>
    </div>
  );
}
