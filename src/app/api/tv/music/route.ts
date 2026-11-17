import { NextResponse } from 'next/server';

export interface TVMusicTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

const FALLBACK_TRACKS: TVMusicTrack[] = [
  {
    videoId: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio - beats to relax/study to',
    channel: 'Lofi Girl',
    duration: 'LIVE',
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
  },
  {
    videoId: '5qap5aO4i9A',
    title: 'Chill Lofi Beats Mix',
    channel: 'Lofi Girl',
    duration: '45:00',
    thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
  },
  {
    videoId: '4xDzrJKXOOY',
    title: 'synthwave radio - chill synth / retro beats',
    channel: 'Lofi Girl Synthwave',
    duration: 'LIVE',
    thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
  },
];

function extractTracksFromHtml(html: string): TVMusicTrack[] {
  const tracks: TVMusicTrack[] = [];
  const seen = new Set<string>();

  const marker = 'var ytInitialData = ';
  const idx = html.indexOf(marker);
  if (idx !== -1) {
    const end = html.indexOf(';</script>', idx);
    if (end !== -1) {
      try {
        const json = JSON.parse(html.slice(idx + marker.length, end)) as {
          contents?: {
            twoColumnSearchResultsRenderer?: {
              primaryContents?: {
                sectionListRenderer?: {
                  contents?: Array<{
                    itemSectionRenderer?: {
                      contents?: Array<{
                        videoRenderer?: {
                          videoId?: string;
                          title?: { runs?: Array<{ text?: string }> };
                          ownerText?: { runs?: Array<{ text?: string }> };
                          lengthText?: { simpleText?: string };
                          thumbnail?: { thumbnails?: Array<{ url?: string }> };
                        };
                      }>;
                    };
                  }>;
                };
              };
            };
          };
        };

        const sections =
          json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
            ?.contents ?? [];

        for (const sec of sections) {
          for (const item of sec.itemSectionRenderer?.contents ?? []) {
            const vr = item.videoRenderer;
            if (!vr?.videoId || !/^[a-zA-Z0-9_-]{11}$/.test(vr.videoId)) continue;
            if (seen.has(vr.videoId)) continue;
            seen.add(vr.videoId);

            const title = (vr.title?.runs ?? []).map((r) => r.text ?? '').join('').trim();
            if (!title) continue;

            const thumb =
              vr.thumbnail?.thumbnails?.[vr.thumbnail.thumbnails.length - 1]?.url ||
              `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

            tracks.push({
              videoId: vr.videoId,
              title,
              channel: vr.ownerText?.runs?.[0]?.text?.trim() || 'YouTube Music',
              duration: vr.lengthText?.simpleText?.trim() || 'PLAY',
              thumbnail: thumb,
            });
            if (tracks.length >= 10) break;
          }
          if (tracks.length >= 10) break;
        }
      } catch {
        // Fallback to regex extraction below
      }
    }
  }

  if (tracks.length === 0) {
    const idMatches = html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    for (const m of idMatches) {
      const videoId = m[1];
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      tracks.push({
        videoId,
        title: `YouTube Track (${videoId})`,
        channel: 'YouTube Music',
        duration: 'PLAY',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
      if (tracks.length >= 6) break;
    }
  }

  return tracks;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get('q') ?? '').trim().slice(0, 140);
  const effectiveQuery = rawQuery || 'trending top hits music playlist';

  // Bias non-specific queries toward music/audio tracks for higher embed compatibility
  const searchQuery =
    /\b(song|music|audio|lyrics|mix|remix|lofi|qawwali|ghazal|track|album|playlist)\b/i.test(
      effectiveQuery
    )
      ? effectiveQuery
      : `${effectiveQuery} song audio`;

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      searchQuery
    )}&hl=en`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8500),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ query: effectiveQuery, tracks: FALLBACK_TRACKS, fallback: true });
    }

    const html = await res.text();
    const tracks = extractTracksFromHtml(html);

    if (tracks.length === 0) {
      return NextResponse.json({ query: effectiveQuery, tracks: FALLBACK_TRACKS, fallback: true });
    }

    return NextResponse.json({ query: effectiveQuery, tracks, fallback: false });
  } catch {
    return NextResponse.json({ query: effectiveQuery, tracks: FALLBACK_TRACKS, fallback: true });
  }
}
