import { invoke } from "@tauri-apps/api/core";
import type { VaultData, VaultEnvelope } from "../types";
import {
  formatVaultMergeSummary,
  mergeVaultData,
  type VaultMergeSummary,
} from "./utils";
import { decryptVault, readVaultEnvelope, saveVault } from "./vault";

export type SyncStatus = {
  running: boolean;
  port: number;
  pair_code: string;
};

export type SyncResult = {
  success: boolean;
  message: string;
  summary?: VaultMergeSummary;
  vault?: VaultData;
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

export async function syncPing(remoteUrl: string): Promise<boolean> {
  return invoke<boolean>("sync_ping", { remoteUrl });
}

/** 从远程拉取加密 vault 字符串；无数据时返回 null */
export async function syncPull(remoteUrl: string, pairCode: string): Promise<string | null> {
  return invoke<string | null>("sync_pull", { remoteUrl, pairCode });
}

/** 推送本地加密 vault 到远程 */
export async function syncPush(remoteUrl: string, pairCode: string, envelope: string): Promise<void> {
  await invoke("sync_push", { remoteUrl, pairCode, envelope });
}

function parseEnvelope(raw: string): VaultEnvelope {
  return JSON.parse(raw) as VaultEnvelope;
}

/**
 * 一键同步：拉取 → 解密 → merge → 保存 → 推回
 * 远程无数据时仅推送本地；要求两端主密码一致。
 */
export async function performLanSync(options: {
  remoteUrl: string;
  pairCode: string;
  localVault: VaultData;
  masterPassword: string;
}): Promise<SyncResult> {
  const remoteUrl = options.remoteUrl.trim();
  const pairCode = options.pairCode.trim();

  if (!remoteUrl) {
    return { success: false, message: "请输入目标地址（如 http://192.168.1.100:9876）" };
  }
  if (!pairCode) {
    return { success: false, message: "请输入配对码" };
  }

  try {
    let mergedVault = options.localVault;
    let summary: VaultMergeSummary | undefined;

    const remoteRaw = await syncPull(remoteUrl, pairCode);
    if (remoteRaw) {
      let remoteVault: VaultData;
      try {
        remoteVault = await decryptVault(parseEnvelope(remoteRaw), options.masterPassword);
      } catch {
        return {
          success: false,
          message: "无法解密远程数据，请确认两端主密码一致",
        };
      }

      const merged = mergeVaultData(options.localVault, remoteVault);
      mergedVault = merged.vault;
      summary = merged.summary;
      await saveVault(mergedVault, options.masterPassword);
    }

    const envelope = await readVaultEnvelope();
    if (!envelope) {
      return { success: false, message: "本地保险库为空，无法推送" };
    }

    await syncPush(remoteUrl, pairCode, JSON.stringify(envelope));

    const summaryText = summary ? formatVaultMergeSummary(summary) : "远程暂无数据，已推送本地保险库";
    return {
      success: true,
      message: summaryText,
      summary,
      vault: mergedVault,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
