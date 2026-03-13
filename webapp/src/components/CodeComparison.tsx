import { EXAMPLES, COMPARISON_SOL_LINES } from "../examples.ts";
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

const compTsLines = EXAMPLES.Token.trimEnd().split("\n");

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
        <CodeComparisonPanel label="Token.sol — generated" lines={COMPARISON_SOL_LINES} lang="sol" highlighted />
      </div>
      <a href="#playground" className="btn-primary btn-primary--lg comparison-cta">
        <span>Open the Playground</span>
        <span>&rarr;</span>
      </a>
    </section>
  );
}

export default CodeComparison;
