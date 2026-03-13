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
      <span className="section-label">WHY SKITTLES</span>
      <h2 className="section-title">Built for TypeScript developers.</h2>
      <p className="section-desc">
        No new languages to learn. No complex tooling to configure. Just TypeScript.
      </p>
      <div className="pipeline">
        <PipelineStep
          num="01"
          title="Write TypeScript"
          desc="Write your smart contracts as TypeScript classes. Use the types and syntax you already know — autocomplete and type checking included."
          color="#22D3EE"
        />
        <PipelineStep
          num="02"
          title="Test Locally"
          desc="Run your tests against a local simulated blockchain. Catch bugs before they cost real money."
          color="#A78BFA"
        />
        <PipelineStep
          num="03"
          title="Deploy"
          desc="Deploy your contracts to any EVM blockchain. Ethereum, Polygon, Arbitrum, Base — they all work."
          color="#22C55E"
        />
      </div>
    </section>
  );
}

export default HowItWorks;
