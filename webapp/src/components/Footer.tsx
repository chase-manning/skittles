import { useContext } from "react";
import { URLS } from "../constants.ts";
import { VersionContext } from "./VersionContext.tsx";
import Logo from "./Logo.tsx";

function FooterVersion() {
  const version = useContext(VersionContext);
  if (!version) return null;
  return <span className="footer-version">v{version}</span>;
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo small />
          <p className="footer-tagline">
            Write smart contracts in TypeScript.
            <br />
            The language you already know.
          </p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <span className="footer-col-title">PRODUCT</span>
            <a href={URLS.docs} className="footer-link">Documentation</a>
            <a href="#playground" className="footer-link">Playground</a>
            <a href={URLS.githubExamples} target="_blank" rel="noopener noreferrer" className="footer-link">Examples</a>
            <a href={URLS.githubReleases} target="_blank" rel="noopener noreferrer" className="footer-link">Changelog</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">COMMUNITY</span>
            <a href={URLS.github} target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
            <a href={URLS.npm} target="_blank" rel="noopener noreferrer" className="footer-link">npm</a>
            <a href={URLS.githubIssues} target="_blank" rel="noopener noreferrer" className="footer-link">Issues</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">LEGAL</span>
            <a href={URLS.githubLicense} target="_blank" rel="noopener noreferrer" className="footer-link">MIT License</a>
          </div>
        </div>
      </div>
      <div className="footer-divider" />
      <div className="footer-bottom">
        <span className="footer-copyright">
          &copy; 2025 Chase Manning. Built with TypeScript.
        </span>
        <FooterVersion />
      </div>
    </footer>
  );
}

export default Footer;
