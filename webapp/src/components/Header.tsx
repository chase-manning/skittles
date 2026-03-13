import { URLS } from "../constants.ts";
import Logo from "./Logo.tsx";

function Header() {
  return (
    <header className="header">
      <Logo />
      <nav className="nav">
        <a href="#playground" className="nav-link">
          Playground
        </a>
        <a href={URLS.docs} className="nav-link">
          Docs
        </a>
        <a href={URLS.github} target="_blank" rel="noopener noreferrer" className="nav-link">
          GitHub
        </a>
        <a href={URLS.githubExamples} target="_blank" rel="noopener noreferrer" className="nav-link">
          Examples
        </a>
        <a href={URLS.npm} target="_blank" rel="noopener noreferrer" className="nav-link">
          npm
        </a>
        <a href="#get-started" className="header-cta">
          <span>Get Started</span>
          <span>&rarr;</span>
        </a>
      </nav>
    </header>
  );
}

export default Header;
