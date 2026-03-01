import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STDLIB_CONTRACTS_DIR = path.resolve(__dirname, "../../stdlib/contracts");

interface StdlibEntry {
  className: string;
  filePath: string;
}

let _registry: StdlibEntry[] | null = null;

function buildRegistry(): StdlibEntry[] {
  const entries: StdlibEntry[] = [];
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) {
        walk(path.join(dir, item.name));
      } else if (
        item.name.endsWith(".ts") &&
        !item.name.endsWith(".d.ts") &&
        item.name !== "index.ts"
      ) {
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

function getRegistry(): StdlibEntry[] {
  if (!_registry) _registry = buildRegistry();
  return _registry;
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
    const name = queue.pop()!;
    const entry = registry.find((e) => e.className === name);
    if (!entry || needed.has(entry.filePath)) continue;
    needed.add(entry.filePath);

    const source = fs.readFileSync(entry.filePath, "utf-8");
    const extendsMatch = source.match(/extends\s+(\w+)/g);
    if (extendsMatch) {
      for (const m of extendsMatch) {
        const parent = m.replace(/^extends\s+/, "");
        if (!needed.has(parent)) queue.push(parent);
      }
    }
  }

  return [...needed];
}

/**
 * Check if a file path belongs to the stdlib.
 */
export function isStdlibFile(filePath: string): boolean {
  return path.resolve(filePath).startsWith(STDLIB_CONTRACTS_DIR);
}

/**
 * Return the absolute path to the stdlib contracts directory.
 */
export function getStdlibContractsDir(): string {
  return STDLIB_CONTRACTS_DIR;
}
