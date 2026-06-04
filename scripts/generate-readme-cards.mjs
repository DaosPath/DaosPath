import { mkdir, writeFile } from "node:fs/promises";

const owner = "DaosPath";
const featuredRepo = "Cic";
const outputDir = "profile";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const theme = {
  bg: "#111827",
  bg2: "#171b2e",
  panel: "#20263a",
  title: "#8fb3ff",
  text: "#d8def8",
  muted: "#8892b8",
  accent: "#9ece6a",
  pink: "#f7768e",
  orange: "#ffb86c",
  cyan: "#7dcfff",
  purple: "#bb9af7",
  border: "#36405f",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compactNumber(value) {
  return new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("es", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function shell({ width, height, label, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg2}"/>
      <stop offset="100%" stop-color="${theme.bg}"/>
    </linearGradient>
    <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="14" fill="url(#card-bg)" filter="url(#soft-shadow)"/>
  <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="13.5" fill="none" stroke="${theme.border}"/>
  <circle cx="${width - 34}" cy="30" r="44" fill="${theme.title}" opacity="0.06"/>
  <circle cx="${width - 78}" cy="${height - 8}" r="52" fill="${theme.accent}" opacity="0.045"/>
${body}
</svg>
`;
}

function text(x, y, content, { size = 14, color = theme.text, weight = 400, anchor = "start" } = {}) {
  return `  <text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function pill(x, y, value, color) {
  const width = Math.max(44, String(value).length * 9 + 26);
  return [
    `  <rect x="${x}" y="${y - 19}" width="${width}" height="28" rx="14" fill="${color}" opacity="0.14"/>`,
    text(x + width / 2, y, value, { color, weight: 800, anchor: "middle" }),
  ].join("\n");
}

function statRow(x, y, label, value, color = theme.accent) {
  return [
    text(x, y, label, { size: 14, color: theme.text }),
    pill(x + 310, y, value, color),
  ].join("\n");
}

function metricTile(x, y, width, label, value, color, icon) {
  return [
    `  <rect x="${x}" y="${y}" width="${width}" height="62" rx="15" fill="${theme.panel}" opacity="0.76"/>`,
    `  <rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="61" rx="14.5" fill="none" stroke="${color}" opacity="0.24"/>`,
    `  <rect x="${x + 12}" y="${y + 14}" width="34" height="34" rx="12" fill="${color}" opacity="0.16"/>`,
    text(x + 29, y + 37, icon, { size: 14, color, weight: 850, anchor: "middle" }),
    text(x + 58, y + 25, label, { size: 12, color: theme.muted, weight: 700 }),
    text(x + 58, y + 45, "GitHub", { size: 11, color: theme.muted }),
    text(x + width - 24, y + 43, value, { size: 25, color, weight: 900, anchor: "end" }),
  ].join("\n");
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function donutSlice(cx, cy, radius, startAngle, endAngle, color) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return `  <path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="28" stroke-linecap="round"/>`;
}

function legendRow(x, y, color, label, value) {
  return [
    `  <circle cx="${x}" cy="${y - 4}" r="5" fill="${color}"/>`,
    text(x + 14, y, label, { size: 13, color: theme.text, weight: 700 }),
    text(x + 210, y, value, { size: 12, color: theme.muted, anchor: "end" }),
  ].join("\n");
}

function bar(x, y, width, color, label, value) {
  return [
    `  <circle cx="${x}" cy="${y - 12}" r="4" fill="${color}"/>`,
    text(x + 12, y - 8, label, { size: 13, color: theme.text, weight: 650 }),
    text(x + 312, y - 8, value, { size: 12, color: theme.muted, anchor: "end" }),
    `  <rect x="${x}" y="${y}" width="312" height="9" rx="4.5" fill="${theme.panel}"/>`,
    `  <rect x="${x}" y="${y}" width="${Math.max(8, width)}" height="9" rx="4.5" fill="${color}"/>`,
  ].join("\n");
}

async function getPublicRepos() {
  const repos = [];
  for (let page = 1; page <= 3; page += 1) {
    const chunk = await fetchJson(`https://api.github.com/users/${owner}/repos?per_page=100&page=${page}&type=owner&sort=updated`);
    repos.push(...chunk);
    if (chunk.length < 100) break;
  }
  return repos.filter((repo) => !repo.fork);
}

async function getLanguageTotals(repos) {
  const totals = new Map();
  await Promise.all(
    repos.map(async (repo) => {
      const languages = await fetchJson(repo.languages_url);
      for (const [language, bytes] of Object.entries(languages)) {
        totals.set(language, (totals.get(language) ?? 0) + bytes);
      }
    }),
  );
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function renderStatsCard(user, repos) {
  const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const updated = repos.reduce(
    (latest, repo) => (new Date(repo.updated_at) > new Date(latest) ? repo.updated_at : latest),
    repos[0]?.updated_at ?? user.updated_at,
  );

  return shell({
    width: 640,
    height: 285,
    label: `Estadisticas de GitHub de ${owner}`,
    body: [
      `  <rect x="28" y="26" width="584" height="66" rx="18" fill="${theme.panel}" opacity="0.38"/>`,
      text(48, 56, `GitHub de ${owner}`, { size: 26, color: theme.title, weight: 900 }),
      text(48, 78, "Pulso publico del perfil", { size: 12, color: theme.muted }),
      `  <rect x="476" y="42" width="118" height="30" rx="15" fill="${theme.title}" opacity="0.13"/>`,
      `  <circle cx="494" cy="57" r="5" fill="${theme.accent}"/>`,
      text(548, 62, "perfil activo", { size: 12, color: theme.title, weight: 850, anchor: "middle" }),
      metricTile(30, 116, 286, "Repositorios publicos", compactNumber(user.public_repos), theme.accent, "R"),
      metricTile(324, 116, 286, "Estrellas recibidas", compactNumber(stars), theme.orange, "S"),
      metricTile(30, 190, 286, "Forks", compactNumber(forks), theme.pink, "F"),
      metricTile(324, 190, 286, "Seguidores", compactNumber(user.followers), theme.cyan, "U"),
      `  <line x1="30" y1="268" x2="610" y2="268" stroke="${theme.border}" opacity="0.5"/>`,
      text(452, 278, `actualizado ${dateLabel(updated)}`, { size: 11, color: theme.muted }),
    ].join("\n"),
  });
}

function renderLanguagesCard(languages) {
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const colors = [theme.title, theme.accent, theme.pink, theme.orange, theme.purple, theme.cyan];
  const slices = [];
  const rows = [];
  let angle = -90;

  languages.forEach(([language, bytes], index) => {
    const pct = (bytes / total) * 100;
    const color = colors[index % colors.length];
    const nextAngle = angle + (pct / 100) * 360;
    slices.push(donutSlice(116, 128, 58, angle, nextAngle - 3, color));
    rows.push(legendRow(224, 86 + index * 22, color, language, `${pct.toFixed(1)}%`));
    angle = nextAngle;
  });

  return shell({
    width: 440,
    height: 240,
    label: `Lenguajes mas usados por ${owner}`,
    body: [
      text(26, 42, "Lenguajes mas usados", { size: 21, color: theme.title, weight: 800 }),
      text(224, 62, "Distribucion por bytes", { size: 12, color: theme.muted }),
      `  <circle cx="116" cy="128" r="58" fill="none" stroke="${theme.panel}" stroke-width="28"/>`,
      ...slices,
      `  <circle cx="116" cy="128" r="35" fill="${theme.bg}"/>`,
      text(116, 124, "Top", { size: 13, color: theme.muted, weight: 700, anchor: "middle" }),
      text(116, 145, "stack", { size: 18, color: theme.text, weight: 800, anchor: "middle" }),
      ...rows,
    ].join("\n"),
  });
}

function renderRepoCard(repo) {
  const description = repo.description || "Aplicacion web con foco en privacidad, claridad y cuidado personal.";

  return shell({
    width: 540,
    height: 150,
    label: `Repositorio ${featuredRepo}`,
    body: [
      text(28, 44, `${owner} / ${featuredRepo}`, { size: 22, color: theme.title, weight: 800 }),
      text(28, 72, description.length > 78 ? `${description.slice(0, 75)}...` : description, { size: 13, color: theme.text }),
      `  <rect x="28" y="98" width="88" height="28" rx="14" fill="${theme.orange}" opacity="0.14"/>`,
      text(44, 117, `Stars ${compactNumber(repo.stargazers_count)}`, { size: 13, color: theme.orange, weight: 800 }),
      `  <rect x="128" y="98" width="86" height="28" rx="14" fill="${theme.pink}" opacity="0.14"/>`,
      text(144, 117, `Forks ${compactNumber(repo.forks_count)}`, { size: 13, color: theme.pink, weight: 800 }),
      `  <rect x="226" y="98" width="116" height="28" rx="14" fill="${theme.accent}" opacity="0.14"/>`,
      text(244, 117, repo.language || "Web", { size: 13, color: theme.accent, weight: 800 }),
      text(398, 126, `actualizado ${dateLabel(repo.updated_at)}`, { size: 11, color: theme.muted }),
    ].join("\n"),
  });
}

await mkdir(outputDir, { recursive: true });

const [user, repos, featured] = await Promise.all([
  fetchJson(`https://api.github.com/users/${owner}`),
  getPublicRepos(),
  fetchJson(`https://api.github.com/repos/${owner}/${featuredRepo}`),
]);
const languages = await getLanguageTotals(repos);

await writeFile(`${outputDir}/stats-v3.svg`, renderStatsCard(user, repos), "utf8");
await writeFile(`${outputDir}/languages-donut-v2.svg`, renderLanguagesCard(languages), "utf8");
await writeFile(`${outputDir}/cic.svg`, renderRepoCard(featured), "utf8");
