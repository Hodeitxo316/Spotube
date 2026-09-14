// src/services/youtubeService.ts
import { getYouTubeClient } from '../api/youtube';
import { TrackItem } from '../types/track';

/**
 * Busca canciones en YouTube y mapea los resultados.
 */
export const searchTracks = async (query: string): Promise<TrackItem[]> => {
  try {
    const yt = await getYouTubeClient();
    const searchResults = await yt.search(query, { type: 'video' });

    const tracks: TrackItem[] = [];

    if (searchResults.results) {
      for (const item of searchResults.results) {
        const video = item as any;
        if (video.id && video.title) {
          // Obtener la carátula de mayor resolución disponible
          const artworkUrl =
            video.thumbnails?.[video.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

          tracks.push({
            id: video.id,
            title: typeof video.title === 'string' ? video.title : video.title?.text || 'Sin título',
            artist: video.author?.name || video.secondary_title?.text || 'Artista desconocido',
            artwork: artworkUrl,
            duration: video.duration?.seconds || 0,
          });
        }
      }
    }

    return tracks;
  } catch (error) {
    console.error('Error al buscar canciones:', error);
    throw error;
  }
};

/**
 * Obtiene y descifra el stream de audio directo en tiempo real usando youtubei.js
 */
export const getAudioStreamUrl = async (videoId: string): Promise<string> => {
  try {
    const yt = await getYouTubeClient();
    const info = await yt.getInfo(videoId);

    // Selecciona el formato con mejor calidad de sonido
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best',
    });

    if (!format) {
      throw new Error('No se encontró un formato de audio disponible para este vídeo.');
    }

    // Descifrado de la firma (signatureCipher) y del parámetro `n` on-device
    const streamUrl = format.decipher(yt.session.player);
    return streamUrl;
  } catch (error) {
    console.error(`Error al extraer stream para el ID ${videoId}:`, error);
    throw error;
  }
};