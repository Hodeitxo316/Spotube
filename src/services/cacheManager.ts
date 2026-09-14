// src/services/cacheManager.ts
import ReactNativeBlobUtil from 'react-native-blob-util';
import { saveTrackToLocalDb } from '../database/trackRepository';
import { TrackItem } from '../types/track';

const { dirs } = ReactNativeBlobUtil.fs;
const CACHE_DIR = `${dirs.CacheDir}/audio_cache`;
const PERMANENT_DIR = `${dirs.DocumentDir}/saved_tracks`;

// Estructura del directorio de la aplicación
const ensureDirectoriesExist = async () => {
  if (!(await ReactNativeBlobUtil.fs.isDir(CACHE_DIR))) {
    await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);
  }
  if (!(await ReactNativeBlobUtil.fs.isDir(PERMANENT_DIR))) {
    await ReactNativeBlobUtil.fs.mkdir(PERMANENT_DIR);
  }
};

/**
 * Retorna la ruta nativa local del archivo si existe (Permanente o Caché temporal)
 */
export const getLocalAudioPath = async (trackId: string): Promise<string | null> => {
  await ensureDirectoriesExist();

  const permanentPath = `${PERMANENT_DIR}/${trackId}.m4a`;
  if (await ReactNativeBlobUtil.fs.exists(permanentPath)) {
    return `file://${permanentPath}`;
  }

  const cachePath = `${CACHE_DIR}/${trackId}.m4a`;
  if (await ReactNativeBlobUtil.fs.exists(cachePath)) {
    return `file://${cachePath}`;
  }

  return null;
};

/**
 * Descarga y guarda en caché temporal en segundo plano mientras se transmite el audio
 */
export const cacheAudioStream = async (trackId: string, streamUrl: string): Promise<string> => {
  await ensureDirectoriesExist();
  const cachePath = `${CACHE_DIR}/${trackId}.m4a`;

  ReactNativeBlobUtil.config({
    path: cachePath,
    fileCache: true,
  })
    .fetch('GET', streamUrl)
    .then(() => {
      console.log(`Pista ${trackId} guardada exitosamente en la caché temporal.`);
    })
    .catch((err) => {
      console.error(`Error escribiendo caché para ${trackId}:`, err);
    });

  return cachePath;
};

/**
 * Promueve la pista de la caché a permanente y persiste los metadatos en MMKV (Cero red)
 */
export const promoteToPermanentAndSave = async (track: TrackItem): Promise<boolean> => {
  try {
    await ensureDirectoriesExist();
    const cachePath = `${CACHE_DIR}/${track.id}.m4a`;
    const permanentPath = `${PERMANENT_DIR}/${track.id}.m4a`;

    if (await ReactNativeBlobUtil.fs.exists(cachePath)) {
      await ReactNativeBlobUtil.fs.mv(cachePath, permanentPath);
      console.log(`Pista ${track.id} promovida a almacenamiento permanente.`);
    }

    saveTrackToLocalDb(track);
    return true;
  } catch (error) {
    console.error(`Error al promocionar y guardar ${track.id} localmente:`, error);
    return false;
  }
};