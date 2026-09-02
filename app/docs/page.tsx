import Link from "next/link";

const params = [
  { name: "username", values: "GitHub username", note: "Required. Public GitHub login to render." },
  { name: "theme", values: "github, ocean, sunset, grape, mono, rose, white", note: "Controls the default SVG palette." },
  { name: "type", values: "heatmap, activity, streak, punch, stats, summary, profile", note: "Selects the widget layout." },
  { name: "size", values: "compact, normal, wide", note: "Sets the rendered SVG width." },
  { name: "hide_title", values: "true or false", note: "Hides the title when true." },
  { name: "hide_total", values: "true or false", note: "Hides total contribution text when true." },
  { name: "hide_legend", values: "true or false", note: "Hides legends and helper captions when true." },
  { name: "show_border", values: "true or false", note: "Turns the outer border on or off." },
  { name: "avatar", values: "true or false", note: "Shows the GitHub profile image in the profile layout when true." },
  { name: "radius", values: "0 to 24", note: "Controls SVG corner radius." },
  { name: "bg", values: "6-digit hex", note: "Overrides background color, without #." },
  { name: "text", values: "6-digit hex", note: "Overrides primary text color, without #." },
  { name: "border", values: "6-digit hex", note: "Overrides border color, without #." },
];

const examples = [
  "/api/contributions?username=muhammad-muneeb3&theme=github&type=heatmap",
  "/api/contributions?username=muhammad-muneeb3&theme=ocean&type=activity&size=wide",
  "/api/contributions?username=muhammad-muneeb3&theme=grape&type=stats&hide_legend=true",
  "/api/contributions?username=muhammad-muneeb3&theme=mono&type=profile&avatar=false&bg=ffffff&text=111111&border=d0d7de",
];

const troubleshooting = [
  { title: "Missing token", detail: "Set `GITHUB_TOKEN` in Vercel or your local environment." },
  { title: "Invalid username", detail: "Use only letters, numbers, and hyphens. GitHub usernames cannot start or end with a hyphen." },
  { title: "Empty graph", detail: "If GitHub shows activity but the widget is empty, private contributions may be hidden or inaccessible to this app token." },
  { title: "Rate limit", detail: "Wait until the reset time shown in the SVG error, or use a fresh read-only GitHub token." },
  { title: "Private activity", detail: "Only public contribution calendar data available to the configured token can be rendered." },
];

export default function Docs() {
  return (
    <>
      <nav>
        <div className="wrap nav-row">
          <Link className="brand" href="/">
            <div className="brand-mark">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            sprout
          </Link>
          <div className="nav-links">
            <Link href="/#builder">Build</Link>
            <Link href="/#themes">Themes</Link>
            <Link href="/docs">Docs</Link>
          </div>
          <Link className="btn" href="/#builder">
            Get your graph
          </Link>
        </div>
      </nav>

      <main className="docs wrap">
        <div className="docs-head">
          <div className="kicker">api --reference</div>
          <h1 className="headline">Docs</h1>
          <p className="sub">Every URL option supported by the live SVG endpoint, plus examples and common fixes.</p>
        </div>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>Endpoint</h2>
            <p>Use this path inside an image tag or open it directly in the browser.</p>
          </div>
          <pre className="docs-code">/api/contributions?username=your-github-username</pre>
        </section>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>Query Params</h2>
            <p>Missing optional params fall back to safe defaults.</p>
          </div>
          <div className="docs-table">
            {params.map((param) => (
              <div className="docs-row" key={param.name}>
                <code>{param.name}</code>
                <span>{param.values}</span>
                <p>{param.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>Examples</h2>
            <p>Swap the username and paste the URL into your README image tag.</p>
          </div>
          <div className="docs-examples">
            {examples.map((example) => (
              <pre className="docs-code" key={example}>
                {example}
              </pre>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>Troubleshooting</h2>
            <p>The endpoint returns an SVG error state, so broken embeds still explain what happened.</p>
          </div>
          <div className="docs-grid">
            {troubleshooting.map((item) => (
              <div className="docs-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
