'use client';

import { useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { getOSProjects } from '@/utils/githubProjects';
import { openAppById } from '@/utils/osActions';
import { useOsStore } from '@/stores/osStore';
import {
  ComputerIcon,
  FolderIcon,
  MailIcon,
  NotepadIcon,
  PdfDocIcon,
  PowerActionIcon,
  RecycleBinIcon,
  UserAvatarIcon,
} from '@/components/os/xpIcons';

export default function StartMenu() {
  const startMenuOpen = useOsStore((s) => s.startMenuOpen);
  const recycleBinEmptied = useOsStore((s) => s.recycleBinEmptied);
  const setStartMenuOpen = useOsStore((s) => s.setStartMenuOpen);
  const setTurnOffDialogOpen = useOsStore((s) => s.setTurnOffDialogOpen);
  const logOff = useOsStore((s) => s.logOff);

  const [projectsHover, setProjectsHover] = useState(false);

  if (!startMenuOpen) return null;

  const projects = getOSProjects();

  const launch = (id: string) => {
    setStartMenuOpen(false);
    openAppById(id);
  };

  return (
    <div
      data-start-menu="true"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 2,
        bottom: 30,
        width: 374,
        zIndex: 9600,
        fontFamily: OS_CONFIG.fonts.ui,
        fontSize: 12,
        border: `2px solid ${OS_CONFIG.colors.windowBorder}`,
        borderRadius: '8px 8px 0 0',
        boxShadow: '3px -2px 14px rgba(0, 0, 0, 0.45)',
      }}
      className="flex flex-col select-none bg-white"
    >
      {/* Top User Header */}
      <div
        style={{
          background: `linear-gradient(180deg, ${OS_CONFIG.colors.titleActiveStart} 0%, ${OS_CONFIG.colors.titleActiveEnd} 50%, #1158d6 100%)`,
          fontFamily: OS_CONFIG.fonts.title,
        }}
        className="px-3 py-2 flex items-center gap-2.5 text-white rounded-t-[6px]"
      >
        <UserAvatarIcon size={36} />
        <span
          className="text-[14px] font-bold tracking-wide"
          style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}
        >
          {OS_CONFIG.userDisplayName}
        </span>
      </div>

      {/* Orange separator sheen line */}
      <div className="h-[2px] bg-gradient-to-r from-[#245edb] via-[#f59e0b] to-[#245edb]" />

      {/* Two-Column Body */}
      <div className="flex min-h-[258px]">
        {/* Left White Column */}
        <div className="w-[54%] bg-white p-1.5 flex flex-col gap-0.5 text-[#111827] border-r border-[#9db9eb]">
          <button
            type="button"
            onClick={() => launch('about-me')}
            className="w-full px-2 py-1.5 rounded-[3px] flex items-center gap-2.5 text-left hover:bg-[#316ac5] hover:text-white cursor-pointer"
          >
            <NotepadIcon size={24} className="shrink-0" />
            <div>
              <div className="text-[12px] font-bold leading-tight">About Me</div>
              <div className="text-[12px] opacity-75 leading-tight">PROFILE.TXT</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => launch('contact')}
            className="w-full px-2 py-1.5 rounded-[3px] flex items-center gap-2.5 text-left hover:bg-[#316ac5] hover:text-white cursor-pointer"
          >
            <MailIcon size={24} className="shrink-0" />
            <div>
              <div className="text-[12px] font-bold leading-tight">Contact</div>
              <div className="text-[12px] opacity-75 leading-tight">Outlook Express</div>
            </div>
          </button>

          {/* My Projects with Submenu */}
          <div
            className="relative"
            onMouseEnter={() => setProjectsHover(true)}
            onMouseLeave={() => setProjectsHover(false)}
          >
            <button
              type="button"
              onClick={() => setProjectsHover((v) => !v)}
              className="w-full px-2 py-1.5 rounded-[3px] flex items-center justify-between text-left hover:bg-[#316ac5] hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FolderIcon size={24} className="shrink-0" />
                <span>
                  <div className="text-[12px] font-bold leading-tight">My Projects</div>
                  <div className="text-[12px] opacity-75 leading-tight">
                    {projects.length} repositories
                  </div>
                </span>
              </span>
              <span className="text-[12px] font-bold pr-0.5">&rsaquo;</span>
            </button>

            {projectsHover && (
              <div
                style={{
                  border: `2px solid ${OS_CONFIG.colors.windowBorder}`,
                  boxShadow: '2px 3px 10px rgba(0, 0, 0, 0.35)',
                }}
                className="absolute left-full top-0 ml-0.5 w-[236px] max-h-[270px] overflow-y-auto bg-white p-1 flex flex-col gap-0.5 z-[9700]"
              >
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => launch(`project:${proj.id}`)}
                    className="w-full px-2 py-1 rounded-[2px] flex items-center gap-2 text-left text-[12px] text-[#111827] hover:bg-[#316ac5] hover:text-white cursor-pointer"
                  >
                    <FolderIcon size={16} className="shrink-0" />
                    <span className="truncate">{proj.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => launch('resume')}
            className="w-full px-2 py-1.5 rounded-[3px] flex items-center gap-2.5 text-left hover:bg-[#316ac5] hover:text-white cursor-pointer"
          >
            <PdfDocIcon size={24} className="shrink-0" />
            <div>
              <div className="text-[12px] font-bold leading-tight">My Resume</div>
              <div className="text-[12px] opacity-75 leading-tight">Rai_Farhan_CV.pdf</div>
            </div>
          </button>
        </div>

        {/* Right Light Blue Column */}
        <div className="w-[46%] bg-[#d3e5fa] p-1.5 flex flex-col gap-0.5 text-[#0f2961]">
          <button
            type="button"
            onClick={() => launch('my-computer')}
            className="w-full px-2 py-1.5 rounded-[3px] flex items-center gap-2 text-left font-bold hover:bg-[#316ac5] hover:text-white cursor-pointer"
          >
            <ComputerIcon size={20} className="shrink-0" />
            <span className="text-[12px]">My Computer</span>
          </button>

          <button
            type="button"
            onClick={() => launch('recycle-bin')}
            className="w-full px-2 py-1.5 rounded-[3px] flex items-center gap-2 text-left font-bold hover:bg-[#316ac5] hover:text-white cursor-pointer"
          >
            <RecycleBinIcon size={20} full={!recycleBinEmptied} className="shrink-0" />
            <span className="text-[12px]">Recycle Bin</span>
          </button>

          <div className="my-1 border-t border-[#9eb9e6]" />

          <a
            href={OS_CONFIG.contact.github}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setStartMenuOpen(false)}
            className="w-full px-2 py-1.5 rounded-[3px] text-[12px] font-medium hover:bg-[#316ac5] hover:text-white block"
          >
            GitHub
          </a>
          <a
            href={OS_CONFIG.contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setStartMenuOpen(false)}
            className="w-full px-2 py-1.5 rounded-[3px] text-[12px] font-medium hover:bg-[#316ac5] hover:text-white block"
          >
            LinkedIn
          </a>
          <a
            href={OS_CONFIG.contact.fiverr}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setStartMenuOpen(false)}
            className="w-full px-2 py-1.5 rounded-[3px] text-[12px] font-medium hover:bg-[#316ac5] hover:text-white block"
          >
            Fiverr
          </a>
        </div>
      </div>

      {/* Bottom Power Actions Bar */}
      <div
        style={{
          background: 'linear-gradient(180deg, #3e83ee 0%, #1c58c9 100%)',
        }}
        className="px-3 py-1.5 flex items-center justify-end gap-3 text-white border-t border-[#6ea3f7]"
      >
        <button
          type="button"
          onClick={logOff}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] hover:bg-white/20 cursor-pointer"
        >
          <PowerActionIcon kind="logoff" size={20} />
          <span>Log Off</span>
        </button>
        <button
          type="button"
          onClick={() => setTurnOffDialogOpen(true)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] hover:bg-white/20 cursor-pointer"
        >
          <PowerActionIcon kind="turnoff" size={20} />
          <span>Turn Off Computer</span>
        </button>
      </div>
    </div>
  );
}
