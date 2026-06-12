import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { isTauriRuntime } from "./tauri";

export const BACKGROUND_IMAGE_RELATIVE_PATH = "appearance/wallpaper.jpg";
export const LARGE_IMAGE_WARN_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export type BackgroundImageImportResult = {
  relativePath?: string;
  previewUrl: string;
  cacheVersion: number;
  warning?: string;
};

function withCacheBuster(url: string, cacheVersion?: number) {
  if (!cacheVersion) {
    return url;
  }
  return `${url}?v=${cacheVersion}`;
}

function extensionFromMime(mime: string) {
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  return "jpg";
}

async function resizeImageFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("无法处理图片。");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("图片转换失败。"));
      },
      mime,
      JPEG_QUALITY,
    );
  });

  return { blob, extension: extensionFromMime(mime) };
}

async function appearanceDir() {
  const base = await appDataDir();
  const dir = await join(base, "appearance");
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function importBackgroundImage(file: File): Promise<BackgroundImageImportResult> {
  const warning =
    file.size > LARGE_IMAGE_WARN_BYTES
      ? "图片较大，已自动缩放；若感觉卡顿可换更小图片。"
      : undefined;
  const { blob, extension } = await resizeImageFile(file);
  const relativePath = `appearance/wallpaper.${extension}`;

  const cacheVersion = Date.now();

  if (!isTauriRuntime()) {
    return {
      previewUrl: URL.createObjectURL(blob),
      cacheVersion,
      warning,
    };
  }

  const dir = await appearanceDir();
  const outputPath = await join(dir, `wallpaper.${extension}`);
  const stalePath = await join(dir, "wallpaper.jpg");
  const staleWebp = await join(dir, "wallpaper.webp");
  const stalePng = await join(dir, "wallpaper.png");

  for (const path of [stalePath, staleWebp, stalePng]) {
    if (path !== outputPath && (await exists(path))) {
      await remove(path);
    }
  }

  await writeFile(outputPath, new Uint8Array(await blob.arrayBuffer()));
  const absolutePath = outputPath;
  const assetUrl = convertFileSrc(absolutePath);
  return {
    relativePath,
    previewUrl: withCacheBuster(assetUrl, cacheVersion),
    cacheVersion,
    warning,
  };
}

export async function resolveBackgroundImageUrl(relativePath: string | undefined, cacheVersion?: number) {
  if (!relativePath) {
    return null;
  }

  if (!isTauriRuntime()) {
    return null;
  }

  const absolutePath = await join(await appDataDir(), relativePath);
  if (!(await exists(absolutePath))) {
    return null;
  }

  return withCacheBuster(convertFileSrc(absolutePath), cacheVersion);
}

export async function removeStoredBackgroundImage(relativePath: string | undefined) {
  if (!relativePath || !isTauriRuntime()) {
    return;
  }

  const absolutePath = await join(await appDataDir(), relativePath);
  if (await exists(absolutePath)) {
    await remove(absolutePath);
  }
}
