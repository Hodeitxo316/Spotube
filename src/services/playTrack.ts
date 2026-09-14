// src/services/playTrack.ts
import TrackPlayer from 'react-native-track-player';
import { TrackItem } from '../types/track';
import { getAudioStreamUrl } from './youtubeService';

export const playTrack = async (track: TrackItem): Promise<void> => {
  try {
    // 1. Obtener la URL de audio en tiempo real
    const streamUrl = await getAudioStreamUrl(track.id);

    // 2. Limpiar la cola actual e inyectar la canción
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: track.id,
      url: streamUrl,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
    });

    // 3. Iniciar la reproducción inmediatamente
    await TrackPlayer.play();
  } catch (error) {
    console.error('Error al reproducir la pista:', error);
  }
};