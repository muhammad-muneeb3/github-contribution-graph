"use client";

import { useMemo, useState } from "react";

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

const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function buildLevels(username: string, total = 371) {
  const seed = hashStr(username || "sprout");
  return Array.from({ length: total }, (_, index): number => {
    const random = seededRandom(seed + index * 7.13);
    if (seededRandom(seed + index * 3.1) > 0.965) return 4;
    if (random < 0.42) return 0;
    if (random < 0.64) return 1;
    if (random < 0.8) return 2;
    if (random < 0.93) return 3;
    return 4;
  });
}

function displayName(username: string) {
  return (username || "your-username")
    .split(/[-_.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Heatmap({ username, colors }: { username: string; colors: string[] }) {
  const levels = useMemo(() => buildLevels(username), [username]);

  return (
    <>
      <div className="grid-scroll">
        <div className="grid-inner">
          <div className="month-row">
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
          <div className="grid-body">
            <div className="day-labels">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="squares">
              {levels.map((level, index) => (
                <span className="sq sq-visible" key={index} style={{ background: colors[level] }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <Legend colors={colors} />
    </>
  );
}

function Activity({ username, colors }: { username: string; colors: string[] }) {
  const weeks = useMemo(() => {
    const levels = buildLevels(username);
    return Array.from({ length: 53 }, (_, week) => levels.slice(week * 7, week * 7 + 7).reduce((sum, level) => sum + level, 0));
  }, [username]);
  const max = Math.max(...weeks, 1);

  return (
    <>
      <div className="bar-chart">
        {weeks.map((total, index) => {
          const level = total === 0 ? 0 : Math.min(4, Math.ceil((total / max) * 4));
          return (
            <span
              className="bar bar-visible"
              key={index}
              style={{ background: colors[level], height: `${Math.max(6, (total / max) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="legend">
        <span>53 weeks of commit activity</span>
      </div>
    </>
  );
}

function Streak({ username, colors }: { username: string; colors: string[] }) {
  const pathData = useMemo(() => {
    const seed = hashStr(username || "sprout");
    const values = Array.from({ length: 60 }, (_, index) => {
      const base = seededRandom(seed + index * 4.4) * 22;
      const spike = seededRandom(seed + index * 9.1) > 0.9 ? 20 : 0;
      return base + spike;
    });
    const max = Math.max(...values, 1);
    const width = 700;
    const height = 150;
    const padY = 14;
    const stepX = width / (values.length - 1);
    const coords = values.map((value, index) => {
      const x = index * stepX;
      const y = height - padY - (value / max) * (height - padY * 2);
      return [x, y];
    });
    const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
    return { line, area: `${line} L${width},${height} L0,${height} Z` };
  }, [username]);

  return (
    <>
      <svg className="line-chart" viewBox="0 0 700 150" preserveAspectRatio="none">
        <path className="area" d={pathData.area} fill={colors[2]} />
        <path className="line line-visible" d={pathData.line} stroke={colors[3]} />
      </svg>
      <div className="legend">
        <span>daily commits over the last year</span>
      </div>
    </>
  );
}

function Punch({ username, colors }: { username: string; colors: string[] }) {
  const seed = hashStr(username || "sprout");

  return (
    <>
      <div className="punch-wrap">
        <div className="punch-grid">
          <div />
          {Array.from({ length: 24 }, (_, index) => (
            <div className="hour-label" key={index}>
              {index % 3 === 0 ? index : ""}
            </div>
          ))}
          {days.flatMap((day, dayIndex) => [
            <div className="row-label" key={`${day}-label`}>
              {day}
            </div>,
            ...Array.from({ length: 24 }, (_, hour) => {
              const dotIndex = dayIndex * 24 + hour;
              const random = seededRandom(seed + dotIndex * 6.66);
              const level = random < 0.55 ? 0 : random < 0.75 ? 1 : random < 0.88 ? 2 : random < 0.96 ? 3 : 4;
              return (
                <span
                  className="punch-dot punch-visible"
                  key={`${day}-${hour}`}
                  style={{ background: colors[level], transform: `scale(${0.25 + level * 0.19})` }}
                />
              );
            }),
          ])}
        </div>
      </div>
      <div className="legend">
        <span>activity by day &amp; hour (UTC)</span>
      </div>
    </>
  );
}

function Legend({ colors }: { colors: string[] }) {
  return (
    <div className="legend">
      <span>Less</span>
      {colors.map((color) => (
        <span className="sq sq-visible legend-sq" key={color} style={{ background: color }} />
      ))}
      <span>More</span>
    </div>
  );
}

export default function Home() {
  const [username, setUsername] = useState("muhammad-muneeb3");
  const [theme, setTheme] = useState<ThemeName>("github");
  const [graphType, setGraphType] = useState<GraphType>("heatmap");
  const [copied, setCopied] = useState(false);
  const colors = themes[theme];
  const cleanUsername = username.trim() || "your-username";
  const total = 400 + (hashStr(cleanUsername) % 900);
  const svgUrl = `/api/contributions?username=${encodeURIComponent(cleanUsername)}&theme=${theme}&type=${graphType}&v=3`;
  const embedCode = `<img src="https://your-vercel-domain.vercel.app${svgUrl}" alt="${cleanUsername}'s contribution graph" />`;

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
                <div className="card-title">{displayName(cleanUsername)}&apos;s contribution graph</div>
                <div className="card-meta">
                  @{cleanUsername} · {total} contributions in the last year
                </div>

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

                {graphType === "heatmap" && <Heatmap username={cleanUsername} colors={colors} />}
                {graphType === "activity" && <Activity username={cleanUsername} colors={colors} />}
                {graphType === "streak" && <Streak username={cleanUsername} colors={colors} />}
                {graphType === "punch" && <Punch username={cleanUsername} colors={colors} />}
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
