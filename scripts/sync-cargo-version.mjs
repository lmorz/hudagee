import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const cargoPath = join(root, "src-tauri", "Cargo.toml");
const cargo = readFileSync(cargoPath, "utf8");

const nextCargo = cargo.replace(/^version = "[^"]*"/m, `version = "${version}"`);
if (!/^version = "/m.test(cargo)) {
  throw new Error("Cargo.toml version field not found.");
}

writeFileSync(cargoPath, nextCargo);
if (nextCargo === cargo) {
  console.log(`Cargo.toml version already ${version}`);
} else {
  console.log(`Synced Cargo.toml version to ${version}`);
}
