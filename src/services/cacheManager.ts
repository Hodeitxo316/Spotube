// src/services/cacheManager.ts
import ReactNativeBlobUtil from 'react-native-blob-util';

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

  // Descarga progresiva al directorio de caché
  ReactNativeBlobUtil.config({
    path: cachePath,
    fileCache: true,
  })
    .fetch('GET', streamUrl)
    .then((res) => {
      console.log(`Pista ${trackId} guardada exitosamente en la caché temporal.`);
    })
    .catch((err) => {
      console.error(`Error escribiendo caché para ${trackId}:`, err);
    });

  return cachePath;
};

/**
 * Promueve un archivo de la caché temporal a almacenamiento permanente (Cero uso de red)
 */
export const promoteToPermanent = async (trackId: string): Promise<boolean> => {
  try {
    await ensureDirectoriesExist();
    const cachePath = `${CACHE_DIR}/${trackId}.m4a`;
    const permanentPath = `${PERMANENT_DIR}/${trackId}.m4a`;

    if (await ReactNativeBlobUtil.fs.exists(cachePath)) {
      await ReactNativeBlobUtil.fs.mv(cachePath, permanentPath);
      console.log(`Pista ${trackId} promovida a almacenamiento permanente.`);
      return true;
    } else if (await ReactNativeBlobUtil.fs.exists(permanentPath)) {
      return true; // Ya estaba guardada permanentemente
    }
  } catch (error) {
    console.error(`Error promoviendo pista ${trackId}:`, error);
  }
  return false;
};