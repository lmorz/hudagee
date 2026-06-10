import { invoke } from "@tauri-apps/api/core";
import type { VaultData, VaultEnvelope } from "../types";
import { createEmptyVault, normalizeVault } from "./utils";

const LOCAL_STORAGE_KEY = "hudagee.encryptedVault";
const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(masterPassword: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVault(data: VaultData, masterPassword: string): Promise<VaultEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    key,
    encoder.encode(JSON.stringify(data)),
  );

  return {
    schemaVersion: 1,
    crypto: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations: ITERATIONS,
      salt: bytesToBase64(salt),
      nonce: bytesToBase64(nonce),
    },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVault(envelope: VaultEnvelope, masterPassword: string): Promise<VaultData> {
  try {
    const key = await deriveKey(masterPassword, base64ToBytes(envelope.crypto.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(envelope.crypto.nonce)) },
      key,
      toArrayBuffer(base64ToBytes(envelope.ciphertext)),
    );
    return normalizeVault(JSON.parse(decoder.decode(plaintext)) as VaultData);
  } catch {
    throw new Error("主密码不正确，或数据文件已损坏。");
  }
}

export async function readVaultEnvelope(): Promise<VaultEnvelope | null> {
  if (isTauriRuntime()) {
    const raw = await invoke<string | null>("read_vault");
    return raw ? (JSON.parse(raw) as VaultEnvelope) : null;
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as VaultEnvelope) : null;
}

export async function writeVaultEnvelope(envelope: VaultEnvelope) {
  const raw = JSON.stringify(envelope);
  if (isTauriRuntime()) {
    await invoke("write_vault", { contents: raw });
    return;
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, raw);
}

export async function hasVault() {
  return (await readVaultEnvelope()) !== null;
}

export async function createVault(masterPassword: string) {
  const envelope = await encryptVault(createEmptyVault(), masterPassword);
  await writeVaultEnvelope(envelope);
  return createEmptyVault();
}

export async function unlockVault(masterPassword: string) {
  const envelope = await readVaultEnvelope();
  if (!envelope) {
    return createVault(masterPassword);
  }
  return decryptVault(envelope, masterPassword);
}

export async function saveVault(data: VaultData, masterPassword: string) {
  const envelope = await encryptVault(data, masterPassword);
  await writeVaultEnvelope(envelope);
}

export async function restoreVaultEnvelope(envelope: VaultEnvelope) {
  await writeVaultEnvelope(envelope);
}

export async function exportVaultBackup(data: VaultData, masterPassword: string) {
  return JSON.stringify(await encryptVault(data, masterPassword), null, 2);
}

export async function parseVaultBackup(raw: string, masterPassword: string) {
  const envelope = JSON.parse(raw) as VaultEnvelope;
  return {
    envelope,
    data: await decryptVault(envelope, masterPassword),
  };
}

export async function importVaultBackup(raw: string, masterPassword: string) {
  const { envelope, data } = await parseVaultBackup(raw, masterPassword);
  await writeVaultEnvelope(envelope);
  return data;
}
