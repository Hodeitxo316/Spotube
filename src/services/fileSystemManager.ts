import RNFS from 'react-native-fs';

// Directorio dedicado para almacenamiento offline atómico
const DOWNLOAD_DIRECTORY = `${RNFS.DocumentDirectoryPath}/offline_tracks`;

class FileSystemManager {
  constructor() {
    this.initDirectory();
  }

  /**
   * Garantiza la existencia de la carpeta de descargas.
   */
  private async initDirectory(): Promise<void> {
    try {
      const exists = await RNFS.exists(DOWNLOAD_DIRECTORY);
      if (!exists) {
        await RNFS.mkdir(DOWNLOAD_DIRECTORY);
      }
    } catch (error) {
      console.error('[FileSystemManager] Error al inicializar directorio:', error);
    }
  }

  /**
   * Genera la ruta absoluta única donde debe guardarse el audio .m4a.
   */
  public getAudioPath(trackId: string): string {
    return `${DOWNLOAD_DIRECTORY}/${trackId}.m4a`;
  }

  /**
   * Verifica si el archivo existe físicamente en el almacenamiento interno.
   */
  public async fileExists(path: string): Promise<boolean> {
    try {
      return await RNFS.exists(path);
    } catch {
      return false;
    }
  }

  /**
   * Borra de forma atómica el archivo físico .m4a para liberar espacio en disco.
   */
  public async deleteAudioFile(path: string): Promise<boolean> {
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[FileSystemManager] Error al borrar el archivo físico:', error);
      return false;
    }
  }

  /**
   * Obtiene el tamaño en bytes de un archivo local.
   */
  public async getFileSize(path: string): Promise<number> {
    try {
      const fileStat = await RNFS.stat(path);
      return Number(fileStat.size);
    } catch {
      return 0;
    }
  }

  /**
   * Utilidad para formatear bytes en MB/KB legibles para la interfaz.
   */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB';
    const megabytes = bytes / (1024 * 1024);
    if (megabytes < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${megabytes.toFixed(1)} MB`;
  }
}

export const fileSystemManager = new FileSystemManager();