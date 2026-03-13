import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { isTypeScriptSourceFile } from "../utils/file.ts";
import { findExtendsReferences } from "../utils/regex.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STDLIB_CONTRACTS_DIR = path.resolve(__dirname, "../../stdlib/contracts");

interface StdlibEntry {
  className: string;
  filePath: string;
}

/**
 * Cached registry of stdlib entries. Once built, the cache persists for the
 * lifetime of the process. Use {@link clearStdlibRegistryCache} or pass
 * `force: true` to {@link getRegistry} to invalidate it (useful in tests or
 * development when stdlib files may change between invocations).
 */
let _registry: StdlibEntry[] | null = null;

function buildRegistry(): StdlibEntry[] {
  const entries: StdlibEntry[] = [];
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) {
        walk(path.join(dir, item.name));
      } else if (isTypeScriptSourceFile(item.name, { excludeIndex: true })) {
        const className = item.name.replace(/\.ts$/, "");
        entries.push({
          className,
          filePath: path.join(dir, item.name),
        });
      }
    }
  };
  walk(STDLIB_CONTRACTS_DIR);
  return entries;
}

function getRegistry(force = false): StdlibEntry[] {
  if (force || !_registry) _registry = buildRegistry();
  return _registry;
}

/**
 * Invalidate the cached stdlib registry so the next call to
 * {@link getStdlibClassNames} or {@link resolveStdlibFiles} rebuilds it
 * from disk. This is useful in tests or during development when stdlib
 * files may be added, removed, or modified between invocations.
 */
export function clearStdlibRegistryCache(): void {
  _registry = null;
}

/**
 * Return the set of all stdlib class names.
 */
export function getStdlibClassNames(): Set<string> {
  return new Set(getRegistry().map((e) => e.className));
}

/**
 * Given a set of class names that user code references (via extends),
 * return the file paths for the matching stdlib contracts and any
 * transitive stdlib dependencies.
 */
export function resolveStdlibFiles(referencedClasses: Set<string>): string[] {
  const registry = getRegistry();
  const needed = new Set<string>();
  const queue = [...referencedClasses];

  while (queue.length > 0) {
    const name = queue.pop();
    if (!name) break;
    const entry = registry.find((e) => e.className === name);
    if (!entry || needed.has(entry.filePath)) continue;
    needed.add(entry.filePath);

    const source = fs.readFileSync(entry.filePath, "utf-8");
    for (const parent of findExtendsReferences(source)) {
      const parentEntry = registry.find((e) => e.className === parent);
      if (parentEntry && !needed.has(parentEntry.filePath)) queue.push(parent);
    }

    // Also follow relative import statements to other stdlib files
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const importPath = match[1];
      const resolved = path.resolve(path.dirname(entry.filePath), importPath);
      if (resolved.startsWith(STDLIB_CONTRACTS_DIR) && !needed.has(resolved)) {
        needed.add(resolved);
      }
    }
  }

  return [...needed];
}

/**
 * Check if a file path belongs to the stdlib.
 */
export function isStdlibFile(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return (
    resolved === STDLIB_CONTRACTS_DIR ||
    resolved.startsWith(STDLIB_CONTRACTS_DIR + path.sep)
  );
}

/**
 * Return the absolute path to the stdlib contracts directory.
 */
export function getStdlibContractsDir(): string {
  return STDLIB_CONTRACTS_DIR;
}
