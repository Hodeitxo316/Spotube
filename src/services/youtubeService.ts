// src/services/youtubeService.ts

// @ts-ignore
import * as YouTubeJSModule from 'youtubei.js/bundle/react-native';
import { TrackItem } from '../types/track';

const YouTubeJS = YouTubeJSModule as any;
const InnertubeClass = YouTubeJS.Innertube || YouTubeJS.default?.Innertube || YouTubeJS.default;

const PIPED_FALLBACKS = [
  'https://api.piped.video',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.mha.fi',
  'https://pipedapi.adminforge.de',
];

// Tiempo límite por petición de red (ms) para no congelar la app
const FETCH_TIMEOUT_MS = 3500;

// Helper para crear fetch con timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

interface StreamCacheEntry {
  url: string;
  timestamp: number;
}

class YouTubeService {
  private static instance: YouTubeService;
  private innertube: any = null;
  private initPromise: Promise<void> | null = null;

  // Caché en memoria para enlaces de streaming (1 hora de validez)
  private streamCache = new Map<string, StreamCacheEntry>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hora

  private constructor() { }

  public static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  public async init(): Promise<void> {
    if (this.innertube) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          if (!InnertubeClass || typeof InnertubeClass.create !== 'function') {
            throw new Error('No se pudo cargar la clase Innertube.');
          }

          this.innertube = await InnertubeClass.create({
            generate_session_locally: false,
            retrieve_player: false,
            enable_safety_mode: false,
          });
        } catch (error) {
          this.initPromise = null;
          console.warn('[YouTubeService] Innertube init falló, se usará fallback directo:', error);
        }
      })();
    }

    return this.initPromise;
  }

  /**
   * Búsqueda ultra-rápida con timeout y fallback inmediato
   */

  private isLikelyNonOfficial(title: string, artist: string): boolean {
    const text = `${title} ${artist}`.toLowerCase();

    const unwantedTerms = [
      'cover',
      'karaoke',
      'remix',
      'slowed',
      'reverb',
      'sped up',
      'speed up',
      'nightcore',
      '8d',
      'bass boosted',
      'instrumental',
      'acapella',
      'acapella',
      'type beat',
      'live',
      'en vivo',
      '1 hour',
      '1h',
      'extended',
      'edit',
      'version',
      'versión',
      'mashup',
      'mix',
    ];

    return unwantedTerms.some(term => text.includes(term));
  }

  public async searchTracks(query: string): Promise<TrackItem[]> {
    const cleanQuery = query ? query.trim() : '';
    if (cleanQuery.length < 2) return [];

    // Primero intentamos buscar únicamente canciones en YouTube Music
    const musicResults = await this.searchMusicTracks(cleanQuery);

    if (musicResults.length > 0) {
      return musicResults;
    }

    try {
      const response = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
                hl: 'es',
                gl: 'ES',
              },
            },
            query: cleanQuery,
          }),
        },
        4000
      );

      if (!response.ok) return this.searchTracksFallback(cleanQuery);

      const data = await response.json();
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents?.[0]?.itemSectionRenderer?.contents || [];

      const parsed: TrackItem[] = [];
      const seenIds = new Set<string>();

      for (const item of contents) {
        const video = item.videoRenderer;
        if (video && video.videoId && !seenIds.has(video.videoId)) {
          seenIds.add(video.videoId);

          const title = video.title?.runs?.[0]?.text || 'Sin título';
          const artist = video.ownerText?.runs?.[0]?.text || 'Artista desconocido';

          if (this.isLikelyNonOfficial(title, artist)) {
            continue;
          }

          const durationText = video.lengthText?.simpleText || '0:00';
          const artwork =
            `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`;

          parsed.push({
            id: video.videoId,
            title,
            artist,
            artwork,
            duration: this.parseDuration(durationText),
          });
        }
      }

      if (parsed.length > 0) return parsed.slice(0, 20);
      return this.searchTracksFallback(cleanQuery);
    } catch (error) {
      return this.searchTracksFallback(cleanQuery);
    }
  }

  private async searchMusicTracks(query: string): Promise<TrackItem[]> {
    try {
      await this.init();

      if (!this.innertube?.music?.search) {
        return [];
      }

      const results = await this.innertube.music.search(query, {
        type: 'song',
      });

      // ---------------------------------------------------------
      // Función para normalizar textos
      // ---------------------------------------------------------

      const normalizeText = (text: string): string =>
        text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

      const normalizedQuery = normalizeText(query);

      // ---------------------------------------------------------
      // Convierte las canciones de YouTube Music a nuestro TrackItem
      // ---------------------------------------------------------

      const convertSongs = (songs: any[]) => {
        return songs
          .map((song: any) => {
            const videoId = song.id || song.video_id || '';

            const title =
              song.title?.toString?.() ||
              song.title?.text ||
              'Sin título';

            const artists =
              song.artists
                ?.map((artist: any) => artist.name)
                .filter(Boolean) || [];

            const artist =
              artists.join(' & ') ||
              song.artist?.name ||
              'Artista desconocido';

            const duration =
              song.duration?.seconds ||
              0;

            return {
              id: videoId,
              title,
              artist,
              artwork:
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              duration,
              _artists: artists,
            };
          })
          .filter((track: any) => {
            if (!track.id) return false;

            return !this.isLikelyNonOfficial(
              track.title,
              track.artist
            );
          });
      };

      // ---------------------------------------------------------
      // 1. Resultados iniciales
      // ---------------------------------------------------------

      let songs = results?.songs?.contents || [];

      let tracks = convertSongs(songs);

      // ---------------------------------------------------------
      // 2. Eliminamos duplicados
      // ---------------------------------------------------------

      const uniqueTracks = new Map<
        string,
        TrackItem & { _artists: string[] }
      >();

      for (const track of tracks) {
        if (!uniqueTracks.has(track.id)) {
          uniqueTracks.set(track.id, track);
        }
      }

      let uniqueResults = Array.from(uniqueTracks.values());

      // ---------------------------------------------------------
      // 3. Buscamos una coincidencia exacta con la búsqueda
      //
      // Ejemplo:
      // "Tenías razón" -> "Tenías razón" de Rvfv
      // "Scandic" -> "SCANDIC" de Quevedo
      // ---------------------------------------------------------

      const exactMatch = uniqueResults.find((track) => {
        return normalizeText(track.title) === normalizedQuery;
      });

      // ---------------------------------------------------------
      // 4. Detectamos el artista principal
      // ---------------------------------------------------------

      const mainArtists = new Set<string>();

      if (exactMatch) {
        for (const artist of exactMatch._artists) {
          mainArtists.add(normalizeText(artist));
        }
      }

      // ---------------------------------------------------------
      // 5. Si no es una canción concreta, comprobamos si la
      //    búsqueda corresponde directamente a un artista.
      //
      // Ejemplo:
      // "Quevedo" -> canciones donde aparece Quevedo
      // ---------------------------------------------------------

      if (mainArtists.size === 0) {
        for (const track of uniqueResults) {
          const hasMatchingArtist = track._artists.some(
            (artist) =>
              normalizeText(artist) === normalizedQuery
          );

          if (hasMatchingArtist) {
            mainArtists.add(normalizedQuery);
            break;
          }
        }
      }

      // ---------------------------------------------------------
      // 6. Buscamos canciones del artista principal
      //    dentro de los resultados iniciales.
      // ---------------------------------------------------------

      const mainArtistTracks = new Map<
        string,
        TrackItem & { _artists: string[] }
      >();

      for (const track of uniqueResults) {
        const belongsToMainArtist = track._artists.some(
          (artist) =>
            mainArtists.has(normalizeText(artist))
        );

        if (belongsToMainArtist) {
          mainArtistTracks.set(track.id, track);
        }
      }

      // ---------------------------------------------------------
      // 7. Si hemos encontrado un artista principal, hacemos una
      //    segunda búsqueda por el artista.
      //
      //    Ejemplo:
      //
      //    "Tenías razón" -> Rvfv
      //    "Rvfv" -> canciones de Rvfv
      //
      //    Así podemos encontrar más canciones aunque la búsqueda
      //    original solo tuviera una coincidencia.
      // ---------------------------------------------------------

      if (mainArtists.size > 0) {
        const artistQuery = Array.from(mainArtists)[0];

        try {
          const artistResults = await this.innertube.music.search(
            artistQuery,
            {
              type: 'song',
            }
          );

          const artistSongs =
            artistResults?.songs?.contents || [];

          const artistTracks = convertSongs(artistSongs);

          for (const track of artistTracks) {
            const belongsToMainArtist = track._artists.some(
              (artist: string) =>
                mainArtists.has(normalizeText(artist))
            );

            if (belongsToMainArtist) {
              mainArtistTracks.set(track.id, track);
            }
          }
        } catch (error) {
          console.warn(
            '[YTMusic] No se pudieron obtener más canciones del artista:',
            error
          );
        }
      }

      // ---------------------------------------------------------
      // 8. Orden final
      //
      //    Primero la canción buscada.
      //    Después el resto de canciones del mismo artista.
      //
      //    IMPORTANTE:
      //    Ya NO añadimos canciones de otros artistas.
      // ---------------------------------------------------------

      const orderedTracks: (
        TrackItem & { _artists: string[] }
      )[] = [];

      if (exactMatch) {
        orderedTracks.push(exactMatch);
      }

      for (const track of mainArtistTracks.values()) {
        if (track.id !== exactMatch?.id) {
          orderedTracks.push(track);
        }
      }

      // ---------------------------------------------------------
      // 9. Devolvemos máximo 20 canciones
      // ---------------------------------------------------------

      return orderedTracks
        .slice(0, 20)
        .map((track) => {
          const { _artists, ...cleanTrack } = track;
          return cleanTrack;
        });

    } catch (error) {
      console.warn(
        '[YouTubeService] Búsqueda musical falló:',
        error
      );

      return [];
    }
  }

  private async searchTracksFallback(query: string): Promise<TrackItem[]> {
    for (const baseUrl of PIPED_FALLBACKS) {
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
          {},
          2500
        );

        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];

          if (items.length > 0) {
            return items.slice(0, 20).map((item: any) => ({
              id: item.url?.replace('/watch?v=', '') || item.id,
              title: item.title || 'Sin título',
              artist: item.uploaderName || 'Artista desconocido',
              artwork: item.thumbnail || '',
              duration: item.duration || 0,
            }));
          }
        }
      } catch { }
    }

    return [];
  }

  /**
   * Obtiene la URL de streaming priorizando la caché de memoria
   */
  public async getAudioStreamUrl(videoId: string): Promise<string> {
    // 1. Revisar caché en memoria
    const cached = this.streamCache.get(videoId);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.url;
    }

    // 2. Intentar con Innertube
    try {
      await this.init();
    } catch { }

    const clientsToTry: Array<'ANDROID' | 'YTMUSIC' | 'WEB' | 'IOS'> = [
      'ANDROID',
      'YTMUSIC',
      'WEB',
      'IOS',
    ];

    for (const client of clientsToTry) {
      try {
        if (this.innertube) {
          const info = await this.innertube.getBasicInfo(videoId, { client });

          const formats = [
            ...(info.streaming_data?.adaptive_formats || []),
            ...(info.streaming_data?.formats || []),
          ];

          const audioFormats = formats.filter(
            (f: any) =>
              f.mime_type?.includes('audio/mp4') ||
              f.mime_type?.includes('m4a')
          );

          if (audioFormats.length > 0) {
            audioFormats.sort(
              (a: any, b: any) =>
                (a.bitrate || 0) - (b.bitrate || 0)
            );

            const selected = audioFormats[0];

            if (selected?.url) {
              this.streamCache.set(videoId, {
                url: selected.url,
                timestamp: Date.now(),
              });

              return selected.url;
            }
          }

          const fallbackFormat = formats.find(
            (f: any) => f.has_audio && f.url
          );

          if (fallbackFormat?.url) {
            this.streamCache.set(videoId, {
              url: fallbackFormat.url,
              timestamp: Date.now(),
            });

            return fallbackFormat.url;
          }
        }
      } catch { }
    }

    // 3. Fallback a servidores Piped con timeouts ajustados
    for (const baseUrl of PIPED_FALLBACKS) {
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/streams/${videoId}`,
          {},
          3000
        );

        if (res.ok) {
          const data = await res.json();
          const streams = data.audioStreams || [];

          const bestAudio =
            streams.find((s: any) =>
              s.mimeType?.includes('audio/mp4')
            ) || streams[0];

          if (bestAudio?.url) {
            this.streamCache.set(videoId, {
              url: bestAudio.url,
              timestamp: Date.now(),
            });

            return bestAudio.url;
          }
        }
      } catch { }
    }

    throw new Error(`La canción (${videoId}) no está disponible.`);
  }

  private parseDuration(text: string): number {
    if (!text) return 0;

    const parts = text.split(':').map(Number);

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    return 0;
  }
}

export const youtubeService = YouTubeService.getInstance();
export const searchTracks = (query: string) =>
  youtubeService.searchTracks(query);

export const getAudioStreamUrl = (videoId: string) =>
  youtubeService.getAudioStreamUrl(videoId);