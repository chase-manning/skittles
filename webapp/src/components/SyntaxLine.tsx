type Token = { text: string; type: "keyword" | "string" | "type" | "comment" | "number" | "plain" | "punctuation" };

function highlightTS(line: string): Token[] {
  const tokens: Token[] = [];
  const keywords = /\b(import|from|export|class|private|constructor|if|throw|new|return|this|const|let|var|function|extends|implements)\b/g;
  const types = /\b(string|number|boolean|void|address|Record|Map|Error|Indexed)\b/g;
  const strings = /"[^"]*"|'[^']*'/g;
  const numbers = /\b\d+\b/g;
  const comments = /\/\/.*/g;

  const spans: { start: number; end: number; type: Token["type"] }[] = [];

  for (const r of [
    { regex: comments, type: "comment" as const },
    { regex: strings, type: "string" as const },
    { regex: keywords, type: "keyword" as const },
    { regex: types, type: "type" as const },
    { regex: numbers, type: "number" as const },
  ]) {
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

function highlightSol(line: string): Token[] {
  const tokens: Token[] = [];
  const keywords = /\b(pragma|solidity|contract|function|constructor|mapping|public|internal|virtual|view|returns|require|return|event|emit|modifier|memory|storage|calldata|payable|external|pure|indexed)\b/g;
  const types = /\b(uint256|address|bool|string|bytes|bytes32|int256)\b/g;
  const strings = /"[^"]*"|'[^']*'/g;
  const numbers = /\b\d+(\.\d+)?\b/g;
  const comments = /\/\/.*/g;

  const spans: { start: number; end: number; type: Token["type"] }[] = [];

  for (const r of [
    { regex: comments, type: "comment" as const },
    { regex: strings, type: "string" as const },
    { regex: keywords, type: "keyword" as const },
    { regex: types, type: "type" as const },
    { regex: numbers, type: "number" as const },
  ]) {
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

function SyntaxLine({ line, lang }: { line: string; lang: "ts" | "sol" }) {
  if (!line.trim()) return <div className="code-line">{"\u00A0"}</div>;
  const tokens = lang === "ts" ? highlightTS(line) : highlightSol(line);
  return (
    <div className="code-line">
      {tokens.map((t, i) => (
        <span key={i} className={`tok-${t.type}`}>{t.text}</span>
      ))}
    </div>
  );
}

export default SyntaxLine;
