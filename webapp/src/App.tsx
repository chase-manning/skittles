import { useState, useEffect, createContext, useContext } from "react";
import { Zap, Shuffle, Code, Shield, Layers, Timer } from "lucide-react";
import "./App.css";

const VersionContext = createContext<string | null>(null);

function useNpmVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    fetch("https://registry.npmjs.org/skittles/latest")
      .then((res) => res.json())
      .then((data) => {
        if (data.version) setVersion(data.version);
      })
      .catch(() => { });
  }, []);
  return version;
}

function Logo({ small }: { small?: boolean }) {
  return (
    <img
      src="/logo.svg"
      alt="Skittles"
      className={`logo ${small ? "logo--small" : ""}`}
    />
  );
}

function Header() {
  return (
    <header className="header">
      <Logo />
      <nav className="nav">
        <a href="https://docs.skittles.dev" className="nav-link">
          Docs
        </a>
        <a href="https://github.com/chase-manning/skittles" target="_blank" rel="noopener noreferrer" className="nav-link">
          GitHub
        </a>
        <a href="https://github.com/chase-manning/skittles/tree/main/example" target="_blank" rel="noopener noreferrer" className="nav-link">
          Examples
        </a>
        <a href="#get-started" className="header-cta">
          <span>Get Started</span>
          <span>&rarr;</span>
        </a>
      </nav>
    </header>
  );
}

function HeroBadge() {
  const version = useContext(VersionContext);
  if (!version) return null;
  return (
    <div className="hero-badge">
      <span className="badge-dot" />
      <span className="badge-text">v{version} &mdash; Now available on npm</span>
    </div>
  );
}

type Token = { text: string; type: "keyword" | "string" | "type" | "comment" | "number" | "plain" | "punctuation" };

function highlightTS(line: string): Token[] {
  const tokens: Token[] = [];
  const keywords = /\b(import|from|export|class|private|constructor|if|throw|new|return|this|const|let|var|function|extends|implements)\b/g;
  const types = /\b(string|number|boolean|void|address|Record|Error|Indexed)\b/g;
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

const heroCode = [
  'import { address, msg } from "skittles";',
  "",
  "export class Token {",
  '  name: string = "MyToken";',
  '  symbol: string = "MTK";',
  "  totalSupply: number = 0;",
  "  private balances: Record<address, number> = {};",
  "",
  "  constructor(initialSupply: number) {",
  "    this.totalSupply = initialSupply;",
  "    this.balances[msg.sender] = initialSupply;",
  "  }",
  "",
  "  transfer(to: address, amount: number): boolean {",
  "    if (this.balances[msg.sender] < amount) {",
  '      throw new Error("Insufficient balance");',
  "    }",
  "    this.balances[msg.sender] -= amount;",
  "    this.balances[to] += amount;",
  "    return true;",
  "  }",
  "}",
];

function CodeWindow() {
  return (
    <div className="code-window">
      <div className="code-header">
        <div className="window-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="code-filename">Token.ts</span>
      </div>
      <div className="code-body">
        {heroCode.map((line, i) => (
          <SyntaxLine key={i} line={line} lang="ts" />
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <HeroBadge />
      <div className="hero-text-wrap">
        <h1 className="hero-title">
          Write smart contracts
          <br />
          in TypeScript.
        </h1>
        <p className="hero-sub">
          Write, test, and deploy EVM smart contracts in pure TypeScript.
          <br />
          The language you know. The blockchain you need.
        </p>
      </div>
      <div className="hero-actions">
        <a href="https://docs.skittles.dev" className="btn-primary">
          <span>Read the Docs</span>
          <span>&rarr;</span>
        </a>
        <a href="https://github.com/chase-manning/skittles" target="_blank" rel="noopener noreferrer" className="btn-secondary">
          <span>View on GitHub</span>
        </a>
      </div>
      <CodeWindow />
    </section>
  );
}

function PipelineStep({
  num,
  title,
  desc,
  color,
}: {
  num: string;
  title: string;
  desc: string;
  color?: string;
}) {
  return (
    <div className="pipeline-step">
      <span className="step-num" style={color ? { color } : undefined}>{num}</span>
      <h3 className="step-title">{title}</h3>
      <p className="step-desc">{desc}</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="how-it-works">
      <span className="section-label">HOW IT WORKS</span>
      <h2 className="section-title">Three stages. Zero configuration.</h2>
      <p className="section-desc">
        Skittles takes your TypeScript classes through a compile pipeline
        <br />
        that outputs standard, auditable Solidity artifacts.
      </p>
      <div className="pipeline">
        <PipelineStep
          num="01"
          title="Parse"
          desc="TypeScript AST is parsed via the official compiler API. Classes become contracts, properties become state variables."
          color="#22D3EE"
        />
        <span className="pipeline-arrow">&rarr;</span>
        <PipelineStep
          num="02"
          title="Generate"
          desc="The IR is converted to valid Solidity. Type mappings, control flow, and optimizations like if/throw → require() are applied."
          color="#A78BFA"
        />
        <span className="pipeline-arrow">&rarr;</span>
        <PipelineStep
          num="03"
          title="Compile"
          desc="Generated Solidity is compiled by Hardhat to produce ABI, bytecode, and standard EVM artifacts."
          color="#22C55E"
        />
      </div>
    </section>
  );
}

function CodeComparisonPanel({
  label,
  lines,
  lang,
  highlighted,
}: {
  label: string;
  lines: string[];
  lang: "ts" | "sol";
  highlighted?: boolean;
}) {
  return (
    <div className={`comparison-panel ${highlighted ? "comparison-panel--highlighted" : ""}`}>
      <div className="comparison-header">
        <div className="window-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="comparison-label">{label}</span>
      </div>
      <div className="comparison-body">
        {lines.map((line, i) => (
          <SyntaxLine key={i} line={line} lang={lang} />
        ))}
      </div>
    </div>
  );
}

const compTsLines = [
  'import { address, msg } from "skittles";',
  "",
  "export class Token {",
  "  totalSupply: number = 0;",
  "  private balances: Record<address, number> = {};",
  "",
  "  constructor(supply: number) {",
  "    this.totalSupply = supply;",
  "    this.balances[msg.sender] = supply;",
  "  }",
  "",
  "  balanceOf(account: address): number {",
  "    return this.balances[account];",
  "  }",
  "",
  "  transfer(to: address, amount: number): boolean {",
  "    if (this.balances[msg.sender] < amount) {",
  '      throw new Error("Insufficient balance");',
  "    }",
  "    this.balances[msg.sender] -= amount;",
  "    this.balances[to] += amount;",
  "    return true;",
  "  }",
  "}",
];

const compSolLines = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.20;",
  "",
  "contract Token {",
  "    uint256 public totalSupply;",
  "    mapping(address => uint256) internal balances;",
  "",
  "    constructor(uint256 supply) {",
  "        totalSupply = supply;",
  "        balances[msg.sender] = supply;",
  "    }",
  "",
  "    function balanceOf(address account)",
  "        public view virtual returns (uint256) {",
  "        return balances[account];",
  "    }",
  "",
  "    function transfer(address to, uint256 amount)",
  "        public virtual returns (bool) {",
  "        require(balances[msg.sender] >= amount,",
  '            "Insufficient balance");',
  "        balances[msg.sender] -= amount;",
  "        balances[to] += amount;",
  "        return true;",
  "    }",
  "}",
];

function CodeComparison() {
  return (
    <section className="code-comparison">
      <span className="section-label">SEE THE OUTPUT</span>
      <h2 className="section-title">TypeScript in. Solidity out.</h2>
      <p className="section-desc">
        Every generated Solidity file is human&#8209;readable and auditable.
        <br />
        Notice the automatic require() optimization, view inference, and mapping translation.
      </p>
      <div className="comparison-row">
        <CodeComparisonPanel label="Token.ts" lines={compTsLines} lang="ts" />
        <CodeComparisonPanel label="Token.sol — generated" lines={compSolLines} lang="sol" highlighted />
      </div>
    </section>
  );
}

const featureCards = [
  {
    icon: Zap,
    title: "Auto Mutability",
    desc: "Functions are automatically marked pure, view, or payable by analyzing what they read and write. No annotations needed.",
    color: "#F59E0B",
  },
  {
    icon: Shuffle,
    title: "Type Mapping",
    desc: "number → uint256, Record → mapping, interface → struct. Your TypeScript types translate naturally to Solidity.",
    color: "#F97316",
  },
  {
    icon: Code,
    title: "Full IDE Support",
    desc: "Autocomplete, type checking, go-to-definition, inline errors. Your editor already supports it because it's just TypeScript.",
    color: "#22D3EE",
  },
  {
    icon: Shield,
    title: "Smart Optimizations",
    desc: "if/throw auto-converts to require(). private maps to internal for gas savings. The compiler does the work so you don't have to.",
    color: "#22C55E",
  },
  {
    icon: Layers,
    title: "Standard Output",
    desc: "Generated Solidity compiles to standard ABI and bytecode via Hardhat, compatible with ethers.js, viem, Foundry, and every other EVM tool.",
    color: "#6366F1",
  },
  {
    icon: Timer,
    title: "Incremental Builds",
    desc: "SHA256-based file caching. Only changed files recompile. Shared type changes trigger dependent recompilation automatically.",
    color: "#A78BFA",
  },
];

function Features() {
  return (
    <section className="features">
      <span className="section-label">FEATURES</span>
      <h2 className="section-title">
        Everything you need.
        <br />
        Nothing you don't.
      </h2>
      <div className="features-grid">
        {featureCards.map((card) => (
          <div key={card.title} className="feature-card">
            <card.icon className="feature-icon" size={28} style={{ color: card.color }} />
            <h3 className="feature-title">{card.title}</h3>
            <p className="feature-desc">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className="quick-start">
      <span className="section-label">QUICK START</span>
      <h2 className="section-title">Three commands. Zero config.</h2>
      <div className="terminal">
        <div className="terminal-header">
          <div className="window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="terminal-label">terminal</span>
        </div>
        <div className="terminal-body">
          <div className="terminal-line">
            <span className="terminal-prompt">$</span>
            <span className="terminal-cmd">npm install skittles</span>
          </div>
          <div className="terminal-comment">&nbsp; # Install the compiler</div>
          <div className="terminal-blank">&nbsp;</div>
          <div className="terminal-line">
            <span className="terminal-prompt">$</span>
            <span className="terminal-cmd">npx skittles init</span>
          </div>
          <div className="terminal-comment">
            &nbsp; # Scaffold contract, tests, and config
          </div>
          <div className="terminal-blank">&nbsp;</div>
          <div className="terminal-line">
            <span className="terminal-prompt">$</span>
            <span className="terminal-cmd">npm run test</span>
          </div>
          <div className="terminal-comment">
            &nbsp; # Compile contracts and run the test suite
          </div>
          <div className="terminal-blank">&nbsp;</div>
          <div className="terminal-success">
            &nbsp; ✓ 5 tests passed
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="final-cta">
      <h2 className="final-cta-title">
        Start writing smart contracts
        <br />
        in the language you already know.
      </h2>
      <p className="final-cta-sub">
        MIT licensed. Node.js 20+. Works with every EVM toolchain.
      </p>
      <div className="final-cta-actions">
        <a href="https://docs.skittles.dev" className="btn-primary btn-primary--lg">
          <span>Read the Docs</span>
          <span>&rarr;</span>
        </a>
        <a href="https://github.com/chase-manning/skittles" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-secondary--lg">
          <span>GitHub</span>
        </a>
      </div>
      <span className="final-cta-install">npm install skittles</span>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo small />
          <p className="footer-tagline">
            TypeScript to Solidity compiler.
            <br />
            Write smart contracts in the language you know.
          </p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <span className="footer-col-title">PRODUCT</span>
            <a href="https://docs.skittles.dev" className="footer-link">Documentation</a>
            <a href="https://github.com/chase-manning/skittles/tree/main/example" target="_blank" rel="noopener noreferrer" className="footer-link">Examples</a>
            <a href="https://github.com/chase-manning/skittles/releases" target="_blank" rel="noopener noreferrer" className="footer-link">Changelog</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">COMMUNITY</span>
            <a href="https://github.com/chase-manning/skittles" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
            <a href="https://www.npmjs.com/package/skittles" target="_blank" rel="noopener noreferrer" className="footer-link">npm</a>
            <a href="https://github.com/chase-manning/skittles/issues" target="_blank" rel="noopener noreferrer" className="footer-link">Issues</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">LEGAL</span>
            <a href="https://github.com/chase-manning/skittles/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="footer-link">MIT License</a>
          </div>
        </div>
      </div>
      <div className="footer-divider" />
      <div className="footer-bottom">
        <span className="footer-copyright">
          &copy; 2025 Chase Manning. Built with TypeScript.
        </span>
        <FooterVersion />
      </div>
    </footer>
  );
}

function FooterVersion() {
  const version = useContext(VersionContext);
  if (!version) return null;
  return <span className="footer-version">v{version}</span>;
}

function Divider() {
  return <div className="divider" />;
}

function App() {
  const version = useNpmVersion();
  return (
    <VersionContext.Provider value={version}>
      <div className="page">
        <Header />
        <Hero />
        <Divider />
        <HowItWorks />
        <Divider />
        <CodeComparison />
        <Divider />
        <Features />
        <Divider />
        <QuickStart />
        <Divider />
        <FinalCTA />
        <Divider />
        <Footer />
      </div>
    </VersionContext.Provider>
  );
}

export default App;
