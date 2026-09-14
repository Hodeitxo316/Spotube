// src/database/storage.ts
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({
  id: 'spottube-local-db',
});

// Claves de almacenamiento local
export const STORAGE_KEYS = {
  SAVED_TRACKS: 'db_saved_tracks',
  PLAYLISTS: 'db_playlists',
  LAST_PLAYED_QUEUE: 'db_last_played_queue',
};