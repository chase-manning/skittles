import { URLS } from "../constants.ts";

function FinalCTA() {
  return (
    <section className="final-cta">
      <h2 className="final-cta-title">
        Start writing smart contracts
        <br />
        as TypeScript classes
      </h2>
      <p className="final-cta-sub">
        MIT licensed. Node.js 22+. Works with Hardhat and Foundry.
      </p>
      <div className="final-cta-actions">
        <a href={URLS.docs} className="btn-primary btn-primary--lg">
          <span>Read the docs</span>
          <span>&rarr;</span>
        </a>
        <a href={URLS.github} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-secondary--lg">
          <span>GitHub</span>
        </a>
      </div>
      <span className="final-cta-install">npx skittles@latest init</span>
    </section>
  );
}

export default FinalCTA;
