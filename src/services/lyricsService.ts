// src/services/lyricsService.ts
import { parseLrc, LyricLine } from '../utils/lrcParser';

export const fetchSyncedLyrics = async (
  title: string,
  artist: string,
  duration: number
): Promise<LyricLine[]> => {
  try {
    const queryParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: Math.round(duration).toString(),
    });

    const response = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`);
    if (!response.ok) return [];

    const data = await response.json();
    if (data.syncedLyrics) {
      return parseLrc(data.syncedLyrics);
    }
  } catch (error) {
    console.error('Error fetching lyrics:', error);
  }
  return [];
};