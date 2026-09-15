// src/services/playTrack.ts
import TrackPlayer, { Capability, TrackType } from 'react-native-track-player';
import { TrackItem } from '../types/track';
import {
  getAudioUrlForPlayback,
  triggerBackgroundDownload,
  cancelActiveDownload,
} from './downloadService';

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
    cancelActiveDownload();
    await setupAudioPlayer();
    await TrackPlayer.reset();

    const { url, isLocal } = await getAudioUrlForPlayback(track);

    // Si es un archivo local (file://), no requiere cabeceras HTTP
    const trackPayload: any = {
      id: track.id,
      url: url,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
      type: TrackType.Default,
    };

    // Inyectar cabeceras HTTP si proviene de streaming remoto para que ExoPlayer no se congele en 00:00
    if (!isLocal) {
      trackPayload.headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
    }

    await TrackPlayer.add(trackPayload);
    await TrackPlayer.play();
    console.log(`[playTrack] 🎵 Reproduciendo: ${track.title} (${isLocal ? 'OFFLINE' : 'STREAMING'})`);

    if (!isLocal) {
      setTimeout(() => {
        triggerBackgroundDownload(track, url);
      }, 4000);
    }
  } catch (error: any) {
    console.warn(`[playTrack] ⚠️ No se pudo reproducir "${track.title}":`, error?.message || error);
  }
};