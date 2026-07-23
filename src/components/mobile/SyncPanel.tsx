import { ArrowLeft, Wifi } from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import { isTauriRuntime } from "../../lib/tauri";
import {
  getLocalIp,
  getSyncStatus,
  startSyncServer,
  stopSyncServer,
  syncPing,
  syncPull,
  syncPush,
  type SyncStatus,
} from "../../lib/sync";

type SyncPanelProps = {
  envelope: string;
  onEnvelopeUpdate: (envelope: string) => void;
  onClose: () => void;
};

export function SyncPanel(props: SyncPanelProps) {
  const [mode, setMode] = createSignal<"server" | "client">("server");
  const [status, setStatus] = createSignal<SyncStatus>({ running: false, port: 0, pair_code: "" });
  const [localIp, setLocalIp] = createSignal("");
  const [remoteUrl, setRemoteUrl] = createSignal("");
  const [port, setPort] = createSignal(9876);
  const [pairCodeInput, setPairCodeInput] = createSignal("");
  const [isBusy, setIsBusy] = createSignal(false);

  createEffect(() => {
    if (!isTauriRuntime()) return;
    void refreshStatus();
    void refreshLocalIp();
  });

  async function refreshStatus() {
    try {
      setStatus(await getSyncStatus());
    } catch { /* ignore */ }
  }

  async function refreshLocalIp() {
    try {
      setLocalIp(await getLocalIp());
    } catch {
      setLocalIp("无法获取");
    }
  }

  async function handleStartServer() {
    setIsBusy(true);
    try {
      const pairCode = await startSyncServer(port());
      setStatus({ running: true, port: port(), pair_code: pairCode });
      await refreshLocalIp();
      toast.success("同步服务已启动");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "启动同步服务失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStopServer() {
    setIsBusy(true);
    try {
      await stopSyncServer();
      setStatus({ running: false, port: 0, pair_code: "" });
      toast.success("同步服务已停止");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停止同步服务失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePing() {
    if (!remoteUrl().trim()) {
      toast.error("请输入目标 IP 和端口");
      return;
    }
    setIsBusy(true);
    try {
      const ok = await syncPing(remoteUrl().trim());
      toast.success(ok ? "连接成功" : "连接失败，请检查目标设备和端口");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePushData() {
    if (!props.envelope) {
      toast.error("当前无 vault 数据可推送");
      return;
    }
    if (!remoteUrl().trim()) {
      toast.error("请输入目标 IP 和端口");
      return;
    }
    setIsBusy(true);
    try {
      const result = await syncPush(remoteUrl().trim(), pairCodeInput(), props.envelope);
      if (result.success) {
        toast.success("推送完成: " + result.message);
      } else {
        toast.error("推送失败: " + result.message);
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePullData() {
    if (!remoteUrl().trim()) {
      toast.error("请输入目标 IP 和端口");
      return;
    }
    setIsBusy(true);
    try {
      const result = await syncPull(remoteUrl().trim(), pairCodeInput());
      if (result.success) {
        props.onEnvelopeUpdate(result.message);
        toast.success("拉取完成，数据已更新");
      } else {
        toast.error("拉取失败: " + result.message);
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div class="mobile-fullscreen-form">
      <div class="mobile-form-header">
        <button class="mobile-icon-btn" type="button" onClick={props.onClose} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
        <h2>局域网同步</h2>
        <div style="width: 32px" />
      </div>

      <div class="mobile-settings-body">
        {/* 模式切换 */}
        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">模式</h3>
          <div class="mobile-card">
            <div style="display:flex;gap:6px;padding:8px">
              <button
                class="mobile-action-btn"
                classList={{ "mobile-action-active": mode() === "server" }}
                onClick={() => setMode("server")}
              >
                服务端
              </button>
              <button
                class="mobile-action-btn"
                classList={{ "mobile-action-active": mode() === "client" }}
                onClick={() => setMode("client")}
              >
                客户端
              </button>
            </div>
          </div>
        </section>

        {/* 服务端模式 */}
        <Show when={mode() === "server"}>
          <section class="mobile-settings-section">
            <h3 class="mobile-settings-section-title">启动同步服务</h3>
            <div class="mobile-card" style="padding:10px;display:flex;flex-direction:column;gap:8px">
              <label>
                端口
                <input
                  type="number"
                  value={port()}
                  disabled={status().running}
                  onInput={(e) => setPort(Number(e.currentTarget.value))}
                  placeholder="9876"
                  style="min-height:38px"
                />
              </label>

              <Show when={status().running}>
                <div style="display:flex;align-items:center;gap:6px;color:#4ade80;font-size:14px">
                  <Wifi size={16} /> 服务运行中
                </div>
                <div style="font-size:13px;color:#94a3b8">
                  <div>本机 IP: <strong style="color:#e2e8f0">{localIp()}</strong></div>
                  <div>端口: <strong style="color:#e2e8f0">{status().port}</strong></div>
                  <div>配对码: <strong style="color:#fbbf24;font-size:18px;letter-spacing:2px">{status().pair_code}</strong></div>
                </div>
              </Show>

              <Show when={!status().running}>
                <button class="mobile-btn-primary mobile-btn-full" onClick={handleStartServer} disabled={isBusy()}>
                  {isBusy() ? "启动中..." : "启动服务"}
                </button>
              </Show>
              <Show when={status().running}>
                <button
                  class="mobile-btn-ghost mobile-btn-full"
                  onClick={handleStopServer}
                  disabled={isBusy()}
                  style="color:#fca5a5;border-color:rgba(248,113,113,0.25)"
                >
                  {isBusy() ? "停止中..." : "停止服务"}
                </button>
              </Show>
            </div>
          </section>
        </Show>

        {/* 客户端模式 */}
        <Show when={mode() === "client"}>
          <section class="mobile-settings-section">
            <h3 class="mobile-settings-section-title">连接到远程设备</h3>
            <div class="mobile-card" style="padding:10px;display:flex;flex-direction:column;gap:8px">
              <label>
                目标地址
                <input
                  type="text"
                  value={remoteUrl()}
                  onInput={(e) => setRemoteUrl(e.currentTarget.value)}
                  placeholder="http://192.168.1.100:9876"
                  style="min-height:38px"
                />
              </label>
              <label>
                配对码
                <input
                  type="text"
                  value={pairCodeInput()}
                  onInput={(e) => setPairCodeInput(e.currentTarget.value)}
                  placeholder="6 位数字"
                  style="min-height:38px;font-size:16px;letter-spacing:3px"
                />
              </label>

              <button class="mobile-btn-ghost mobile-btn-full" onClick={handlePing} disabled={isBusy()}>
                {isBusy() ? "测试中..." : "测试连接"}
              </button>

              <div style="display:flex;gap:6px">
                <button class="mobile-btn-primary" style="flex:1" onClick={handlePullData} disabled={isBusy()}>
                  拉取数据
                </button>
                <button class="mobile-btn-ghost" style="flex:1" onClick={handlePushData} disabled={isBusy()}>
                  推送数据
                </button>
              </div>
            </div>
          </section>
        </Show>

        {/* 使用提示 */}
        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">使用说明</h3>
          <div class="mobile-card" style="padding:10px;font-size:12px;color:#94a3b8;line-height:1.6">
            <p style="margin:0">
              1. <strong>服务端</strong>：在你想分享数据的设备上启动同步服务，获取 IP 和配对码
            </p>
            <p style="margin:0">
              2. <strong>客户端</strong>：在另一台设备上输入服务端的 IP 和配对码
            </p>
            <p style="margin:0">
              3. 数据全程加密传输，建议先拉取再推送以保证两端数据一致
            </p>
            <p style="margin:0;color:#64748b">
              ⚠ 两端主密码需一致，否则无法解密数据
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
