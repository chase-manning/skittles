import WindowDots from "./WindowDots.tsx";

function QuickStart() {
  return (
    <section className="quick-start">
      <span className="section-label">QUICK START</span>
      <h2 className="section-title">Two commands. Zero config.</h2>
      <div className="terminal">
        <div className="terminal-header">
          <WindowDots />
          <span className="terminal-label">terminal</span>
        </div>
        <div className="terminal-body">
          <div className="terminal-line">
            <span className="terminal-prompt">$</span>
            <span className="terminal-cmd">npx skittles@latest init</span>
          </div>
          <div className="terminal-comment">
            &nbsp; # Scaffold contract, tests, config, and install dependencies
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

export default QuickStart;
