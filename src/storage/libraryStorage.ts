// src/storage/libraryStorage.ts
import { createMMKV, MMKV } from 'react-native-mmkv';
import { Track } from '../types/library';

const storage: MMKV = createMMKV();
const TRACKS_KEY = 'library_tracks';

class LibraryStorageService {
  /**
   * Obtiene todas las canciones almacenadas en MMKV.
   */
  public getAllTracks(): Track[] {
    try {
      const json = storage.getString(TRACKS_KEY);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('[libraryStorage] Error al obtener canciones:', error);
      return [];
    }
  }

  /**
   * Obtiene una canción específica por su ID.
   */
  public getTrack(id: string): Track | undefined {
    const tracks = this.getAllTracks();
    return tracks.find((t) => t.id === id);
  }

  /**
   * Guarda o reemplaza una canción completa en el almacenamiento.
   */
  public saveTrack(track: Track): void {
    try {
      const tracks = this.getAllTracks();
      const index = tracks.findIndex((t) => t.id === track.id);

      if (index !== -1) {
        tracks[index] = track;
      } else {
        tracks.push(track);
      }

      storage.set(TRACKS_KEY, JSON.stringify(tracks));
    } catch (error) {
      console.error('[libraryStorage] Error al guardar canción:', error);
    }
  }

  /**
   * Actualiza propiedades parciales de una canción existente.
   */
  public updateTrack(id: string, partialTrack: Partial<Track>): void {
    try {
      const tracks = this.getAllTracks();
      const index = tracks.findIndex((t) => t.id === id);

      if (index !== -1) {
        tracks[index] = { ...tracks[index], ...partialTrack };
        storage.set(TRACKS_KEY, JSON.stringify(tracks));
      }
    } catch (error) {
      console.error('[libraryStorage] Error al actualizar canción:', error);
    }
  }

  /**
   * Elimina completamente una canción del almacenamiento MMKV por su ID.
   */
  public deleteTrack(id: string): void {
    try {
      const tracks = this.getAllTracks();
      const filtered = tracks.filter((t) => t.id !== id);
      storage.set(TRACKS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[libraryStorage] Error al eliminar canción:', error);
    }
  }

  /**
   * Limpia toda la biblioteca almacenada.
   */
  public clearAll(): void {
    try {
      if (typeof (storage as any).delete === 'function') {
        (storage as any).delete(TRACKS_KEY);
      } else {
        storage.clearAll();
      }
    } catch (error) {
      console.error('[libraryStorage] Error al limpiar la biblioteca:', error);
    }
  }
}

export const libraryStorage = new LibraryStorageService();