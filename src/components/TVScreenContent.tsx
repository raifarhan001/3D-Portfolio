'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TV_CONFIG } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';

interface TVScreenContentProps {
  mode: '3d' | 'fullscreen';
  canInteract: boolean;
}

const QUICK_MUSIC_CHIPS = [
  'The Weeknd Starboy',
  'Atif Aslam hits',
  'Bayaan Din Dhalay',
  'Coke Studio Pakistan',
  'Lo-Fi Chill Beats',
] as const;

export default function TVScreenContent({ mode, canInteract }: TVScreenContentProps) {
  const source = useTvStore((s) => s.source);
  const reloadNonce = useTvStore((s) => s.reloadNonce);
  const tvFullscreen = useTvStore((s) => s.tvFullscreen);

  const musicQuery = useTvStore((s) => s.musicQuery);
  const musicLoading = useTvStore((s) => s.musicLoading);
  const musicError = useTvStore((s) => s.musicError);
  const musicResults = useTvStore((s) => s.musicResults);
  const musicTrackIndex = useTvStore((s) => s.musicTrackIndex);
  const musicCurrentTrack = useTvStore((s) => s.musicCurrentTrack);

  const [localDraft, setLocalDraft] = useState<string | null>(null);
  const [ytStatusNote, setYtStatusNote] = useState<{ videoId: string; text: string } | null>(null);

  const searchDraft = localDraft ?? musicQuery;
  const activeStatusNote =
    ytStatusNote && ytStatusNote.videoId === musicCurrentTrack?.videoId ? ytStatusNote.text : null;

  const nightcastIframeRef = useRef<HTMLIFrameElement>(null);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);
  const nightcastLoadedRef = useRef(false);
  const embedErrorSkipsRef = useRef(0);

  useEffect(() => {
    embedErrorSkipsRef.current = 0;
  }, [musicQuery]);

  // NightCast embed availability check (clears on onLoad or direct iframe interaction)
  useEffect(() => {
    if (source !== 'nightcast') {
      nightcastLoadedRef.current = false;
      useTvStore.getState().setNightcastBlocked(false);
      return;
    }

    nightcastLoadedRef.current = false;
    useTvStore.getState().setNightcastBlocked(false);

    const onWindowBlur = () => {
      if (document.activeElement === nightcastIframeRef.current) {
        nightcastLoadedRef.current = true;
        useTvStore.getState().setNightcastBlocked(false);
      }
    };
    window.addEventListener('blur', onWindowBlur);

    const timer = setTimeout(() => {
      if (!nightcastLoadedRef.current) {
        useTvStore.getState().setNightcastBlocked(true);
      }
    }, 15000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [source, reloadNonce, mode]);

  const handleNightcastLoad = useCallback(() => {
    nightcastLoadedRef.current = true;
    useTvStore.getState().setNightcastBlocked(false);
  }, []);

  const handleNightcastError = useCallback(() => {
    useTvStore.getState().setNightcastBlocked(true);
  }, []);

  // Listen to YouTube IFrame postMessage API for track-end auto-next and embed-blocked fallback
  useEffect(() => {
    if (source !== 'music') return;

    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.origin !== 'string' ||
        (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com'))
      ) {
        return;
      }

      let data: { event?: string; info?: unknown } | null = null;
      try {
        data =
          typeof event.data === 'string'
            ? (JSON.parse(event.data) as { event?: string; info?: unknown })
            : (event.data as { event?: string; info?: unknown });
      } catch {
        return;
      }
      if (!data) return;

      if (data.event === 'onError') {
        const code = Number(data.info);
        if (code === 100 || code === 101 || code === 150) {
          const st = useTvStore.getState();
          const curId = st.musicCurrentTrack?.videoId ?? '';
          if (embedErrorSkipsRef.current < Math.min(4, Math.max(0, st.musicResults.length - 1))) {
            embedErrorSkipsRef.current += 1;
            setYtStatusNote({ videoId: curId, text: 'Video blocked embed — trying next match...' });
            st.nextMusicTrack();
          } else {
            setYtStatusNote({
              videoId: curId,
              text: 'Embed blocked by owner — click Open in YT Music below.',
            });
          }
        }
      } else if (data.event === 'onStateChange' && Number(data.info) === 0) {
        embedErrorSkipsRef.current = 0;
        useTvStore.getState().nextMusicTrack();
      } else if (
        data.event === 'infoDelivery' &&
        data.info &&
        typeof data.info === 'object' &&
        'playerState' in data.info
      ) {
        const ps = Number((data.info as { playerState?: unknown }).playerState);
        if (ps === 0) {
          embedErrorSkipsRef.current = 0;
          useTvStore.getState().nextMusicTrack();
        } else if (ps === 1) {
          embedErrorSkipsRef.current = 0;
          setYtStatusNote(null);
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [source]);

  const handleYtLoad = useCallback(() => {
    try {
      ytIframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*'
      );
    } catch {
      // ignore cross-origin post errors
    }
  }, []);

  const submitMusicSearch = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const q = searchDraft.trim();
    if (!q) return;
    embedErrorSkipsRef.current = 0;
    setLocalDraft(null);
    setYtStatusNote(null);
    void useTvStore.getState().searchAndPlayMusic(q, true);
  };

  const isCompact3d = mode === '3d';

  return (
    <div
      data-tv-screen-root="true"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#070709',
        color: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* 1. TV HOME SCREEN */}
      {source === 'standby' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: isCompact3d ? '44px 60px' : '28px 44px',
            background:
              'radial-gradient(circle at 50% 24%, rgba(179, 18, 42, 0.22), rgba(9, 9, 13, 0.98) 68%)',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#b3122a',
                  boxShadow: '0 0 12px #b3122a',
                }}
              />
              <span
                style={{
                  fontSize: isCompact3d ? '26px' : '22px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: '#f9fafb',
                }}
              >
                NIGHTCAST TV
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                data-tv-fullscreen-btn="true"
                onClick={() => useTvStore.getState().toggleTvFullscreen()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  backgroundColor: tvFullscreen
                    ? 'rgba(225, 29, 72, 0.28)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: '#f9fafb',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tvFullscreen ? '⤢ Exit Fullscreen' : '⛶ Fullscreen'}
              </button>

              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '14px',
                  color: '#d1d5db',
                }}
              >
                Smart TV Home
              </span>
            </div>
          </div>

          {/* Center: NightCast & YouTube Music */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isCompact3d ? '30px' : '24px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: isCompact3d ? '34px' : '30px',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '6px',
                }}
              >
                Choose an App
              </div>
              <div style={{ fontSize: '17px', color: '#9ca3af' }}>
                {canInteract
                  ? 'Launch NightCast movies, stream YouTube Music, or tell ELSA any song to play'
                  : 'Press E to interact with the TV'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: isCompact3d ? '34px' : '28px',
                flexWrap: 'wrap',
              }}
            >
              {/* App 1: NightCast */}
              <button
                type="button"
                data-tv-app-nightcast="true"
                onClick={() => useTvStore.getState().openNightcast()}
                style={{
                  width: '360px',
                  height: '240px',
                  borderRadius: '24px',
                  border: '2px solid #e11d48',
                  background:
                    'linear-gradient(145deg, rgba(179, 18, 42, 0.34), rgba(20, 20, 26, 0.95))',
                  boxShadow: '0 20px 50px rgba(179, 18, 42, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  color: '#ffffff',
                }}
              >
                <div
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, #b3122a, #4c0519)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    boxShadow: '0 8px 24px rgba(179, 18, 42, 0.5)',
                  }}
                >
                  NC
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>NightCast</div>
                <div style={{ fontSize: '15px', color: '#e5e7eb' }}>
                  Movies & Series Streaming
                </div>
              </button>

              {/* App 2: YouTube Music */}
              <button
                type="button"
                data-tv-app-music="true"
                onClick={() => useTvStore.getState().openMusic()}
                style={{
                  width: '360px',
                  height: '240px',
                  borderRadius: '24px',
                  border: '2px solid #ff0033',
                  background:
                    'linear-gradient(145deg, rgba(255, 0, 51, 0.24), rgba(14, 14, 18, 0.97))',
                  boxShadow: '0 20px 50px rgba(255, 0, 51, 0.22)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  color: '#ffffff',
                }}
              >
                <div
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '50%',
                    background: '#ff0033',
                    border: '3px solid rgba(255,255,255,0.88)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '30px',
                    fontWeight: 800,
                    boxShadow: '0 8px 24px rgba(255, 0, 51, 0.5)',
                    paddingLeft: '4px',
                    boxSizing: 'border-box',
                  }}
                >
                  ▶
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>YouTube Music</div>
                <div style={{ fontSize: '15px', color: '#e5e7eb' }}>
                  Search Songs or Ask ELSA to Play
                </div>
              </button>
            </div>
          </div>

          {/* Bottom Hint */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              fontSize: '15px',
              color: '#9ca3af',
            }}
          >
            <span>
              Remote: NightCast • YouTube Music • Fullscreen • Home • Ask ELSA &quot;play any song on TV&quot;
            </span>
          </div>
        </div>
      )}

      {/* 2. NIGHTCAST APP */}
      {source === 'nightcast' && (
        <iframe
          ref={nightcastIframeRef}
          key={`nc-${mode}-${reloadNonce}`}
          title="NightCast Smart TV"
          src={TV_CONFIG.nightcastUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: '#000',
            pointerEvents: canInteract ? 'auto' : 'none',
          }}
          allow="accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onLoad={handleNightcastLoad}
          onError={handleNightcastError}
        />
      )}

      {/* 3. YOUTUBE MUSIC APP */}
      {source === 'music' && (
        <div
          data-tv-youtube-music="true"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #0b0b0f 0%, #040406 100%)',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Bar: Logo + Search + Quick Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              padding: isCompact3d ? '16px 24px 12px' : '12px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(12, 12, 16, 0.94)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#ff0033',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#fff',
                  paddingLeft: '2px',
                  boxSizing: 'border-box',
                }}
              >
                ▶
              </div>
              <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>
                YT Music
              </span>
            </div>

            <form
              onSubmit={submitMusicSearch}
              style={{
                flex: 1,
                maxWidth: '560px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <input
                type="text"
                data-tv-music-search="true"
                value={searchDraft}
                onChange={(e) => setLocalDraft(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search any song, artist, or mood..."
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  background: '#16161d',
                  color: '#f9fafb',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '9px 18px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#ff0033',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {musicLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => useTvStore.getState().openNightcast()}
                style={headerBtnStyle}
              >
                NightCast
              </button>
              <button
                type="button"
                onClick={() => useTvStore.getState().goHome()}
                style={headerBtnStyle}
              >
                Home
              </button>
              {!tvFullscreen && (
                <button
                  type="button"
                  data-tv-fullscreen-btn="true"
                  onClick={() => useTvStore.getState().toggleTvFullscreen()}
                  style={{
                    ...headerBtnStyle,
                    background: 'rgba(255, 0, 51, 0.2)',
                    borderColor: 'rgba(255, 0, 51, 0.5)',
                  }}
                >
                  ⛶ Fullscreen
                </button>
              )}
            </div>
          </div>

          {/* Quick Vibe Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {QUICK_MUSIC_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  embedErrorSkipsRef.current = 0;
                  setLocalDraft(null);
                  setYtStatusNote(null);
                  void useTvStore.getState().searchAndPlayMusic(chip, true);
                }}
                style={{
                  padding: '6px 13px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  background:
                    musicQuery.toLowerCase() === chip.toLowerCase()
                      ? '#f9fafb'
                      : 'rgba(255, 255, 255, 0.06)',
                  color: musicQuery.toLowerCase() === chip.toLowerCase() ? '#09090b' : '#e4e4e7',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Main Split: Left Embedded Player + Right Up Next Queue */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '1.65fr 1fr',
              gap: '18px',
              padding: '16px 24px 20px',
              boxSizing: 'border-box',
            }}
          >
            {/* Left: Video Player & Track Controls */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                gap: '12px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: '#000',
                  position: 'relative',
                }}
              >
                {musicCurrentTrack ? (
                  <iframe
                    ref={ytIframeRef}
                    key={`yt-${mode}-${musicCurrentTrack.videoId}-${reloadNonce}`}
                    title={musicCurrentTrack.title}
                    src={`https://www.youtube.com/embed/${musicCurrentTrack.videoId}?autoplay=1&enablejsapi=1&rel=0&playsinline=1`}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block',
                      pointerEvents: canInteract ? 'auto' : 'none',
                    }}
                    allow="accelerometer *; autoplay *; clipboard-write *; encrypted-media *; gyroscope *; picture-in-picture *; web-share *"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={handleYtLoad}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      gap: '10px',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>
                      {musicLoading ? 'Finding songs on YouTube Music...' : 'Pick or search a song'}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      Search above, click any track on the right, or tell ELSA &quot;play [song] on TV&quot;.
                    </div>
                  </div>
                )}
              </div>

              {/* Track Metadata + Transport Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexShrink: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    data-tv-music-now-playing="true"
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#f9fafb',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {musicCurrentTrack?.title || (musicError ?? 'No track selected')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px' }}>
                    {activeStatusNote || musicCurrentTrack?.channel || 'YouTube Music TV'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => useTvStore.getState().prevMusicTrack()}
                    disabled={musicResults.length === 0}
                    style={transportBtnStyle}
                  >
                    ⏮ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => useTvStore.getState().nextMusicTrack()}
                    disabled={musicResults.length === 0}
                    style={transportBtnStyle}
                  >
                    Next ⏭
                  </button>
                  {musicCurrentTrack && (
                    <a
                      href={`https://music.youtube.com/watch?v=${musicCurrentTrack.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...transportBtnStyle,
                        textDecoration: 'none',
                        color: '#fda4af',
                        borderColor: 'rgba(255, 0, 51, 0.35)',
                      }}
                    >
                      ↗ YT Music
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Queue List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#d4d4d8',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>UP NEXT</span>
                <span style={{ color: '#9ca3af', fontWeight: 500 }}>
                  {musicResults.length} tracks
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {musicError && musicResults.length === 0 && (
                  <div style={{ padding: '16px', fontSize: '13px', color: '#fca5a5' }}>
                    {musicError}
                  </div>
                )}

                {musicResults.map((track, idx) => {
                  const isActive =
                    musicCurrentTrack?.videoId === track.videoId && idx === musicTrackIndex;
                  return (
                    <button
                      key={`${track.videoId}-${idx}`}
                      type="button"
                      onClick={() => {
                        embedErrorSkipsRef.current = 0;
                        setYtStatusNote(null);
                        useTvStore.getState().playMusicTrackAt(idx);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        border: isActive
                          ? '1px solid rgba(255, 0, 51, 0.55)'
                          : '1px solid transparent',
                        background: isActive
                          ? 'rgba(255, 0, 51, 0.16)'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: '#f4f4f5',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={track.thumbnail}
                        alt=""
                        width={56}
                        height={36}
                        style={{
                          width: '56px',
                          height: '36px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          flexShrink: 0,
                          backgroundColor: '#18181b',
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: isActive ? '#fda4af' : '#f4f4f5',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {track.title}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#a1a1aa',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginTop: '2px',
                          }}
                        >
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {track.channel}
                          </span>
                          <span style={{ flexShrink: 0 }}>{track.duration}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '8px 13px',
  borderRadius: '999px',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: 'rgba(255, 255, 255, 0.07)',
  color: '#f3f4f6',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const transportBtnStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#f4f4f5',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
