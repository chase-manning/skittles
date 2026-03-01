import { useState, useEffect, useCallback, useRef } from "react";
import { compileSource } from "./compiler.ts";
import "./Playground.css";

const EXAMPLES: Record<string, string> = {
  Token: `import { address, msg } from "skittles";

export class Token {
  name: string = "MyToken";
  symbol: string = "MTK";
  totalSupply: number = 0;
  private balances: Record<address, number> = {};

  constructor(initialSupply: number) {
    this.totalSupply = initialSupply;
    this.balances[msg.sender] = initialSupply;
  }

  balanceOf(account: address): number {
    return this.balances[account];
  }

  transfer(to: address, amount: number): boolean {
    if (this.balances[msg.sender] < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances[msg.sender] -= amount;
    this.balances[to] += amount;
    return true;
  }
}
`,
  Counter: `export class Counter {
  count: number = 0;

  increment(): void {
    this.count += 1;
  }

  decrement(): void {
    if (this.count <= 0) {
      throw new Error("Counter cannot go below zero");
    }
    this.count -= 1;
  }

  getCount(): number {
    return this.count;
  }
}
`,
  Ownable: `import { address, msg } from "skittles";

export class Ownable {
  owner: address = msg.sender;

  transferOwnership(newOwner: address): void {
    if (msg.sender !== this.owner) {
      throw new Error("Not the owner");
    }
    this.owner = newOwner;
  }
}
`,
  Staking: `import { address, msg, block } from "skittles";

export class Staking {
  private stakes: Record<address, number> = {};
  private stakedAt: Record<address, number> = {};
  totalStaked: number = 0;

  stake(amount: number): void {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    this.stakes[msg.sender] += amount;
    this.stakedAt[msg.sender] = block.timestamp;
    this.totalStaked += amount;
  }

  withdraw(): void {
    const staked = this.stakes[msg.sender];
    if (staked <= 0) {
      throw new Error("Nothing staked");
    }
    this.stakes[msg.sender] = 0;
    this.totalStaked -= staked;
  }

  stakeOf(account: address): number {
    return this.stakes[account];
  }
}
`,
};

const DEFAULT_EXAMPLE = "Token";

function encodeSource(source: string): string {
  return btoa(encodeURIComponent(source));
}

function decodeSource(encoded: string): string | null {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return null;
  }
}

function getInitialSource(): string {
  const hash = window.location.hash;
  const codeMatch = hash.match(/code=([^&]*)/);
  if (codeMatch) {
    const decoded = decodeSource(codeMatch[1]);
    if (decoded) return decoded;
  }
  return EXAMPLES[DEFAULT_EXAMPLE];
}

// Simple syntax highlighting for Solidity output
type Token = { text: string; type: "keyword" | "string" | "type" | "comment" | "number" | "plain" };

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

function SolLine({ line }: { line: string }) {
  if (!line.trim()) return <div className="pg-code-line">{"\u00A0"}</div>;
  const tokens = highlightSol(line);
  return (
    <div className="pg-code-line">
      {tokens.map((t, i) => (
        <span key={i} className={`tok-${t.type}`}>{t.text}</span>
      ))}
    </div>
  );
}

export default function Playground() {
  const [source, setSource] = useState(getInitialSource);
  const [solidity, setSolidity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedExample, setSelectedExample] = useState(() => {
    const hash = window.location.hash;
    if (hash.includes("code=")) return "";
    return DEFAULT_EXAMPLE;
  });
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compile = useCallback((src: string) => {
    const result = compileSource(src);
    setSolidity(result.solidity);
    setError(result.error);
  }, []);

  // Compile on mount
  useEffect(() => {
    compile(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSourceChange = (value: string) => {
    setSource(value);
    setSelectedExample("");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => compile(value), 300);
  };

  const handleExampleChange = (name: string) => {
    if (!name || !EXAMPLES[name]) return;
    setSelectedExample(name);
    setSource(EXAMPLES[name]);
    compile(EXAMPLES[name]);
    // Clear code from hash when selecting an example
    window.location.hash = "playground";
  };

  const handleShare = () => {
    const encoded = encodeSource(source);
    const url = `${window.location.origin}${window.location.pathname}#playground&code=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const solLines = solidity.split("\n");

  return (
    <div className="pg">
      <header className="pg-header">
        <div className="pg-header-left">
          <a href="#" className="pg-logo">
            <img src="/logo.svg" alt="Skittles" className="pg-logo-img" />
          </a>
          <span className="pg-title">Playground</span>
        </div>
        <div className="pg-header-right">
          <select
            className="pg-select"
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
          >
            <option value="" disabled>
              Load Example…
            </option>
            {Object.keys(EXAMPLES).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="pg-share-btn" onClick={handleShare}>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </header>

      <div className="pg-main">
        <div className="pg-pane pg-pane--input">
          <div className="pg-pane-header">
            <div className="pg-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="pg-pane-label">Contract.ts</span>
          </div>
          <textarea
            className="pg-editor"
            value={source}
            onChange={(e) => handleSourceChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>

        <div className="pg-pane pg-pane--output">
          <div className="pg-pane-header">
            <div className="pg-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="pg-pane-label">
              {error ? "Error" : "Contract.sol — generated"}
            </span>
          </div>
          <div className="pg-output">
            {error ? (
              <div className="pg-error">{error}</div>
            ) : (
              solLines.map((line, i) => <SolLine key={i} line={line} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
