// src/services/playTrack.ts
import TrackPlayer, { Capability, TrackType } from 'react-native-track-player';
import { TrackItem } from '../types/track';
import { getAudioUrlForPlayback, triggerBackgroundDownload } from './downloadService';

let isPlayerSetup = false;

export const setupAudioPlayer = async () => {
  if (isPlayerSetup) return;
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    await TrackPlayer.updateOptions({
      android: { alwaysPauseOnInterruption: true },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
    });
    isPlayerSetup = true;
  } catch (error: any) {
    if (
      error?.message?.includes('already initialized') ||
      error?.code === 'player_already_initialized'
    ) {
      isPlayerSetup = true;
    } else {
      console.error('[setupAudioPlayer Error]:', error);
      throw error;
    }
  }
};

export const playTrack = async (track: TrackItem): Promise<void> => {
  try {
    await setupAudioPlayer();

    // Desestructuramos el objeto retornado para obtener 'url' (string) e 'isLocal' (boolean)
    const { url, isLocal } = await getAudioUrlForPlayback(track);

    await TrackPlayer.reset();

    await TrackPlayer.add({
      id: track.id,
      url: url, // Ahora 'url' es un string válido
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
      type: TrackType.Default,
    });

    await TrackPlayer.play();
    console.log('[playTrack] Reproducción iniciada de inmediato.');

    // Si la pista no está en el almacenamiento local, se inicia la descarga en segundo plano
    if (!isLocal) {
      setTimeout(() => {
        triggerBackgroundDownload(track, url);
      }, 500);
    }
  } catch (error: any) {
    console.error('[playTrack Error]:', error?.message || error);
    throw error;
  }
};