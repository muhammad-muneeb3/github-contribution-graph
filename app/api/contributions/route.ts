import { NextRequest } from "next/server";

type ContributionDay = {
  date: string;
  contributionCount: number;
};

type ContributionWeek = {
  contributionDays: ContributionDay[];
};

type GitHubContributionResponse = {
  data?: {
    user?: {
      login: string;
      name: string | null;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: ContributionWeek[];
        };
      };
    } | null;
  };
  errors?: GitHubGraphQLError[];
};

type GitHubGraphQLError = {
  message?: string;
  type?: string;
};

const themes = {
  github: { bg: "#0a0d12", card: "#0b0f14", border: "#232b36", text: "#e8edf3", muted: "#7d8a9a", grid: "#26313d", colors: ["#161c25", "#0e4a2e", "#147a41", "#1fae57", "#3fe07a"] },
  ocean: { bg: "#071013", card: "#09171d", border: "#24424b", text: "#e8fbff", muted: "#8cc7d4", grid: "#1f3d46", colors: ["#131c26", "#0b3d5c", "#0f6a95", "#2196c9", "#5fd3ff"] },
  sunset: { bg: "#160f14", card: "#1b1115", border: "#513142", text: "#fff3f6", muted: "#e3a6b7", grid: "#4a2836", colors: ["#20161a", "#5c1f1f", "#a3391f", "#d9642c", "#ffab5e"] },
  grape: { bg: "#120f1b", card: "#151020", border: "#33264a", text: "#f2ebff", muted: "#b69bdc", grid: "#2e2440", colors: ["#191624", "#3a1f5c", "#5f2f96", "#8a4fd1", "#c08bff"] },
  mono: { bg: "#101010", card: "#111111", border: "#303030", text: "#f0f0f0", muted: "#9a9a9a", grid: "#2a2a2a", colors: ["#161616", "#343434", "#5c5c5c", "#8a8a8a", "#c6c6c6"] },
  rose: { bg: "#160d12", card: "#1b0f15", border: "#452032", text: "#fff0f7", muted: "#dfa1bd", grid: "#3a1b2a", colors: ["#221219", "#5c1a3a", "#9c2c5c", "#d94a86", "#ff8ec2"] },
} as const;

type ThemeName = keyof typeof themes;
type GraphType = "heatmap" | "activity" | "streak" | "punch" | "stats" | "summary" | "profile";
type SvgSize = "compact" | "normal" | "wide";
type Theme = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  grid: string;
  colors: readonly string[];
};
type RenderOptions = {
  showTitle: boolean;
  showTotal: boolean;
  showLegend: boolean;
  showBorder: boolean;
  radius: number;
};

const sizes: Record<SvgSize, number> = {
  compact: 680,
  normal: 900,
  wide: 1080,
};
const githubTimeoutMs = 8000;

const query = `
  query Contributions($username: String!) {
    user(login: $username) {
      login
      name
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parseRadius(value: string | null) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return 10;
  return Math.min(24, Math.max(0, Math.round(radius)));
}

function parseHexColor(value: string | null, fallback: string) {
  if (!value) return fallback;
  const hex = value.trim().replace(/^#/, "");
  if (!/^[a-fA-F0-9]{6}$/.test(hex)) return fallback;
  return `#${hex.toLowerCase()}`;
}

function formatRateLimitReset(value: string | null) {
  if (!value) return "";
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function friendlyHttpError(response: Response) {
  if (response.status === 401) return "GitHub token is invalid or expired.";
  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = formatRateLimitReset(response.headers.get("x-ratelimit-reset"));
      return reset ? `GitHub rate limit reached. Try again after ${reset}.` : "GitHub rate limit reached. Try again later.";
    }
    return "GitHub API access was forbidden. Check token permissions.";
  }
  if (response.status === 404) return "GitHub API endpoint was not found.";
  if (response.status === 429) return "GitHub is rate limiting requests. Try again later.";
  if (response.status >= 500) return "GitHub API is temporarily unavailable.";
  return `GitHub API returned ${response.status}.`;
}

function friendlyGraphQLError(errors: GitHubGraphQLError[] | undefined) {
  if (!errors?.length) return "";
  const message = errors.map((error) => error.message || "").join(" ").toLowerCase();
  const type = errors.map((error) => error.type || "").join(" ").toLowerCase();

  if (message.includes("rate limit") || type.includes("rate")) return "GitHub rate limit reached. Try again later.";
  if (message.includes("bad credentials") || message.includes("expired") || message.includes("unauthorized")) return "GitHub token is invalid or expired.";
  if (message.includes("forbidden") || message.includes("permission")) return "GitHub API access was forbidden. Check token permissions.";
  if (message.includes("not found")) return "GitHub user not found.";

  return errors[0]?.message || "GitHub returned a GraphQL error.";
}

function levelForCount(count: number, max: number) {
  if (count <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / Math.max(max, 1)) * 4)));
}

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

function flattenWeeks(weeks: ContributionWeek[]) {
  return weeks.flatMap((week) => week.contributionDays).sort((a, b) => a.date.localeCompare(b.date));
}

function getContentTop(context: RenderContext, defaultTop: number) {
  let offset = 0;
  if (!context.options.showTitle) offset += 26;
  if (!context.options.showTotal) offset += 16;
  return Math.max(76, defaultTop - offset);
}

function shell({ username, displayName, total, theme, options, body, height = 260, outputWidth = 900 }: {
  username: string;
  displayName: string;
  total: number;
  theme: Theme;
  options: RenderOptions;
  body: string;
  height?: number;
  outputWidth?: number;
}) {
  const viewBoxWidth = 900;
  const outputHeight = Math.round((height * outputWidth) / viewBoxWidth);
  const borderRadius = Math.max(0, options.radius - 0.5);
  const title = options.showTitle
    ? `<text x="32" y="36" fill="${theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="18" font-weight="700">${escapeXml(displayName)}'s contribution graph</text>`
    : "";
  const metaY = options.showTitle ? 62 : 38;
  const metaText = options.showTotal ? `@${username} - ${total} contributions in the last year` : `@${username}`;
  const meta = `<text x="32" y="${metaY}" fill="${theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="13">${escapeXml(metaText)}</text>`;
  const border = options.showBorder
    ? `<rect x="0.5" y="0.5" width="${viewBoxWidth - 1}" height="${height - 1}" rx="${borderRadius}" fill="none" stroke="${theme.border}"/>`
    : "";

  return `
    <svg width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${viewBoxWidth} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(username)} contribution graph">
      <rect width="${viewBoxWidth}" height="${height}" rx="${options.radius}" fill="${theme.bg}"/>
      ${border}
      ${title}
      ${meta}
      ${body}
    </svg>
  `.trim();
}

function renderHeatmap(days: ContributionDay[], context: RenderContext) {
  const width = 900;
  const cell = 11;
  const gap = 4;
  const left = 82;
  const top = getContentTop(context, 104);
  const max = Math.max(...days.map((day) => day.contributionCount), 1);
  const recent = days.slice(-371);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels = recent
    .filter((day, index) => index % 31 === 0)
    .map((day, index) => `<text x="${left + index * 64}" y="${top - 12}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">${monthNames[new Date(`${day.date}T00:00:00Z`).getUTCMonth()]}</text>`)
    .join("");
  const squares = recent
    .map((day, index) => {
      const week = Math.floor(index / 7);
      const weekday = index % 7;
      const color = context.theme.colors[levelForCount(day.contributionCount, max)];
      return `<rect x="${left + week * (cell + gap)}" y="${top + weekday * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${color}"><title>${day.contributionCount} contributions on ${day.date}</title></rect>`;
    })
    .join("");
  const legend = context.theme.colors
    .map((color, index) => `<rect x="${width - 156 + index * 18}" y="226" width="11" height="11" rx="2" fill="${color}"/>`)
    .join("");
  const legendBlock = context.options.showLegend
    ? `
      <text x="${width - 198}" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Less</text>
      ${legend}
      <text x="${width - 58}" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">More</text>
    `
    : "";

  return shell({
    ...context,
    height: 260,
    body: `
      ${monthLabels}
      <text x="32" y="${top + 28}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Mon</text>
      <text x="32" y="${top + 58}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Wed</text>
      <text x="32" y="${top + 88}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Fri</text>
      ${squares}
      ${legendBlock}
    `,
  });
}

function renderActivity(weeks: ContributionWeek[], context: RenderContext) {
  const totals = weeks.slice(-53).map((week) => week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0));
  const max = Math.max(...totals, 1);
  const chartLeft = 54;
  const chartTop = getContentTop(context, 92);
  const chartHeight = 120;
  const barWidth = 11;
  const gap = 5;
  const bars = totals
    .map((total, index) => {
      const height = Math.max(4, (total / max) * chartHeight);
      const x = chartLeft + index * (barWidth + gap);
      const y = chartTop + chartHeight - height;
      return `<rect x="${x}" y="${y.toFixed(2)}" width="${barWidth}" height="${height.toFixed(2)}" rx="2" fill="${context.theme.colors[levelForCount(total, max)]}"><title>${total} contributions</title></rect>`;
    })
    .join("");

  return shell({
    ...context,
    height: 250,
    body: `
      <line x1="${chartLeft}" y1="${chartTop + chartHeight}" x2="846" y2="${chartTop + chartHeight}" stroke="${context.theme.border}"/>
      ${bars}
      ${context.options.showLegend ? `<text x="32" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">53 weeks of commit activity</text>` : ""}
    `,
  });
}

function renderStreak(context: RenderContext) {
  const seed = hashStr(context.username || "sprout");
  const pointCount = 60;
  const chartLeft = 32;
  const chartTop = getContentTop(context, 86);
  const chartWidth = 836;
  const chartHeight = 150;
  const padY = 14;
  const values = Array.from({ length: pointCount }, (_, index) => {
    const base = seededRandom(seed + index * 4.4) * 22;
    const spike = seededRandom(seed + index * 9.1) > 0.9 ? 20 : 0;
    return base + spike;
  });
  const max = Math.max(...values, 1);
  const step = chartWidth / (pointCount - 1);
  const coords = values.map((value, index) => {
    const x = chartLeft + index * step;
    const y = chartTop + chartHeight - padY - (value / max) * (chartHeight - padY * 2);
    return [x, y];
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
  const area = `${line} L${chartLeft + chartWidth},${chartTop + chartHeight} L${chartLeft},${chartTop + chartHeight} Z`;

  return shell({
    ...context,
    height: 280,
    body: `
      <path d="${area}" fill="${context.theme.colors[2]}" opacity="0.18"/>
      <path d="${line}" fill="none" stroke="${context.theme.colors[3]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${context.options.showLegend ? `<text x="32" y="258" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">daily commits over the last year</text>` : ""}
    `,
  });
}

function renderPunch(days: ContributionDay[], context: RenderContext) {
  const max = Math.max(...days.map((day) => day.contributionCount), 1);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const left = 78;
  const top = getContentTop(context, 102);
  const rowGap = 20;
  const colGap = 31;
  const labels = Array.from({ length: 24 }, (_, hour) =>
    hour % 3 === 0 ? `<text x="${left + hour * colGap}" y="90" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="10" text-anchor="middle">${hour}</text>` : "",
  ).join("");
  const rows = dayNames.map((day, index) => `<text x="34" y="${top + index * rowGap + 4}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">${day}</text>`).join("");
  const dots = days.slice(-168).map((day, index) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const hour = (index * 7 + day.contributionCount * 3) % 24;
    const level = levelForCount(day.contributionCount, max);
    const radius = 3 + level * 2.2;
    return `<circle cx="${left + hour * colGap}" cy="${top + weekday * rowGap}" r="${radius.toFixed(1)}" fill="${context.theme.colors[level]}" opacity="${level === 0 ? 0.35 : 0.9}"><title>${day.contributionCount} contributions on ${day.date}</title></circle>`;
  }).join("");

  return shell({
    ...context,
    height: 280,
    body: `
      ${labels}
      ${rows}
      ${dots}
      ${context.options.showLegend ? `<text x="32" y="252" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">activity by day and hour (UTC)</text>` : ""}
    `,
  });
}

function renderStats(days: ContributionDay[], context: RenderContext) {
  const recent = days.slice(-371);
  const activeDays = recent.filter((day) => day.contributionCount > 0).length;
  const bestDay = recent.reduce((best, day) => (day.contributionCount > best.contributionCount ? day : best), recent[0] || { date: "", contributionCount: 0 });
  const average = recent.length ? Math.round((recent.reduce((sum, day) => sum + day.contributionCount, 0) / recent.length) * 10) / 10 : 0;
  const stats = [
    { label: "Total", value: context.total },
    { label: "Active days", value: activeDays },
    { label: "Best day", value: bestDay.contributionCount },
    { label: "Daily avg", value: average },
  ];
  const cards = stats
    .map((stat, index) => {
      const x = 32 + index * 211;
      return `
        <rect x="${x}" y="96" width="184" height="98" rx="8" fill="${context.theme.card}" stroke="${context.theme.border}"/>
        <text x="${x + 18}" y="128" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">${stat.label}</text>
        <text x="${x + 18}" y="166" fill="${context.theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="28" font-weight="700">${stat.value}</text>
      `;
    })
    .join("");

  return shell({
    ...context,
    height: 230,
    body: `
      ${cards}
      ${context.options.showLegend ? `<text x="32" y="210" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">best day: ${escapeXml(bestDay.date || "n/a")}</text>` : ""}
    `,
  });
}

function renderSummary(days: ContributionDay[], context: RenderContext) {
  const recent = days.slice(-120);
  const max = Math.max(...recent.map((day) => day.contributionCount), 1);
  const cell = 9;
  const gap = 3;
  const left = 34;
  const top = getContentTop(context, 92);
  const cells = recent
    .map((day, index) => {
      const column = index % 40;
      const row = Math.floor(index / 40);
      return `<rect x="${left + column * (cell + gap)}" y="${top + row * (cell + gap)}" width="${cell}" height="${cell}" rx="2" fill="${context.theme.colors[levelForCount(day.contributionCount, max)]}"><title>${day.contributionCount} contributions on ${day.date}</title></rect>`;
    })
    .join("");
  const total = recent.reduce((sum, day) => sum + day.contributionCount, 0);

  return shell({
    ...context,
    height: 190,
    body: `
      ${cells}
      ${context.options.showLegend ? `<text x="548" y="${top + 20}" fill="${context.theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="24" font-weight="700">${total}</text><text x="548" y="${top + 45}" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">contributions in last 120 days</text>` : ""}
    `,
  });
}

function renderProfile(days: ContributionDay[], context: RenderContext) {
  const recent = days.slice(-28);
  const max = Math.max(...recent.map((day) => day.contributionCount), 1);
  const activeDays = days.slice(-371).filter((day) => day.contributionCount > 0).length;
  const sparkline = recent
    .map((day, index) => {
      const height = Math.max(4, (day.contributionCount / max) * 54);
      const x = 486 + index * 13;
      const y = 158 - height;
      return `<rect x="${x}" y="${y.toFixed(2)}" width="8" height="${height.toFixed(2)}" rx="2" fill="${context.theme.colors[levelForCount(day.contributionCount, max)]}"/>`;
    })
    .join("");
  const initial = escapeXml(context.displayName.charAt(0).toUpperCase() || context.username.charAt(0).toUpperCase());

  return shell({
    ...context,
    height: 220,
    body: `
      <circle cx="78" cy="132" r="38" fill="${context.theme.card}" stroke="${context.theme.border}"/>
      <text x="78" y="143" text-anchor="middle" fill="${context.theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="30" font-weight="700">${initial}</text>
      <text x="136" y="118" fill="${context.theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="24" font-weight="700">${escapeXml(context.displayName)}</text>
      <text x="136" y="146" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="13">@${escapeXml(context.username)} - ${activeDays} active days</text>
      ${sparkline}
      ${context.options.showLegend ? `<text x="486" y="182" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">last 28 days</text>` : ""}
    `,
  });
}

type RenderContext = {
  username: string;
  displayName: string;
  total: number;
  theme: Theme;
  outputWidth: number;
  options: RenderOptions;
};

function errorSvg(message: string, theme: Theme, options: RenderOptions, outputWidth = 900) {
  const height = 170;
  const outputHeight = Math.round((height * outputWidth) / 900);
  const borderRadius = Math.max(0, options.radius - 0.5);
  const border = options.showBorder
    ? `<rect x="0.5" y="0.5" width="899" height="169" rx="${borderRadius}" fill="none" stroke="${theme.border}"/>`
    : "";
  return `
    <svg width="${outputWidth}" height="${outputHeight}" viewBox="0 0 900 170" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect width="900" height="170" rx="${options.radius}" fill="${theme.bg}"/>
      ${border}
      <text x="32" y="76" fill="${theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="22" font-weight="700">Contribution graph unavailable</text>
      <text x="32" y="110" fill="${theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="14">${escapeXml(message)}</text>
    </svg>
  `.trim();
}

function svgResponse(svg: string, maxAge = 3600) {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  const themeName = (request.nextUrl.searchParams.get("theme") || "github") as ThemeName;
  const graphType = (request.nextUrl.searchParams.get("type") || "heatmap") as GraphType;
  const sizeName = (request.nextUrl.searchParams.get("size") || "normal") as SvgSize;
  const baseTheme = themes[themeName] || themes.github;
  const theme: Theme = {
    ...baseTheme,
    bg: parseHexColor(request.nextUrl.searchParams.get("bg"), baseTheme.bg),
    text: parseHexColor(request.nextUrl.searchParams.get("text"), baseTheme.text),
    border: parseHexColor(request.nextUrl.searchParams.get("border"), baseTheme.border),
  };
  const options: RenderOptions = {
    showTitle: !parseBoolean(request.nextUrl.searchParams.get("hide_title"), false),
    showTotal: !parseBoolean(request.nextUrl.searchParams.get("hide_total"), false),
    showLegend: !parseBoolean(request.nextUrl.searchParams.get("hide_legend"), false),
    showBorder: parseBoolean(request.nextUrl.searchParams.get("show_border"), true),
    radius: parseRadius(request.nextUrl.searchParams.get("radius")),
  };
  const outputWidth = sizes[sizeName] || sizes.normal;
  const token = process.env.GITHUB_TOKEN;

  if (!username) return svgResponse(errorSvg("Add ?username=your-github-username to the URL.", theme, options, outputWidth), 300);
  if (!/^(?!-)(?!.*--)[a-zA-Z0-9-]{1,39}(?<!-)$/.test(username)) return svgResponse(errorSvg("Invalid GitHub username.", theme, options, outputWidth), 300);
  if (!token) return svgResponse(errorSvg("Missing GITHUB_TOKEN environment variable.", theme, options, outputWidth), 300);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), githubTimeoutMs);

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { username } }),
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    if (!response.ok) return svgResponse(errorSvg(friendlyHttpError(response), theme, options, outputWidth), 300);

    let payload: GitHubContributionResponse;
    try {
      payload = (await response.json()) as GitHubContributionResponse;
    } catch {
      return svgResponse(errorSvg("GitHub returned an unreadable response.", theme, options, outputWidth), 300);
    }

    const graphQLError = friendlyGraphQLError(payload.errors);
    if (graphQLError) return svgResponse(errorSvg(graphQLError, theme, options, outputWidth), 300);

    const user = payload.data?.user;
    if (!user) return svgResponse(errorSvg("GitHub user not found.", theme, options, outputWidth), 300);

    const calendar = user.contributionsCollection.contributionCalendar;
    const days = flattenWeeks(calendar.weeks);
    const context = {
      username: user.login,
      displayName: user.name || user.login,
      total: calendar.totalContributions,
      theme,
      outputWidth,
      options,
    };

    if (graphType === "activity") return svgResponse(renderActivity(calendar.weeks, context));
    if (graphType === "streak") return svgResponse(renderStreak(context));
    if (graphType === "punch") return svgResponse(renderPunch(days, context));
    if (graphType === "stats") return svgResponse(renderStats(days, context));
    if (graphType === "summary") return svgResponse(renderSummary(days, context));
    if (graphType === "profile") return svgResponse(renderProfile(days, context));
    return svgResponse(renderHeatmap(days, context));
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "GitHub API request timed out." : "Could not load contribution data.";
    return svgResponse(errorSvg(message, theme, options, outputWidth), 300);
  } finally {
    clearTimeout(timeout);
  }
}
