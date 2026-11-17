'use client';

interface IconProps {
  size?: number;
  className?: string;
}

export function XpEmblemIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g transform="skewX(-8) translate(3, 2)">
        <rect x="2" y="3" width="11" height="11" rx="2" fill="#f05228" />
        <rect x="15" y="5" width="11" height="11" rx="2" fill="#6cc02e" />
        <rect x="2" y="16" width="11" height="11" rx="2" fill="#298ef2" />
        <rect x="15" y="18" width="11" height="11" rx="2" fill="#f5b400" />
        <rect x="3" y="4" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.4)" />
        <rect x="16" y="6" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.4)" />
      </g>
    </svg>
  );
}

export function ComputerIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="4" width="24" height="17" rx="2.5" fill="#d9e2ec" stroke="#486581" strokeWidth="1.5" />
      <rect x="6" y="7" width="18" height="11" rx="1" fill="#1e64d8" />
      <path d="M6 7 L19 7 L11 18 L6 18 Z" fill="#5da9ff" opacity="0.55" />
      <rect x="12" y="21" width="6" height="3" fill="#829ab1" />
      <rect x="7" y="24" width="16" height="4" rx="1.5" fill="#bcccdc" stroke="#486581" strokeWidth="1.2" />
      <circle cx="24" cy="19" r="1.1" fill="#38bdf8" />
    </svg>
  );
}

export function RecycleBinIcon({ size = 32, full = true, className }: IconProps & { full?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      {full && (
        <>
          <polygon points="10,7 16,3 21,8 14,11" fill="#fffdf5" stroke="#94a3b8" strokeWidth="0.9" />
          <polygon points="16,6 23,5 24,10 17,11" fill="#dbeafe" stroke="#64748b" strokeWidth="0.9" />
        </>
      )}
      <path d="M7 10 L25 10 L23 28 Q16 30 9 28 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1.4" />
      <ellipse cx="16" cy="10" rx="9" ry="2.5" fill="#e2e8f0" stroke="#475569" strokeWidth="1.3" />
      <line x1="12" y1="14" x2="12.5" y2="25" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="14" x2="16" y2="25.5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="14" x2="19.5" y2="25" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NotepadIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="6" y="4" width="20" height="24" rx="2" fill="#ffffff" stroke="#3b63a8" strokeWidth="1.4" />
      <rect x="6" y="4" width="20" height="5.5" rx="1.5" fill="#316ac5" />
      <circle cx="10" cy="4" r="1.2" fill="#1e3a8a" />
      <circle cx="16" cy="4" r="1.2" fill="#1e3a8a" />
      <circle cx="22" cy="4" r="1.2" fill="#1e3a8a" />
      <line x1="9.5" y1="14" x2="22.5" y2="14" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="9.5" y1="18.5" x2="22.5" y2="18.5" stroke="#60a5fa" strokeWidth="1.5" />
      <line x1="9.5" y1="23" x2="18.5" y2="23" stroke="#60a5fa" strokeWidth="1.5" />
    </svg>
  );
}

export function MailIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="7" width="26" height="18" rx="2" fill="#ffffff" stroke="#3366bb" strokeWidth="1.5" />
      <path d="M3.5 8 L16 17.5 L28.5 8" fill="none" stroke="#2563eb" strokeWidth="1.6" />
      <path d="M4 24.5 L12 16 M28 24.5 L20 16" stroke="#93c5fd" strokeWidth="1.4" />
    </svg>
  );
}

export function PdfDocIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M6 3 H20 L26 9 V29 H6 Z" fill="#ffffff" stroke="#64748b" strokeWidth="1.4" />
      <polygon points="20,3 20,9 26,9" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
      <rect x="7.5" y="13" width="17" height="7" rx="1" fill="#dc2626" />
      <text x="16" y="18.2" textAnchor="middle" fill="#ffffff" fontSize="6" fontWeight="bold" fontFamily="Tahoma, sans-serif">
        PDF
      </text>
      <line x1="9" y1="23" x2="22" y2="23" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="9" y1="26" x2="18" y2="26" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  );
}

export function FolderIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M3 8 C3 6.5 4 6 5.5 6 H12.5 L15 9 H27.5 C28.5 9 29 9.8 29 11 V25 C29 26 28 27 27 27 H5 C3.8 27 3 26 3 25 Z" fill="#e59b1e" stroke="#a16207" strokeWidth="1.2" />
      <rect x="5" y="11" width="22" height="14" rx="1.5" fill="#ffd966" />
      <path d="M3 13 H29 L28 25.5 C27.9 26.3 27.3 27 26.3 27 H5.5 C4.5 27 3.8 26.3 3.7 25.5 Z" fill="#facc15" stroke="#b45309" strokeWidth="1.1" />
    </svg>
  );
}

export function DriveIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <polygon points="5,10 11,5 28,5 24,11" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.2" />
      <rect x="4" y="11" width="24" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1.3" />
      <rect x="6" y="13" width="20" height="4" fill="#94a3b8" />
      <circle cx="9" cy="21" r="1.5" fill="#22c55e" />
      <rect x="19" y="20" width="6" height="2" rx="1" fill="#334155" />
    </svg>
  );
}

export function SkillFileIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 2 H15 L20 7 V22 H4 Z" fill="#ffffff" stroke="#64748b" strokeWidth="1.2" />
      <rect x="7" y="10" width="10" height="8" rx="1" fill="#2563eb" opacity="0.18" stroke="#2563eb" strokeWidth="1" />
      <circle cx="12" cy="14" r="2" fill="#2563eb" />
    </svg>
  );
}

export function RecycleItemIcon({ kind, size = 28 }: { kind: 'text' | 'archive' | 'video'; size?: number }) {
  if (kind === 'archive') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="8" width="24" height="18" rx="2" fill="#facc15" stroke="#a16207" strokeWidth="1.4" />
        <rect x="14" y="8" width="4" height="18" fill="#64748b" />
        <rect x="13" y="14" width="6" height="4" rx="1" fill="#e2e8f0" stroke="#334155" strokeWidth="1" />
      </svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="6" width="24" height="20" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.4" />
        <polygon points="13,11 22,16 13,21" fill="#38bdf8" />
      </svg>
    );
  }
  return <NotepadIcon size={size} />;
}

export function ErrorXIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
      <path d="M10.5 10.5 L21.5 21.5 M21.5 10.5 L10.5 21.5" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionConfirmIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.5" />
      <text x="16" y="22.5" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="bold" fontFamily="Tahoma, sans-serif">
        ?
      </text>
    </svg>
  );
}

export function UserAvatarIcon({ size = 36, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="37" rx="4" fill="#d6e6ff" stroke="#ffffff" strokeWidth="2" />
      <circle cx="20" cy="14.5" r="6" fill="#2b5bb5" />
      <path d="M9 34 C9 26 14 22.5 20 22.5 C26 22.5 31 26 31 34 Z" fill="#2b5bb5" />
    </svg>
  );
}

export function PowerActionIcon({
  kind,
  size = 24,
}: {
  kind: 'standby' | 'turnoff' | 'restart' | 'logoff';
  size?: number;
}) {
  const bg =
    kind === 'turnoff'
      ? '#d9381e'
      : kind === 'restart'
      ? '#3e9e2e'
      : kind === 'logoff'
      ? '#eab308'
      : '#e67e22';
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" rx="5" fill={bg} stroke="#ffffff" strokeWidth="1.4" />
      {kind === 'restart' ? (
        <path
          d="M19.5 11.5 A6 6 0 1 0 20 15.5 M19.5 7.5 V12 H15"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : kind === 'standby' ? (
        <path d="M16.5 8.5 A6.2 6.2 0 1 0 19.5 17.5 A4.6 4.6 0 1 1 16.5 8.5 Z" fill="#ffffff" />
      ) : kind === 'logoff' ? (
        <path
          d="M11 9 V19 M15 14 H21 M18.5 11.5 L21 14 L18.5 16.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M14 7.5 V14 M10 9.8 A6 6 0 1 0 18 9.8"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function TrayIconsRow() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16">
        <path d="M8 1.5 L14 4 V8.5 C14 11.5 11.2 13.8 8 14.8 C4.8 13.8 2 11.5 2 8.5 V4 Z" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1" />
        <path d="M5.5 8 L7.5 10 L11 6" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <svg width="14" height="14" viewBox="0 0 16 16">
        <rect x="2" y="10" width="2.5" height="4" fill="#e0f2fe" />
        <rect x="6.5" y="7" width="2.5" height="7" fill="#e0f2fe" />
        <rect x="11" y="3.5" width="2.5" height="10.5" fill="#e0f2fe" />
      </svg>
      <svg width="14" height="14" viewBox="0 0 16 16">
        <polygon points="2,6 5.5,6 10,2.5 10,13.5 5.5,10 2,10" fill="#e0f2fe" />
        <path d="M12 5.5 Q14 8 12 10.5" fill="none" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
