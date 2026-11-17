'use client';

import { useState, useEffect } from 'react';
import { useAchievementStore } from '@/stores/achievementStore';
import { playKeyClickSound } from '@/utils/sound';

interface GuestbookEntry {
  id: string;
  name: string;
  role: string;
  message: string;
  date: string;
}

const DEFAULT_ENTRIES: GuestbookEntry[] = [
  {
    id: 'entry-1',
    name: 'Sarah Jenkins',
    role: 'Senior Tech Recruiter',
    message: 'One of the most impressive creative developer portfolios I have seen this year. Love the ELSA voice integration!',
    date: 'Nov 12, 2026',
  },
  {
    id: 'entry-2',
    name: 'Hamza Khan',
    role: 'Full-Stack Developer',
    message: 'Nusrat Fateh Ali Khan on the gramophone while browsing retro Windows XP? Masterpiece.',
    date: 'Nov 10, 2026',
  },
  {
    id: 'entry-3',
    name: 'Alex Chen',
    role: 'AI Systems Architect',
    message: 'Clean architecture and smooth Three.js performance. Great work on the Anthropic & AWS certifications.',
    date: 'Nov 8, 2026',
  },
];

const STORAGE_KEY = 'rai_xp_guestbook_entries_v1';

export default function GuestbookApp() {
  const [entries, setEntries] = useState<GuestbookEntry[]>(DEFAULT_ENTRIES);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    playKeyClickSound();
    useAchievementStore.getState().unlock('guestbook');

    const newEntry: GuestbookEntry = {
      id: `entry-${Date.now()}`,
      name: name.trim(),
      role: role.trim() || 'Visitor / Tech Enthusiast',
      message: message.trim(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setName('');
    setRole('');
    setMessage('');
    setSigned(true);
    setTimeout(() => setSigned(false), 3000);
  };

  return (
    <div className="flex h-full flex-col bg-[#ece9d8] text-slate-800 font-sans text-xs">
      {/* XP Toolbar */}
      <div className="flex items-center gap-2 border-b border-[#d0ccb8] bg-gradient-to-b from-[#fbfaf6] to-[#ece9d8] px-3 py-1.5 shadow-sm">
        <span className="font-semibold text-slate-700">✍️ Studio Guestbook Ledger</span>
        <span className="text-[11px] text-slate-500">· {entries.length} Signatures</span>
      </div>

      <div className="flex flex-1 flex-col sm:flex-row overflow-hidden">
        {/* Left: Sign Form */}
        <div className="w-full sm:w-[260px] border-b sm:border-b-0 sm:border-r border-[#d0ccb8] bg-[#f7f5ec] p-3 flex flex-col justify-between overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="font-semibold text-slate-900 border-b border-slate-300 pb-1">
              Sign the Guestbook
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Your Name *</label>
              <input
                type="text"
                value={name}
                maxLength={40}
                required
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="w-full rounded border border-[#7f9db9] bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#215dc6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Role / Company</label>
              <input
                type="text"
                value={role}
                maxLength={50}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. AI Engineer @ Startup"
                className="w-full rounded border border-[#7f9db9] bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#215dc6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Note / Feedback *</label>
              <textarea
                value={message}
                maxLength={240}
                rows={3}
                required
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Leave a message for Rai..."
                className="w-full resize-none rounded border border-[#7f9db9] bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#215dc6]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded border border-[#003c74] bg-gradient-to-b from-[#498ee6] to-[#1e58b8] px-3 py-1.5 font-semibold text-white shadow-sm hover:from-[#5b9df2] hover:to-[#2866cb] cursor-pointer"
            >
              Sign Ledger ✍️
            </button>

            {signed && (
              <div className="rounded bg-emerald-100 border border-emerald-300 p-1.5 text-center text-[11px] font-semibold text-emerald-800">
                ✓ Thank you for signing!
              </div>
            )}
          </form>

          <div className="text-[10px] text-slate-400 mt-2">
            Entries are saved locally to this workstation browser.
          </div>
        </div>

        {/* Right: Entries Stream */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-white">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded border border-[#d6dff7] bg-[#f4f7fd] p-2.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1e3a8a] text-xs">{entry.name}</span>
                <span className="text-[10px] text-slate-400">{entry.date}</span>
              </div>
              <div className="text-[10px] font-medium text-slate-500 mb-1">{entry.role}</div>
              <p className="text-xs text-slate-700 leading-snug">{entry.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
