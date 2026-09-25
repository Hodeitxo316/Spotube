// src/services/lyricsService.ts

import {
  parseLrc,
  LyricLine,
} from '../utils/lrcParser';

const LRCLIB_BASE_URL =
  'https://lrclib.net/api';

const REQUEST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 1200;
const MAX_RETRIES = 2;

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

const wait = (
  milliseconds: number
): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
};

const fetchJson = async <T>(
  url: string
): Promise<T | null> => {
  let lastStatus: number | null = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
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

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'SpotTube/1.0 (React Native music player)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      lastStatus = response.status;

      if (response.ok) {
        return (await response.json()) as T;
      }

      console.warn(
        '[LYRICS] LRCLIB respondió:',
        response.status,
        url
      );

      /*
       * 520 = el servidor/proxy intermedio no ha podido
       * procesar correctamente la petición.
       *
       * En lugar de abandonar inmediatamente,
       * hacemos un par de reintentos controlados.
       */

      if (
        response.status === 520 &&
        attempt < MAX_RETRIES
      ) {
        console.log(
          `[LYRICS] 520 recibido. Reintentando (${attempt + 1}/${MAX_RETRIES})...`
        );

        await wait(RETRY_DELAY_MS);
        continue;
      }

      return null;
    } catch (error) {
      console.warn(
        '[LYRICS] Error consultando LRCLIB:',
        error
      );

      if (attempt < MAX_RETRIES) {
        console.log(
          `[LYRICS] Reintentando petición (${attempt + 1}/${MAX_RETRIES})...`
        );

        await wait(RETRY_DELAY_MS);
        continue;
      }

      return null;
    }
  }

  console.warn(
    '[LYRICS] Petición agotada. Último estado:',
    lastStatus
  );

  return null;
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

    /*
     * DEBUG:
     * Mostramos los primeros timestamps que realmente
     * devuelve LRCLIB después de pasar por nuestro parser.
     *
     * Esto nos permitirá saber si el desfase ya viene
     * desde LRCLIB o aparece posteriormente en el reproductor.
     */

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
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/[-–—_/|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const titleMatches = (
  resultTitle: string,
  requestedTitle: string
): boolean => {
  const result =
    normalizeText(resultTitle);

  const requested =
    normalizeText(requestedTitle);

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

const artistMatches = (
  resultArtist: string,
  requestedArtist: string
): boolean => {
  const result =
    normalizeText(resultArtist);

  const requested =
    normalizeText(requestedArtist);

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

  /*
   * Primero intentamos encontrar una coincidencia
   * real de título + artista.
   */

  const matchingTitleAndArtist =
    withLyrics.filter(track =>
      titleMatches(
        track.trackName ||
          track.name ||
          '',
        title
      ) &&
      artistMatches(
        track.artistName || '',
        artist
      )
    );

  const candidates =
    matchingTitleAndArtist.length > 0
      ? matchingTitleAndArtist
      : withLyrics;

  /*
   * Si tenemos duración, elegimos la versión cuya
   * duración esté más cerca de la canción reproducida.
   */

  const sorted = [...candidates].sort(
    (a, b) => {
      if (duration <= 0) {
        return 0;
      }

      const durationA =
        typeof a.duration === 'number'
          ? Math.abs(
              a.duration - duration
            )
          : Number.MAX_SAFE_INTEGER;

      const durationB =
        typeof b.duration === 'number'
          ? Math.abs(
              b.duration - duration
            )
          : Number.MAX_SAFE_INTEGER;

      return durationA - durationB;
    }
  );

  return sorted[0] || null;
};

const buildApiUrl = (
  endpoint: string,
  params: Record<string, string>
): string => {
  const searchParams =
    new URLSearchParams(params);

  return `${LRCLIB_BASE_URL}/${endpoint}?${searchParams.toString()}`;
};

const logSelectedTrack = (
  label: string,
  track: LrcLibTrack | null,
  requestedTitle: string,
  requestedArtist: string,
  requestedDuration: number
): void => {
  console.log(
    `[LYRICS] 🎯 ${label}:`,
    {
      id: track?.id,
      title:
        track?.trackName ||
        track?.name ||
        null,
      artist:
        track?.artistName ||
        null,
      album:
        track?.albumName ||
        null,
      duration:
        track?.duration ??
        null,
      requestedTitle,
      requestedArtist,
      requestedDuration,
      durationDifference:
        typeof track?.duration === 'number' &&
        requestedDuration > 0
          ? Number(
              (
                track.duration -
                requestedDuration
              ).toFixed(3)
            )
          : null,
      hasSyncedLyrics:
        typeof track?.syncedLyrics ===
          'string' &&
        track.syncedLyrics.trim().length > 0,
      hasWordSync:
        track?.hasWordSync ?? false,
    }
  );
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
     * ==================================================
     * 1. BÚSQUEDA EXACTA
     * ==================================================
     *
     * Esta es la primera opción y la más precisa.
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

    const exactUrl = buildApiUrl(
      'get',
      exactParams
    );

    const exactTrack =
      await fetchJson<LrcLibTrack>(
        exactUrl
      );

    console.log(
      '[LYRICS] Resultado exacto:',
      exactTrack
    );

    logSelectedTrack(
      'REGISTRO EXACTO',
      exactTrack,
      cleanTitle,
      cleanArtist,
      safeDuration
    );

    const exactLyrics =
      getLyricsFromTrack(exactTrack);

    if (exactLyrics.length > 0) {
      console.log(
        '[LYRICS] ✅ Letras encontradas mediante búsqueda exacta:',
        exactLyrics.length
      );

      return exactLyrics;
    }

    /*
     * ==================================================
     * 2. BÚSQUEDA POR TÍTULO + ARTISTA
     * ==================================================
     */

    await wait(300);

    const searchUrl = buildApiUrl(
      'search',
      {
        track_name: cleanTitle,
        artist_name: cleanArtist,
      }
    );

    const searchResults =
      await fetchJson<LrcLibTrack[]>(
        searchUrl
      );

    console.log(
      '[LYRICS] Resultados búsqueda:',
      Array.isArray(searchResults)
        ? searchResults.length
        : 0
    );

    if (Array.isArray(searchResults)) {
      const bestCandidate =
        findBestCandidate(
          searchResults,
          cleanTitle,
          cleanArtist,
          safeDuration
        );

      logSelectedTrack(
        'CANDIDATO FINAL TÍTULO + ARTISTA',
        bestCandidate,
        cleanTitle,
        cleanArtist,
        safeDuration
      );

      if (bestCandidate) {
        console.log(
          '[LYRICS] 🎵 Candidato encontrado:',
          {
            id: bestCandidate.id,
            title:
              bestCandidate.trackName ||
              bestCandidate.name,
            artist:
              bestCandidate.artistName,
            album:
              bestCandidate.albumName,
            duration:
              bestCandidate.duration,
          }
        );

        const lyrics =
          getLyricsFromTrack(
            bestCandidate
          );

        if (lyrics.length > 0) {
          console.log(
            '[LYRICS] ✅ Letras encontradas mediante búsqueda:',
            lyrics.length
          );

          return lyrics;
        }
      }
    }

    /*
     * ==================================================
     * 3. BÚSQUEDA SOLO POR TÍTULO
     * ==================================================
     *
     * Solo llegamos aquí si las anteriores no han
     * encontrado letras.
     */

    await wait(300);

    const titleUrl = buildApiUrl(
      'search',
      {
        track_name: cleanTitle,
      }
    );

    const titleResults =
      await fetchJson<LrcLibTrack[]>(
        titleUrl
      );

    console.log(
      '[LYRICS] Resultados solo por título:',
      Array.isArray(titleResults)
        ? titleResults.length
        : 0
    );

    if (Array.isArray(titleResults)) {
      const bestTitleCandidate =
        findBestCandidate(
          titleResults,
          cleanTitle,
          cleanArtist,
          safeDuration
        );

      logSelectedTrack(
        'CANDIDATO FINAL SOLO TÍTULO',
        bestTitleCandidate,
        cleanTitle,
        cleanArtist,
        safeDuration
      );

      if (bestTitleCandidate) {
        console.log(
          '[LYRICS] 🎵 Candidato por título:',
          {
            id: bestTitleCandidate.id,
            title:
              bestTitleCandidate.trackName ||
              bestTitleCandidate.name,
            artist:
              bestTitleCandidate.artistName,
            album:
              bestTitleCandidate.albumName,
            duration:
              bestTitleCandidate.duration,
          }
        );

        const lyrics =
          getLyricsFromTrack(
            bestTitleCandidate
          );

        if (lyrics.length > 0) {
          console.log(
            '[LYRICS] ✅ Letras encontradas buscando solo por título:',
            lyrics.length
          );

          return lyrics;
        }
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