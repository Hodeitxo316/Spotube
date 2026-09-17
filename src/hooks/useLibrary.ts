import { useState, useCallback, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Track, Playlist, LibraryFilter } from '../types/library';
import { libraryStorage } from '../storage/libraryStorage';
import RNBlobUtil from 'react-native-blob-util';
import { getLocalFilePath, getTempFilePath } from '../services/downloadService';

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshLibrary = useCallback(() => {
    try {
      const allTracks = libraryStorage.getAllTracks();
      const allPlaylists = libraryStorage.getAllPlaylists();

      setPlaylists(allPlaylists);

      let filtered = allTracks;

      if (filter === 'favorites') {
        filtered = allTracks.filter(
          (t) => t.isFavorite && !t.isLocalFile
        );
      } else if (filter === 'downloaded') {
        filtered = allTracks.filter(
          (t) => t.downloadState === 'completed' && !t.isLocalFile
        );
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

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name: name.trim(),
      trackIds: [],
      createdAt: Date.now(),
    };

    libraryStorage.savePlaylist(newPlaylist);
    refreshLibrary();
  };

  const renamePlaylist = (playlistId: string, newName: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);

    if (!playlist) return;

    const updatedPlaylist: Playlist = {
      ...playlist,
      name: newName.trim(),
    };

    libraryStorage.savePlaylist(updatedPlaylist);
    refreshLibrary();
  };

  const deletePlaylist = (playlistId: string) => {
    libraryStorage.deletePlaylist(playlistId);
    refreshLibrary();
  };

  return {
    tracks,
    playlists,
    filter,
    setFilter,
    isLoading,
    refreshLibrary,
    toggleFavorite,
    deleteTrackCompletely,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
  };


};