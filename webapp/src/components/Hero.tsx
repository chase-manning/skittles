import { useContext } from "react";
import { URLS } from "../constants.ts";
import { VersionContext } from "./VersionContext.tsx";
import WindowDots from "./WindowDots.tsx";
import SyntaxLine from "./SyntaxLine.tsx";

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
        <WindowDots />
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
        <a href={URLS.docs} className="btn-primary">
          <span>Read the Docs</span>
          <span>&rarr;</span>
        </a>
      </div>
      <CodeWindow />
    </section>
  );
}

export default Hero;
