import fs from 'node:fs';
import path from 'node:path';

const USERNAME = 'RaiFarhan0';
const OUT_FILE = path.resolve(process.cwd(), 'src/data/github.json');
const MAX_README_LEN = 12000;

function getHeaders(accept = 'application/vnd.github+json') {
  const headers = {
    'User-Agent': '3d-room-rai-xp-portfolio',
    Accept: accept,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: getHeaders('application/vnd.github+json') });
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchRawReadme(repoName) {
  const url = `https://api.github.com/repos/${USERNAME}/${encodeURIComponent(repoName)}/readme`;
  const res = await fetch(url, { headers: getHeaders('application/vnd.github.raw+json') });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`GitHub README ${res.status} for ${repoName}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

function isDecorativeBadgeUrl(url) {
  return /(shields\.io|camo\.githubusercontent\.com|capsule-render|komarev\.com|readme-typing-svg|github-readme-stats|streak-stats|badge\.fury\.io|badgen\.net)/i.test(
    url
  );
}

function toRawRepoUrl(repoName, relUrl) {
  const trimmed = relUrl.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    /^(https?:|mailto:|data:|tel:)/i.test(trimmed)
  ) {
    return trimmed;
  }
  const clean = trimmed.replace(/^(\.\/|\/)+/, '');
  return `https://raw.githubusercontent.com/${USERNAME}/${repoName}/HEAD/${clean}`;
}

/**
 * Cleans GitHub README markdown at build time:
 * - Strips shields.io / camo / capsule-render badges & HTML-only decorations
 * - Rewrites relative links & images to https://raw.githubusercontent.com/RaiFarhan0/{repo}/HEAD/...
 * - Caps length at 12000 chars
 */
function cleanReadme(raw, repoName) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.replace(/\r\n/g, '\n');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Strip clickable badge markdown: [![alt](badgeUrl)](href)
  text = text.replace(/\[\s*!\[[^\]]*\]\(([^)]+)\)\s*\]\(([^)]+)\)/g, (full, imgUrl) =>
    isDecorativeBadgeUrl(imgUrl) ? '' : full
  );

  // Strip standalone badge images: ![alt](badgeUrl)
  text = text.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (full, imgUrl) =>
    isDecorativeBadgeUrl(imgUrl) ? '' : full
  );

  // Rewrite HTML <img src="..."> relative URLs or drop badge/decorative imgs
  text = text.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (tag, src) => {
    if (isDecorativeBadgeUrl(src)) return '';
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    const abs = toRawRepoUrl(repoName, src);
    return `![${alt}](${abs})`;
  });

  // Convert remaining anchor tags wrapping plain text to markdown links; drop empty badge anchors
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_tag, href, inner) => {
    const cleanInner = inner.replace(/<[^>]+>/g, '').trim();
    if (!cleanInner) return '';
    return `[${cleanInner}](${toRawRepoUrl(repoName, href)})`;
  });

  // Strip HTML-only decoration tags (<div align=...>, <p align=...>, <br>, <hr>, etc.)
  text = text.replace(/<\/?(div|p|span|center|picture|source|figure|figcaption|table|thead|tbody|tr|th|td|details|summary|sub|sup|strong|em|b|i|br|hr|font|h[1-6])\b[^>]*>/gi, '\n');

  // Rewrite relative markdown image & link paths: ![alt](rel) and [label](rel)
  text = text.replace(/(!?\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, prefix, targetUrl) => {
    const rewritten = toRawRepoUrl(repoName, targetUrl);
    return `${prefix}(${rewritten})`;
  });

  // Clean whitespace and cap at 12000 chars
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return null;
  if (text.length > MAX_README_LEN) {
    text = text.slice(0, MAX_README_LEN);
  }
  return text;
}

async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  try {
    const userRaw = await fetchJson(`https://api.github.com/users/${USERNAME}`);
    const user = {
      login: userRaw.login || USERNAME,
      name: userRaw.name || 'Rai Farhan',
      bio: userRaw.bio || '',
      avatar_url: userRaw.avatar_url || '',
      html_url: userRaw.html_url || `https://github.com/${USERNAME}`,
      public_repos: Number(userRaw.public_repos ?? 0),
    };

    const reposRaw = await fetchJson(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`
    );

    const rawProfileReadme = await fetchRawReadme(USERNAME);
    const profileReadme = cleanReadme(rawProfileReadme, USERNAME);

    const repos = await runWithConcurrency(reposRaw, 5, async (repo) => {
      const [rawReadme, languages] = await Promise.all([
        fetchRawReadme(repo.name),
        fetchJson(`https://api.github.com/repos/${USERNAME}/${encodeURIComponent(repo.name)}/languages`).catch(
          () => ({})
        ),
      ]);

      return {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        homepage: repo.homepage || '',
        language: repo.language || null,
        languages: languages && typeof languages === 'object' ? languages : {},
        stargazers_count: Number(repo.stargazers_count ?? 0),
        forks_count: Number(repo.forks_count ?? 0),
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        updated_at: repo.updated_at || repo.pushed_at || '',
        readme: cleanReadme(rawReadme, repo.name),
      };
    });

    const snapshot = {
      user,
      repos,
      profileReadme,
      fetchedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

    const withReadme = repos.filter((r) => Boolean(r.readme)).length;
    console.log(
      `[fetch-github] Saved ${repos.length} repos (${withReadme} with READMEs) for ${USERNAME} -> src/data/github.json`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (fs.existsSync(OUT_FILE)) {
      console.warn(
        `[fetch-github] Warning: failed to refresh GitHub data (${msg}); keeping existing snapshot src/data/github.json.`
      );
      process.exit(0);
    }

    console.warn(
      `[fetch-github] Warning: failed to fetch GitHub data (${msg}) and no existing snapshot found; writing empty fallback.`
    );
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(
      OUT_FILE,
      JSON.stringify(
        {
          user: {
            login: USERNAME,
            name: 'Rai Farhan',
            bio: '',
            avatar_url: '',
            html_url: `https://github.com/${USERNAME}`,
            public_repos: 0,
          },
          repos: [],
          profileReadme: null,
          fetchedAt: null,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }
}

main();
