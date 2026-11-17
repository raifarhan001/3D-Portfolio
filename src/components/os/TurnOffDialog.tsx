'use client';

import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore } from '@/stores/osStore';
import { usePcStore } from '@/stores/pcStore';
import { PowerActionIcon, XpEmblemIcon } from '@/components/os/xpIcons';

export default function TurnOffDialog() {
  const turnOffDialogOpen = useOsStore((s) => s.turnOffDialogOpen);
  const setTurnOffDialogOpen = useOsStore((s) => s.setTurnOffDialogOpen);
  const restartPC = usePcStore((s) => s.restartPC);
  const powerOffPC = usePcStore((s) => s.powerOffPC);

  if (!turnOffDialogOpen) return null;

  const exitPcMode = () => {
    const win = window as unknown as { __exitPcMode?: (lockPointer?: boolean) => void };
    win.__exitPcMode?.(true);
  };

  const handleStandBy = () => {
    setTurnOffDialogOpen(false);
    exitPcMode();
  };

  const handleTurnOff = () => {
    setTurnOffDialogOpen(false);
    powerOffPC();
    exitPcMode();
  };

  const handleRestart = () => {
    setTurnOffDialogOpen(false);
    restartPC();
  };

  return (
    <div
      data-xp-dialog="true"
      className="absolute inset-0 z-[9850] bg-black/45 flex items-center justify-center"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Turn off computer"
        style={{
          width: 340,
          fontFamily: OS_CONFIG.fonts.ui,
          fontSize: 12,
          border: '2px solid #00237a',
          boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        }}
        className="rounded-[6px] overflow-hidden select-none"
      >
        <div className="bg-[#003399] px-3 py-2 flex items-center justify-between text-white">
          <span
            className="text-[14px] font-bold"
            style={{ fontFamily: OS_CONFIG.fonts.title }}
          >
            Turn off computer
          </span>
          <XpEmblemIcon size={22} />
        </div>

        <div className="h-[2px] bg-gradient-to-r from-[#003399] via-[#f59e0b] to-[#003399]" />

        <div
          style={{
            background: 'linear-gradient(180deg, #658ee3 0%, #4873d4 100%)',
          }}
          className="px-6 py-6 flex items-center justify-between text-white"
        >
          <button
            type="button"
            onClick={handleStandBy}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <span className="p-1 rounded-[6px] group-hover:bg-white/20">
              <PowerActionIcon kind="standby" size={32} />
            </span>
            <span className="text-[12px] font-semibold">Stand By</span>
          </button>

          <button
            type="button"
            onClick={handleTurnOff}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <span className="p-1 rounded-[6px] group-hover:bg-white/20">
              <PowerActionIcon kind="turnoff" size={32} />
            </span>
            <span className="text-[12px] font-semibold">Turn Off</span>
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <span className="p-1 rounded-[6px] group-hover:bg-white/20">
              <PowerActionIcon kind="restart" size={32} />
            </span>
            <span className="text-[12px] font-semibold">Restart</span>
          </button>
        </div>

        <div className="bg-[#003399] px-3 py-2 flex justify-end">
          <button
            type="button"
            onClick={() => setTurnOffDialogOpen(false)}
            className="px-4 py-1 text-[12px] bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] border border-[#00237a] rounded-[3px] hover:brightness-105 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
