import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLibrary } from '../hooks/useLibrary';
import { libraryStorage } from '../storage/libraryStorage';
import { Track, Playlist } from '../types/library';
import { TrackItem } from '../types/track';
import { playTrack } from '../services/playTrack';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import {
  pick,
  keepLocalCopy,
} from '@react-native-documents/picker';



type LibrarySection =
  | 'home'
  | 'favorites'
  | 'downloaded'
  | 'local'
  | 'playlist';

export const LibraryScreen = () => {
  const {
    tracks,
    playlists,
    isLoading,
    refreshLibrary,
    toggleFavorite,
    deleteTrackCompletely,
    createPlaylist,
  } = useLibrary();

  const [menuPlaylist, setMenuPlaylist] =
    useState<Playlist | null>(null);

  const [section, setSection] =
    useState<LibrarySection>('home');

  const [showCreatePlaylist, setShowCreatePlaylist] =
    useState(false);

  const [editingPlaylist, setEditingPlaylist] =
    useState<Playlist | null>(null);

  const [playlistName, setPlaylistName] =
    useState('');

  const [showAddSongs, setShowAddSongs] =
    useState(false);

  const [selectedTrackIds, setSelectedTrackIds] =
    useState<string[]>([]);

  const [selectedPlaylist, setSelectedPlaylist] =
    useState<Playlist | null>(null);

  const [showSortMenu, setShowSortMenu] =
    useState(false);

  const [sortOrder, setSortOrder] = useState<
    'recent' | 'oldest' | 'titleAsc' | 'titleDesc' | 'artistAsc'
  >('recent');

  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, [refreshLibrary])
  );


  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, [refreshLibrary])
  );

  /**
   * Reproduce una canción.
   */
  const handlePlayTrack = async (track: Track) => {
    try {

      console.log('🎵 TRACK LOCAL:', JSON.stringify(track, null, 2));

      const trackToPlay: TrackItem = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.coverUrl || 'local',
        duration: track.duration || 0,
        streamUrl: track.localPath,
      };

      await playTrack(trackToPlay);
    } catch (error) {
      console.error(
        '[LibraryScreen] Error al reproducir la pista:',
        error
      );
    }
  };

  /**
   * Elimina una canción y sus archivos descargados.
   */
  const handleConfirmDelete = (track: Track) => {
    Alert.alert(
      'Eliminar canción',
      `¿Deseas eliminar "${track.title}" de tu biblioteca y liberar su espacio en disco?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteTrackCompletely(track.id),
        },
      ]
    );
  };

  /**
   * Crear una playlist.
   */
  const handleCreatePlaylist = () => {
    setPlaylistName('');
    setShowCreatePlaylist(true);
  };

  const handleRenamePlaylist = () => {
    if (!editingPlaylist) {
      return;
    }

    const newName = playlistName.trim();

    if (!newName) {
      return;
    }

    const updatedPlaylist: Playlist = {
      ...editingPlaylist,
      name: newName,
    };

    libraryStorage.savePlaylist(updatedPlaylist);

    setEditingPlaylist(null);
    setPlaylistName('');
    setMenuPlaylist(null);

    setShowCreatePlaylist(false);
    refreshLibrary();
  };

  const handleDeletePlaylist = () => {
    if (!menuPlaylist) {
      return;
    }

    libraryStorage.deletePlaylist(menuPlaylist.id);

    setMenuPlaylist(null);
    refreshLibrary();
  };

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId]
    );
  };

  const handleAddSongsToPlaylist = () => {
    if (!selectedPlaylist || selectedTrackIds.length === 0) {
      return;
    }

    const updatedPlaylist: Playlist = {
      ...selectedPlaylist,
      trackIds: [
        ...new Set([
          ...selectedPlaylist.trackIds,
          ...selectedTrackIds,
        ]),
      ],
    };

    libraryStorage.savePlaylist(updatedPlaylist);

    setSelectedPlaylist(updatedPlaylist);
    setSelectedTrackIds([]);
    setShowAddSongs(false);

    refreshLibrary();
  };

  const handleRemoveSongFromPlaylist = (trackId: string) => {
    if (!selectedPlaylist) {
      return;
    }

    const updatedPlaylist: Playlist = {
      ...selectedPlaylist,
      trackIds: selectedPlaylist.trackIds.filter(
        (id) => id !== trackId
      ),
    };

    libraryStorage.savePlaylist(updatedPlaylist);

    setSelectedPlaylist(updatedPlaylist);

    refreshLibrary();
  };

  const handleConfirmCreatePlaylist = () => {
    const name = playlistName.trim();

    if (!name) {
      Alert.alert(
        'Nombre necesario',
        'Escribe un nombre para la playlist.'
      );
      return;
    }

    createPlaylist(name);

    setShowCreatePlaylist(false);
    setPlaylistName('');
  };

  /**
   * Abrir archivos locales.
   * La importación real la añadiremos en el siguiente paso.
   */
  const handleLocalFiles = async () => {
    try {
      const result = await pick({
        type: ['audio/*'],
        allowMultiSelection: true,
      });

      for (const file of result) {
        const fileName = file.name ?? 'Archivo sin nombre';

        const [copyResult] = await keepLocalCopy({
          files: [
            {
              uri: file.uri,
              fileName,
            },
          ],
          destination: 'documentDirectory',
        });

        if (copyResult.status !== 'success') {
          console.error(
            '[LibraryScreen] Error copiando archivo:',
            copyResult.copyError
          );
          continue;
        }

        const newTrack: Track = {
          id: `local_${Date.now()}_${Math.random()}`,
          title: fileName.replace(/\.[^/.]+$/, ''),
          artist: 'Archivo local',
          coverUrl: '',
          localPath: copyResult.localUri,
          isFavorite: false,
          downloadState: 'completed',
          addedAt: Date.now(),
          isLocalFile: true,
        };

        libraryStorage.saveTrack(newTrack);
      }

      refreshLibrary();

      Alert.alert(
        'Archivo añadido',
        result
          .map((file) => file.name ?? 'Sin nombre')
          .join('\n')
      );
    } catch (error: any) {
      if (error?.code === 'OPERATION_CANCELED') {
        return;
      }

      console.error('ERROR AL SELECCIONAR:', error);
    }
  };

  /**
   * Canciones que pertenecen a la sección seleccionada.
   */
  const sortTracks = (trackList: Track[]): Track[] => {
    const sorted = [...trackList];

    switch (sortOrder) {
      case 'recent':
        return sorted.sort((a, b) => b.addedAt - a.addedAt);

      case 'oldest':
        return sorted.sort((a, b) => a.addedAt - b.addedAt);

      case 'titleAsc':
        return sorted.sort((a, b) =>
          a.title.localeCompare(b.title)
        );

      case 'titleDesc':
        return sorted.sort((a, b) =>
          b.title.localeCompare(a.title)
        );

      case 'artistAsc':
        return sorted.sort((a, b) =>
          a.artist.localeCompare(b.artist)
        );

      default:
        return sorted;
    }
  };


  const getSectionTracks = (): Track[] => {
    let sectionTracks: Track[] = [];

    if (section === 'favorites') {
      sectionTracks = tracks.filter(
        (track) => track.isFavorite
      );
    } else if (section === 'downloaded') {
      sectionTracks = tracks.filter(
        (track) =>
          track.downloadState === 'completed' &&
          !track.isLocalFile
      );
    } else if (section === 'local') {
      sectionTracks = tracks.filter(
        (track) => track.isLocalFile
      );
    } else if (section === 'playlist' && selectedPlaylist) {
      sectionTracks = selectedPlaylist.trackIds
        .map((trackId) =>
          tracks.find((track) => track.id === trackId)
        )
        .filter((track): track is Track => track !== undefined);
    } else {
      sectionTracks = tracks;
    }

    if (section === 'playlist') {
      return sectionTracks;
    }

    return sortTracks(sectionTracks);
  };

    /**
   * Tarjeta individual de canción.
   */
  const renderTrackItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.trackCard}
      onPress={() => handlePlayTrack(item)}
    >
      <Image
        source={{ uri: item.coverUrl }}
        style={styles.coverImage}
      />

      <View style={styles.trackInfo}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>

        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>

        {item.downloadState === 'downloading' && (
          <View
            style={[
              styles.downloadBadge,
              styles.downloadingBadge,
            ]}
          >
            <Text
              style={[
                styles.downloadBadgeText,
                styles.downloadingBadgeText,
              ]}
            >
              DESCARGANDO...
            </Text>
          </View>
        )}

        {item.downloadState === 'completed' && !item.isLocalFile && (
          <View style={styles.downloadBadge}>
            <Text style={styles.downloadBadgeText}>
              OFFLINE
            </Text>
          </View>
        )}

        {item.isLocalFile && (
          <View style={styles.localBadge}>
            <Text style={styles.localBadgeText}>
              LOCAL
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => toggleFavorite(item)}
          style={styles.actionButton}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <FontAwesome
            name={item.isFavorite ? 'heart' : 'heart-o'}
            size={20}
            color={item.isFavorite ? '#FF5500' : '#B3B3B3'}
          />
        </TouchableOpacity>

        {section === 'playlist' ? (
          <TouchableOpacity
            onPress={() => handleRemoveSongFromPlaylist(item.id)}
            style={styles.actionButton}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <FontAwesome
              name="ellipsis-h"
              size={20}
              color="#B3B3B3"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleConfirmDelete(item)}
            style={styles.actionButton}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <FontAwesome
              name="trash-o"
              size={19}
              color="#B3B3B3"
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  /**
   * Pantalla principal de Biblioteca.
   */
  const renderHome = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeContent}
    >
      <Text style={styles.headerTitle}>Tu Biblioteca</Text>

      <Text style={styles.sectionSubtitle}>
        Tu música, tus playlists y tus archivos
      </Text>

      <View style={styles.grid}>
        {/* Tus Me Gusta */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.squareCard, styles.likesCard]}
          onPress={() => setSection('favorites')}
        >
          <View style={styles.cardIconCircle}>
            <Text style={styles.cardIcon}>♥</Text>
          </View>

          <Text style={styles.squareTitle}>
            Tus Me Gusta
          </Text>

          <Text style={styles.squareSubtitle}>
            {tracks.filter((track) => track.isFavorite).length}{' '}
            canciones
          </Text>
        </TouchableOpacity>

        {/* Descargadas */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.squareCard, styles.downloadsCard]}
          onPress={() => setSection('downloaded')}
        >
          <View style={styles.cardIconCircle}>
            <Text style={styles.cardIcon}>↓</Text>
          </View>

          <Text style={styles.squareTitle}>
            Descargadas
          </Text>

          <Text style={styles.squareSubtitle}>
            {
              tracks.filter(
                (track) =>
                  track.downloadState === 'completed' &&
                  !track.isLocalFile
              ).length
            }{' '}
            canciones
          </Text>
        </TouchableOpacity>

        {/* Crear playlist */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.squareCard, styles.playlistCard]}
          onPress={handleCreatePlaylist}
        >
          <View style={styles.cardIconCircle}>
            <Text style={styles.cardIcon}>＋</Text>
          </View>

          <Text style={styles.squareTitle}>
            Crear playlist
          </Text>

          <Text style={styles.squareSubtitle}>
            Crea tu propia lista
          </Text>
        </TouchableOpacity>

        {/* Archivos locales */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.squareCard, styles.localCard]}
          onPress={() => setSection('local')}
        >
          <View style={styles.cardIconCircle}>
            <Text style={styles.cardIcon}>▣</Text>
          </View>

          <Text style={styles.squareTitle}>
            Archivos locales
          </Text>

          <Text style={styles.squareSubtitle}>
            MP3 · M4A · WAV
          </Text>
        </TouchableOpacity>
      </View>

      {/* Playlists */}
      <View style={styles.playlistsHeader}>
        <Text style={styles.playlistsTitle}>
          Tus playlists
        </Text>

        <Text style={styles.playlistCount}>
          {playlists.length}
        </Text>
      </View>

      {playlists.length === 0 ? (
        <View style={styles.emptyPlaylists}>
          <Text style={styles.emptyPlaylistIcon}>♪</Text>

          <Text style={styles.emptyPlaylistTitle}>
            Todavía no tienes playlists
          </Text>

          <Text style={styles.emptyPlaylistText}>
            Crea una para organizar tus canciones.
          </Text>

          <TouchableOpacity
            style={styles.createButton}
            activeOpacity={0.8}
            onPress={handleCreatePlaylist}
          >
            <Text style={styles.createButtonText}>
              + Crear playlist
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.playlistsGrid}>
          {playlists.map((playlist) => (
            <TouchableOpacity
              key={playlist.id}
              activeOpacity={0.8}
              style={styles.playlistItem}
              onPress={() => {
                setSelectedPlaylist(playlist);
                setSection('playlist');
              }}
            >
              <View style={styles.playlistCover}>
                <Text style={styles.playlistCoverIcon}>
                  ♪
                </Text>
              </View>

              <Text
                style={styles.playlistName}
                numberOfLines={1}
              >
                {playlist.name}
              </Text>

              <Text style={styles.playlistSongs}>
                {playlist.trackIds.length}{' '}
                {playlist.trackIds.length === 1
                  ? 'canción'
                  : 'canciones'}
              </Text>

              <TouchableOpacity
                style={styles.playlistMenuButton}
                onPress={() => {
                  setMenuPlaylist(playlist);
                }}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10,
                }}
              >
                <FontAwesome
                  name="ellipsis-v"
                  size={18}
                  color="#B3B3B3"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  /**
   * Pantalla de una sección.
   */
  const renderSection = () => {
    const sectionTracks =
      section === 'playlist' && selectedPlaylist
        ? tracks.filter((track) =>
          selectedPlaylist.trackIds.includes(track.id)
        )
        : getSectionTracks();

    let title = '';

    if (section === 'favorites') {
      title = 'Tus Me Gusta';
    } else if (section === 'downloaded') {
      title = 'Descargadas';
    } else if (section === 'local') {
      title = 'Archivos locales';
    } else if (section === 'playlist' && selectedPlaylist) {
      title = selectedPlaylist.name;
    }

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSection('home')}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.sectionTitleRow}>
            <Text
              style={styles.sectionTitle}
              numberOfLines={1}
            >
              {title}
            </Text>

            {section === 'local' && (
              <TouchableOpacity
                onPress={handleLocalFiles}
                style={styles.addLocalButton}
                activeOpacity={0.8}
              >
                <Text style={styles.addLocalButtonText}>＋</Text>
              </TouchableOpacity>
            )}

            {section !== 'playlist' && (
              <TouchableOpacity
                onPress={() => setShowSortMenu(true)}
                style={styles.sortButton}
                activeOpacity={0.8}
              >
                <Text style={styles.sortIcon}>☷</Text>
              </TouchableOpacity>
            )}
          </View>

          {section === 'playlist' && (
            <TouchableOpacity
              style={styles.addSongsButton}
              onPress={() => setShowAddSongs(true)}
            >
              <Text style={styles.addSongsButtonText}>＋</Text>
            </TouchableOpacity>
          )}
        </View>

        {section === 'playlist' ? (
          <FlatList
            data={sectionTracks}
            keyExtractor={(item) => item.id}
            renderItem={renderTrackItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyIcon}>♪</Text>

                <Text style={styles.emptyText}>
                  Esta playlist todavía está vacía.
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={sectionTracks}
            keyExtractor={(item) => item.id}
            renderItem={renderTrackItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyIcon}>♪</Text>

                <Text style={styles.emptyText}>
                  {section === 'favorites'
                    ? 'Todavía no tienes canciones favoritas.'
                    : section === 'downloaded'
                      ? 'No tienes canciones descargadas.'
                      : section === 'local'
                        ? 'No tienes archivos locales.'
                        : 'Esta playlist todavía está vacía.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color="#FF5500"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Modal
        visible={showCreatePlaylist}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreatePlaylist(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {editingPlaylist
                ? 'Renombrar playlist'
                : 'Nueva playlist'}
            </Text>

            <Text style={styles.modalSubtitle}>
              Dale un nombre a tu nueva playlist
            </Text>

            <TextInput
              value={playlistName}
              onChangeText={setPlaylistName}
              placeholder="Nombre de la playlist"
              placeholderTextColor="#777777"
              autoFocus
              style={styles.modalInput}
              selectionColor="#FF5500"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCreatePlaylist(false)}
              >
                <Text style={styles.modalCancelText}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={
                  editingPlaylist
                    ? handleRenamePlaylist
                    : handleConfirmCreatePlaylist
                }
              >
                <Text style={styles.modalCreateText}>
                  {editingPlaylist ? 'Guardar' : 'Crear'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={menuPlaylist !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPlaylist(null)}
      >
        <TouchableOpacity
          style={styles.playlistMenuOverlay}
          activeOpacity={1}
          onPress={() => setMenuPlaylist(null)}
        >
          <View style={styles.playlistMenu}>
            <Text style={styles.playlistMenuTitle}>
              {menuPlaylist?.name}
            </Text>

            <TouchableOpacity
              style={styles.playlistMenuOption}
              onPress={() => {
                if (!menuPlaylist) {
                  return;
                }

                setEditingPlaylist(menuPlaylist);
                setPlaylistName(menuPlaylist.name);
                setMenuPlaylist(null);
                setShowCreatePlaylist(true);
              }}
            >
              <FontAwesome
                name="pencil"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.playlistMenuOptionText}>
                Renombrar playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playlistMenuOption}
              onPress={handleDeletePlaylist}
            >
              <FontAwesome
                name="trash-o"
                size={18}
                color="#FF4D4D"
              />

              <Text
                style={[
                  styles.playlistMenuOptionText,
                  styles.playlistDeleteText,
                ]}
              >
                Eliminar playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playlistCancelButton}
              onPress={() => setMenuPlaylist(null)}
            >
              <Text style={styles.playlistCancelText}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAddSongs}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddSongs(false);
          setSelectedTrackIds([]);
        }}
      >
        <View style={styles.addSongsOverlay}>
          <View style={styles.addSongsContainer}>
            <View style={styles.addSongsHeader}>
              <Text style={styles.addSongsTitle}>
                Añadir canciones
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowAddSongs(false);
                  setSelectedTrackIds([]);
                }}
              >
                <Text style={styles.addSongsClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.addSongsSubtitle}>
              Selecciona las canciones que quieres añadir
            </Text>

            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected =
                  selectedTrackIds.includes(item.id);

                return (
                  <TouchableOpacity
                    style={[
                      styles.addSongItem,
                      isSelected && styles.addSongItemSelected,
                    ]}
                    onPress={() => toggleTrackSelection(item.id)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: item.coverUrl }}
                      style={styles.addSongCover}
                    />

                    <View style={styles.addSongInfo}>
                      <Text
                        style={styles.addSongTitle}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>

                      <Text
                        style={styles.addSongArtist}
                        numberOfLines={1}
                      >
                        {item.artist}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.addSongCheck,
                        isSelected &&
                        styles.addSongCheckSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.addSongCheckText}>
                          ✓
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>
                    No tienes canciones en tu biblioteca.
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={[
                styles.confirmAddSongsButton,
                selectedTrackIds.length === 0 &&
                styles.confirmAddSongsButtonDisabled,
              ]}
              disabled={selectedTrackIds.length === 0}
              onPress={handleAddSongsToPlaylist}
            >
              <Text style={styles.confirmAddSongsText}>
                Añadir{' '}
                {selectedTrackIds.length > 0
                  ? `(${selectedTrackIds.length})`
                  : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortMenu(false)}
      >
        <TouchableOpacity
          style={styles.sortMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowSortMenu(false)}
        >
          <View style={styles.sortMenu}>
            <Text style={styles.sortMenuTitle}>
              Ordenar canciones
            </Text>

            <TouchableOpacity
              style={styles.sortMenuOption}
              onPress={() => {
                setSortOrder('recent');
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortMenuIcon}>◷</Text>

              <Text style={styles.sortMenuOptionText}>
                Más recientes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortMenuOption}
              onPress={() => {
                setSortOrder('oldest');
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortMenuIcon}>◴</Text>

              <Text style={styles.sortMenuOptionText}>
                Más antiguas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortMenuOption}
              onPress={() => {
                setSortOrder('titleAsc');
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortMenuIcon}>A</Text>

              <Text style={styles.sortMenuOptionText}>
                Título A → Z
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortMenuOption}
              onPress={() => {
                setSortOrder('titleDesc');
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortMenuIcon}>Z</Text>

              <Text style={styles.sortMenuOptionText}>
                Título Z → A
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortMenuOption}
              onPress={() => {
                setSortOrder('artistAsc');
                setShowSortMenu(false);
              }}
            >
              <Text style={styles.sortMenuIcon}>♪</Text>

              <Text style={styles.sortMenuOptionText}>
                Artista A → Z
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortCancelButton}
              onPress={() => setShowSortMenu(false)}
            >
              <Text style={styles.sortCancelText}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SafeAreaView style={styles.container}>
        {section === 'home'
          ? renderHome()
          : renderSection()}
      </SafeAreaView>
    </>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },

  homeContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  sectionSubtitle: {
    color: '#8F8F8F',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 22,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },

  squareCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  likesCard: {
    backgroundColor: '#7B1FA2',
  },

  downloadsCard: {
    backgroundColor: '#1B5E20',
  },

  playlistCard: {
    backgroundColor: '#B23A00',
  },

  localCard: {
    backgroundColor: '#37474F',
  },

  cardIconCircle: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardIcon: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
  },

  squareTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  squareSubtitle: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    marginTop: 4,
  },

  playlistsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },

  playlistsTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  playlistCount: {
    color: '#8F8F8F',
    fontSize: 14,
  },

  emptyPlaylists: {
    alignItems: 'center',
    backgroundColor: '#1B1B1B',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },

  emptyPlaylistIcon: {
    color: '#FF5500',
    fontSize: 36,
    marginBottom: 8,
  },

  emptyPlaylistTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyPlaylistText: {
    color: '#8F8F8F',
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },

  createButton: {
    backgroundColor: '#FF5500',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 18,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  playlistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 22,
  },

  playlistItem: {
    width: '100%',
    minHeight: 82,
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    marginBottom: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  playlistCover: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  playlistCoverIcon: {
    color: '#FF5500',
    fontSize: 48,
    fontWeight: '700',
  },

  playlistName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 14,
  },

  playlistSongs: {
    position: 'absolute',
    left: 86,
    bottom: 18,
    color: '#888888',
    fontSize: 12,
  },

  sectionContainer: {
    flex: 1,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
    marginTop: -3,
  },

  sectionTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#282828',
  },

  coverImage: {
    width: 56,
    height: 56,
    borderRadius: 7,
    backgroundColor: '#282828',
  },

  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  artist: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 2,
  },

  downloadBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    borderColor: '#FF5500',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },

  downloadBadgeText: {
    color: '#FF5500',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  downloadingBadge: {
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
    borderColor: '#FFAA00',
  },

  downloadingBadgeText: {
    color: '#FFAA00',
  },

  localBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(120, 150, 160, 0.15)',
    borderColor: '#78909C',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },

  localBadgeText: {
    color: '#90A4AE',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  actionButton: {
    padding: 6,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },

  emptyIcon: {
    color: '#FF5500',
    fontSize: 42,
    marginBottom: 10,
  },

  emptyText: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  modalContainer: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 24,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  modalSubtitle: {
    color: '#9E9E9E',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },

  modalInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 22,
    gap: 10,
  },

  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  modalCancelText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '600',
  },

  modalCreateButton: {
    backgroundColor: '#FF5500',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  modalCreateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  addSongsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF5500',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },

  addSongsButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  addSongsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },

  addSongsContainer: {
    height: '70%',
    backgroundColor: '#181818',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  addSongsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addSongsTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  addSongsClose: {
    color: '#FFFFFF',
    fontSize: 20,
    padding: 6,
  },

  addSongsSubtitle: {
    color: '#888888',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 18,
  },

  addSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },

  addSongItemSelected: {
    backgroundColor: '#2A211D',
    borderWidth: 1,
    borderColor: '#FF5500',
  },

  addSongCover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#333333',
  },

  addSongInfo: {
    flex: 1,
    marginLeft: 12,
  },

  addSongTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  addSongArtist: {
    color: '#888888',
    fontSize: 13,
    marginTop: 3,
  },

  addSongCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666666',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  addSongCheckSelected: {
    backgroundColor: '#FF5500',
    borderColor: '#FF5500',
  },

  addSongCheckText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  confirmAddSongsButton: {
    backgroundColor: '#FF5500',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 30,
  },

  confirmAddSongsButtonDisabled: {
    backgroundColor: '#333333',
  },

  confirmAddSongsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  addLocalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF5500',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addLocalButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  sectionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playlistMenuButton: {
    position: 'absolute',
    right: 8,
    top: 23,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },

  playlistMenu: {
    backgroundColor: '#1C1C1C',
    borderRadius: 24,
    marginHorizontal: 12,
    padding: 20,
    paddingBottom: 24,
  },

  playlistMenuTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },

  playlistMenuOption: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  playlistMenuOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  playlistDeleteText: {
    color: '#FF4D4D',
  },

  playlistCancelButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  playlistCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sortButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sortIcon: {
    color: '#B3B3B3',
    fontSize: 24,
    fontWeight: '400',
  },

  sortMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },

  sortMenu: {
    backgroundColor: '#1C1C1C',
    borderRadius: 24,
    marginHorizontal: 12,
    padding: 20,
    paddingBottom: 24,
  },

  sortMenuTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
  },

  sortMenuOption: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sortMenuIcon: {
    width: 32,
    color: '#B3B3B3',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 12,
  },

  sortMenuOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  sortCancelButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  sortCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  


});