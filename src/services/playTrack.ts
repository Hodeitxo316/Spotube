// src/services/playTrack.ts
import TrackPlayer, { Capability, TrackType, AppKilledPlaybackBehavior } from 'react-native-track-player';
import { TrackItem } from '../types/track';
import {
  getAudioUrlForPlayback,
  triggerBackgroundDownload,
} from './downloadService';

let isPlayerSetup = false;

export const setupAudioPlayer = async (): Promise<void> => {
  if (isPlayerSetup) return;

  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
      minBuffer: 15,
      maxBuffer: 50,
      playBuffer: 2,
      backBuffer: 10,
    });

    await TrackPlayer.updateOptions({
      android: {
        alwaysPauseOnInterruption: true,
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
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
    // 1. Obtener URL de reproducción (local o remota)
    const { url, isLocal } = await getAudioUrlForPlayback(track);

    if (!url) {
      throw new Error('No se pudo obtener una URL de reproducción válida.');
    }

    // 2. Cargar reproductor
    await setupAudioPlayer();
    await TrackPlayer.reset();

    const trackPayload: any = {
      id: track.id,
      url: url,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
      type: TrackType.Default,
    };

    if (!isLocal) {
      trackPayload.headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
    }

    await TrackPlayer.add(trackPayload);
    await TrackPlayer.play();

    console.log(`[playTrack] 🎵 Reproduciendo: ${track.title} (${isLocal ? 'OFFLINE' : 'STREAMING'})`);

    // 3. Si no es local, encolar para guardar en segundo plano sin interrumpir lo anterior
    if (!isLocal) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          triggerBackgroundDownload(track, url);
        }, 3500);
      });
    }
  } catch (error: any) {
    console.warn(`[playTrack] ⚠️ No se pudo reproducir "${track.title}":`, error?.message || error);
  }
};