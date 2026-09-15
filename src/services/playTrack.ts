// src/services/playTrack.ts
import TrackPlayer, {
  Capability,
  TrackType,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import { TrackItem } from '../types/track';
import {
  getAudioUrlForPlayback,
  triggerBackgroundDownload,
  saveTrackToLibrary,
  isTrackDownloaded,
  getLocalFilePath,
} from './downloadService';

let isPlayerSetup = false;

export const setupAudioPlayer = async (): Promise<void> => {
  if (isPlayerSetup) return;

  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
      minBuffer: 30,
      maxBuffer: 100,
      playBuffer: 3,
      backBuffer: 15,
    });

    await TrackPlayer.updateOptions({
      android: {
        alwaysPauseOnInterruption: true,
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
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
    const { url, isLocal } = await getAudioUrlForPlayback(track);

    if (!url) {
      throw new Error('No se pudo obtener una URL de reproducción válida.');
    }

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

    console.log(
      `[playTrack] 🎵 Reproduciendo: ${track.title} (${
        isLocal ? 'OFFLINE' : 'STREAMING'
      })`
    );

    if (isLocal) {
      saveTrackToLibrary(track);
    } else {
      requestAnimationFrame(() => {
        setTimeout(() => {
          triggerBackgroundDownload(track, url);
        }, 3000);
      });
    }
  } catch (error: any) {
    console.warn(
      `[playTrack] ⚠️ No se pudo reproducir "${track.title}":`,
      error?.message || error
    );
  }
};

/**
 * Realiza un Seek inteligente. Si la canción era de streaming pero ya se descargó,
 * conmuta al archivo local al hacer el salto de tiempo para saltos instantáneos.
 */
export const seekToPosition = async (seconds: number, trackId: string): Promise<void> => {
  try {
    const downloaded = await isTrackDownloaded(trackId);
    const activeTrack = await TrackPlayer.getActiveTrack();

    if (downloaded && activeTrack && activeTrack.url?.startsWith('http')) {
      const localPath = getLocalFilePath(trackId);

      await TrackPlayer.reset();
      await TrackPlayer.add({
        ...activeTrack,
        url: `file://${localPath}`,
      });
      await TrackPlayer.seekTo(seconds);
      await TrackPlayer.play();
      console.log(`[playTrack] ⚡ Conmutado a LOCAL durante el seek en el segundo: ${seconds}`);
    } else {
      await TrackPlayer.seekTo(seconds);
    }
  } catch (error) {
    console.warn('[playTrack] Error al realizar seekToPosition:', error);
    await TrackPlayer.seekTo(seconds);
  }
};