import cvExtract from '@/data/cvExtract.json';
import githubData from '@/data/github.json';
import monaKnowledge from '@/data/monaKnowledge.json';
import { OS_CONFIG } from '@/config/osConfig';
import { GRAMOPHONE_CONFIG } from '@/config/roomConfig';
import { ROOM_CONTENT_CONFIG, SHELF_BOOKS_CONFIG } from '@/config/roomContent';

export interface KnowledgeChunk {
  id: string;
  sourceLabel: string;
  category: 'identity' | 'cv' | 'github' | 'certificates' | 'room' | 'faq';
  alwaysInclude?: boolean;
  content: string;
}

const ROMAN_URDU_SYNONYMS: Record<string, string[]> = {
  kaun: ['who', 'about', 'bio', 'summary', 'rai', 'elsa'],
  kon: ['who', 'about', 'bio', 'summary', 'rai', 'elsa'],
  banaya: ['built', 'project', 'projects', 'created', 'made', 'developed'],
  kaam: ['work', 'experience', 'projects', 'freelance', 'role'],
  parhai: ['education', 'college', 'fsc', 'study', 'pak'],
  taleem: ['education', 'college', 'fsc', 'study', 'pak'],
  rabta: ['contact', 'email', 'phone', 'linkedin', 'github', 'fiverr', 'hire'],
  sanad: ['certificate', 'certificates', 'aws', 'anthropic'],
  gaana: ['music', 'song', 'songs', 'gramophone', 'track', 'tracks', 'nusrat', 'mehdi', 'qawwali', 'ghazal'],
  gaane: ['music', 'song', 'songs', 'gramophone', 'track', 'tracks', 'nusrat', 'mehdi', 'qawwali', 'ghazal'],
  gana: ['music', 'song', 'songs', 'gramophone', 'track', 'tracks', 'nusrat', 'mehdi', 'qawwali', 'ghazal'],
  kahan: ['location', 'based', 'pakistan', 'nankana'],
  rehta: ['location', 'based', 'pakistan', 'nankana'],
  hunar: ['skills', 'tech', 'stack', 'python', 'pytorch'],
  aata: ['skills', 'languages', 'tools', 'stack'],
  kamra: ['room', 'tv', 'pc', 'arcade', 'sofa', 'gramophone', 'lights'],
  naam: ['name', 'rai', 'farhan', 'elsa'],
  zabaan: ['languages', 'urdu', 'english'],
  bhasha: ['languages', 'urdu', 'english'],
};

function cleanMarkdown(text: string, maxLen = 780): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`|_-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

let cachedCorpus: KnowledgeChunk[] | null = null;

export function getKnowledgeCorpus(): KnowledgeChunk[] {
  if (cachedCorpus) return cachedCorpus;

  const chunks: KnowledgeChunk[] = [];

  // 1. Companion & Owner core identity anchor
  chunks.push({
    id: 'core-identity',
    sourceLabel: 'Profile & Companion Intro',
    category: 'identity',
    alwaysInclude: true,
    content: [
      `Companion: ${monaKnowledge.companion.name} (${monaKnowledge.companion.role}). Created by ${monaKnowledge.companion.ownerName}.`,
      `Languages supported by ELSA: ${monaKnowledge.companion.languages.join(', ')}.`,
      `Owner: Rai Farhan — AI/ML & Computer Vision Engineer based in Nankana Sahib, Pakistan. Open to remote roles & freelance AI automation work.`,
      `Contact: Email raifarhan000@gmail.com / raifarhan003@gmail.com | Phone (+92) 3008582139 | GitHub https://github.com/RaiFarhan0 | LinkedIn https://linkedin.com/in/rai-farhan | Fiverr https://www.fiverr.com/rai_farhan.`,
    ].join(' '),
  });

  // 2. Complete parsed CV text split cleanly by logical blocks
  const cvRaw = String(cvExtract.fullText || '').replace(/\r/g, '');
  const cvBlocks = cvRaw
    .split(/(?=\b(?:SUMMARY|EXPERIENCE|PROJECTS|SKILLS|EDUCATION|LANGUAGES)\b)/g)
    .map((b) => b.trim())
    .filter(Boolean);

  cvBlocks.forEach((block, i) => {
    const firstWord = block.split(/\s+/)[0] || `Section ${i + 1}`;
    chunks.push({
      id: `cv-sec-${i}`,
      sourceLabel: `CV (${firstWord})`,
      category: 'cv',
      content: block.replace(/\s+/g, ' ').slice(0, 1200),
    });
  });

  // 3. GitHub user profile + README
  if (githubData.profileReadme) {
    chunks.push({
      id: 'github-profile',
      sourceLabel: 'GitHub Profile',
      category: 'github',
      content: cleanMarkdown(githubData.profileReadme, 900),
    });
  }

  // 4. Every GitHub repository
  for (const repo of githubData.repos ?? []) {
    if (!repo || repo.name === githubData.user?.login) continue;
    const langs = Object.keys(repo.languages || {}).join(', ') || repo.language || 'Various';
    const readmeSummary = cleanMarkdown(String(repo.readme || ''), 760);
    chunks.push({
      id: `repo-${repo.name}`,
      sourceLabel: `GitHub Repo: ${repo.name}`,
      category: 'github',
      content: `Project ${repo.name} (${repo.html_url}). Primary languages: ${langs}. ${repo.description ? repo.description + ' ' : ''}${readmeSummary}`,
    });
  }

  // 5. Extra OS / Room projects (NightCast, skills list)
  for (const extra of OS_CONFIG.extraProjects) {
    chunks.push({
      id: `extra-${extra.id}`,
      sourceLabel: `Portfolio App: ${extra.name}`,
      category: 'room',
      content: `Project ${extra.name}: ${extra.description}. Live URL: ${extra.liveUrl}. Also showcased inside the room's 105-inch Smart TV.`,
    });
  }

  // 6. Verified Certificates & GitHub Achievements
  const certText = ROOM_CONTENT_CONFIG.certificates
    .map((c, idx) => `${idx + 1}. "${c.title}" issued by ${c.issuer} (${c.date}) — ${c.description}`)
    .join(' ');
  const achText = ROOM_CONTENT_CONFIG.achievements
    .map((a) => `${a.title} (${a.description})`)
    .join('; ');
  chunks.push({
    id: 'certificates-achievements',
    sourceLabel: 'Certificates & Achievements',
    category: 'certificates',
    content: `Verified Certificates on shelf: ${certText} GitHub Achievements on plaques: ${achText}.`,
  });

  // 7. Room controls, tracks, books, and editable FAQs
  const trackText = GRAMOPHONE_CONFIG.tracks
    .map((t) => `${t.id}: "${t.title}" by ${t.subtitle}`)
    .join(', ');
  const bookTopics = SHELF_BOOKS_CONFIG.standingBooks
    .map((b) => b.title)
    .concat(SHELF_BOOKS_CONFIG.stackedBooks.filter((b) => b.title).map((b) => b.title))
    .join(', ');
  chunks.push({
    id: 'room-guide',
    sourceLabel: '3D Room & Controls',
    category: 'room',
    content: [
      `Room highlights: ${monaKnowledge.ownerExtras.roomHighlights.join(' ')}`,
      `Gramophone vinyl tracks: ${trackText}.`,
      `Books on shelf: ${bookTopics}.`,
      `Keyboard controls: WASD move, Shift sprint, E interact, F sit/stand up, T toggle Day/Night lights, M mute/unmute audio, Q return to room from interactions, Esc exit room to welcome screen.`,
    ].join(' '),
  });

  for (const faq of monaKnowledge.bilingualFaqs) {
    chunks.push({
      id: faq.id,
      sourceLabel: `FAQ (${faq.id})`,
      category: 'faq',
      content: `Q: ${faq.question} A: ${faq.answer}`,
    });
  }

  cachedCorpus = chunks;
  return chunks;
}

function tokenizeQuery(query: string): string[] {
  const rawTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const expanded = new Set<string>(rawTokens);
  for (const tok of rawTokens) {
    const syns = ROMAN_URDU_SYNONYMS[tok];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

export function retrieveRelevantChunks(query: string, maxChunks = 8): KnowledgeChunk[] {
  const corpus = getKnowledgeCorpus();
  const tokens = tokenizeQuery(query);

  const always = corpus.filter((c) => c.alwaysInclude);
  const candidates = corpus.filter((c) => !c.alwaysInclude);

  const scored = candidates.map((chunk) => {
    const hay = `${chunk.sourceLabel} ${chunk.content}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (hay.includes(tok)) {
        score += tok.length >= 5 ? 3 : 2;
      }
      if (chunk.sourceLabel.toLowerCase().includes(tok)) {
        score += 3;
      }
    }
    if (chunk.category === 'cv') score += 0.4;
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: KnowledgeChunk[] = [...always];
  for (const item of scored) {
    if (selected.length >= maxChunks) break;
    selected.push(item.chunk);
  }

  return selected;
}
