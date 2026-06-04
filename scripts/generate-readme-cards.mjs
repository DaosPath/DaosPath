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
  bg: "#1a1b27",
  title: "#70a5fd",
  text: "#a9b1d6",
  muted: "#7f849c",
  accent: "#c3e88d",
  pink: "#f7768e",
  orange: "#ff9e64",
  border: "#2f3447",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
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
  <rect width="${width}" height="${height}" rx="8" fill="${theme.bg}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="7.5" fill="none" stroke="${theme.border}"/>
${body}
</svg>
`;
}

function text(x, y, content, { size = 14, color = theme.text, weight = 400 } = {}) {
  return `  <text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(content)}</text>`;
}

function statRow(x, y, label, value, color = theme.accent) {
  return [
    text(x, y, label, { color: theme.text }),
    text(x + 290, y, value, { color, weight: 700 }),
  ].join("\n");
}

function bar(x, y, width, color, label, value) {
  return [
    text(x, y - 6, `${label} ${value}`, { size: 13, color: theme.text }),
    `  <rect x="${x}" y="${y}" width="260" height="8" rx="4" fill="#24283b"/>`,
    `  <rect x="${x}" y="${y}" width="${Math.max(6, width)}" height="8" rx="4" fill="${color}"/>`,
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
  const updated = repos.reduce((latest, repo) => (new Date(repo.updated_at) > new Date(latest) ? repo.updated_at : latest), repos[0]?.updated_at ?? user.updated_at);

  return shell({
    width: 495,
    height: 195,
    label: `Estadísticas de GitHub de ${owner}`,
    body: [
      text(24, 38, `Estadísticas de ${owner}`, { size: 20, color: theme.title, weight: 700 }),
      statRow(24, 78, "Repositorios públicos", compactNumber(user.public_repos)),
      statRow(24, 106, "Estrellas recibidas", compactNumber(stars), theme.orange),
      statRow(24, 134, "Forks", compactNumber(forks), theme.pink),
      statRow(24, 162, "Seguidores", compactNumber(user.followers), theme.accent),
      text(350, 184, `upd ${dateLabel(updated)}`, { size: 11, color: theme.muted }),
    ].join("\n"),
  });
}

function renderLanguagesCard(languages) {
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const colors = [theme.title, theme.accent, theme.pink, theme.orange, "#bb9af7", "#7dcfff"];
  const rows = languages.map(([language, bytes], index) => {
    const pct = (bytes / total) * 100;
    return bar(24, 70 + index * 24, Math.round((pct / 100) * 260), colors[index % colors.length], language, `${pct.toFixed(1)}%`);
  });

  return shell({
    width: 360,
    height: 220,
    label: `Lenguajes más usados por ${owner}`,
    body: [
      text(24, 38, "Lenguajes más usados", { size: 20, color: theme.title, weight: 700 }),
      ...rows,
    ].join("\n"),
  });
}

function renderRepoCard(repo) {
  const description = repo.description || "Aplicación web con foco en privacidad, claridad y cuidado personal.";

  return shell({
    width: 440,
    height: 140,
    label: `Repositorio ${featuredRepo}`,
    body: [
      text(24, 38, `${owner} / ${featuredRepo}`, { size: 20, color: theme.title, weight: 700 }),
      text(24, 68, description.length > 58 ? `${description.slice(0, 55)}...` : description, { size: 13, color: theme.text }),
      text(24, 104, `★ ${compactNumber(repo.stargazers_count)}`, { color: theme.orange, weight: 700 }),
      text(100, 104, `Forks ${compactNumber(repo.forks_count)}`, { color: theme.pink, weight: 700 }),
      text(176, 104, repo.language || "Web", { color: theme.accent, weight: 700 }),
      text(320, 124, dateLabel(repo.updated_at), { size: 11, color: theme.muted }),
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

await writeFile(`${outputDir}/stats.svg`, renderStatsCard(user, repos), "utf8");
await writeFile(`${outputDir}/top-langs.svg`, renderLanguagesCard(languages), "utf8");
await writeFile(`${outputDir}/cic.svg`, renderRepoCard(featured), "utf8");
