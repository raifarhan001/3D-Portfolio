'use client';

/**
 * Shared Luna-style Bliss homage wallpaper rendered in SVG & CSS gradients
 * matching the 3D monitor static CanvasTexture in GamingCorner.
 */
export default function XpDesktopWallpaper() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      viewBox="0 0 1280 510"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rxp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f64d0" />
          <stop offset="55%" stopColor="#5b9ef5" />
          <stop offset="100%" stopColor="#a9d5fc" />
        </linearGradient>
        <radialGradient id="rxp-cloud" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.48)" />
          <stop offset="65%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="rxp-back-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#59aa2f" />
          <stop offset="100%" stopColor="#2b6f17" />
        </linearGradient>
        <linearGradient id="rxp-front-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#80d137" />
          <stop offset="45%" stopColor="#59ae23" />
          <stop offset="100%" stopColor="#2c7a16" />
        </linearGradient>
      </defs>

      <rect width="1280" height="510" fill="url(#rxp-sky)" />
      <ellipse cx="280" cy="112" rx="135" ry="34" fill="url(#rxp-cloud)" />
      <ellipse cx="440" cy="96" rx="100" ry="30" fill="url(#rxp-cloud)" />
      <ellipse cx="870" cy="84" rx="155" ry="36" fill="url(#rxp-cloud)" />
      <ellipse cx="1040" cy="122" rx="110" ry="28" fill="url(#rxp-cloud)" />
      <ellipse cx="640" cy="176" rx="170" ry="32" fill="url(#rxp-cloud)" />

      <path
        d="M 0 316 C 358 219, 704 235, 1280 296 L 1280 510 L 0 510 Z"
        fill="url(#rxp-back-hill)"
      />
      <path
        d="M 0 347 C 282 275, 538 367, 870 265 C 1075 209, 1190 240, 1280 281 L 1280 510 L 0 510 Z"
        fill="url(#rxp-front-hill)"
      />
    </svg>
  );
}
