'use client';

import { useAchievementStore } from '@/stores/achievementStore';

export default function AchievementToast() {
  const activeToast = useAchievementStore((s) => s.activeToast);
  const clearToast = useAchievementStore((s) => s.clearToast);

  if (!activeToast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      className="animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div
        onClick={clearToast}
        className="flex items-center gap-3.5 rounded-2xl border border-amber-400/40 bg-[#0d111d]/95 px-4 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.65),0_0_24px_rgba(245,158,11,0.2)] backdrop-blur-xl cursor-pointer hover:border-amber-400/60 transition"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/25 to-yellow-500/10 border border-amber-400/30 text-xl">
          {activeToast.icon}
        </div>
        <div className="pr-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <span>🏆</span>
            <span>Achievement Unlocked</span>
          </div>
          <div className="text-sm font-semibold text-white leading-tight">
            {activeToast.title}
          </div>
          <div className="text-[11px] text-slate-300/80 leading-tight mt-0.5">
            {activeToast.description}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearToast();
          }}
          className="text-slate-400 hover:text-white text-xs pl-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
