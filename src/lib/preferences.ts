import type { ServerGroup } from "../types";

const LAST_SERVER_KEY = "hudagee.lastSelectedServerId";

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
