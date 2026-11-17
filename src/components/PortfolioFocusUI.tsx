'use client';

import { useCallback, useEffect, useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { getCertificateByIndex, ROOM_CONTENT_CONFIG } from '@/config/roomContent';
import { usePortfolioStore } from '@/stores/portfolioStore';
import ResumeApp from '@/components/os/apps/ResumeApp';

function PhoneFrame({ onExit }: { onExit: () => void }) {
  const screen = usePortfolioStore((s) => s.phoneScreen);
  const setScreen = usePortfolioStore((s) => s.setPhoneScreen);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sentOk, setSentOk] = useState(false);

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      setErrorMsg('Please enter both a subject and a message.');
      return;
    }
    setErrorMsg('');
    const params = new URLSearchParams();
    params.set('subject', subject.trim());
    params.set('body', message.trim());
    const mailtoUrl = `mailto:${OS_CONFIG.contact.email}?${params.toString()}`;
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    setSentOk(true);
  };

  const tiles = [
    {
      label: 'Email',
      sub: OS_CONFIG.contact.email,
      href: `mailto:${OS_CONFIG.contact.email}`,
      newTab: false,
      accent: 'from-sky-500/25 to-blue-600/25 border-sky-400/35',
      badge: '✉',
    },
    {
      label: 'GitHub',
      sub: 'RaiFarhan0',
      href: OS_CONFIG.contact.github,
      newTab: true,
      accent: 'from-slate-500/25 to-zinc-700/25 border-white/20',
      badge: 'GH',
    },
    {
      label: 'LinkedIn',
      sub: 'rai-farhan',
      href: OS_CONFIG.contact.linkedin,
      newTab: true,
      accent: 'from-blue-500/25 to-indigo-700/25 border-blue-400/35',
      badge: 'in',
    },
    {
      label: 'Fiverr',
      sub: 'rai_farhan',
      href: OS_CONFIG.contact.fiverr,
      newTab: true,
      accent: 'from-emerald-500/25 to-teal-700/25 border-emerald-400/35',
      badge: 'Fv',
    },
  ];

  return (
    <div
      data-portfolio-phone="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: '360px',
        height: '720px',
        maxHeight: 'calc(100vh - 64px)',
        maxWidth: 'calc(100vw - 32px)',
      }}
      className="relative rounded-[44px] border-[6px] border-[#1f222b] bg-[#090d18] shadow-[0_28px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/15 flex flex-col overflow-hidden text-white select-none"
    >
      {/* Original Top Speaker Pill + Status Bar */}
      <div className="px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-medium text-neutral-300 shrink-0">
        <span>11:18</span>
        <div className="w-[74px] h-[18px] rounded-full bg-black border border-white/10" />
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-300">
          <span>5G</span>
          <span className="inline-block w-4 h-2 rounded-[2px] border border-white/50 p-[1px]">
            <span className="block w-full h-full bg-emerald-400 rounded-[1px]" />
          </span>
        </div>
      </div>

      {screen === 'lock' && (
        <div
          onClick={() => setScreen('home')}
          className="flex-1 flex flex-col justify-between px-6 py-6 bg-[radial-gradient(circle_at_25%_25%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(99,102,241,0.24),transparent_55%)] cursor-pointer"
        >
          <div className="text-center pt-4">
            <div className="mx-auto mb-3 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-neutral-200">
              🔒
            </div>
            <div className="text-xs tracking-wide text-slate-300">Wednesday, Nov 11</div>
            <div className="text-6xl font-bold tracking-tight text-white mt-1">11:18</div>
          </div>

          <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-sky-400/40 p-4 shadow-[0_0_24px_rgba(56,189,248,0.2)]">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-xs font-bold text-white">
                R
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                {ROOM_CONTENT_CONFIG.phone.notificationSender} • now
              </span>
            </div>
            <p className="text-sm font-medium text-white leading-snug">
              {ROOM_CONTENT_CONFIG.phone.notificationSender}:{' '}
              {ROOM_CONTENT_CONFIG.phone.notificationText}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pb-1">
            <button
              type="button"
              data-phone-unlock="true"
              onClick={(e) => {
                e.stopPropagation();
                setScreen('home');
              }}
              className="px-5 py-2.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 text-xs font-semibold tracking-wide text-white transition cursor-pointer"
            >
              Tap to unlock
            </button>
            <div className="w-28 h-1 rounded-full bg-white/50" />
          </div>
        </div>
      )}

      {screen === 'home' && (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-between p-5 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.14),transparent_50%),linear-gradient(180deg,#0b1120_0%,#080b14_100%)]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Rai Farhan</h2>
                <p className="text-xs text-slate-400">Contact &amp; Links</p>
              </div>
              <button
                type="button"
                onClick={() => setScreen('lock')}
                className="px-2.5 py-1 rounded-full bg-white/8 hover:bg-white/15 text-[11px] text-slate-300 cursor-pointer"
              >
                Lock
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {tiles.map((tile) => (
                <a
                  key={tile.label}
                  href={tile.href}
                  target={tile.newTab ? '_blank' : undefined}
                  rel={tile.newTab ? 'noopener noreferrer' : undefined}
                  className={`rounded-2xl bg-gradient-to-br ${tile.accent} border p-3.5 flex flex-col justify-between min-h-[102px] hover:brightness-115 transition`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/12 flex items-center justify-center text-sm font-bold text-white">
                    {tile.badge}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{tile.label}</div>
                    <div className="text-[11px] text-slate-300 truncate">{tile.sub}</div>
                  </div>
                </a>
              ))}
            </div>

            <button
              type="button"
              data-phone-compose-btn="true"
              onClick={() => {
                setErrorMsg('');
                setSentOk(false);
                setScreen('compose');
              }}
              className="mt-3.5 w-full rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 p-3.5 flex items-center justify-between text-left transition cursor-pointer"
            >
              <div>
                <div className="text-sm font-semibold text-white">Send a message</div>
                <div className="text-xs text-sky-200/80">Compose email directly</div>
              </div>
              <span className="text-sky-300 text-lg">→</span>
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 pt-3 shrink-0">
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Put phone down
            </button>
            <div className="w-28 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      )}

      {screen === 'compose' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-[#0b101d] select-text">
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                ← Back
              </button>
              <span className="text-sm font-semibold text-white">New Message</span>
              <span className="w-10" />
            </div>

            <div className="text-xs text-slate-400 px-1">
              To: <span className="text-slate-200">{OS_CONFIG.contact.email}</span>
            </div>

            <div>
              <label htmlFor="phone-subject" className="block text-[11px] text-slate-400 mb-1">
                Subject
              </label>
              <input
                id="phone-subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setErrorMsg('');
                  setSentOk(false);
                }}
                placeholder="Project collaboration"
                className="w-full rounded-xl bg-white/8 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <label htmlFor="phone-message" className="block text-[11px] text-slate-400 mb-1">
                Message
              </label>
              <textarea
                id="phone-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setErrorMsg('');
                  setSentOk(false);
                }}
                placeholder="Write your message..."
                className="flex-1 w-full rounded-xl bg-white/8 border border-white/15 p-3 text-xs text-white placeholder:text-slate-500 resize-none focus:outline-none focus:border-sky-400"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-500/15 border border-red-400/35 px-3 py-2 text-[11px] text-red-300">
                {errorMsg}
              </div>
            )}
            {sentOk && (
              <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/35 px-3 py-2 text-[11px] text-emerald-300">
                Mail draft opened in your email client.
              </div>
            )}
          </div>

          <div className="pt-3 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              Send Message
            </button>
            <div className="w-28 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioFocusUI() {
  const focusMode = usePortfolioStore((s) => s.focusMode);
  const focusExiting = usePortfolioStore((s) => s.focusExiting);
  const stepCertificate = usePortfolioStore((s) => s.stepCertificate);

  const isActive = Boolean(focusMode) && !focusExiting;

  const exitFocus = useCallback((lockPointer: boolean) => {
    const win = window as unknown as { __exitPortfolioFocus?: (lock?: boolean) => void };
    win.__exitPortfolioFocus?.(lockPointer);
  }, []);

  useEffect(() => {
    if (!isActive || !focusMode || focusMode.kind !== 'certificate') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        stepCertificate(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        stepCertificate(1);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isActive, focusMode, stepCertificate]);

  if (!isActive || !focusMode) return null;

  const exitLabel =
    focusMode.kind === 'certificate'
      ? 'Exit Certificates'
      : focusMode.kind === 'achievements'
        ? 'Exit Achievements'
        : focusMode.kind === 'phone'
          ? 'Exit Phone'
          : 'Exit Resume';

  return (
    <div
      data-portfolio-focus-ui={focusMode.kind}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
    >
      {/* Top-left Exit pill matching TV / Gramophone / PC UI */}
      <div className="fixed top-[18px] left-[24px] z-[110] pointer-events-auto">
        <button
          type="button"
          data-exit-focus-button="true"
          onClick={(e) => {
            e.stopPropagation();
            exitFocus(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'rgba(14, 15, 19, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e5e7eb',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          }}
        >
          <span>✕ {exitLabel}</span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>Q</span>
        </button>
      </div>

      {/* 1. Certificate Viewer Card */}
      {focusMode.kind === 'certificate' && (() => {
        const idx = focusMode.certificateIndex;
        const cert = getCertificateByIndex(idx);
        const total = ROOM_CONTENT_CONFIG.certificates.length;
        const metaLine = [cert.issuer, cert.date].filter(Boolean).join(' • ');
        const isPdf = cert.kind === 'pdf' && Boolean(cert.pdfUrl);
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto relative flex items-center gap-3 max-w-[96vw]"
          >
            <button
              type="button"
              aria-label="Previous certificate"
              data-cert-nav="prev"
              onClick={() => stepCertificate(-1)}
              className="w-10 h-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer shrink-0"
            >
              ←
            </button>

            <div className="w-[920px] max-w-[88vw] rounded-2xl bg-[#10131c]/95 backdrop-blur-md border border-white/12 p-6 shadow-2xl text-neutral-100 flex flex-col sm:flex-row gap-6 items-center">
              {isPdf && cert.pdfUrl ? (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cert-pdf-viewer="true"
                  title="Open full PDF in new tab"
                  className="block w-full sm:w-[560px] rounded-lg overflow-hidden shadow-xl border border-white/15 bg-white shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cert.imageUrl}
                    alt={cert.title}
                    className="w-full max-h-[420px] object-contain block"
                  />
                </a>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cert.imageUrl}
                  alt={cert.title}
                  data-cert-image-viewer="true"
                  className="w-full sm:w-[560px] max-h-[420px] object-contain rounded-lg shadow-xl border border-white/15 bg-neutral-950 shrink-0"
                />
              )}

              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
                    Certificate {idx + 1} / {total}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-white leading-snug">{cert.title}</h2>
                  {metaLine && (
                    <p className="text-xs text-neutral-400 mt-1">{metaLine}</p>
                  )}
                </div>

                {cert.description && (
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {cert.description}
                  </p>
                )}

                {(cert.pdfUrl || cert.imageUrl || cert.url) && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {cert.pdfUrl && (
                      <>
                        <a
                          href={cert.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-100 font-semibold text-xs transition"
                        >
                          Open PDF ↗
                        </a>
                        <a
                          href={cert.pdfUrl}
                          download
                          data-cert-download="true"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition"
                        >
                          Download PDF
                        </a>
                      </>
                    )}
                    {!cert.pdfUrl && cert.imageUrl && (
                      <a
                        href={cert.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-100 font-semibold text-xs transition"
                      >
                        Full Image ↗
                      </a>
                    )}
                    {cert.url && (
                      <a
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition"
                      >
                        Verify ↗
                      </a>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 text-[11px] text-neutral-500">
                  Use ← / → keys or arrows to browse certificates
                </div>
              </div>
            </div>

            <button
              type="button"
              aria-label="Next certificate"
              data-cert-nav="next"
              onClick={() => stepCertificate(1)}
              className="w-10 h-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer shrink-0"
            >
              →
            </button>
          </div>
        );
      })()}

      {/* 2. GitHub Achievements Card */}
      {focusMode.kind === 'achievements' && (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto w-[540px] max-w-[92vw] rounded-2xl bg-[#10131c]/95 backdrop-blur-md border border-white/12 p-6 shadow-2xl text-neutral-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">GitHub Achievements</h2>
              <p className="text-xs text-neutral-400">Earned collaboration &amp; PR milestones</p>
            </div>
            <a
              href={ROOM_CONTENT_CONFIG.achievementsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition"
            >
              GitHub ↗
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {ROOM_CONTENT_CONFIG.achievements.map((ach) => (
              <a
                key={ach.id}
                href={ach.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 flex flex-col items-center text-center gap-2 transition"
              >
                <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden="true">
                  <polygon
                    points="50,6 90,28 90,72 50,94 10,72 10,28"
                    fill="#161b22"
                    stroke={ach.accentColor}
                    strokeWidth="5"
                  />
                  {ach.iconKind === 'shark' ? (
                    <path
                      d="M32 64 Q45 28 60 32 Q54 49 70 64 Z"
                      fill={ach.accentColor}
                      stroke={ach.secondaryColor}
                      strokeWidth="3"
                    />
                  ) : (
                    <>
                      <circle cx="40" cy="50" r="11" fill={ach.accentColor} stroke={ach.secondaryColor} strokeWidth="3" />
                      <circle cx="60" cy="50" r="11" fill="none" stroke={ach.secondaryColor} strokeWidth="3" />
                    </>
                  )}
                </svg>
                <div className="text-sm font-semibold text-white">{ach.title}</div>
                <p className="text-[11px] text-neutral-400 leading-snug">{ach.description}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 3. Phone UI (360 x 720) */}
      {focusMode.kind === 'phone' && (
        <div className="pointer-events-auto">
          <PhoneFrame onExit={() => exitFocus(true)} />
        </div>
      )}

      {/* 4. Resume Window (reusing Rai XP ResumeApp) */}
      {focusMode.kind === 'resume' && (
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto w-[800px] max-w-[92vw] h-[540px] max-h-[84vh] rounded-xl overflow-hidden border border-white/15 bg-[#12151e] shadow-2xl flex flex-col"
        >
          <div className="h-[38px] px-4 flex items-center justify-between bg-[#181c28] border-b border-white/10 text-xs font-semibold text-neutral-100 shrink-0">
            <span>Rai_Farhan_CV.pdf — Rai Farhan</span>
            <button
              type="button"
              onClick={() => exitFocus(true)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] text-neutral-200 cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <ResumeApp standalone />
          </div>
        </div>
      )}
    </div>
  );
}
