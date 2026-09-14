// src/services/playTrack.ts
import TrackPlayer from 'react-native-track-player';
import { TrackItem } from '../types/track';
import { getAudioStreamUrl } from './youtubeService';
import { getLocalAudioPath, cacheAudioStream } from './cacheManager';

export const playTrack = async (track: TrackItem): Promise<void> => {
  try {
    // 1. Verificación en disco local (Latencia < 100ms)
    let playbackUrl = await getLocalAudioPath(track.id);

    // 2. Si no existe en local, se obtiene la URL remota y se inicia el Write-Through
    if (!playbackUrl) {
      playbackUrl = await getAudioStreamUrl(track.id);
      // Inicia la descarga en caché temporal de forma asíncrona en segundo plano
      cacheAudioStream(track.id, playbackUrl);
    }

    // 3. Inyección y reproducción en TrackPlayer
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: track.id,
      url: playbackUrl,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
    });

    await TrackPlayer.play();
  } catch (error) {
    console.error('Error al reproducir pista con estrategia de caché:', error);
  }
};