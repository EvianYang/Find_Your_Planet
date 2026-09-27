/**
 * DEMO ONLY: replays the opening scene over the welcome screen. The real app plays it once per browser
 * session (see GameApp); this page ignores that so it can be watched again. No service calls are made.
 */
import { useState } from "react";

import "../styles/global.css";
import { Intro } from "../components/Intro.tsx";
import { MoonLoader } from "../components/MoonLoader.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";

const nothing = async () => ({});
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function IntroPreview() {
  const [run, setRun] = useState(1);
  const [playing, setPlaying] = useState(true);

  return (
    <div className="fyp-app">
      <WelcomeScreen profileNickname={null} onCreateIdentity={nothing} onCreateRoom={nothing} onJoinRoom={nothing} />
      {playing ? <Intro key={run} onDone={() => setPlaying(false)} /> : null}
      <aside
        aria-label="Preview controls"
        style={{ position: "fixed", left: 12, bottom: 12, zIndex: 20, display: "flex", gap: 12, alignItems: "center", color: "#e6e4de", fontSize: 13, fontFamily: "system-ui, sans-serif" }}
      >
        <button type="button" onClick={() => { setRun((n) => n + 1); setPlaying(true); }}>Replay intro</button>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <MoonLoader size={18} /> loader
        </span>
        {reduced() ? <span>Reduced motion is on, so the intro is skipped.</span> : null}
      </aside>
    </div>
  );
}
