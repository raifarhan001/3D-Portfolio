'use client';

import { useEffect, useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore } from '@/stores/osStore';

interface ResumeAppProps {
  standalone?: boolean;
}

export default function ResumeApp({ standalone = false }: ResumeAppProps) {
  const closeWindow = useOsStore((s) => s.closeWindow);
  const openDialog = useOsStore((s) => s.openDialog);
  const [checkedOk, setCheckedOk] = useState(false);
  const [missingError, setMissingError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(OS_CONFIG.resumeUrl, { method: 'HEAD' })
      .then((res) => {
        if (!active) return;
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html')) {
          if (standalone) {
            setMissingError(true);
          } else {
            closeWindow('resume');
            openDialog({
              kind: 'error',
              title: 'Resume.pdf',
              message: 'Resume.pdf could not be found.',
            });
          }
        } else {
          setCheckedOk(true);
        }
      })
      .catch(() => {
        if (!active) return;
        if (standalone) {
          setMissingError(true);
        } else {
          closeWindow('resume');
          openDialog({
            kind: 'error',
            title: 'Resume.pdf',
            message: 'Resume.pdf could not be found.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [closeWindow, openDialog, standalone]);

  if (missingError) {
    return (
      <div
        className="flex-1 flex items-center justify-center p-6 bg-[#0f1117] text-neutral-200"
        style={{ fontFamily: OS_CONFIG.fonts.ui }}
      >
        <div className="max-w-sm w-full rounded-xl border border-red-500/30 bg-neutral-900/90 p-5 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-400 text-lg font-bold">
            !
          </div>
          <h3 className="text-sm font-semibold text-white">Resume file unavailable</h3>
          <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
            Could not locate <code className="text-neutral-300">{OS_CONFIG.resumeUrl}</code>. Add
            your PDF at that path or update <code className="text-neutral-300">osConfig.resumeUrl</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!checkedOk) {
    return (
      <div
        className={`flex-1 flex items-center justify-center text-[12px] ${
          standalone ? 'bg-[#0f1117] text-neutral-300' : 'bg-[#ece9d8] text-[#374151]'
        }`}
      >
        Checking Resume.pdf...
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col bg-[#ece9d8]"
      style={{ fontFamily: OS_CONFIG.fonts.ui, fontSize: 12 }}
    >
      <div className="h-[34px] px-2.5 flex items-center justify-between border-b border-[#aca899] bg-[#ece9d8] shrink-0">
        <span className="font-semibold text-[#111827]">Rai_Farhan_CV.pdf</span>
        <a
          href={OS_CONFIG.resumeUrl}
          download="Rai_Farhan_CV.pdf"
          className="px-3 py-1 rounded-[3px] border border-[#003c74] bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] font-semibold text-[12px] hover:brightness-105"
        >
          Download PDF
        </a>
      </div>
      <div className="flex-1 min-h-0 bg-[#525659]">
        <iframe
          src={OS_CONFIG.resumeUrl}
          title="Rai Farhan Resume"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
