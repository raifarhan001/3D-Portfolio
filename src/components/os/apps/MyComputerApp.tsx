'use client';

import { useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { getOSProjects, getParsedProfile } from '@/utils/githubProjects';
import { openAppById } from '@/utils/osActions';
import XpExplorerShell, { type ExplorerTaskGroup } from '@/components/os/XpExplorerShell';
import {
  DriveIcon,
  FolderIcon,
  NotepadIcon,
  SkillFileIcon,
} from '@/components/os/xpIcons';

type ComputerView = 'root' | 'C' | 'D' | 'E' | 'projects';

const DRIVES: ReadonlyArray<{
  key: 'C' | 'D' | 'E';
  label: string;
  items: readonly string[];
  tag: string;
}> = [
  { key: 'C', label: 'Languages (C:)', items: OS_CONFIG.skills.languages, tag: 'Local Disk' },
  { key: 'D', label: 'AI / ML (D:)', items: OS_CONFIG.skills.aiMl, tag: 'Local Disk' },
  {
    key: 'E',
    label: 'Application Engineering (E:)',
    items: OS_CONFIG.skills.appEng,
    tag: 'Local Disk',
  },
];

export default function MyComputerApp() {
  const [history, setHistory] = useState<ComputerView[]>(['root']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const view = history[historyIdx];
  const profile = getParsedProfile();
  const projects = getOSProjects();

  const navigate = (next: ComputerView) => {
    const sliced = history.slice(0, historyIdx + 1);
    setHistory([...sliced, next]);
    setHistoryIdx(sliced.length);
    setSelectedKey(null);
  };

  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;
  const canUp = view !== 'root';

  const activeDrive = DRIVES.find((d) => d.key === view);
  const addressPath =
    view === 'root'
      ? 'My Computer'
      : view === 'projects'
      ? 'C:\\Rai\\Projects'
      : `${activeDrive?.label ?? 'C:'}\\Skills`;

  const statusText =
    view === 'root'
      ? '5 objects'
      : view === 'projects'
      ? `${projects.length} projects`
      : `${activeDrive?.items.length ?? 0} skill modules`;

  const taskGroups: ExplorerTaskGroup[] = [
    {
      id: 'sys-tasks',
      title: 'File and Folder Tasks',
      items: [
        ...(view !== 'root'
          ? [{ label: 'Back to My Computer', onClick: () => navigate('root') }]
          : []),
        { label: 'View About Me (PROFILE.TXT)', onClick: () => openAppById('about-me') },
        { label: 'Browse My Projects', onClick: () => navigate('projects') },
        { label: 'Send a Message (Contact)', onClick: () => openAppById('contact') },
      ],
    },
    {
      id: 'other-places',
      title: 'Other Places',
      items: [
        { label: 'Languages (C:)', onClick: () => navigate('C') },
        { label: 'AI / ML (D:)', onClick: () => navigate('D') },
        { label: 'Application Engineering (E:)', onClick: () => navigate('E') },
        { label: 'Recycle Bin', onClick: () => openAppById('recycle-bin') },
      ],
    },
    {
      id: 'details',
      title: 'Details',
      body: (
        <div className="space-y-1 text-[12px] text-[#111827] leading-snug">
          <div className="font-bold text-[#1e3a8a]">{profile.name}</div>
          <div>{profile.role}</div>
          <div className="text-[#374151]">{profile.based_in}</div>
          <div className="pt-1 border-t border-[#9db4e6] text-[#1e40af]">
            Mindset: {profile.mindset}
          </div>
        </div>
      ),
    },
  ];

  return (
    <XpExplorerShell
      addressPath={addressPath}
      statusText={statusText}
      canBack={canBack}
      canForward={canForward}
      canUp={canUp}
      onBack={() => canBack && setHistoryIdx(historyIdx - 1)}
      onForward={() => canForward && setHistoryIdx(historyIdx + 1)}
      onUp={() => canUp && navigate('root')}
      taskGroups={taskGroups}
    >
      {view === 'root' && (
        <div className="space-y-5">
          <section>
            <div className="border-b border-[#8db2e3] pb-1 mb-3 text-[12px] font-bold text-[#003399]">
              Hard Disk Drives (Skills)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {DRIVES.map((drive) => {
                const isSelected = selectedKey === drive.key;
                const fillPct = Math.min(100, Math.round((drive.items.length / 10) * 100));
                return (
                  <button
                    key={drive.key}
                    type="button"
                    onClick={() => setSelectedKey(drive.key)}
                    onDoubleClick={() => navigate(drive.key)}
                    className={`p-2 rounded-[3px] flex items-center gap-3 text-left border ${
                      isSelected
                        ? 'bg-[#316ac5] text-white border-[#1d4ed8]'
                        : 'bg-white text-[#111827] border-transparent hover:bg-[#eef4ff]'
                    }`}
                  >
                    <DriveIcon size={36} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[12px] truncate">{drive.label}</div>
                      <div
                        className={`text-[12px] ${
                          isSelected ? 'text-blue-100' : 'text-[#4b5563]'
                        }`}
                      >
                        {drive.items.length} skills indexed
                      </div>
                      <div className="mt-1 h-[8px] w-full max-w-[140px] bg-[#e5e7eb] border border-[#94a3b8] rounded-xs overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-b from-[#60a5fa] to-[#1d4ed8]"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">
              Double-click a drive above to inspect installed skill libraries.
            </p>
          </section>

          <section>
            <div className="border-b border-[#8db2e3] pb-1 mb-3 text-[12px] font-bold text-[#003399]">
              Shortcuts on This Computer
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedKey('sc-projects')}
                onDoubleClick={() => navigate('projects')}
                className={`w-[180px] p-2 rounded-[3px] flex items-center gap-2.5 text-left ${
                  selectedKey === 'sc-projects'
                    ? 'bg-[#316ac5] text-white'
                    : 'hover:bg-[#eef4ff]'
                }`}
              >
                <FolderIcon size={32} className="shrink-0" />
                <div>
                  <div className="text-[12px] font-semibold">My Projects</div>
                  <div
                    className={`text-[12px] ${
                      selectedKey === 'sc-projects' ? 'text-blue-100' : 'text-[#6b7280]'
                    }`}
                  >
                    {projects.length} folders
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedKey('sc-about')}
                onDoubleClick={() => openAppById('about-me')}
                className={`w-[180px] p-2 rounded-[3px] flex items-center gap-2.5 text-left ${
                  selectedKey === 'sc-about'
                    ? 'bg-[#316ac5] text-white'
                    : 'hover:bg-[#eef4ff]'
                }`}
              >
                <NotepadIcon size={32} className="shrink-0" />
                <div>
                  <div className="text-[12px] font-semibold">About Me</div>
                  <div
                    className={`text-[12px] ${
                      selectedKey === 'sc-about' ? 'text-blue-100' : 'text-[#6b7280]'
                    }`}
                  >
                    PROFILE.TXT
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>
      )}

      {activeDrive && (
        <div>
          <div className="border-b border-[#8db2e3] pb-1 mb-3 flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#003399]">{activeDrive.label}</span>
            <span className="text-[12px] text-[#6b7280]">{activeDrive.tag}</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {activeDrive.items.map((skill) => {
              const fileName = `${skill.replace(/\s+/g, '')}.dll`;
              const isSelected = selectedKey === fileName;
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => setSelectedKey(fileName)}
                  className={`p-2 rounded-[3px] flex items-center gap-2 text-left ${
                    isSelected ? 'bg-[#316ac5] text-white' : 'hover:bg-[#eef4ff]'
                  }`}
                >
                  <SkillFileIcon size={24} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium truncate">{fileName}</div>
                    <div
                      className={`text-[12px] ${
                        isSelected ? 'text-blue-100' : 'text-[#6b7280]'
                      }`}
                    >
                      {skill} module
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'projects' && (
        <div>
          <div className="border-b border-[#8db2e3] pb-1 mb-3 text-[12px] font-bold text-[#003399]">
            C:\Rai\Projects (Double-click to open folder)
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {projects.map((proj) => {
              const isSelected = selectedKey === proj.id;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => setSelectedKey(proj.id)}
                  onDoubleClick={() => openAppById(`project:${proj.id}`)}
                  className={`p-2 rounded-[3px] flex items-center gap-2.5 text-left ${
                    isSelected ? 'bg-[#316ac5] text-white' : 'hover:bg-[#eef4ff]'
                  }`}
                >
                  <FolderIcon size={28} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold truncate">{proj.name}</div>
                    <div
                      className={`text-[12px] truncate ${
                        isSelected ? 'text-blue-100' : 'text-[#6b7280]'
                      }`}
                    >
                      {proj.primaryLanguage || (proj.isExtra ? 'Featured App' : 'Project Folder')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </XpExplorerShell>
  );
}
