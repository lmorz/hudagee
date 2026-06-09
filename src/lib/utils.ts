import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "../types";

export const DEFAULT_PROFESSIONS = ["战士", "法师", "刺客", "射手", "辅助", "奶妈"];

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
