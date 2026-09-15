// src/services/downloadService.ts
import RNBlobUtil, { StatefulPromise, FetchBlobResponse } from 'react-native-blob-util';
import { TrackItem } from '../types/track';
import { youtubeService } from './youtubeService';

const { dirs } = RNBlobUtil.fs;
const MUSIC_DIR = `${dirs.DocumentDir}/music`;

export const getLocalFilePath = (trackId: string): string => {
  return `${MUSIC_DIR}/${trackId}.m4a`;
};

export const getTempFilePath = (trackId: string): string => {
  return `${MUSIC_DIR}/${trackId}.m4a.tmp`;
};

// Verifica únicamente si el archivo final COMPLETO existe y es válido (>300 KB)
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
      if (downloaded) return;

      // Si la canción ya está siendo descargada o ya está en la cola, no duplicar
      const isAlreadyInQueue = this.queue.some((item) => item.track.id === track.id);
      const isCurrentlyDownloading = this.activeTrackId === track.id;

      if (!isAlreadyInQueue && !isCurrentlyDownloading) {
        // Se añade al final de la cola para procesarse de forma secuencial
        this.queue.push({ track, streamUrl });
        console.log(`[Storage] 📥 Canción encolada para descarga posterior: "${track.title}" (En cola: ${this.queue.length})`);
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
      console.log(`[Storage] ℹ️ "${track.title}" ya está 100% descargada.`);
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

      console.log(`[Storage] 🚀 Guardando en segundo plano: "${track.title}"`);
      const startTime = Date.now();
      let lastLoggedStep = -1;

      // Descargar en archivo temporal sin interrumpir reproducciones activas
      this.currentTask = RNBlobUtil.config({
        path: tempPath,
        fileCache: true,
      }).fetch('GET', streamUrl, {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      this.currentTask.progress((received, total) => {
        if (total > 0) {
          const percent = Math.floor((received / total) * 100);
          const step = Math.floor(percent / 50) * 50;
          if (step > lastLoggedStep && step < 100) {
            lastLoggedStep = step;
            console.log(
              `[Storage] 📥 Progreso de "${track.title}": ${step}% (${(
                received /
                1024 /
                1024
              ).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`
            );
          }
        }
      });

      const res = await this.currentTask;
      this.currentTask = null;

      const status = res.info().status;
      if (status >= 200 && status < 300) {
        const stat = await RNBlobUtil.fs.stat(tempPath);
        if (Number(stat.size) > 300000) {
          if (await RNBlobUtil.fs.exists(finalPath)) {
            await RNBlobUtil.fs.unlink(finalPath);
          }

          // Renombrado atómico: de .tmp a .m4a al completar el 100%
          await RNBlobUtil.fs.mv(tempPath, finalPath);

          const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
          const sizeMB = (Number(stat.size) / 1024 / 1024).toFixed(2);
          console.log(
            `[Storage] 🎉 ¡GUARDADA 100% EN DISCO!: "${track.title}" (${sizeMB} MB en ${seconds}s)`
          );
        }
      }
    } catch (err: any) {
      this.currentTask = null;
      // Si ocurre un error fatal de red, limpiar el archivo temporal parcial
      try {
        if (await RNBlobUtil.fs.exists(tempPath)) {
          await RNBlobUtil.fs.unlink(tempPath);
        }
      } catch {}
    } finally {
      this.activeTrackId = null;
      this.isProcessing = false;
      // Procesar la siguiente canción en la cola
      this.processNext();
    }
  }
}

const queueManager = new DownloadQueueManager();

export const triggerBackgroundDownload = (track: TrackItem, streamUrl: string): void => {
  queueManager.enqueue(track, streamUrl);
};

// Mantenemos la función por compatibilidad, pero ya no destruye las descargas activas al cambiar de tema
export const cancelActiveDownload = (): void => {};

export const getAudioUrlForPlayback = async (
  track: TrackItem
): Promise<{ url: string; isLocal: boolean }> => {
  const localPath = getLocalFilePath(track.id);

  const downloaded = await isTrackDownloaded(track.id);
  if (downloaded) {
    console.log(`[Storage] ⚡ Reproduciendo desde disco LOCAL (100% completa): "${track.title}"`);
    return { url: `file://${localPath}`, isLocal: true };
  }

  console.log(`[Storage] 🌐 Obteniendo enlace para streaming: "${track.title}"`);
  const remoteUrl = await youtubeService.getAudioStreamUrl(track.id);
  return { url: remoteUrl, isLocal: false };
};