import { invoke } from "@tauri-apps/api/core";

export type SyncStatus = {
  running: boolean;
  port: number;
  pair_code: string;
};

export async function startSyncServer(port: number): Promise<string> {
  return invoke<string>("start_sync_server", { port });
}

export async function stopSyncServer(): Promise<void> {
  await invoke("stop_sync_server");
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>("get_sync_status");
}

export async function getLocalIp(): Promise<string> {
  return invoke<string>("get_local_ip");
}

/** 从远程拉取 vault */
export async function syncPull(remoteUrl: string, pairCode: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. 携带配对码 GET vault
    const resp = await fetch(`${remoteUrl}/api/vault?pair_code=${encodeURIComponent(pairCode)}`);
    if (!resp.ok) {
      return { success: false, message: resp.status === 403 ? "配对码错误" : `连接失败 (${resp.status})` };
    }

    const data = await resp.json();
    if (!data.envelope) {
      return { success: false, message: "远程设备上暂无 vault 数据" };
    }

    // 2. 校验 SHA-256
    const receivedSha = data.sha256 as string;
    const computedSha = await sha256Hex(data.envelope);
    if (computedSha !== receivedSha) {
      return { success: false, message: "数据传输损坏，请重试" };
    }

    return { success: true, message: data.envelope };
  } catch (e) {
    return { success: false, message: `连接远程设备失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 推送本地 vault 到远程 */
export async function syncPush(
  remoteUrl: string,
  pairCode: string,
  envelope: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const sha = await sha256Hex(envelope);

    const resp = await fetch(`${remoteUrl}/api/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair_code: pairCode, envelope, sha256: sha }),
    });

    if (!resp.ok) {
      return { success: false, message: resp.status === 403 ? "配对码错误" : `推送失败 (${resp.status})` };
    }

    const data = await resp.json();
    return { success: data.success, message: data.message };
  } catch (e) {
    return { success: false, message: `连接远程设备失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 测试连接 */
export async function syncPing(remoteUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`${remoteUrl}/api/ping`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/** SHA-256 计算 */
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
