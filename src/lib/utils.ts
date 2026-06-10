import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "../types";

export const DEFAULT_PROFESSIONS = ["武侠", "法师", "羽芒", "羽灵", "妖兽", "妖精"];

export type VaultMergeSummary = {
  addedServers: number;
  mergedServers: number;
  addedAccounts: number;
  skippedAccounts: number;
  addedProfessions: number;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${suffix}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createEmptyVault(): VaultData {
  return {
    schemaVersion: 1,
    servers: [],
    accounts: [],
    professions: DEFAULT_PROFESSIONS,
  };
}

export function normalizeVault(data: VaultData): VaultData {
  return {
    ...data,
    professions: data.professions?.length ? data.professions : DEFAULT_PROFESSIONS,
  };
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function characterNameKey(serverId: string, characterName: string) {
  return [serverId, normalizeName(characterName)].join("\u0000");
}

function usernameKey(serverId: string, username: string) {
  return [serverId, normalizeName(username)].join("\u0000");
}

export type AccountDuplicateConflict = "characterName" | "username";

export function findDuplicateAccount(
  accounts: AccountEntry[],
  form: AccountForm,
  excludeAccountId?: string | null,
): AccountDuplicateConflict | undefined {
  const characterName = normalizeName(form.characterName);
  const username = normalizeName(form.username);
  if (!characterName || !username) {
    return undefined;
  }

  for (const account of accounts) {
    if (account.id === excludeAccountId || account.serverId !== form.serverId) {
      continue;
    }
    if (normalizeName(account.characterName) === characterName) {
      return "characterName";
    }
    if (normalizeName(account.username) === username) {
      return "username";
    }
  }

  return undefined;
}

function createUniqueServerName(name: string, usedNames: Set<string>) {
  if (!usedNames.has(name)) {
    return name;
  }

  let suffix = 2;
  let nextName = `${name} (${suffix})`;
  while (usedNames.has(nextName)) {
    suffix += 1;
    nextName = `${name} (${suffix})`;
  }
  return nextName;
}

function getPrimaryServer(servers: ServerGroup[]) {
  return [...servers].sort((left, right) => left.sortOrder - right.sortOrder)[0];
}

export function createServer(name: string, sortOrder: number): ServerGroup {
  const timestamp = nowIso();
  return {
    id: createId("srv"),
    name: name.trim(),
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createAccount(form: AccountForm): AccountEntry {
  const timestamp = nowIso();
  return {
    id: createId("acc"),
    serverId: form.serverId,
    characterName: form.characterName.trim(),
    username: form.username.trim(),
    password: form.password,
    profession: form.profession.trim(),
    note: form.note.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateAccount(account: AccountEntry, form: AccountForm): AccountEntry {
  return {
    ...account,
    serverId: form.serverId,
    characterName: form.characterName.trim(),
    username: form.username.trim(),
    password: form.password,
    profession: form.profession.trim(),
    note: form.note.trim(),
    updatedAt: nowIso(),
  };
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getServerAccountCount(accounts: AccountEntry[], serverId: string) {
  return accounts.filter((account) => account.serverId === serverId).length;
}

export function reorderServers(
  servers: ServerGroup[],
  draggedId: string,
  targetId: string,
  placement: "before" | "after",
) {
  const sorted = [...servers].sort((left, right) => left.sortOrder - right.sortOrder);
  const dragged = sorted.find((server) => server.id === draggedId);
  const target = sorted.find((server) => server.id === targetId);
  if (!dragged || !target || draggedId === targetId) {
    return null;
  }

  const withoutDragged = sorted.filter((server) => server.id !== draggedId);
  const targetIndex = withoutDragged.findIndex((server) => server.id === targetId);
  if (targetIndex === -1) {
    return null;
  }

  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  const reordered = [
    ...withoutDragged.slice(0, insertIndex),
    dragged,
    ...withoutDragged.slice(insertIndex),
  ];
  if (reordered.every((server, index) => server.id === sorted[index]?.id)) {
    return null;
  }

  const timestamp = nowIso();
  const existingById = new Map(servers.map((server) => [server.id, server]));
  return reordered.map((server, index) => {
    const existing = existingById.get(server.id);
    if (!existing) {
      return server;
    }
    if (existing.sortOrder === index && server.id !== draggedId) {
      return existing;
    }
    return {
      ...existing,
      sortOrder: index,
      updatedAt: server.id === draggedId ? timestamp : existing.updatedAt,
    };
  });
}

export function mergeVaultData(current: VaultData, imported: VaultData): { vault: VaultData; summary: VaultMergeSummary } {
  const timestamp = nowIso();
  const serversByName = new Map<string, ServerGroup[]>();
  for (const server of current.servers) {
    const serverName = normalizeName(server.name);
    serversByName.set(serverName, [...(serversByName.get(serverName) ?? []), server]);
  }
  const serverById = new Map(current.servers.map((server) => [server.id, server]));
  const usedServerNames = new Set(current.servers.map((server) => normalizeName(server.name)));
  const importedServerIdToMergedServer = new Map<string, ServerGroup>();
  const nextServers = [...current.servers];
  let addedServers = 0;
  let mergedServers = 0;

  for (const importedServer of imported.servers) {
    // 优先按 ID 匹配：重新导入本机导出的备份时，即使分组已改名也视为同一分组
    const sameIdServer = serverById.get(importedServer.id);
    if (sameIdServer) {
      importedServerIdToMergedServer.set(importedServer.id, sameIdServer);
      mergedServers += 1;
      continue;
    }

    const serverName = normalizeName(importedServer.name) || "未命名分组";
    const matchingServers = serversByName.get(serverName) ?? [];

    const existingServer = getPrimaryServer(matchingServers);
    if (existingServer) {
      importedServerIdToMergedServer.set(importedServer.id, existingServer);
      mergedServers += 1;
      continue;
    }

    const nextServerName = createUniqueServerName(serverName, usedServerNames);
    const nextServer = {
      ...importedServer,
      id: createId("srv"),
      name: nextServerName,
      sortOrder: nextServers.length,
      updatedAt: timestamp,
    };
    nextServers.push(nextServer);
    serversByName.set(nextServerName, [...(serversByName.get(nextServerName) ?? []), nextServer]);
    usedServerNames.add(nextServerName);
    importedServerIdToMergedServer.set(importedServer.id, nextServer);
    addedServers += 1;
  }

  const serverIdsByName = new Map<string, string[]>();
  for (const server of nextServers) {
    const serverName = normalizeName(server.name);
    serverIdsByName.set(serverName, [...(serverIdsByName.get(serverName) ?? []), server.id]);
  }
  const characterNameKeys = new Set(
    current.accounts.map((account) => characterNameKey(account.serverId, account.characterName)),
  );
  const usernameKeys = new Set(
    current.accounts.map((account) => usernameKey(account.serverId, account.username)),
  );
  const nextAccounts = [...current.accounts];
  let addedAccounts = 0;
  let skippedAccounts = 0;

  for (const importedAccount of imported.accounts) {
    const mergedServer = importedServerIdToMergedServer.get(importedAccount.serverId);
    if (!mergedServer) {
      skippedAccounts += 1;
      continue;
    }

    const characterName = normalizeName(importedAccount.characterName);
    const username = normalizeName(importedAccount.username);
    if (!characterName || !username) {
      skippedAccounts += 1;
      continue;
    }

    const nextAccount = {
      ...importedAccount,
      id: createId("acc"),
      serverId: mergedServer.id,
      characterName,
      username,
      profession: normalizeName(importedAccount.profession),
      note: normalizeName(importedAccount.note),
      updatedAt: timestamp,
    };
    // 与所有同名分组（含历史遗留的重名分组）下的账号判重，避免逻辑重复
    const siblingServerIds = serverIdsByName.get(normalizeName(mergedServer.name)) ?? [mergedServer.id];
    const isDuplicate = siblingServerIds.some(
      (serverId) =>
        characterNameKeys.has(characterNameKey(serverId, characterName)) ||
        usernameKeys.has(usernameKey(serverId, username)),
    );
    if (isDuplicate) {
      skippedAccounts += 1;
      continue;
    }

    characterNameKeys.add(characterNameKey(mergedServer.id, characterName));
    usernameKeys.add(usernameKey(mergedServer.id, username));
    nextAccounts.push(nextAccount);
    addedAccounts += 1;
  }

  const professionSet = new Set(current.professions);
  const nextProfessions = [...current.professions];
  let addedProfessions = 0;
  for (const profession of imported.professions) {
    const normalizedProfession = normalizeName(profession);
    if (!normalizedProfession || professionSet.has(normalizedProfession)) {
      continue;
    }

    professionSet.add(normalizedProfession);
    nextProfessions.push(normalizedProfession);
    addedProfessions += 1;
  }

  return {
    vault: {
      ...current,
      servers: nextServers,
      accounts: nextAccounts,
      professions: nextProfessions,
    },
    summary: {
      addedServers,
      mergedServers,
      addedAccounts,
      skippedAccounts,
      addedProfessions,
    },
  };
}

export function formatVaultMergeSummary(summary: VaultMergeSummary) {
  return [
    `新增 ${summary.addedServers} 个分组`,
    `合并 ${summary.mergedServers} 个同名分组`,
    `导入 ${summary.addedAccounts} 条账号`,
    `跳过 ${summary.skippedAccounts} 条重复或无效账号`,
    `新增 ${summary.addedProfessions} 个职业`,
  ].join("，");
}
