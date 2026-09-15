// src/services/youtubeService.ts

// @ts-ignore
import * as YouTubeJSModule from 'youtubei.js/bundle/react-native';
import { TrackItem } from '../types/track';

const YouTubeJS = YouTubeJSModule as any;
const InnertubeClass = YouTubeJS.Innertube || YouTubeJS.default?.Innertube || YouTubeJS.default;

export interface StreamResult {
  url: string;
}

class YouTubeService {
  private static instance: YouTubeService;
  private innertube: any = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

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

          // retrieve_player: false desactiva eval y acelera la app de inmediato
          this.innertube = await InnertubeClass.create({
            generate_session_locally: true,
            retrieve_player: false,
          });

          console.log('[YouTubeService] Extractor inicializado sin bloqueo de hilo.');
        } catch (error) {
          this.initPromise = null;
          console.error('[YouTubeService] Error en init:', error);
          throw error;
        }
      })();
    }

    return this.initPromise;
  }

  public async searchTracks(query: string): Promise<TrackItem[]> {
    const cleanQuery = query ? query.trim() : '';
    if (cleanQuery.length < 2) return [];

    await this.init();
    if (!this.innertube) return [];

    try {
      const searchResults = await this.innertube.search(cleanQuery, { type: 'video' });
      const videos = searchResults.videos || searchResults.results || searchResults.contents || [];

      const parsed: TrackItem[] = [];
      for (const item of videos as any[]) {
        const id = item.id || item.video_id;
        const title = item.title?.text || item.title?.toString() || item.title || item.name;
        if (id && title) {
          parsed.push({
            id,
            title: typeof title === 'string' ? title : title.toString(),
            artist: item.author?.name || item.artists?.[0]?.name || 'Artista desconocido',
            artwork: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: item.duration?.seconds || 0,
          });
        }
      }
      return parsed.slice(0, 20);
    } catch (err) {
      console.error('[YouTubeService] Error en búsqueda:', err);
      return [];
    }
  }

  public async getAudioStream(videoId: string): Promise<StreamResult> {
    await this.init();

    // 1. Extraer flujos directos no cifrados mediante clientes incrustados/móviles
    const clients = ['TV_EMBEDDED', 'ANDROID', 'IOS'] as const;

    for (const clientName of clients) {
      try {
        const info = await this.innertube.getBasicInfo(videoId, { client: clientName });
        const formats = [
          ...(info.streaming_data?.adaptive_formats || []),
          ...(info.streaming_data?.formats || []),
        ];

        const audioFormat = formats.find(
          (f: any) => (f.has_audio || f.mime_type?.includes('audio')) && f.url
        );

        if (audioFormat?.url) {
          return { url: audioFormat.url };
        }
      } catch (e) {
        // Continuar al siguiente cliente
      }
    }

    // 2. Respaldo distribuido en caso de restricción geográfica o de licencias
    const endpoints = [
      `https://pipedapi.kavin.rocks/streams/${videoId}`,
      `https://api.piped.video/streams/${videoId}`,
      `https://inv.nadeko.net/api/v1/videos/${videoId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          const audioStreams = data.audioStreams || data.adaptiveFormats || [];
          const bestAudio = audioStreams.find(
            (s: any) =>
              s.mimeType?.includes('audio/mp4') ||
              s.type?.includes('audio/mp4') ||
              s.format === 'M4A'
          ) || audioStreams[0];

          if (bestAudio?.url) {
            return { url: bestAudio.url };
          }
        }
      } catch (e) {
        // Continuar al siguiente endpoint
      }
    }

    throw new Error(`No se pudo obtener datos de transmisión para el ID: ${videoId}`);
  }
}

export const youtubeService = YouTubeService.getInstance();
export const searchTracks = (query: string) => youtubeService.searchTracks(query);
export const getAudioStream = (videoId: string) => youtubeService.getAudioStream(videoId);