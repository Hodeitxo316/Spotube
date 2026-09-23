// src/services/cacheManager.ts
import ReactNativeBlobUtil from 'react-native-blob-util';
import { TrackItem } from '../types/track';
import { libraryStorage } from '../storage/libraryStorage';
import { Track } from '../types/library';
import { DeviceEventEmitter } from 'react-native';

const { dirs } = ReactNativeBlobUtil.fs;
const CACHE_DIR = `${dirs.CacheDir}/audio_cache`;
const PERMANENT_DIR = `${dirs.DocumentDir}/music`;
const MIN_FILE_SIZE_BYTES = 500 * 1024; // 500 KB mínimos

const ensureDirectoriesExist = async () => {
  if (!(await ReactNativeBlobUtil.fs.isDir(CACHE_DIR))) {
    await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);
  }
  if (!(await ReactNativeBlobUtil.fs.isDir(PERMANENT_DIR))) {
    await ReactNativeBlobUtil.fs.mkdir(PERMANENT_DIR);
  }
};

/**
 * Retorna la ruta nativa local del archivo solo si existe y no está corrupto (> 500 KB)
 */
export const getLocalAudioPath = async (trackId: string): Promise<string | null> => {
  await ensureDirectoriesExist();

  const verifyAndGetPath = async (path: string): Promise<string | null> => {
    if (await ReactNativeBlobUtil.fs.exists(path)) {
      const stat = await ReactNativeBlobUtil.fs.stat(path);
      if (stat.size >= MIN_FILE_SIZE_BYTES) {
        return `file://${path}`;
      }
      console.warn(`Archivo corrupto hallado en ${path} (${stat.size} bytes). Eliminando...`);
      await ReactNativeBlobUtil.fs.unlink(path);
    }
    return null;
  };

  const permanentPath = await verifyAndGetPath(`${PERMANENT_DIR}/${trackId}.m4a`);

  console.log('[Cache DEBUG] permanentPath:', `${PERMANENT_DIR}/${trackId}.m4a`);
  console.log('[Cache DEBUG] existe permanente:', await ReactNativeBlobUtil.fs.exists(`${PERMANENT_DIR}/${trackId}.m4a`));

  if (permanentPath) return permanentPath;

  const cachePath = await verifyAndGetPath(`${CACHE_DIR}/${trackId}.m4a`);
  if (cachePath) return cachePath;

  return null;
};

/**
 * Descarga y guarda en caché temporal en segundo plano
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
 * Promueve la pista de la caché a permanente y persiste los metadatos en la base de datos local
 */
export const promoteToPermanentAndSave = async (track: TrackItem): Promise<boolean> => {
  try {
    await ensureDirectoriesExist();
    const cachePath = `${CACHE_DIR}/${track.id}.m4a`;
    const permanentPath = `${PERMANENT_DIR}/${track.id}.m4a`;

    if (await ReactNativeBlobUtil.fs.exists(cachePath)) {
      await ReactNativeBlobUtil.fs.mv(cachePath, permanentPath);

      console.log(`Pista ${track.id} promovida a almacenamiento permanente.`);

      console.log(
        '[PROMOTE DEBUG] existe permanente después de mv:',
        await ReactNativeBlobUtil.fs.exists(permanentPath)
      );
    }

    const libraryTrack: Track = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.artwork,
      duration: track.duration,
      isFavorite: false,
      downloadState: 'completed',
      addedAt: Date.now(),
      isLocalFile: false,
    };

    libraryStorage.saveTrack(libraryTrack);
    DeviceEventEmitter.emit('library_updated');

    return true;
  } catch (error) {
    console.error(`Error al promocionar y guardar ${track.id} localmente:`, error);
    return false;
  }
};