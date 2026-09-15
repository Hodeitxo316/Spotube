// src/services/downloadService.ts
import RNBlobUtil, { StatefulPromise, FetchBlobResponse } from 'react-native-blob-util';
import { DeviceEventEmitter } from 'react-native';
import { TrackItem } from '../types/track';
import { youtubeService } from './youtubeService';
import { libraryStorage } from '../storage/libraryStorage';
import { Track } from '../types/library';

const { dirs } = RNBlobUtil.fs;
const MUSIC_DIR = `${dirs.DocumentDir}/music`;

export const getLocalFilePath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MUSIC_DIR}/${cleanId}.m4a`;
};

export const getTempFilePath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MUSIC_DIR}/${cleanId}.m4a.tmp`;
};

export const isTrackDownloaded = async (trackId: string): Promise<boolean> => {
  try {
    const finalPath = getLocalFilePath(trackId);
    const exists = await RNBlobUtil.fs.exists(finalPath);
    if (!exists) return false;
    const stat = await RNBlobUtil.fs.stat(finalPath);
    return Number(stat.size) > 300000;
  } catch {
    return false;
  }
};

interface QueueTask {
  track: TrackItem;
  streamUrl: string;
}

class DownloadQueueManager {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private currentTask: StatefulPromise<FetchBlobResponse> | null = null;
  private activeTrackId: string | null = null;

  public enqueue(track: TrackItem, streamUrl: string) {
    isTrackDownloaded(track.id).then((downloaded) => {
      const existingTrack = libraryStorage.getTrack(track.id);
      const finalPath = getLocalFilePath(track.id);

      if (downloaded) {
        libraryStorage.saveTrack({
          id: track.id,
          title: track.title,
          artist: track.artist || (track as any).channelTitle || 'Artista Desconocido',
          coverUrl: track.artwork || (track as any).coverUrl || (track as any).thumbnail || '',
          duration: track.duration || 0,
          localPath: finalPath,
          isFavorite: existingTrack ? existingTrack.isFavorite : false,
          downloadState: 'completed',
          addedAt: existingTrack ? existingTrack.addedAt : Date.now(),
        });
        DeviceEventEmitter.emit('library_updated');
        return;
      }

      const isAlreadyInQueue = this.queue.some((item) => item.track.id === track.id);
      const isCurrentlyDownloading = this.activeTrackId === track.id;

      if (!isAlreadyInQueue && !isCurrentlyDownloading) {
        const trackToSave: Track = {
          id: track.id,
          title: track.title,
          artist: track.artist || (track as any).channelTitle || 'Artista Desconocido',
          coverUrl: track.artwork || (track as any).coverUrl || (track as any).thumbnail || '',
          duration: track.duration || 0,
          isFavorite: existingTrack ? existingTrack.isFavorite : false,
          downloadState: 'downloading',
          addedAt: existingTrack ? existingTrack.addedAt : Date.now(),
        };
        libraryStorage.saveTrack(trackToSave);
        DeviceEventEmitter.emit('library_updated');

        this.queue.push({ track, streamUrl });
        this.processNext();
      }
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    const { track, streamUrl } = task;
    const finalPath = getLocalFilePath(track.id);
    const tempPath = getTempFilePath(track.id);

    if (await isTrackDownloaded(track.id)) {
      this.isProcessing = false;
      this.processNext();
      return;
    }

    this.activeTrackId = track.id;

    try {
      const dirExists = await RNBlobUtil.fs.isDir(MUSIC_DIR);
      if (!dirExists) {
        await RNBlobUtil.fs.mkdir(MUSIC_DIR);
      }

      this.currentTask = RNBlobUtil.config({
        path: tempPath,
        fileCache: true,
      }).fetch('GET', streamUrl, {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const res = await this.currentTask;
      this.currentTask = null;

      const status = res.info().status;
      if (status >= 200 && status < 300) {
        const stat = await RNBlobUtil.fs.stat(tempPath);
        if (Number(stat.size) > 300000) {

          // Operación desacoplada sin congelar el hilo principal de audio
          setTimeout(async () => {
            try {
              if (await RNBlobUtil.fs.exists(finalPath)) {
                await RNBlobUtil.fs.unlink(finalPath);
              }

              await RNBlobUtil.fs.mv(tempPath, finalPath);

              const existingTrack = libraryStorage.getTrack(track.id);
              const trackToSave: Track = {
                id: track.id,
                title: track.title,
                artist: track.artist || (track as any).channelTitle || 'Artista Desconocido',
                coverUrl: track.artwork || (track as any).coverUrl || (track as any).thumbnail || '',
                duration: track.duration || 0,
                localPath: finalPath,
                isFavorite: existingTrack ? existingTrack.isFavorite : false,
                downloadState: 'completed',
                fileSizeBytes: Number(stat.size),
                addedAt: existingTrack ? existingTrack.addedAt : Date.now(),
              };

              libraryStorage.saveTrack(trackToSave);
              DeviceEventEmitter.emit('library_updated');
              console.log(`[Storage] 🎉 Canción guardada sin cortes: "${track.title}"`);
            } catch (e) {
              console.error('[Storage] Error al mover el archivo final:', e);
            }
          }, 150);

        }
      }
    } catch (err: any) {
      this.currentTask = null;
      console.error(`[Storage] Error descargando "${track.title}":`, err);
      const existingTrack = libraryStorage.getTrack(track.id);
      if (existingTrack) {
        libraryStorage.saveTrack({ ...existingTrack, downloadState: 'error' });
        DeviceEventEmitter.emit('library_updated');
      }
    } finally {
      this.activeTrackId = null;
      this.isProcessing = false;
      this.processNext();
    }
  }
}

const queueManager = new DownloadQueueManager();

export const saveTrackToLibrary = async (track: TrackItem): Promise<void> => {
  try {
    const downloaded = await isTrackDownloaded(track.id);
    const finalPath = getLocalFilePath(track.id);
    const existingTrack = libraryStorage.getTrack(track.id);

    if (downloaded) {
      const trackToSave: Track = {
        id: track.id,
        title: track.title,
        artist: track.artist || (track as any).channelTitle || 'Artista Desconocido',
        coverUrl: track.artwork || (track as any).coverUrl || (track as any).thumbnail || '',
        duration: track.duration || 0,
        localPath: finalPath,
        isFavorite: existingTrack ? existingTrack.isFavorite : false,
        downloadState: 'completed',
        addedAt: existingTrack ? existingTrack.addedAt : Date.now(),
      };
      libraryStorage.saveTrack(trackToSave);
      DeviceEventEmitter.emit('library_updated');
    } else {
      const streamUrl = await youtubeService.getAudioStreamUrl(track.id);
      if (streamUrl) {
        queueManager.enqueue(track, streamUrl);
      }
    }
  } catch (error) {
    console.error(`[Storage] Error al guardar "${track.title}":`, error);
  }
};

export const triggerBackgroundDownload = (track: TrackItem, streamUrl: string): void => {
  queueManager.enqueue(track, streamUrl);
};

export const cancelActiveDownload = (): void => {};

export const getAudioUrlForPlayback = async (
  track: TrackItem
): Promise<{ url: string; isLocal: boolean }> => {
  const localPath = getLocalFilePath(track.id);
  const downloaded = await isTrackDownloaded(track.id);

  if (downloaded) {
    return { url: `file://${localPath}`, isLocal: true };
  }

  const remoteUrl = await youtubeService.getAudioStreamUrl(track.id);
  return { url: remoteUrl, isLocal: false };
};