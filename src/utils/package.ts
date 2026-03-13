import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read the package version from the root package.json.
 *
 * The result is cached after the first successful read so the file is only
 * parsed once per process.
 *
 * @returns The `version` field from package.json.
 */
export function getPackageVersion(): string {
  if (_cached !== undefined) return _cached;
  const raw = fs.readFileSync(
    path.resolve(__dirname, "../../package.json"),
    "utf-8"
  );
  _cached = JSON.parse(raw).version as string;
  return _cached;
}

let _cached: string | undefined;
