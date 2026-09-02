"use client";

import { type CSSProperties, useEffect, useState } from "react";

const themes = {
  github: ["#161c25", "#0e4a2e", "#147a41", "#1fae57", "#3fe07a"],
  ocean: ["#131c26", "#0b3d5c", "#0f6a95", "#2196c9", "#5fd3ff"],
  sunset: ["#20161a", "#5c1f1f", "#a3391f", "#d9642c", "#ffab5e"],
  grape: ["#191624", "#3a1f5c", "#5f2f96", "#8a4fd1", "#c08bff"],
  mono: ["#161616", "#343434", "#5c5c5c", "#8a8a8a", "#c6c6c6"],
  rose: ["#221219", "#5c1a3a", "#9c2c5c", "#d94a86", "#ff8ec2"],
  white: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
};

const themeSurfaces = {
  github: { bg: "#0a0d12", text: "#e8edf3", border: "#232b36" },
  ocean: { bg: "#071013", text: "#e8fbff", border: "#24424b" },
  sunset: { bg: "#160f14", text: "#fff3f6", border: "#513142" },
  grape: { bg: "#120f1b", text: "#f2ebff", border: "#33264a" },
  mono: { bg: "#101010", text: "#f0f0f0", border: "#303030" },
  rose: { bg: "#160d12", text: "#fff0f7", border: "#452032" },
  white: { bg: "#ffffff", text: "#111111", border: "#d0d7de" },
};

const graphTypes = [
  { key: "heatmap", label: "Heatmap" },
  { key: "activity", label: "Activity" },
  { key: "streak", label: "Streak" },
  { key: "punch", label: "Punch card" },
  { key: "stats", label: "Stats" },
  { key: "summary", label: "Summary" },
  { key: "profile", label: "Profile" },
];

const sizeOptions = [
  { key: "compact", label: "Compact", width: 680 },
  { key: "normal", label: "Normal", width: 900 },
  { key: "wide", label: "Wide", width: 1080 },
];

type ThemeName = keyof typeof themes;
type GraphType = (typeof graphTypes)[number]["key"];
type SizeName = (typeof sizeOptions)[number]["key"];
type PreviewState = { status: "idle" | "loading" | "ready" | "error"; message: string };

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

function getUsernameError(value: string) {
  const username = value.trim();
  if (!username) return "Enter a GitHub username to generate the widget.";
  if (username.length > 39) return "GitHub usernames can be up to 39 characters.";
  if (!/^[a-zA-Z0-9-]+$/.test(username)) return "Use only letters, numbers, and hyphens.";
  if (username.startsWith("-") || username.endsWith("-")) return "Username cannot start or end with a hyphen.";
  if (username.includes("--")) return "Username cannot contain consecutive hyphens.";
  return "";
}

function extractSvgError(svg: string) {
  if (!svg.includes("Contribution graph unavailable") && !svg.includes("No public contribution data found")) return "";
  const messages = Array.from(svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)).map((match) =>
    match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"'),
  );
  return messages.at(-1) || "Contribution graph unavailable.";
}

function stripHash(value: string) {
  return value.replace(/^#/, "");
}

export default function Home() {
  const [username, setUsername] = useState("muhammad-muneeb3");
  const [theme, setTheme] = useState<ThemeName>("github");
  const [graphType, setGraphType] = useState<GraphType>("heatmap");
  const [size, setSize] = useState<SizeName>("normal");
  const [showTitle, setShowTitle] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showBorder, setShowBorder] = useState(true);
  const [radius, setRadius] = useState(10);
  const [customColors, setCustomColors] = useState(themeSurfaces.github);
  const [copied, setCopied] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>({ status: "idle", message: "" });
  const usernameError = getUsernameError(username);
  const canGenerate = !usernameError;
  const cleanUsername = username.trim();
  const selectedSize = sizeOptions.find((option) => option.key === size) || sizeOptions[1];
  const svgUrl = canGenerate ? (() => {
    const params = new URLSearchParams({
      username: cleanUsername,
      theme,
      type: graphType,
      size,
      radius: String(radius),
      bg: stripHash(customColors.bg),
      text: stripHash(customColors.text),
      border: stripHash(customColors.border),
      v: "8",
    });

    if (!showTitle) params.set("hide_title", "true");
    if (!showTotal) params.set("hide_total", "true");
    if (!showLegend) params.set("hide_legend", "true");
    if (!showBorder) params.set("show_border", "false");

    return `/api/contributions?${params.toString()}`;
  })() : "";
  const embedCode = canGenerate
    ? `<img src="https://github-sprout.vercel.app${svgUrl}" alt="${cleanUsername}'s contribution graph" />`
    : "Fix the username to generate embed code.";
  const previewStyle = { "--preview-width": `${selectedSize.width}px` } as CSSProperties;
  const displayedPreviewState = svgUrl
    ? previewState
    : { status: "idle" as const, message: "Fix the username to preview the SVG." };

  useEffect(() => {
    if (!svgUrl) {
      return;
    }

    const controller = new AbortController();

    const loadPreview = async () => {
      try {
        if (controller.signal.aborted) return;
        setPreviewState({ status: "loading", message: "Loading live SVG preview..." });
        const response = await fetch(svgUrl, { signal: controller.signal });
        const svg = await response.text();
        if (!response.ok) throw new Error(`Preview request failed with ${response.status}.`);
        const svgError = extractSvgError(svg);
        if (svgError) throw new Error(svgError);
        setPreviewState({ status: "ready", message: "Live SVG preview loaded." });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Could not load preview.";
        setPreviewState({ status: "error", message });
      }
    };

    queueMicrotask(loadPreview);

    return () => controller.abort();
  }, [svgUrl]);

  const copyCode = async () => {
    if (!canGenerate) return;
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const selectTheme = (nextTheme: ThemeName) => {
    setTheme(nextTheme);
    setCustomColors(themeSurfaces[nextTheme]);
  };

  const updateRadius = (value: string) => {
    const nextRadius = Number(value);
    if (!Number.isFinite(nextRadius)) return;
    setRadius(Math.min(24, Math.max(0, Math.round(nextRadius))));
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
            <a href="/docs">Docs</a>
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
              <input
                id="username"
                className={usernameError ? "invalid" : ""}
                type="text"
                value={username}
                spellCheck={false}
                aria-invalid={Boolean(usernameError)}
                aria-describedby="username-error"
                onChange={(event) => setUsername(event.target.value)}
              />
              {usernameError && (
                <div className="field-error" id="username-error">
                  {usernameError}
                </div>
              )}
            </div>

            <div className="field">
              <label>Theme</label>
              <div className="theme-row">
                {Object.entries(themes).map(([key, palette]) => (
                  <button
                    className={`theme-chip ${key === theme ? "active" : ""}`}
                    key={key}
                    type="button"
                    onClick={() => selectTheme(key as ThemeName)}
                  >
                    <span className="theme-dot" style={{ background: palette[3] }} />
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>SVG size</label>
              <div className="size-row">
                {sizeOptions.map((option) => (
                  <button
                    className={`size-chip ${option.key === size ? "active" : ""}`}
                    key={option.key}
                    type="button"
                    onClick={() => setSize(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Advanced options</label>
              <div className="toggle-grid">
                <label className="toggle-row">
                  <input type="checkbox" checked={showTitle} onChange={(event) => setShowTitle(event.target.checked)} />
                  <span className="toggle-box" aria-hidden="true" />
                  <span>Title</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={showTotal} onChange={(event) => setShowTotal(event.target.checked)} />
                  <span className="toggle-box" aria-hidden="true" />
                  <span>Total</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={showLegend} onChange={(event) => setShowLegend(event.target.checked)} />
                  <span className="toggle-box" aria-hidden="true" />
                  <span>Legend</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={showBorder} onChange={(event) => setShowBorder(event.target.checked)} />
                  <span className="toggle-box" aria-hidden="true" />
                  <span>Border</span>
                </label>
              </div>
            </div>

            <div className="field">
              <div className="label-row">
                <label htmlFor="radius">Border radius</label>
                <span>{radius}px</span>
              </div>
              <input id="radius" className="range-input" type="range" min="0" max="24" value={radius} onChange={(event) => updateRadius(event.target.value)} />
            </div>

            <div className="field">
              <label>SVG colors</label>
              <div className="color-grid">
                <label className="color-control">
                  <span>Background</span>
                  <input
                    aria-label="Background color"
                    type="color"
                    value={customColors.bg}
                    onChange={(event) => setCustomColors((colors) => ({ ...colors, bg: event.target.value }))}
                  />
                </label>
                <label className="color-control">
                  <span>Text</span>
                  <input
                    aria-label="Text color"
                    type="color"
                    value={customColors.text}
                    onChange={(event) => setCustomColors((colors) => ({ ...colors, text: event.target.value }))}
                  />
                </label>
                <label className="color-control">
                  <span>Border</span>
                  <input
                    aria-label="Border color"
                    type="color"
                    value={customColors.border}
                    onChange={(event) => setCustomColors((colors) => ({ ...colors, border: event.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="field field-last">
              <label>Embed in README.md</label>
              <div className="code-block">
                <div className="code-label">
                  <span>markdown</span>
                  <button className="copy-btn" type="button" onClick={copyCode} disabled={!canGenerate}>
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
              <div className="preview-actions">
                <a className={`btn btn-small ${!canGenerate ? "disabled" : ""}`} href={svgUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!canGenerate}>
                  Open SVG
                </a>
                <a className={`btn btn-small ${!canGenerate ? "disabled" : ""}`} href={svgUrl || undefined} download={`${cleanUsername || "contribution"}-${graphType}.svg`} aria-disabled={!canGenerate}>
                  Download SVG
                </a>
              </div>
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
                <div className={`preview-alert ${displayedPreviewState.status}`}>
                  {displayedPreviewState.message}
                </div>
                <div className="api-preview-frame" style={previewStyle}>
                  {svgUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={`api-preview-image ${displayedPreviewState.status === "loading" ? "loading" : ""}`}
                      src={svgUrl}
                      alt={`${cleanUsername}'s contribution graph preview`}
                      onError={() => setPreviewState({ status: "error", message: "Could not render the SVG preview." })}
                    />
                  )}
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
