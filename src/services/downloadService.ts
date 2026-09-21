// src/services/downloadService.ts
import RNBlobUtil, { StatefulPromise, FetchBlobResponse } from 'react-native-blob-util';
import { DeviceEventEmitter } from 'react-native';
import { TrackItem } from '../types/track';
import { youtubeService } from './youtubeService';
import { libraryStorage } from '../storage/libraryStorage';
import { Track } from '../types/library';

const { dirs } = RNBlobUtil.fs;
const MUSIC_DIR = `${dirs.DocumentDir}/music`;
const TEMP_MUSIC_DIR = `${dirs.CacheDir}/music`;

export const getLocalFilePath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MUSIC_DIR}/${cleanId}.m4a`;
};

export const getTempFilePath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${MUSIC_DIR}/${cleanId}.m4a.tmp`;
};

export const getTemporaryFilePath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${TEMP_MUSIC_DIR}/${cleanId}.m4a`;
};

export const getTemporaryFileTempPath = (trackId: string): string => {
  const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${TEMP_MUSIC_DIR}/${cleanId}.m4a.tmp`;
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

export const isTrackTemporarilyCached = async (
  trackId: string
): Promise<boolean> => {
  try {
    const temporaryPath = getTemporaryFilePath(trackId);
    const exists = await RNBlobUtil.fs.exists(temporaryPath);

    if (!exists) return false;

    const stat = await RNBlobUtil.fs.stat(temporaryPath);

    return Number(stat.size) > 300000;
  } catch {
    return false;
  }
};

interface QueueTask {
  track: TrackItem;
  streamUrl: string;
  permanent: boolean;
}

class DownloadQueueManager {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private currentTask: StatefulPromise<FetchBlobResponse> | null = null;
  private activeTrackId: string | null = null;

  public enqueue(
    track: TrackItem,
    streamUrl: string,
    permanent: boolean = true
  ) {
      const alreadyAvailablePromise = permanent
    ? isTrackDownloaded(track.id)
    : isTrackTemporarilyCached(track.id);

  alreadyAvailablePromise.then((alreadyAvailable) => {
    const existingTrack = libraryStorage.getTrack(track.id);
    const finalPath = getLocalFilePath(track.id);

    if (alreadyAvailable) {
      if (!permanent) {
        return;
      }

      libraryStorage.saveTrack({
        id: track.id,
        title: track.title,
        artist:
          track.artist ||
          (track as any).channelTitle ||
          'Artista Desconocido',
        coverUrl:
          track.artwork ||
          (track as any).coverUrl ||
          (track as any).thumbnail ||
          '',
        duration: track.duration || 0,
        localPath: finalPath,
        isFavorite: existingTrack
          ? existingTrack.isFavorite
          : false,
        downloadState: 'completed',
        addedAt: existingTrack
          ? existingTrack.addedAt
          : Date.now(),
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

        this.queue.push({
          track,
          streamUrl,
          permanent,
        });
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

  const { track, streamUrl, permanent } = task;

  const finalPath = getLocalFilePath(track.id);
  const tempPath = getTempFilePath(track.id);

  const downloadDir = permanent
    ? MUSIC_DIR
    : TEMP_MUSIC_DIR;

  const downloadFinalPath = permanent
    ? finalPath
    : getTemporaryFilePath(track.id);

  const downloadTempPath = permanent
    ? tempPath
    : getTemporaryFileTempPath(track.id);

  const alreadyAvailable = permanent
    ? await isTrackDownloaded(track.id)
    : await isTrackTemporarilyCached(track.id);

  if (alreadyAvailable) {
    this.isProcessing = false;
    this.processNext();
    return;
  }

  this.activeTrackId = track.id;

  try {
    const dirExists = await RNBlobUtil.fs.isDir(downloadDir);

    if (!dirExists) {
      await RNBlobUtil.fs.mkdir(downloadDir);
    }

    this.currentTask = RNBlobUtil.config({
      path: downloadTempPath,
      fileCache: true,
    }).fetch('GET', streamUrl, {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const res = await this.currentTask;
    this.currentTask = null;

    const status = res.info().status;

    if (status >= 200 && status < 300) {
      const stat = await RNBlobUtil.fs.stat(downloadTempPath);

      if (Number(stat.size) > 300000) {
        setTimeout(async () => {
          try {
            if (await RNBlobUtil.fs.exists(downloadFinalPath)) {
              await RNBlobUtil.fs.unlink(downloadFinalPath);
            }

            await RNBlobUtil.fs.mv(
              downloadTempPath,
              downloadFinalPath
            );

            if (!permanent) {
              console.log(
                `[Temp Cache] 🟠 Canción guardada temporalmente: "${track.title}"`
              );
              return;
            }

            const existingTrack = libraryStorage.getTrack(track.id);

            const trackToSave: Track = {
              id: track.id,
              title: track.title,
              artist:
                track.artist ||
                (track as any).channelTitle ||
                'Artista Desconocido',
              coverUrl:
                track.artwork ||
                (track as any).coverUrl ||
                (track as any).thumbnail ||
                '',
              duration: track.duration || 0,
              localPath: downloadFinalPath,
              isFavorite: existingTrack
                ? existingTrack.isFavorite
                : false,
              downloadState: 'completed',
              fileSizeBytes: Number(stat.size),
              addedAt: existingTrack
                ? existingTrack.addedAt
                : Date.now(),
            };

            libraryStorage.saveTrack(trackToSave);
            DeviceEventEmitter.emit('library_updated');

            console.log(
              `[Storage] 🎉 Canción guardada sin cortes: "${track.title}"`
            );
          } catch (e) {
            console.error(
              '[Storage] Error al mover el archivo final:',
              e
            );
          }
        }, 150);
      }
    }
  } catch (err: any) {
    this.currentTask = null;

    console.error(
      `[Storage] Error descargando "${track.title}":`,
      err
    );

    const existingTrack = libraryStorage.getTrack(track.id);

    if (existingTrack) {
      libraryStorage.saveTrack({
        ...existingTrack,
        downloadState: 'error',
      });

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

export const saveTrackToTemporaryCache = async (
  track: TrackItem,
  streamUrl: string
): Promise<void> => {
  try {
    const temporaryDir = TEMP_MUSIC_DIR;
    const finalPath = getTemporaryFilePath(track.id);
    const tempPath = getTemporaryFileTempPath(track.id);

    const dirExists = await RNBlobUtil.fs.isDir(temporaryDir);

    if (!dirExists) {
      await RNBlobUtil.fs.mkdir(temporaryDir);
    }

    if (await isTrackTemporarilyCached(track.id)) {
      return;
    }

    const response = await RNBlobUtil.config({
      path: tempPath,
      fileCache: true,
    }).fetch('GET', streamUrl, {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const status = response.info().status;

    if (status < 200 || status >= 300) {
      return;
    }

    const stat = await RNBlobUtil.fs.stat(tempPath);

    if (Number(stat.size) <= 300000) {
      return;
    }

    if (await RNBlobUtil.fs.exists(finalPath)) {
      await RNBlobUtil.fs.unlink(finalPath);
    }

    await RNBlobUtil.fs.mv(tempPath, finalPath);

    console.log(
      `[Temp Cache] 🟠 Canción guardada temporalmente: "${track.title}"`
    );
  } catch (error) {
    console.warn(
      `[Temp Cache] ⚠️ No se pudo guardar "${track.title}" temporalmente:`,
      error
    );
  }
};

export const promoteTemporaryCacheToLibrary = async (
  track: TrackItem
): Promise<boolean> => {
  try {
    const temporaryPath = getTemporaryFilePath(track.id);
    const finalPath = getLocalFilePath(track.id);

    if (!(await isTrackTemporarilyCached(track.id))) {
      return false;
    }

    const permanentDirExists = await RNBlobUtil.fs.isDir(MUSIC_DIR);

    if (!permanentDirExists) {
      await RNBlobUtil.fs.mkdir(MUSIC_DIR);
    }

    if (await RNBlobUtil.fs.exists(finalPath)) {
      await RNBlobUtil.fs.unlink(finalPath);
    }

    await RNBlobUtil.fs.mv(temporaryPath, finalPath);

    const existingTrack = libraryStorage.getTrack(track.id);

    const trackToSave: Track = {
      id: track.id,
      title: track.title,
      artist:
        track.artist ||
        (track as any).channelTitle ||
        'Artista Desconocido',
      coverUrl:
        track.artwork ||
        (track as any).coverUrl ||
        (track as any).thumbnail ||
        '',
      duration: track.duration || 0,
      localPath: finalPath,
      isFavorite: existingTrack ? existingTrack.isFavorite : false,
      downloadState: 'completed',
      addedAt: existingTrack ? existingTrack.addedAt : Date.now(),
    };

    libraryStorage.saveTrack(trackToSave);
    DeviceEventEmitter.emit('library_updated');

    console.log(
      `[Temp Cache] 🔒 Caché temporal convertida en descarga permanente: "${track.title}"`
    );

    return true;
  } catch (error) {
    console.warn(
      `[Temp Cache] ⚠️ No se pudo convertir "${track.title}" en descarga permanente:`,
      error
    );

    return false;
  }
};

export const saveTrackToLibrary = async (
  track: TrackItem
): Promise<void> => {
  console.log(`[DOWNLOAD TEST] Pulsado guardar: "${track.title}"`);
  try {
    const downloaded = await isTrackDownloaded(track.id);

    if (downloaded) {
      const finalPath = getLocalFilePath(track.id);
      const existingTrack = libraryStorage.getTrack(track.id);

      const trackToSave: Track = {
        id: track.id,
        title: track.title,
        artist:
          track.artist ||
          (track as any).channelTitle ||
          'Artista Desconocido',
        coverUrl:
          track.artwork ||
          (track as any).coverUrl ||
          (track as any).thumbnail ||
          '',
        duration: track.duration || 0,
        localPath: finalPath,
        isFavorite: existingTrack
          ? existingTrack.isFavorite
          : false,
        downloadState: 'completed',
        addedAt: existingTrack
          ? existingTrack.addedAt
          : Date.now(),
      };

      libraryStorage.saveTrack(trackToSave);
      DeviceEventEmitter.emit('library_updated');

      return;
    }

    const promoted = await promoteTemporaryCacheToLibrary(track);

    if (promoted) {
      return;
    }

    const streamUrl = await youtubeService.getAudioStreamUrl(track.id);

    if (streamUrl) {
      queueManager.enqueue(track, streamUrl);
    }
  } catch (error) {
    console.error(
      `[Storage] Error al guardar "${track.title}":`,
      error
    );
  }
};

export const triggerBackgroundDownload = (
  track: TrackItem,
  streamUrl: string
): void => {
  queueManager.enqueue(track, streamUrl, false);
};

export const cancelActiveDownload = (): void => { };

export const getAudioUrlForPlayback = async (
  track: TrackItem
): Promise<{ url: string; isLocal: boolean }> => {

const localPath = getLocalFilePath(track.id);
const downloaded = await isTrackDownloaded(track.id);


if (downloaded) {
  return { url: `file://${localPath}`, isLocal: true };
}

const temporaryPath = getTemporaryFilePath(track.id);
const temporarilyCached = await isTrackTemporarilyCached(track.id);

if (temporarilyCached) {
  return {
    url: `file://${temporaryPath}`,
    isLocal: true,
  };
}

  const startTime = Date.now();

  const remoteUrl = await youtubeService.getAudioStreamUrl(track.id);

  console.log(
    `[Playback] ⏱️ URL de audio obtenida en ${Date.now() - startTime} ms`
  );

  return { url: remoteUrl, isLocal: false };
};