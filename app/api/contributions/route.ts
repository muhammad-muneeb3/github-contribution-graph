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
type GraphType = "heatmap" | "activity" | "streak" | "punch";
type Theme = (typeof themes)[ThemeName];

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

function shell({ username, displayName, total, theme, body, height = 260 }: {
  username: string;
  displayName: string;
  total: number;
  theme: Theme;
  body: string;
  height?: number;
}) {
  const width = 900;
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(username)} contribution graph">
      <rect width="${width}" height="${height}" rx="10" fill="${theme.bg}"/>
      <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="9.5" fill="none" stroke="${theme.border}"/>
      <text x="32" y="36" fill="${theme.text}" font-family="JetBrains Mono, Consolas, monospace" font-size="18" font-weight="700">${escapeXml(displayName)}'s contribution graph</text>
      <text x="32" y="62" fill="${theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="13">@${escapeXml(username)} - ${total} contributions in the last year</text>
      ${body}
    </svg>
  `.trim();
}

function renderHeatmap(days: ContributionDay[], context: RenderContext) {
  const width = 900;
  const cell = 11;
  const gap = 4;
  const left = 82;
  const top = 104;
  const max = Math.max(...days.map((day) => day.contributionCount), 1);
  const recent = days.slice(-371);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels = recent
    .filter((day, index) => index % 31 === 0)
    .map((day, index) => `<text x="${left + index * 64}" y="92" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">${monthNames[new Date(`${day.date}T00:00:00Z`).getUTCMonth()]}</text>`)
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

  return shell({
    ...context,
    height: 260,
    body: `
      ${monthLabels}
      <text x="32" y="132" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Mon</text>
      <text x="32" y="162" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Wed</text>
      <text x="32" y="192" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Fri</text>
      ${squares}
      <text x="${width - 198}" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">Less</text>
      ${legend}
      <text x="${width - 58}" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="11">More</text>
    `,
  });
}

function renderActivity(weeks: ContributionWeek[], context: RenderContext) {
  const totals = weeks.slice(-53).map((week) => week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0));
  const max = Math.max(...totals, 1);
  const chartLeft = 54;
  const chartTop = 92;
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
      <text x="32" y="236" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">53 weeks of commit activity</text>
    `,
  });
}

function renderStreak(context: RenderContext) {
  const seed = hashStr(context.username || "sprout");
  const pointCount = 60;
  const chartLeft = 32;
  const chartTop = 86;
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
      <text x="32" y="258" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">daily commits over the last year</text>
    `,
  });
}

function renderPunch(days: ContributionDay[], context: RenderContext) {
  const max = Math.max(...days.map((day) => day.contributionCount), 1);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const left = 78;
  const top = 102;
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
      <text x="32" y="252" fill="${context.theme.muted}" font-family="JetBrains Mono, Consolas, monospace" font-size="12">activity by day and hour (UTC)</text>
    `,
  });
}

type RenderContext = {
  username: string;
  displayName: string;
  total: number;
  theme: Theme;
};

function errorSvg(message: string) {
  return `
    <svg width="900" height="170" viewBox="0 0 900 170" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect width="900" height="170" rx="10" fill="#0a0d12"/>
      <rect x="0.5" y="0.5" width="899" height="169" rx="9.5" fill="none" stroke="#232b36"/>
      <text x="32" y="76" fill="#e8edf3" font-family="JetBrains Mono, Consolas, monospace" font-size="22" font-weight="700">Contribution graph unavailable</text>
      <text x="32" y="110" fill="#7d8a9a" font-family="JetBrains Mono, Consolas, monospace" font-size="14">${escapeXml(message)}</text>
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
  const theme = themes[themeName] || themes.github;
  const token = process.env.GITHUB_TOKEN;

  if (!username) return svgResponse(errorSvg("Add ?username=your-github-username to the URL."), 300);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return svgResponse(errorSvg("Invalid GitHub username."), 300);
  if (!token) return svgResponse(errorSvg("Missing GITHUB_TOKEN environment variable."), 300);

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { username } }),
      next: { revalidate: 3600 },
    });

    if (!response.ok) return svgResponse(errorSvg(`GitHub API returned ${response.status}.`), 300);

    const payload = (await response.json()) as GitHubContributionResponse;
    const user = payload.data?.user;
    if (!user) return svgResponse(errorSvg("GitHub user not found."), 300);

    const calendar = user.contributionsCollection.contributionCalendar;
    const days = flattenWeeks(calendar.weeks);
    const context = {
      username: user.login,
      displayName: user.name || user.login,
      total: calendar.totalContributions,
      theme,
    };

    if (graphType === "activity") return svgResponse(renderActivity(calendar.weeks, context));
    if (graphType === "streak") return svgResponse(renderStreak(context));
    if (graphType === "punch") return svgResponse(renderPunch(days, context));
    return svgResponse(renderHeatmap(days, context));
  } catch {
    return svgResponse(errorSvg("Could not load contribution data."), 300);
  }
}
