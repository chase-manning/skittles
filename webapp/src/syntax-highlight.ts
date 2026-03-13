export type Token = { text: string; type: "keyword" | "string" | "type" | "comment" | "number" | "plain" | "punctuation" };

function highlightLine(line: string, rules: { regex: RegExp; type: Token["type"] }[]): Token[] {
  const tokens: Token[] = [];

  const spans: { start: number; end: number; type: Token["type"] }[] = [];

  for (const r of rules) {
    let m;
    while ((m = r.regex.exec(line)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type: r.type });
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const merged: typeof spans = [];
  for (const s of spans) {
    if (merged.length > 0 && s.start < merged[merged.length - 1].end) continue;
    merged.push(s);
  }

  let cursor = 0;
  for (const s of merged) {
    if (cursor < s.start) {
      tokens.push({ text: line.slice(cursor, s.start), type: "plain" });
    }
    tokens.push({ text: line.slice(s.start, s.end), type: s.type });
    cursor = s.end;
  }
  if (cursor < line.length) {
    tokens.push({ text: line.slice(cursor), type: "plain" });
  }

  return tokens.length > 0 ? tokens : [{ text: line, type: "plain" }];
}

const SHARED_RULES: { regex: RegExp; type: Token["type"] }[] = [
  { regex: /\/\/.*/g, type: "comment" },
  { regex: /"[^"]*"|'[^']*'/g, type: "string" },
];

export function highlightTS(line: string): Token[] {
  return highlightLine(line, [
    ...SHARED_RULES,
    { regex: /\b(import|from|export|class|private|constructor|if|throw|new|return|this|const|let|var|function|extends|implements)\b/g, type: "keyword" },
    { regex: /\b(string|number|boolean|void|address|Record|Map|Error|Indexed)\b/g, type: "type" },
    { regex: /\b\d+\b/g, type: "number" },
  ]);
}

export function highlightSol(line: string): Token[] {
  return highlightLine(line, [
    ...SHARED_RULES,
    { regex: /\b(pragma|solidity|contract|function|constructor|mapping|public|internal|virtual|view|returns|require|return|event|emit|modifier|memory|storage|calldata|payable|external|pure|indexed)\b/g, type: "keyword" },
    { regex: /\b(uint256|address|bool|string|bytes|bytes32|int256)\b/g, type: "type" },
    { regex: /\b\d+(\.\d+)?\b/g, type: "number" },
  ]);
}
