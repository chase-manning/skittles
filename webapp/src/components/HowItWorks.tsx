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
      <h2 className="section-title">From TypeScript to deployed contract</h2>
      <p className="section-desc">
        Write TypeScript classes, test locally with Hardhat and deploy the compiled output.
      </p>
      <div className="pipeline">
        <PipelineStep
          num="01"
          title="Write TypeScript"
          desc="Write contracts as exported TypeScript classes in contracts/, with your editor's type checking and autocomplete. Skittles parses each class and generates Solidity."
          color="#22D3EE"
        />
        <PipelineStep
          num="02"
          title="Test locally"
          desc="Run Mocha and Chai tests with Hardhat 3 on its local simulated network. The npm run test script compiles first."
          color="#A78BFA"
        />
        <PipelineStep
          num="03"
          title="Deploy"
          desc="Use Hardhat or Foundry with the compiled ABI and bytecode to deploy to EVM chains such as Ethereum, Polygon, Arbitrum and Base."
          color="#22C55E"
        />
      </div>
    </section>
  );
}

export default HowItWorks;
