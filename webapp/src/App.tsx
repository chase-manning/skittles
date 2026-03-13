import { useState, useEffect, lazy, Suspense } from "react";
import "./App.css";
import { VersionContext } from "./components/VersionContext.tsx";
import Header from "./components/Header.tsx";
import Hero from "./components/Hero.tsx";
import HowItWorks from "./components/HowItWorks.tsx";
import CodeComparison from "./components/CodeComparison.tsx";
import Features from "./components/Features.tsx";
import QuickStart from "./components/QuickStart.tsx";
import FinalCTA from "./components/FinalCTA.tsx";
import Footer from "./components/Footer.tsx";
import { URLS } from "./constants.ts";

const Playground = lazy(() => import("./Playground.tsx"));

function useNpmVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    fetch(URLS.npmApi)
      .then((res) => res.json())
      .then((data) => {
        if (data.version) setVersion(data.version);
      })
      .catch((err) => console.warn("Failed to fetch npm version:", err));
  }, []);
  return version;
}

function Divider() {
  return <div className="divider" />;
}

function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return hash;
}

function LandingPage() {
  return (
    <div className="page">
      <Header />
      <Hero />
      <Divider />
      <HowItWorks />
      <Divider />
      <CodeComparison />
      <Divider />
      <Features />
      <Divider />
      <QuickStart />
      <Divider />
      <FinalCTA />
      <Divider />
      <Footer />
    </div>
  );
}

function App() {
  const version = useNpmVersion();
  const hash = useRoute();
  const isPlayground = hash.startsWith("#playground");

  return (
    <VersionContext.Provider value={version}>
      {isPlayground ? (
        <Suspense fallback={<div className="pg-loading">Loading playground…</div>}>
          <Playground />
        </Suspense>
      ) : (
        <LandingPage />
      )}
    </VersionContext.Provider>
  );
}

export default App;
