'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { OS_CONFIG } from '@/config/osConfig';
import { getOSProjects, getProjectById } from '@/utils/githubProjects';
import { openAppById } from '@/utils/osActions';
import XpExplorerShell, { type ExplorerTaskGroup } from '@/components/os/XpExplorerShell';

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Dockerfile: '#384d54',
  Batchfile: '#C1F12E',
  Shell: '#89e051',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Featured Project';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ProjectFolderApp({ projectId }: { projectId: string }) {
  const project = getProjectById(projectId);
  const allProjects = getOSProjects();

  if (!project) {
    return (
      <div className="p-4 text-[12px] text-[#111827]">
        Folder not found in repository cache.
      </div>
    );
  }

  const langEntries = Object.entries(project.languages || {});
  const totalBytes = langEntries.reduce((acc, [, v]) => acc + v, 0);
  const isNightCast = project.id.toLowerCase() === 'nightcast';

  const taskGroups: ExplorerTaskGroup[] = [
    {
      id: 'proj-links',
      title: 'File and Folder Tasks',
      body: (
        <div className="flex flex-col gap-1.5 text-[12px]">
          {project.htmlUrl && (
            <a
              href={project.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-[3px] border border-[#003c74] bg-gradient-to-b from-[#ffffff] to-[#dce5f7] text-[#111827] font-semibold text-center hover:brightness-105"
            >
              Open on GitHub
            </a>
          )}
          {isNightCast && project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-[3px] border border-[#14532d] bg-gradient-to-b from-[#6fd168] to-[#348a2d] text-white font-semibold text-center hover:brightness-105"
            >
              Open NightCast
            </a>
          )}
          {!isNightCast && project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-[3px] border border-[#14532d] bg-gradient-to-b from-[#6fd168] to-[#348a2d] text-white font-semibold text-center hover:brightness-105"
            >
              Live demo
            </a>
          )}
          <button
            type="button"
            onClick={() => openAppById('my-computer')}
            className="text-left text-[#215dc6] hover:underline pt-0.5"
          >
            Open My Computer
          </button>
        </div>
      ),
    },
    {
      id: 'proj-details',
      title: 'Details',
      body: (
        <div className="space-y-2 text-[12px] text-[#111827] leading-snug">
          <p className="text-[#1f2937]">
            {project.description || 'AI/Engineering repository by Rai Farhan.'}
          </p>

          {project.primaryLanguage && (
            <div>
              <span className="font-semibold">Primary:</span> {project.primaryLanguage}
            </div>
          )}

          {totalBytes > 0 && (
            <div>
              <div className="h-[8px] w-full flex rounded-xs overflow-hidden border border-[#94a3b8] bg-[#e5e7eb]">
                {langEntries.map(([lang, bytes]) => {
                  const pct = (bytes / totalBytes) * 100;
                  return (
                    <div
                      key={lang}
                      title={`${lang}: ${pct.toFixed(1)}%`}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: LANG_COLORS[lang] ?? '#64748b',
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-[#334155]">
                {langEntries.slice(0, 4).map(([lang, bytes]) => (
                  <span key={lang} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: LANG_COLORS[lang] ?? '#64748b' }}
                    />
                    {lang} {Math.round((bytes / totalBytes) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-[#1e3a8a]">
            <span>Stars: {project.stars}</span>
            <span>Forks: {project.forks}</span>
          </div>

          {project.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.topics.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 bg-white/80 border border-[#93c5fd] rounded-xs text-[12px] text-[#1e3a8a]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="text-[#374151] pt-1 border-t border-[#9db4e6]">
            Updated: {formatDate(project.updatedAt)}
          </div>
        </div>
      ),
    },
    {
      id: 'other-projects',
      title: 'Other Projects',
      items: allProjects
        .filter((p) => p.id !== project.id)
        .slice(0, 5)
        .map((p) => ({
          label: p.name,
          onClick: () => openAppById(`project:${p.id}`),
        })),
    },
  ];

  return (
    <XpExplorerShell
      addressPath={`C:\\Rai\\Projects\\${project.name}`}
      statusText={project.readme ? 'README.md loaded (Internet Explorer view)' : 'Folder view'}
      canUp
      onUp={() => openAppById('my-computer')}
      taskGroups={taskGroups}
    >
      {/* Classic Internet Explorer styled README canvas */}
      <div
        className="bg-white border border-[#cbd5e1] rounded-xs p-4 text-[#111827] leading-relaxed"
        style={{ fontFamily: 'Verdana, Tahoma, "Segoe UI", sans-serif', fontSize: 12 }}
      >
        <div className="pb-2 mb-3 border-b border-[#d1d5db] flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-[14px] text-[#003399]">{project.name}</div>
          <div className="flex items-center gap-2">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-[12px] font-semibold rounded-[3px] border border-[#14532d] bg-[#eefae9] text-[#166534] hover:bg-[#dcfce7]"
              >
                {isNightCast ? 'Open NightCast' : 'Live demo'}
              </a>
            )}
            {project.htmlUrl && (
              <a
                href={project.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-[12px] font-semibold rounded-[3px] border border-[#003c74] bg-[#eef4ff] text-[#0000ee] underline hover:bg-[#dbeafe]"
              >
                Open on GitHub
              </a>
            )}
          </div>
        </div>

        {project.readme ? (
          <div className="space-y-3 text-[12px] text-[#111827]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-[17px] font-bold text-[#003399] border-b border-[#e5e7eb] pb-1 mt-2 mb-2">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-[14px] font-bold text-[#0f172a] border-b border-[#e5e7eb] pb-0.5 mt-4 mb-1.5">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-[13px] font-bold text-[#1e293b] mt-3 mb-1">{children}</h3>
                ),
                p: ({ children }) => <p className="text-[12px] leading-relaxed my-1.5">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-1.5">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 space-y-1 my-1.5">{children}</ol>
                ),
                li: ({ children }) => <li className="text-[12px] leading-snug">{children}</li>,
                a: ({ href, children }) => (
                  <a
                    href={href || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0000ee] underline hover:text-[#551a8b]"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#93c5fd] bg-[#f8fafc] px-3 py-1.5 my-2 text-[#334155]">
                    {children}
                  </blockquote>
                ),
                pre: ({ children }) => (
                  <pre
                    className="bg-[#f6f8fa] border border-[#cbd5e1] p-2.5 my-2 overflow-x-auto text-[12px] text-[#0f172a]"
                    style={{ fontFamily: OS_CONFIG.fonts.mono }}
                  >
                    {children}
                  </pre>
                ),
                code: ({ children, className }) =>
                  className ? (
                    <code className={className} style={{ fontFamily: OS_CONFIG.fonts.mono }}>
                      {children}
                    </code>
                  ) : (
                    <code
                      className="bg-[#f1f5f9] border border-[#e2e8f0] px-1 py-0.2 rounded-xs text-[12px]"
                      style={{ fontFamily: OS_CONFIG.fonts.mono }}
                    >
                      {children}
                    </code>
                  ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full border-collapse border border-[#94a3b8] text-[12px]">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-[#94a3b8] bg-[#e2e8f0] px-2 py-1 text-left font-bold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-[#cbd5e1] px-2 py-1 align-top">{children}</td>
                ),
                img: ({ src, alt }) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src || ''}
                    alt={alt || ''}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="max-w-full h-auto my-2 border border-[#cbd5e1]"
                    loading="lazy"
                  />
                ),
              }}
            >
              {project.readme}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="py-6 space-y-3">
            <p className="text-[13px] font-semibold text-[#334155]">
              No README found in this folder.
            </p>
            {project.description && (
              <p className="text-[12px] text-[#111827]">{project.description}</p>
            )}
            {isNightCast && project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3.5 py-1.5 rounded-[3px] border border-[#14532d] bg-gradient-to-b from-[#6fd168] to-[#348a2d] text-white font-bold text-[12px] hover:brightness-105"
              >
                Open NightCast
              </a>
            )}
          </div>
        )}
      </div>
    </XpExplorerShell>
  );
}
