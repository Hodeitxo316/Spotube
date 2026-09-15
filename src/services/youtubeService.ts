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

          this.innertube = await InnertubeClass.create({
            generate_session_locally: false,
            retrieve_player: false,
            enable_safety_mode: false,
          });
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

    try {
      const response = await fetch('https://www.youtube.com/youtubei/v1/search', {
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
      });

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
          const durationText = video.lengthText?.simpleText || '0:00';
          const artwork =
            video.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;

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

  private async searchTracksFallback(query: string): Promise<TrackItem[]> {
    for (const baseUrl of PIPED_FALLBACKS) {
      try {
        const res = await fetch(
          `${baseUrl}/search?q=${encodeURIComponent(query)}&filter=music_songs`
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          return items.slice(0, 20).map((item: any) => ({
            id: item.url?.replace('/watch?v=', '') || item.id,
            title: item.title || 'Sin título',
            artist: item.uploaderName || 'Artista desconocido',
            artwork: item.thumbnail || '',
            duration: item.duration || 0,
          }));
        }
      } catch {}
    }
    return [];
  }

  public async getAudioStreamUrl(videoId: string): Promise<string> {
    try {
      await this.init();
    } catch {}

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
            (f: any) => f.mime_type?.includes('audio/mp4') || f.mime_type?.includes('m4a')
          );

          if (audioFormats.length > 0) {
            audioFormats.sort((a: any, b: any) => (a.bitrate || 0) - (b.bitrate || 0));
            const selected = audioFormats[0];
            if (selected?.url) return selected.url;
          }

          const fallbackFormat = formats.find((f: any) => f.has_audio && f.url);
          if (fallbackFormat?.url) return fallbackFormat.url;
        }
      } catch {}
    }

    for (const baseUrl of PIPED_FALLBACKS) {
      try {
        const res = await fetch(`${baseUrl}/streams/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          const streams = data.audioStreams || [];
          const bestAudio =
            streams.find((s: any) => s.mimeType?.includes('audio/mp4')) || streams[0];

          if (bestAudio?.url) return bestAudio.url;
        }
      } catch {}
    }

    throw new Error(`La canción (${videoId}) no está disponible.`);
  }

  private parseDuration(text: string): number {
    if (!text) return 0;
    const parts = text.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
}

export const youtubeService = YouTubeService.getInstance();
export const searchTracks = (query: string) => youtubeService.searchTracks(query);
export const getAudioStreamUrl = (videoId: string) => youtubeService.getAudioStreamUrl(videoId);