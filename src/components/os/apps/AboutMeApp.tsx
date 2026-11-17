'use client';

import { useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { getParsedProfile } from '@/utils/githubProjects';

const NOTEPAD_MENU = ['File', 'Edit', 'Format', 'View', 'Help'];

export default function AboutMeApp() {
  const [tab, setTab] = useState<'profile' | 'overview'>('profile');
  const profile = getParsedProfile();

  const yamlText = [
    `name: ${profile.name}`,
    `role: ${profile.role}`,
    `based_in: ${profile.based_in}`,
    ``,
    `interests:`,
    ...profile.interests.map((item) => `  - ${item}`),
    ``,
    `mindset: ${profile.mindset}`,
  ].join('\n');

  return (
    <div
      className="flex-1 min-h-0 flex flex-col bg-[#ece9d8]"
      style={{ fontFamily: OS_CONFIG.fonts.ui, fontSize: 12 }}
    >
      {/* Classic Notepad Menu Bar */}
      <div className="h-[22px] px-2 flex items-center gap-3 border-b border-[#d4d0c8] text-[#111827] shrink-0">
        {NOTEPAD_MENU.map((m) => (
          <span key={m} className="px-1 py-0.5 rounded-xs hover:bg-[#316ac5] hover:text-white cursor-default">
            {m}
          </span>
        ))}
      </div>

      {/* Plain-text section switcher tabs */}
      <div className="px-2 pt-1.5 flex items-center gap-1 border-b border-[#aca899] bg-[#ece9d8] shrink-0">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={`px-3 py-1 text-[12px] rounded-t-[3px] border border-b-0 ${
            tab === 'profile'
              ? 'bg-white border-[#808080] font-bold text-[#111827]'
              : 'bg-[#dfdcd0] border-[#aca899] text-[#4b5563] hover:bg-[#f3f1ea]'
          }`}
        >
          PROFILE.TXT
        </button>
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`px-3 py-1 text-[12px] rounded-t-[3px] border border-b-0 ${
            tab === 'overview'
              ? 'bg-white border-[#808080] font-bold text-[#111827]'
              : 'bg-[#dfdcd0] border-[#aca899] text-[#4b5563] hover:bg-[#f3f1ea]'
          }`}
        >
          The big picture &amp; Exploring
        </button>
      </div>

      {/* Monospace Notepad Document Canvas */}
      <div
        className="flex-1 min-h-0 bg-white border-t border-[#7f9db9] p-3.5 overflow-y-auto whitespace-pre-wrap text-[#111827] leading-relaxed"
        style={{ fontFamily: OS_CONFIG.fonts.mono, fontSize: 13 }}
      >
        {tab === 'profile' ? (
          <div>
            <div>{yamlText}</div>
            <div className="mt-4 pt-3 border-t border-dashed border-[#cbd5e1] text-[#334155]">
              {'== THE BIG PICTURE ==\n\n'}
              {profile.bigPicture}
            </div>
            <div className="mt-4 pt-3 border-t border-dashed border-[#cbd5e1] text-[#334155]">
              {'== CURRENTLY EXPLORING ==\n\n'}
              {profile.exploring.map((item) => `* ${item}`).join('\n\n')}
            </div>
          </div>
        ) : (
          <div>
            <div className="font-bold text-[#0f172a] mb-2">THE BIG PICTURE</div>
            <div className="mb-5">{profile.bigPicture}</div>
            <div className="font-bold text-[#0f172a] mb-2">CURRENTLY EXPLORING</div>
            <div className="space-y-3">
              {profile.exploring.map((item, idx) => (
                <div key={idx}>* {item}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-[22px] px-2.5 flex items-center justify-between bg-[#ece9d8] border-t border-[#aca899] text-[12px] text-[#4b5563] shrink-0">
        <span>Ln 1, Col 1</span>
        <span>UTF-8 (Plain Text)</span>
      </div>
    </div>
  );
}
