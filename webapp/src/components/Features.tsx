import { Zap, Shuffle, Code, Shield, Layers, Timer } from "lucide-react";

const featureCards = [
  {
    icon: Zap,
    title: "Auto Mutability",
    desc: "Skittles checks what each function reads, writes and calls, then marks it pure, view, payable or nonpayable. No annotations are needed.",
    color: "#F59E0B",
  },
  {
    icon: Shuffle,
    title: "Type Mapping",
    desc: "TypeScript number becomes uint256, while Record and Map become mappings and type aliases become structs. Arrays, enums and interfaces work too.",
    color: "#F97316",
  },
  {
    icon: Code,
    title: "Full IDE Support",
    desc: "Contracts are plain TypeScript files, so your editor gives you autocomplete, type checking, go-to-definition and inline errors with no plugin.",
    color: "#22D3EE",
  },
  {
    icon: Shield,
    title: "Solidity Conventions",
    desc: "An if block that only throws compiles to require(). TypeScript private and protected members become internal so child contracts can use them.",
    color: "#22C55E",
  },
  {
    icon: Layers,
    title: "Standard Output",
    desc: "Output is standard Solidity, so the ABI and bytecode work with ethers.js, viem, Hardhat and Foundry. You can verify it on Etherscan.",
    color: "#6366F1",
  },
  {
    icon: Timer,
    title: "Incremental Builds",
    desc: "Skittles hashes each file with SHA-256 and reads unchanged files from cache. Changing shared types, constants or functions recompiles dependent files.",
    color: "#A78BFA",
  },
];

function Features() {
  return (
    <section className="features">
      <span className="section-label">FEATURES</span>
      <h2 className="section-title">
        Write EVM contracts
        <br />
        as TypeScript classes
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
