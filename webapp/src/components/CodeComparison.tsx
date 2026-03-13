import WindowDots from "./WindowDots.tsx";
import SyntaxLine from "./SyntaxLine.tsx";

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
        <WindowDots />
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
      <span className="section-label">UNDER THE HOOD</span>
      <h2 className="section-title">Compiles to auditable Solidity.</h2>
      <p className="section-desc">
        Under the hood, Skittles compiles your TypeScript to clean, readable Solidity. This means your contracts can be audited by security professionals and verified on block explorers like Etherscan.
      </p>
      <div className="comparison-row">
        <CodeComparisonPanel label="Token.ts" lines={compTsLines} lang="ts" />
        <CodeComparisonPanel label="Token.sol — generated" lines={compSolLines} lang="sol" highlighted />
      </div>
      <a href="#playground" className="btn-primary btn-primary--lg comparison-cta">
        <span>Open the Playground</span>
        <span>&rarr;</span>
      </a>
    </section>
  );
}

export default CodeComparison;
