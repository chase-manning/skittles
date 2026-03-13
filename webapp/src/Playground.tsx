import { useState, useCallback, useRef, useEffect, type ChangeEvent } from "react";
import { compileSource } from "./compiler.ts";
import "./Playground.css";
import { highlightTS, highlightSol } from "./syntax-highlight.ts";
import { EXAMPLES } from "./examples.ts";

const DEFAULT_EXAMPLE = "Token";
// Debounce delay for recompile-on-change (aligned with src/commands/compile.ts)
const DEBOUNCE_MS = 300;

function encodeSource(source: string): string {
  return btoa(encodeURIComponent(source));
}

function decodeSource(encoded: string): string | null {
  try {
    return decodeURIComponent(atob(encoded));
  } catch (_ignored) {
    /* Invalid base64 or URI encoding, return null */
    return null;
  }
}

function getInitialSource(): string {
  const hash = window.location.hash;
  const codeMatch = hash.match(/code=([^&]*)/);
  if (codeMatch) {
    const decoded = decodeSource(codeMatch[1]);
    if (decoded) return decoded;
  }
  return EXAMPLES[DEFAULT_EXAMPLE];
}

function CodeLine({ line, lang }: { line: string; lang: 'ts' | 'sol' }) {
  if (!line.trim()) return <div className="pg-code-line">{"\u00A0"}</div>;
  const tokens = lang === 'ts' ? highlightTS(line) : highlightSol(line);
  return (
    <div className="pg-code-line">
      {tokens.map((t, i) => (
        <span key={`${i}-${t.type}`} className={`tok-${t.type}`}>{t.text}</span>
      ))}
    </div>
  );
}

let _cachedInitial: { source: string; solidity: string; error: string | null } | null = null;
function getInitialData() {
  if (!_cachedInitial) {
    const source = getInitialSource();
    const result = compileSource(source);
    _cachedInitial = { source, solidity: result.solidity, error: result.error };
  }
  return _cachedInitial;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _cachedInitial = null;
  });
}

export default function Playground() {
  const [source, setSource] = useState(() => getInitialData().source);
  const [solidity, setSolidity] = useState(() => getInitialData().solidity);
  const [error, setError] = useState<string | null>(() => getInitialData().error);
  const [selectedExample, setSelectedExample] = useState(() => {
    const hash = window.location.hash;
    if (hash.includes("code=")) return "";
    return DEFAULT_EXAMPLE;
  });
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const compile = useCallback((src: string) => {
    const result = compileSource(src);
    setSolidity(result.solidity);
    setError(result.error);
  }, []);

  const handleSourceChange = (value: string) => {
    setSource(value);
    setSelectedExample("");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => compile(value), DEBOUNCE_MS);
  };

  const handleExampleChange = (name: string) => {
    if (!name || !EXAMPLES[name]) return;
    setSelectedExample(name);
    setSource(EXAMPLES[name]);
    compile(EXAMPLES[name]);
    // Clear code from hash when selecting an example
    window.location.hash = "playground";
  };

  const handleShare = async () => {
    const encoded = encodeSource(source);
    const url = `${window.location.origin}${window.location.pathname}#playground&code=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_ignored) {
      /* Clipboard API not available, fall back to prompt */
      window.prompt("Copy this URL to share:", url);
    }
  };

  const solLines = solidity.split("\n");

  return (
    <div className="pg">
      <header className="pg-header">
        <div className="pg-header-left">
          <a href="/" className="pg-logo">
            <img src="/logo.svg" alt="Skittles" className="pg-logo-img" />
          </a>
          <span className="pg-title">Playground</span>
        </div>
        <div className="pg-header-right">
          <select
            className="pg-select"
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
            aria-label="Load example contract"
          >
            <option value="" disabled>
              Load Example…
            </option>
            {Object.keys(EXAMPLES).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="pg-share-btn" onClick={handleShare}>
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </header>

      <div className="pg-main">
        <div className="pg-pane pg-pane--input">
          <div className="pg-pane-header">
            <div className="pg-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="pg-pane-label">Contract.ts</span>
          </div>
          <div className="pg-editor-wrap">
            <pre
              ref={highlightRef}
              className="pg-editor-highlight"
              aria-hidden="true"
            >
              {source.split("\n").map((line, i) => (
                <CodeLine key={`${i}-${line}`} line={line} lang="ts" />
              ))}
            </pre>
            <textarea
              ref={textareaRef}
              className="pg-editor"
              value={source}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                handleSourceChange(e.target.value)
              }
              aria-label="TypeScript contract source editor"
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const ta = e.currentTarget;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  const newValue =
                    source.substring(0, start) + "  " + source.substring(end);
                  handleSourceChange(newValue);
                  requestAnimationFrame(() => {
                    ta.selectionStart = ta.selectionEnd = start + 2;
                  });
                }
              }}
              onScroll={syncScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        </div>

        <div className="pg-pane pg-pane--output">
          <div className="pg-pane-header">
            <div className="pg-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="pg-pane-label">
              {error ? "Error" : "Contract.sol — generated"}
            </span>
          </div>
          <div className="pg-output">
            {error ? (
              <div className="pg-error">{error}</div>
            ) : (
              solLines.map((line, i) => <CodeLine key={`${i}-${line}`} line={line} lang="sol" />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
