import { execSync } from "child_process";
import type { FormattingConfig } from "../types/index.ts";

/**
 * Apply formatting options to generated Solidity source code.
 *
 * The codegen produces Solidity with 4-space indentation and same-line braces.
 * This function transforms the output to match the user's preferred style.
 */
export function formatSolidity(
  source: string,
  formatting: Required<FormattingConfig>
): string {
  let result = source;

  // Apply indentation style (codegen uses 4 spaces as the base unit)
  if (formatting.indent !== 4) {
    result = applyIndentation(result, formatting.indent);
  }

  // Apply brace style
  if (formatting.braceStyle === "next-line") {
    result = applyNextLineBraces(result);
  }

  // Apply bracket spacing
  if (!formatting.bracketSpacing) {
    result = removeBracketSpacing(result);
  }

  // Run external formatter (forge fmt) if requested
  if (formatting.formatOutput) {
    result = runExternalFormatter(result);
  }

  return result;
}

/**
 * Convert 4-space indentation to the desired style.
 */
function applyIndentation(source: string, indent: number | "tab"): string {
  const lines = source.split("\n");
  const replacement = indent === "tab" ? "\t" : " ".repeat(indent);

  return lines
    .map((line) => {
      // Count leading groups of 4 spaces
      let leadingSpaces = 0;
      while (
        leadingSpaces + 4 <= line.length &&
        line.substring(leadingSpaces, leadingSpaces + 4) === "    "
      ) {
        leadingSpaces += 4;
      }
      const indentLevel = leadingSpaces / 4;
      if (indentLevel === 0) return line;
      return replacement.repeat(indentLevel) + line.substring(leadingSpaces);
    })
    .join("\n");
}

/**
 * Convert same-line braces to next-line braces.
 *
 * Transforms patterns like:
 *   contract Foo {
 * Into:
 *   contract Foo
 *   {
 */
function applyNextLineBraces(source: string): string {
  const lines = source.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Match lines ending with " {" that are declarations (not single-line statements)
    if (trimmed.endsWith(" {") && isDeclarationLine(trimmed)) {
      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      // Remove the trailing " {"
      result.push(trimmed.slice(0, -2));
      result.push(`${indent}{`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Determine if a line is a declaration (contract, function, struct, etc.)
 * as opposed to a single-line statement like `if (x) { return; }`.
 */
function isDeclarationLine(trimmed: string): boolean {
  // Match contract/interface/struct/enum/function/modifier/constructor/if/else/for/while declarations
  return /^\s*(contract |abstract contract |interface |struct |enum |function |modifier |constructor|if\s*\(|else\s*\{|else if\s*\(|for\s*\(|while\s*\(|do\s*\{|unchecked\s*\{)/.test(
    trimmed
  );
}

/**
 * Remove bracket spacing from mapping declarations and other bracket-spaced constructs.
 * e.g. `mapping( address => uint256 )` → `mapping(address => uint256)`
 */
function removeBracketSpacing(source: string): string {
  // Remove spaces after opening parens and before closing parens in declarations
  return source
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

/**
 * Attempt to run forge fmt on the source code.
 * Falls back to returning the source unchanged if forge is not available.
 */
function runExternalFormatter(source: string): string {
  try {
    // Try forge fmt first (reads from stdin, writes to stdout)
    const formatted = execSync("forge fmt --raw -", {
      input: source,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return formatted;
  } catch {
    // forge fmt not available, try prettier with solidity plugin
    try {
      const formatted = execSync(
        'prettier --parser solidity --plugin prettier-plugin-solidity',
        {
          input: source,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 10000,
        }
      );
      return formatted;
    } catch {
      // No external formatter available, return source as-is
      return source;
    }
  }
}
