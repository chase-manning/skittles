import { Zap, Shuffle, Code, Shield, Layers, Timer } from "lucide-react";

const featureCards = [
  {
    icon: Zap,
    title: "Inferred mutability",
    desc: "Skittles infers pure, view and payable from what each function reads and writes, including this.method() calls. You don't need annotations.",
    color: "#F59E0B",
  },
  {
    icon: Shuffle,
    title: "Type mapping",
    desc: "Use number for uint256, Record or Map for mappings and type aliases for structs. Arrays, enums, interfaces, address and bytes are supported.",
    color: "#F97316",
  },
  {
    icon: Code,
    title: "Editor support",
    desc: "Contracts are ordinary TypeScript files, so your editor gives you autocomplete, type checking, go-to-definition and inline errors without a plugin.",
    color: "#22D3EE",
  },
  {
    icon: Shield,
    title: "Solidity conventions",
    desc: "An if statement that only throws an Error compiles to require(). Members marked private or protected become internal, and public stays public.",
    color: "#22C55E",
  },
  {
    icon: Layers,
    title: "Standard output",
    desc: "Output is standard Solidity, so ABI and bytecode work with ethers.js, viem, Hardhat and Foundry. You can verify the source on Etherscan.",
    color: "#6366F1",
  },
  {
    icon: Timer,
    title: "Incremental builds",
    desc: "Unchanged files use a SHA-256 cache. Editing a parent contract recompiles its subclasses, and editing a shared definition recompiles every file.",
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
