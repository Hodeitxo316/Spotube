import { useState, useCallback, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Track, LibraryFilter } from '../types/library';
import { libraryStorage } from '../storage/libraryStorage';
import RNBlobUtil from 'react-native-blob-util';
import { getLocalFilePath, getTempFilePath } from '../services/downloadService';

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshLibrary = useCallback(() => {
    try {
      const allTracks = libraryStorage.getAllTracks();

      let filtered = allTracks;
      if (filter === 'favorites') {
        filtered = allTracks.filter((t) => t.isFavorite);
      } else if (filter === 'downloaded') {
        filtered = allTracks.filter((t) => t.downloadState === 'completed');
      }

      filtered.sort((a, b) => b.addedAt - a.addedAt);

      setTracks(filtered);
    } catch (error) {
      console.error('[useLibrary] Error al cargar biblioteca:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // Escuchar eventos de actualización en tiempo real desde downloadService
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('library_updated', () => {
      refreshLibrary();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshLibrary]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const toggleFavorite = (track: Track) => {
    const updatedTrack: Track = {
      ...track,
      isFavorite: !track.isFavorite,
    };
    libraryStorage.saveTrack(updatedTrack);
    refreshLibrary();
  };

  const deleteTrackCompletely = async (trackId: string) => {
    try {
      const finalPath = getLocalFilePath(trackId);
      const tempPath = getTempFilePath(trackId);

      if (await RNBlobUtil.fs.exists(finalPath)) {
        await RNBlobUtil.fs.unlink(finalPath);
      }
      if (await RNBlobUtil.fs.exists(tempPath)) {
        await RNBlobUtil.fs.unlink(tempPath);
      }

      libraryStorage.deleteTrack(trackId);
      refreshLibrary();
    } catch (error) {
      console.error(`[useLibrary] Error al eliminar la pista ${trackId}:`, error);
    }
  };

  return {
    tracks,
    filter,
    setFilter,
    isLoading,
    refreshLibrary,
    toggleFavorite,
    deleteTrackCompletely,
  };
};