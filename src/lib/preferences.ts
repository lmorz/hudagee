import type { ServerGroup } from "../types";

const LAST_SERVER_KEY = "hudagee.lastSelectedServerId";
const SYNC_REMOTE_HOST_KEY = "hudagee.sync.remoteHost";
const SYNC_REMOTE_PORT_KEY = "hudagee.sync.remotePort";
const SYNC_PAIR_CODE_KEY = "hudagee.sync.pairCode";

export const DEFAULT_SYNC_HOST = "192.168.1.100";
export const DEFAULT_SYNC_PORT = 9876;

export function readLastSelectedServerId() {
  try {
    return localStorage.getItem(LAST_SERVER_KEY);
  } catch {
    return null;
  }
}

export function writeLastSelectedServerId(serverId: string) {
  try {
    localStorage.setItem(LAST_SERVER_KEY, serverId);
  } catch {
    // ignore quota or privacy mode errors
  }
}

export function resolveSelectedServerId(servers: ServerGroup[], preferredId: string | null) {
  if (preferredId && servers.some((server) => server.id === preferredId)) {
    return preferredId;
  }

  const sorted = [...servers].sort((left, right) => left.sortOrder - right.sortOrder);
  return sorted[0]?.id ?? null;
}

export type SyncClientPreferences = {
  host: string;
  port: number;
  pairCode: string;
};

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function readSyncClientPreferences(): SyncClientPreferences {
  const storedHost = readStorage(SYNC_REMOTE_HOST_KEY)?.trim() ?? "";
  // 模拟器地址 10.0.2.* 不作为默认目标，回退到常用局域网示例
  const host =
    storedHost && !storedHost.startsWith("10.0.2.")
      ? storedHost
      : DEFAULT_SYNC_HOST;
  const portRaw = Number(readStorage(SYNC_REMOTE_PORT_KEY));
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : DEFAULT_SYNC_PORT;
  const pairCode = readStorage(SYNC_PAIR_CODE_KEY)?.trim() ?? "";
  return { host, port, pairCode };
}

export function writeSyncClientPreferences(prefs: Partial<SyncClientPreferences>) {
  if (prefs.host !== undefined) {
    writeStorage(SYNC_REMOTE_HOST_KEY, prefs.host.trim());
  }
  if (prefs.port !== undefined) {
    writeStorage(SYNC_REMOTE_PORT_KEY, String(prefs.port));
  }
  if (prefs.pairCode !== undefined) {
    writeStorage(SYNC_PAIR_CODE_KEY, prefs.pairCode.trim());
  }
}

/** 将用户输入的 IP/主机 与端口规范为 http://host:port（可省略 http://） */
export function normalizeSyncRemoteUrl(hostInput: string, portInput: number = DEFAULT_SYNC_PORT): string {
  let raw = hostInput.trim();
  if (!raw) {
    return "";
  }

  raw = raw.replace(/^https?:\/\//i, "");
  raw = raw.replace(/\/+$/, "");

  let host = raw;
  let port = portInput > 0 ? portInput : DEFAULT_SYNC_PORT;

  const ipv6Match = raw.match(/^\[(.+)\](?::(\d+))?$/);
  if (ipv6Match) {
    host = ipv6Match[1] ?? raw;
    if (ipv6Match[2]) {
      port = Number(ipv6Match[2]);
    }
  } else {
    // 若输入已含端口（host:port），优先使用输入中的端口
    const lastColon = raw.lastIndexOf(":");
    if (lastColon > 0 && !raw.includes("::") && raw.indexOf(":") === lastColon) {
      const maybePort = Number(raw.slice(lastColon + 1));
      if (Number.isFinite(maybePort) && maybePort > 0) {
        host = raw.slice(0, lastColon);
        port = maybePort;
      }
    }
  }

  return `http://${host}:${port}`;
}
