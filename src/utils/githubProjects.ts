import githubSnapshot from '@/data/github.json';
import { OS_CONFIG } from '@/config/osConfig';
import { WELCOME_CONFIG } from '@/config/welcomeConfig';

export interface WelcomeGitHubSummary {
  displayName: string;
  publicRepos: number;
  topLanguages: string[];
  profileTagline: string;
}

export interface GitHubRepoEntry {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  homepage: string;
  language: string | null;
  languages: Record<string, number>;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  updated_at: string;
  readme: string | null;
}

export interface OSProject {
  id: string;
  name: string;
  description: string;
  htmlUrl: string | null;
  liveUrl: string | null;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  topics: string[];
  updatedAt: string | null;
  readme: string | null;
  isExtra: boolean;
}

export interface ParsedProfileInfo {
  name: string;
  role: string;
  based_in: string;
  interests: string[];
  mindset: string;
  bigPicture: string;
  exploring: string[];
}

interface GitHubSnapshotShape {
  user: {
    login: string;
    name: string;
    bio: string;
    avatar_url: string;
    html_url: string;
    public_repos: number;
  };
  repos: GitHubRepoEntry[];
  profileReadme: string | null;
  fetchedAt: string | null;
}

const snapshot = githubSnapshot as unknown as GitHubSnapshotShape;

/**
 * Returns the ordered project list built from the committed GitHub snapshot + OS_CONFIG.extraProjects,
 * honoring OS_CONFIG.excludeRepos and OS_CONFIG.pinnedOrder.
 */
export function getOSProjects(): OSProject[] {
  const excluded = new Set<string>(OS_CONFIG.excludeRepos);
  const pinnedIndex = new Map<string, number>();
  OS_CONFIG.pinnedOrder.forEach((name, idx) => pinnedIndex.set(name, idx));

  const githubRepos = (snapshot.repos ?? []).filter((repo) => !excluded.has(repo.name));

  const sortedRepos = [...githubRepos].sort((a, b) => {
    const pa = pinnedIndex.get(a.name);
    const pb = pinnedIndex.get(b.name);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
  });

  const mappedRepos: OSProject[] = sortedRepos.map((repo) => ({
    id: repo.name,
    name: repo.name,
    description: repo.description || '',
    htmlUrl: repo.html_url || null,
    liveUrl: repo.homepage && repo.homepage.trim().length > 0 ? repo.homepage.trim() : null,
    primaryLanguage: repo.language || Object.keys(repo.languages || {})[0] || null,
    languages: repo.languages || {},
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    updatedAt: repo.updated_at || null,
    readme: repo.readme ?? null,
    isExtra: false,
  }));

  const existingIds = new Set(mappedRepos.map((p) => p.id.toLowerCase()));
  const extras: OSProject[] = OS_CONFIG.extraProjects
    .filter((extra) => !existingIds.has(extra.id.toLowerCase()))
    .map((extra) => ({
      id: extra.id,
      name: extra.name,
      description: extra.description,
      htmlUrl: null,
      liveUrl: extra.liveUrl || null,
      primaryLanguage: null,
      languages: {},
      stars: 0,
      forks: 0,
      topics: [...extra.tags],
      updatedAt: null,
      readme: null,
      isExtra: true,
    }));

  return [...mappedRepos, ...extras];
}

export function getProjectById(id: string): OSProject | undefined {
  return getOSProjects().find((p) => p.id === id);
}

/**
 * Strips markdown decoration (images/badges/inline links) cleanly for Notepad plain-text sections.
 */
function cleanPlainText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\*/g, '')
    .replace(/\u00a0|&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Parses PROFILE.TXT YAML metadata, "The big picture", and "Currently exploring" sections
 * from the GitHub profile README, falling back to OS_CONFIG.aboutFallback on missing fields.
 */
export function getParsedProfile(): ParsedProfileInfo {
  const fallback = OS_CONFIG.aboutFallback;
  const md = snapshot.profileReadme;
  if (!md || typeof md !== 'string') {
    return {
      name: fallback.name,
      role: fallback.role,
      based_in: fallback.based_in,
      interests: [...fallback.interests],
      mindset: fallback.mindset,
      bigPicture: fallback.bigPicture,
      exploring: [...fallback.exploring],
    };
  }

  let name: string = fallback.name;
  let role: string = fallback.role;
  let based_in: string = fallback.based_in;
  let mindset: string = fallback.mindset;
  const interests: string[] = [];

  // 1. Parse YAML block if present
  const yamlMatch = md.match(/```ya?ml\s*([\s\S]*?)```/i);
  if (yamlMatch) {
    const lines = yamlMatch[1].split(/\r?\n/);
    let inInterests = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^interests\s*:/i.test(trimmed)) {
        inInterests = true;
        continue;
      }
      if (inInterests) {
        if (trimmed.startsWith('-')) {
          const item = trimmed.slice(1).trim();
          if (item) interests.push(item);
          continue;
        } else {
          inInterests = false;
        }
      }
      const kv = trimmed.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
      if (kv) {
        const key = kv[1].toLowerCase();
        const val = kv[2].replace(/^['"]|['"]$/g, '').trim();
        if (key === 'name' && val) name = val;
        if (key === 'role' && val) role = val;
        if (key === 'based_in' && val) based_in = val;
        if (key === 'mindset' && val) mindset = val;
      }
    }
  }

  // 2. Parse "The big picture" section
  let bigPicture: string = fallback.bigPicture;
  const bigMatch = md.match(/##+\s*The big picture[^\n]*\n([\s\S]*?)(?=\n###|\n##\s|$)/i);
  if (bigMatch) {
    const cleaned = bigMatch[1]
      .split(/\n{2,}/)
      .map((p) => cleanPlainText(p))
      .filter(Boolean)
      .join('\n\n');
    if (cleaned) bigPicture = cleaned;
  }

  // 3. Parse "Currently exploring" section
  const exploring: string[] = [];
  const expMatch = md.match(/##+\s*(?:0\d+\s*[—-]\s*)?Currently exploring[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (expMatch) {
    const blocks = expMatch[1]
      .replace(/\n\s*[—-]\s*/g, ' — ')
      .split(/\n{2,}/)
      .map((b) => cleanPlainText(b))
      .filter(Boolean);
    for (let i = 0; i < blocks.length; i++) {
      const line = blocks[i];
      if (line.includes(' — ') && blocks[i + 1] && !blocks[i + 1].includes(' — ')) {
        exploring.push(`${line}\n  ${blocks[i + 1]}`);
        i++;
      } else {
        exploring.push(line);
      }
    }
  }

  return {
    name,
    role,
    based_in,
    interests: interests.length > 0 ? interests : [...fallback.interests],
    mindset,
    bigPicture,
    exploring: exploring.length > 0 ? exploring : [...fallback.exploring],
  };
}

/**
 * Extracts user display name, public repo count, top weighted languages, and first tagline heading
 * cleanly from the committed GitHub snapshot (static/SSR-safe).
 */
export function getWelcomeGitHubSummary(): WelcomeGitHubSummary {
  const displayName =
    (snapshot.user?.name && snapshot.user.name.trim()) || WELCOME_CONFIG.fallbackName;
  const publicRepos = snapshot.user?.public_repos ?? (snapshot.repos?.length || 0);

  const langTotals = new Map<string, number>();
  for (const repo of snapshot.repos ?? []) {
    for (const [lang, bytes] of Object.entries(repo.languages || {})) {
      if (typeof bytes === 'number' && bytes > 0) {
        langTotals.set(lang, (langTotals.get(lang) || 0) + bytes);
      }
    }
  }
  const topLanguages = Array.from(langTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang);

  let profileTagline: string = WELCOME_CONFIG.tagline;
  const md = snapshot.profileReadme;
  if (md && typeof md === 'string') {
    const headings = md.matchAll(/^#{1,4}\s+(.+)$/gm);
    for (const match of headings) {
      const candidate = cleanPlainText(match[1]);
      if (
        candidate &&
        candidate !== '.' &&
        candidate.toLowerCase() !== displayName.toLowerCase() &&
        !/^profile\.txt$/i.test(candidate)
      ) {
        profileTagline = candidate;
        break;
      }
    }
  }

  return {
    displayName,
    publicRepos,
    topLanguages,
    profileTagline,
  };
}

/**
 * Produces a crisp 1-2 sentence summary for a project card when GitHub `description` is empty.
 */
export function getProjectShortSummary(project: OSProject): string {
  if (project.description && project.description.trim().length > 0) {
    return project.description.trim();
  }
  if (!project.readme) return '';

  const lines = project.readme.split(/\r?\n/);
  for (const raw of lines) {
    const t = raw.trim();
    if (
      !t ||
      t.startsWith('#') ||
      t.startsWith('!') ||
      t.startsWith('[![') ||
      t.startsWith('---') ||
      t.startsWith('```') ||
      t.startsWith('|') ||
      t.startsWith('[')
    ) {
      continue;
    }
    const cleaned = cleanPlainText(t.replace(/^[>\-*]\s*/, ''));
    if (cleaned.length >= 28) {
      if (cleaned.length <= 165) return cleaned;
      const cut = cleaned.slice(0, 165);
      const lastSpace = cut.lastIndexOf(' ');
      const trimmed = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-]+$/, '').trimEnd();
      return `${trimmed}...`;
    }
  }
  return '';
}
