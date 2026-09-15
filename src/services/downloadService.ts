// src/services/downloadService.ts
import RNBlobUtil from 'react-native-blob-util';
import { TrackItem } from '../types/track';
import { youtubeService } from './youtubeService';

const { dirs } = RNBlobUtil.fs;
const MUSIC_DIR = `${dirs.DocumentDir}/music`;

export const getLocalFilePath = (trackId: string): string => {
  return `${MUSIC_DIR}/${trackId}.mp3`;
};

export const isTrackDownloaded = async (trackId: string): Promise<boolean> => {
  try {
    const path = getLocalFilePath(trackId);
    const exists = await RNBlobUtil.fs.exists(path);
    if (!exists) return false;
    const stat = await RNBlobUtil.fs.stat(path);
    return stat.size > 1000000; // Archivos completos (> 1 MB)
  } catch {
    return false;
  }
};

/**
 * Descarga silenciosa en segundo plano sin bloquear la UI ni pausar el reproductor
 */
const downloadInBackground = async (track: TrackItem): Promise<void> => {
  const localPath = getLocalFilePath(track.id);

  try {
    const dirExists = await RNBlobUtil.fs.isDir(MUSIC_DIR);
    if (!dirExists) {
      await RNBlobUtil.fs.mkdir(MUSIC_DIR);
    }

    // Petición externa para obtener el enlace directo de archivo completo
    const videoUrl = `https://www.youtube.com/watch?v=${track.id}`;
    const res = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3',
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    if (!data.url) return;

    // Descarga en disco
    await RNBlobUtil.config({
      path: localPath,
      fileCache: true,
    }).fetch('GET', data.url);

    const stat = await RNBlobUtil.fs.stat(localPath);
    if (stat.size > 1000000) {
      console.log(`[Storage] Canción guardada para escuchar offline: ${track.title}`);
    } else {
      await RNBlobUtil.fs.unlink(localPath);
    }
  } catch (err) {
    console.warn('[Storage] Descarga de fondo cancelada o fallida:', err);
    try {
      if (await RNBlobUtil.fs.exists(localPath)) {
        await RNBlobUtil.fs.unlink(localPath);
      }
    } catch {}
  }
};

/**
 * Devuelve la URL de reproducción instantánea e inicia el guardado local
 */
export const getAudioUrlForPlayback = async (track: TrackItem): Promise<string> => {
  const localPath = getLocalFilePath(track.id);

  // 1. Si ya está descargada, suena desde el almacenamiento interno en <50ms
  const isDownloaded = await isTrackDownloaded(track.id);
  if (isDownloaded) {
    console.log(`[Storage] Reproducción desde disco local: ${track.title}`);
    return `file://${localPath}`;
  }

  // 2. Si no está guardada, obtiene la URL de streaming en ~200ms
  console.log(`[Storage] Streaming directo instantáneo para: ${track.title}`);
  const streamData = await youtubeService.getAudioStream(track.id);

  // 3. Dispara la descarga en segundo plano sin usar await (evita congelar la app)
  setTimeout(() => {
    downloadInBackground(track);
  }, 1000);

  return streamData.url;
};