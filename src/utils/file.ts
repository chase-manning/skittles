import fs from "fs";
import path from "path";

/**
 * Recursively find all TypeScript files in a directory
 */
export function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Read a file and return its contents
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write content to a file, creating directories as needed
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Remove a directory and all its contents
 */
export function removeDirectory(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
