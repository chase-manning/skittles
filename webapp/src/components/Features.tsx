import { Zap, Shuffle, Code, Shield, Layers, Timer } from "lucide-react";

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
    desc: "Use `number` for amounts, `Record` for key-value storage, `address` for wallets. Your TypeScript types just work.",
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

export default Features;
