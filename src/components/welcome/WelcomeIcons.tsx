import type { AchievementEntry } from '@/config/roomContent';
import type { WelcomeFeatureIcon } from '@/config/welcomeConfig';

export function FeatureSvgIcon({ kind }: { kind: WelcomeFeatureIcon }) {
  switch (kind) {
    case 'tv':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
          <path d="M8 20h8" />
          <path d="M12 17v3" />
          <polygon points="10.5,8.5 15,10.5 10.5,12.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'pc':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M7 20h10" />
          <path d="M10 16v4" />
          <path d="M14 16v4" />
        </svg>
      );
    case 'certificate':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M7 9h6" />
          <path d="M7 12.5h4" />
          <circle cx="16.5" cy="14" r="2.5" />
          <path d="M15.2 16.2V20l1.3-.9 1.3.9v-3.8" />
        </svg>
      );
    case 'phone':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M10.5 5.5h3" />
          <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function ArrowRightSvgIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function SocialSvgIcon({ kind }: { kind: 'github' | 'linkedin' | 'fiverr' | 'email' | 'resume' }) {
  switch (kind) {
    case 'github':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.38 9.38 0 0 1 12 6.94c.85 0 1.71.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 11v5" />
          <path d="M8 8v.01" />
          <path d="M12 16v-5" />
          <path d="M16 16v-3a2 2 0 0 0-4 0" />
        </svg>
      );
    case 'fiverr':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M10.5 16v-4.5a2 2 0 0 1 2-2h1.2" />
          <path d="M9 12h4.2" />
          <circle cx="15.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'email':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'resume':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
  }
}

export function AchievementMiniBadge({ achievement }: { achievement: AchievementEntry }) {
  return (
    <a
      href={achievement.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#08090D]/80 px-2.5 py-1.5 text-xs text-[#F4F5F7] hover:border-[#6C8CFF]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6C8CFF] transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
        <polygon
          points="50,6 90,28 90,72 50,94 10,72 10,28"
          fill="#10131C"
          stroke={achievement.accentColor}
          strokeWidth="7"
        />
        {achievement.iconKind === 'shark' ? (
          <path
            d="M32 64 Q45 28 60 32 Q54 49 70 64 Z"
            fill={achievement.accentColor}
            stroke={achievement.secondaryColor}
            strokeWidth="4"
          />
        ) : (
          <>
            <circle
              cx="40"
              cy="50"
              r="11"
              fill={achievement.accentColor}
              stroke={achievement.secondaryColor}
              strokeWidth="4"
            />
            <circle
              cx="60"
              cy="50"
              r="11"
              fill="none"
              stroke={achievement.secondaryColor}
              strokeWidth="4"
            />
          </>
        )}
      </svg>
      <span className="font-mono text-[12px] tracking-tight text-[#F4F5F7] group-hover:text-white">
        {achievement.title}
      </span>
    </a>
  );
}
