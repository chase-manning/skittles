/**
 * Extract class names referenced in `extends` clauses from source code.
 */
export function findExtendsReferences(source: string): string[] {
  return [...source.matchAll(/extends\s+(\w+)/g)].map((m) => m[1]);
}
