// src/services/lyricsService.ts

import {
  parseLrc,
  LyricLine,
} from '../utils/lrcParser';

const LRCLIB_BASE_URL =
  'https://lrclib.net/api';

/*
 * Una petición individual no debe bloquear demasiado
 * el reproductor.
 */
const REQUEST_TIMEOUT_MS = 3500;

interface LrcLibTrack {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  hasWordSync?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const fetchJson = async <T>(
  url: string
): Promise<T | null> => {
  try {
    const controller =
      new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    console.log(
      '[LYRICS] Consultando LRCLIB:',
      url
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'SpotTube/1.0 (React Native music player)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(
          '[LYRICS] LRCLIB respondió:',
          response.status,
          url
        );

        return null;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn(
      '[LYRICS] Error consultando LRCLIB:',
      error
    );

    return null;
  }
};

const parseSyncedLyrics = (
  syncedLyrics?: string | null
): LyricLine[] => {
  if (!syncedLyrics) {
    return [];
  }

  try {
    const parsedLyrics =
      parseLrc(syncedLyrics);

    console.log(
      '[LYRICS] Primeros timestamps:',
      parsedLyrics
        .slice(0, 10)
        .map(line => ({
          time: Number(line.time.toFixed(3)),
          text: line.text,
        }))
    );

    console.log(
      '[LYRICS] Último timestamp:',
      parsedLyrics.length > 0
        ? Number(
            parsedLyrics[
              parsedLyrics.length - 1
            ].time.toFixed(3)
          )
        : null
    );

    return parsedLyrics;
  } catch (error) {
    console.warn(
      '[LYRICS] Error parseando LRC:',
      error
    );

    return [];
  }
};

const normalizeText = (
  value?: string
): string => {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/[-–—_/|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const compactText = (
  value?: string
): string => {
  return normalizeText(value)
    .replace(/\b(feat|ft|featuring)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const textMatches = (
  resultValue: string,
  requestedValue: string
): boolean => {
  const result = compactText(resultValue);
  const requested = compactText(requestedValue);

  if (!result || !requested) {
    return false;
  }

  if (result === requested) {
    return true;
  }

  if (
    result.includes(requested) ||
    requested.includes(result)
  ) {
    return true;
  }

  return false;
};

const durationDifference = (
  track: LrcLibTrack,
  requestedDuration: number
): number => {
  if (
    typeof track.duration !== 'number' ||
    requestedDuration <= 0
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(
    track.duration - requestedDuration
  );
};

const scoreCandidate = (
  track: LrcLibTrack,
  title: string,
  artist: string,
  duration: number
): number => {
  const resultTitle =
    track.trackName || track.name || '';

  const resultArtist =
    track.artistName || '';

  const titleMatch = textMatches(
    resultTitle,
    title
  );

  const artistMatch = textMatches(
    resultArtist,
    artist
  );

  if (!titleMatch) {
    return -1;
  }

  let score = 0;

  score += 60;

  if (artistMatch) {
    score += 60;
  } else {
    /*
     * No aceptamos una canción de otro artista
     * en una búsqueda normal.
     */
    return -1;
  }

  if (duration > 0) {
    const difference =
      durationDifference(
        track,
        duration
      );

    if (difference <= 2) {
      score += 50;
    } else if (difference <= 5) {
      score += 25;
    } else if (difference <= 10) {
      score += 10;
    } else {
      /*
       * Una diferencia grande suele indicar otra
       * versión, remix, live o edición.
       */
      score -= 40;
    }
  }

  return score;
};

const findBestCandidate = (
  results: LrcLibTrack[],
  title: string,
  artist: string,
  duration: number
): LrcLibTrack | null => {
  const withLyrics =
    results.filter(
      track =>
        typeof track.syncedLyrics ===
          'string' &&
        track.syncedLyrics.trim().length > 0
    );

  if (withLyrics.length === 0) {
    return null;
  }

  const scored = withLyrics
    .map(track => ({
      track,
      score: scoreCandidate(
        track,
        title,
        artist,
        duration
      ),
    }))
    .filter(item => item.score >= 0)
    .sort((a, b) =>
      b.score - a.score
    );

  const best = scored[0];

  if (!best) {
    return null;
  }

  console.log(
    '[LYRICS] 🎯 Mejor candidato:',
    {
      title:
        best.track.trackName ||
        best.track.name,
      artist:
        best.track.artistName,
      album:
        best.track.albumName,
      duration:
        best.track.duration,
      requestedDuration: duration,
      durationDifference:
        duration > 0 &&
        typeof best.track.duration ===
          'number'
          ? Number(
              (
                best.track.duration -
                duration
              ).toFixed(3)
            )
          : null,
      score: best.score,
    }
  );

  return best.track;
};

const buildApiUrl = (
  endpoint: string,
  params: Record<string, string>
): string => {
  const searchParams =
    new URLSearchParams(params);

  return `${LRCLIB_BASE_URL}/${endpoint}?${searchParams.toString()}`;
};

const getLyricsFromTrack = (
  track: LrcLibTrack | null
): LyricLine[] => {
  if (!track) {
    return [];
  }

  return parseSyncedLyrics(
    track.syncedLyrics
  );
};

export const fetchSyncedLyrics = async (
  title: string,
  artist: string,
  duration: number
): Promise<LyricLine[]> => {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();

  if (!cleanTitle || !cleanArtist) {
    console.warn(
      '[LYRICS] Título o artista vacío'
    );

    return [];
  }

  const safeDuration =
    Number.isFinite(duration) &&
    duration > 0
      ? Math.round(duration)
      : 0;

  console.log(
    '[LYRICS] ==============================='
  );

  console.log(
    '[LYRICS] Título:',
    cleanTitle
  );

  console.log(
    '[LYRICS] Artista:',
    cleanArtist
  );

  console.log(
    '[LYRICS] Duración:',
    safeDuration
  );

  try {
    /*
     * 1. PRIMERA OPCIÓN: /get
     *
     * Es la búsqueda más precisa de LRCLIB.
     * La duración ayuda a distinguir versiones.
     */
    const exactParams: Record<
      string,
      string
    > = {
      track_name: cleanTitle,
      artist_name: cleanArtist,
    };

    if (safeDuration > 0) {
      exactParams.duration =
        safeDuration.toString();
    }

    const exactTrack =
      await fetchJson<LrcLibTrack>(
        buildApiUrl(
          'get',
          exactParams
        )
      );

    const exactLyrics =
      getLyricsFromTrack(exactTrack);

    if (exactLyrics.length > 0) {
      console.log(
        '[LYRICS] ✅ Letras encontradas mediante /get:',
        exactLyrics.length
      );

      return exactLyrics;
    }

    /*
     * 2. SEGUNDA OPCIÓN: /search
     *
     * Aquí no cogemos simplemente el primer resultado.
     * Comparamos título + artista + duración.
     */
    const searchResults =
      await fetchJson<LrcLibTrack[]>(
        buildApiUrl(
          'search',
          {
            track_name: cleanTitle,
            artist_name: cleanArtist,
          }
        )
      );

    if (Array.isArray(searchResults)) {
      console.log(
        '[LYRICS] Resultados búsqueda:',
        searchResults.length
      );

      const bestCandidate =
        findBestCandidate(
          searchResults,
          cleanTitle,
          cleanArtist,
          safeDuration
        );

      const lyrics =
        getLyricsFromTrack(
          bestCandidate
        );

      if (lyrics.length > 0) {
        console.log(
          '[LYRICS] ✅ Letras encontradas mediante /search:',
          lyrics.length
        );

        return lyrics;
      }
    }

    /*
     * 3. FALLBACK MUY CONTROLADO
     *
     * Solo buscamos por título si no hay otra opción,
     * pero seguimos exigiendo que artista y duración
     * coincidan antes de aceptar el resultado.
     */
    const titleResults =
      await fetchJson<LrcLibTrack[]>(
        buildApiUrl(
          'search',
          {
            track_name: cleanTitle,
          }
        )
      );

    if (Array.isArray(titleResults)) {
      const bestTitleCandidate =
        findBestCandidate(
          titleResults,
          cleanTitle,
          cleanArtist,
          safeDuration
        );

      const lyrics =
        getLyricsFromTrack(
          bestTitleCandidate
        );

      if (lyrics.length > 0) {
        console.log(
          '[LYRICS] ✅ Letras encontradas mediante fallback:',
          lyrics.length
        );

        return lyrics;
      }
    }

    console.log(
      '[LYRICS] ❌ No se encontraron letras sincronizadas para:',
      cleanTitle,
      '-',
      cleanArtist
    );

    return [];
  } catch (error) {
    console.warn(
      '[LYRICS] Error obteniendo las letras:',
      error
    );

    return [];
  }
};