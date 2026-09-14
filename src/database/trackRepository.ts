// src/database/trackRepository.ts
import { storage, STORAGE_KEYS } from './storage';
import { TrackItem } from '../types/track';

/**
 * Obtiene todas las canciones guardadas localmente en el teléfono
 */
export const getSavedTracks = (): TrackItem[] => {
  const json = storage.getString(STORAGE_KEYS.SAVED_TRACKS);
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
};

/**
 * Guarda o actualiza los metadatos de una canción en el almacenamiento interno
 */
export const saveTrackToLocalDb = (track: TrackItem): void => {
  const current = getSavedTracks();
  const exists = current.some((t) => t.id === track.id);

  if (!exists) {
    const updated = [track, ...current];
    storage.set(STORAGE_KEYS.SAVED_TRACKS, JSON.stringify(updated));
  }
};

/**
 * Elimina la canción de la base de datos del móvil
 */
export const removeTrackFromLocalDb = (trackId: string): void => {
  const current = getSavedTracks();
  const updated = current.filter((t) => t.id !== trackId);
  storage.set(STORAGE_KEYS.SAVED_TRACKS, JSON.stringify(updated));
};

/**
 * Verifica si una pista está persistida localmente
 */
export const isTrackSaved = (trackId: string): boolean => {
  const current = getSavedTracks();
  return current.some((t) => t.id === trackId);
};