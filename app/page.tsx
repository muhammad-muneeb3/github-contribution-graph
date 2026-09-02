"use client";

import { useState } from "react";

const themes = {
  github: ["#161c25", "#0e4a2e", "#147a41", "#1fae57", "#3fe07a"],
  ocean: ["#131c26", "#0b3d5c", "#0f6a95", "#2196c9", "#5fd3ff"],
  sunset: ["#20161a", "#5c1f1f", "#a3391f", "#d9642c", "#ffab5e"],
  grape: ["#191624", "#3a1f5c", "#5f2f96", "#8a4fd1", "#c08bff"],
  mono: ["#161616", "#343434", "#5c5c5c", "#8a8a8a", "#c6c6c6"],
  rose: ["#221219", "#5c1a3a", "#9c2c5c", "#d94a86", "#ff8ec2"],
};

const graphTypes = [
  { key: "heatmap", label: "Heatmap" },
  { key: "activity", label: "Activity" },
  { key: "streak", label: "Streak" },
  { key: "punch", label: "Punch card" },
];

type ThemeName = keyof typeof themes;
type GraphType = (typeof graphTypes)[number]["key"];

function hashStr(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function buildLevels(seedText: string, total = 48) {
  const seed = hashStr(seedText || "sprout");
  return Array.from({ length: total }, (_, index): number => {
    const random = seededRandom(seed + index * 7.13);
    if (random < 0.42) return 0;
    if (random < 0.64) return 1;
    if (random < 0.8) return 2;
    if (random < 0.93) return 3;
    return 4;
  });
}

export default function Home() {
  const [username, setUsername] = useState("muhammad-muneeb3");
  const [theme, setTheme] = useState<ThemeName>("github");
  const [graphType, setGraphType] = useState<GraphType>("heatmap");
  const [copied, setCopied] = useState(false);
  const cleanUsername = username.trim() || "your-username";
  const svgUrl = `/api/contributions?username=${encodeURIComponent(cleanUsername)}&theme=${theme}&type=${graphType}&v=4`;
  const embedCode = `<img src="https://github-sprout.vercel.app${svgUrl}" alt="${cleanUsername}'s contribution graph" />`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <>
      <nav>
        <div className="wrap nav-row">
          <div className="brand">
            <div className="brand-mark">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            sprout
          </div>
          <div className="nav-links">
            <a href="#builder">Build</a>
            <a href="#themes">Themes</a>
            <a href="#how">How it works</a>
          </div>
          <a className="btn" href="#builder">
            Get your graph
          </a>
        </div>
      </nav>

      <header className="hero wrap">
        <div className="hero-top">
          <div className="kicker">generate --type=readme-widget</div>
          <h1 className="headline">
            A contribution graph
            <br />
            that actually looks like <em>your</em> repo.
          </h1>
          <p className="sub">
            Pull real commit activity, render it as an SVG graph, and drop it into any GitHub README with one image tag. No login, no tracking script, no build step.
          </p>
        </div>

        <div className="builder" id="builder">
          <div className="panel">
            <div className="field">
              <label htmlFor="username">GitHub username</label>
              <input id="username" type="text" value={username} spellCheck={false} onChange={(event) => setUsername(event.target.value)} />
            </div>

            <div className="field">
              <label>Theme</label>
              <div className="theme-row">
                {Object.entries(themes).map(([key, palette]) => (
                  <button
                    className={`theme-chip ${key === theme ? "active" : ""}`}
                    key={key}
                    type="button"
                    onClick={() => setTheme(key as ThemeName)}
                  >
                    <span className="theme-dot" style={{ background: palette[3] }} />
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="field field-last">
              <label>Embed in README.md</label>
              <div className="code-block">
                <div className="code-label">
                  <span>markdown</span>
                  <button className="copy-btn" type="button" onClick={copyCode}>
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
                <pre className="code">{embedCode}</pre>
              </div>
            </div>
          </div>

          <div className="panel preview-panel">
            <div className="preview-head">
              <span>preview.svg</span>
              <a className="btn btn-small" href={svgUrl} target="_blank" rel="noreferrer">
                Open SVG
              </a>
            </div>
            <div className="preview-body">
              <div className="card">
                <div className="graph-tabs">
                  {graphTypes.map((type) => (
                    <button
                      className={`graph-tab ${type.key === graphType ? "active" : ""}`}
                      key={type.key}
                      type="button"
                      onClick={() => setGraphType(type.key)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="api-preview-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="api-preview-image" src={svgUrl} alt={`${cleanUsername}'s contribution graph preview`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="themes">
        <div className="wrap">
          <div className="section-head">
            <h2>Six palettes, one SVG.</h2>
            <p>Every theme is just a different set of five colors mapped to the same contribution scale. Pick whichever fits your profile.</p>
          </div>
          <div className="theme-gallery">
            {Object.entries(themes).map(([key, palette]) => (
              <div className="theme-card" key={key}>
                <div className="theme-card-name">
                  <span>{key}</span>
                </div>
                <div className="mini-squares">
                  {buildLevels(key, 48).map((level, index) => (
                    <span key={index} style={{ background: palette[level] }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps, no dashboard to manage afterward.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3>Enter your username</h3>
              <p>Sprout reads your public contribution calendar directly from GitHub.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>Pick a theme</h3>
              <p>Choose a color scale that matches your README, or leave it on the default GitHub green.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>Paste the image tag</h3>
              <p>The graph is served as a live SVG endpoint, so it updates itself every time you push.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="wrap footer">
        <span>sprout — contribution graphs for READMEs</span>
        <span>built on the GitHub contributions API</span>
      </footer>
    </>
  );
}
