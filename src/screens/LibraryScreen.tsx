import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  PanResponder,
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

  // =========================
  // ANIMACIONES HOME
  // =========================

  const homeEntrance = useRef(
    new Animated.Value(0),
  ).current;

  const sectionEntrance = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    if (section === 'home') {
      return;
    }

    sectionEntrance.setValue(0);

    Animated.timing(sectionEntrance, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [section, selectedPlaylist, sectionEntrance]);

  const homeCardPressAnimations =
    useRef<Record<string, Animated.Value>>(
      {},
    ).current;

  const getHomeCardPressAnimation = (
    cardId: string,
  ) => {
    if (
      !homeCardPressAnimations[cardId]
    ) {
      homeCardPressAnimations[cardId] =
        new Animated.Value(1);
    }

    return homeCardPressAnimations[
      cardId
    ];
  };

  const animateHomeCardPress = (
    cardId: string,
  ) => {
    const animation =
      getHomeCardPressAnimation(cardId);

    Animated.sequence([
      Animated.spring(animation, {
        toValue: 0.965,
        useNativeDriver: true,
        friction: 5,
        tension: 280,
      }),
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 280,
      }),
    ]).start();
  };

  useEffect(() => {
    if (section !== 'home') {
      return;
    }

    homeEntrance.setValue(0);

    Animated.timing(homeEntrance, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [section, homeEntrance]);

  // =========================
  // DRAG & DROP
  // =========================

  const [draggedTrackId, setDraggedTrackId] =
    useState<string | null>(null);

  const [dragOverIndex, setDragOverIndex] =
    useState<number | null>(null);

  const [draggedTrackIndex, setDraggedTrackIndex] =
    useState<number | null>(null);

  const dragAnimatedY = useRef(
    new Animated.Value(0),
  ).current;

  const trackShiftAnimations = useRef<
    Record<string, Animated.Value>
  >({}).current;

  const draggedTrackIdRef =
    useRef<string | null>(null);

  const draggedTrackIndexRef =
    useRef<number | null>(null);

  const dragOverIndexRef =
    useRef<number | null>(null);

  const getTrackShiftAnimation = (
    trackId: string,
  ) => {
    if (!trackShiftAnimations[trackId]) {
      trackShiftAnimations[trackId] =
        new Animated.Value(0);
    }

    return trackShiftAnimations[trackId];
  };

  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, [refreshLibrary])
  );

  // =========================
  // REPRODUCIR CANCIÓN
  // =========================

  const handlePlayTrack = async (
    track: Track,
  ) => {
    try {
      console.log(
        '🎵 TRACK LOCAL:',
        JSON.stringify(track, null, 2),
      );

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
        error,
      );
    }
  };

  // =========================
  // ELIMINAR CANCIÓN
  // =========================

  const handleConfirmDelete = (
    track: Track,
  ) => {
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
          onPress: () =>
            deleteTrackCompletely(track.id),
        },
      ],
    );
  };

  // =========================
  // PLAYLISTS
  // =========================

  const handleCreatePlaylist = () => {
    setPlaylistName('');
    setEditingPlaylist(null);
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

    libraryStorage.deletePlaylist(
      menuPlaylist.id,
    );

    setMenuPlaylist(null);

    refreshLibrary();
  };

  const toggleTrackSelection = (
    trackId: string,
  ) => {
    setSelectedTrackIds((current) =>
      current.includes(trackId)
        ? current.filter(
          (id) => id !== trackId,
        )
        : [...current, trackId],
    );
  };

  const handleAddSongsToPlaylist = () => {
    if (
      !selectedPlaylist ||
      selectedTrackIds.length === 0
    ) {
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

    libraryStorage.savePlaylist(
      updatedPlaylist,
    );

    setSelectedPlaylist(updatedPlaylist);
    setSelectedTrackIds([]);
    setShowAddSongs(false);

    refreshLibrary();
  };

  const handleRemoveSongFromPlaylist = (
    trackId: string,
  ) => {
    if (!selectedPlaylist) {
      return;
    }

    const updatedPlaylist: Playlist = {
      ...selectedPlaylist,
      trackIds:
        selectedPlaylist.trackIds.filter(
          (id) => id !== trackId,
        ),
    };

    libraryStorage.savePlaylist(
      updatedPlaylist,
    );

    setSelectedPlaylist(updatedPlaylist);

    refreshLibrary();
  };

  const handleConfirmCreatePlaylist = () => {
    const name = playlistName.trim();

    if (!name) {
      Alert.alert(
        'Nombre necesario',
        'Escribe un nombre para la playlist.',
      );

      return;
    }

    createPlaylist(name);

    setShowCreatePlaylist(false);
    setPlaylistName('');
  };

  // =========================
  // ARCHIVOS LOCALES
  // =========================

  const handleLocalFiles = async () => {
    try {
      const result = await pick({
        type: ['audio/*'],
        allowMultiSelection: true,
      });

      for (const file of result) {
        const fileName =
          file.name ?? 'Archivo sin nombre';

        const [copyResult] =
          await keepLocalCopy({
            files: [
              {
                uri: file.uri,
                fileName,
              },
            ],
            destination:
              'documentDirectory',
          });

        if (
          copyResult.status !== 'success'
        ) {
          console.error(
            '[LibraryScreen] Error copiando archivo:',
            copyResult.copyError,
          );

          continue;
        }

        const newTrack: Track = {
          id: `local_${Date.now()}_${Math.random()}`,
          title: fileName.replace(
            /\.[^/.]+$/,
            '',
          ),
          artist: 'Archivo local',
          coverUrl: '',
          localPath: copyResult.localUri,
          isFavorite: false,
          downloadState: 'completed',
          addedAt: Date.now(),
          isLocalFile: true,
        };

        libraryStorage.saveTrack(
          newTrack,
        );
      }

      refreshLibrary();

      Alert.alert(
        'Archivo añadido',
        result
          .map(
            (file) =>
              file.name ?? 'Sin nombre',
          )
          .join('\n'),
      );
    } catch (error: any) {
      if (
        error?.code ===
        'OPERATION_CANCELED'
      ) {
        return;
      }

      console.error(
        'ERROR AL SELECCIONAR:',
        error,
      );
    }
  };

  // =========================
  // ORDENAR CANCIONES
  // =========================

  const sortTracks = (
    trackList: Track[],
  ): Track[] => {
    const sorted = [...trackList];

    switch (sortOrder) {
      case 'recent':
        return sorted.sort(
          (a, b) =>
            b.addedAt - a.addedAt,
        );

      case 'oldest':
        return sorted.sort(
          (a, b) =>
            a.addedAt - b.addedAt,
        );

      case 'titleAsc':
        return sorted.sort(
          (a, b) =>
            a.title.localeCompare(
              b.title,
            ),
        );

      case 'titleDesc':
        return sorted.sort(
          (a, b) =>
            b.title.localeCompare(
              a.title,
            ),
        );

      case 'artistAsc':
        return sorted.sort(
          (a, b) =>
            a.artist.localeCompare(
              b.artist,
            ),
        );

      default:
        return sorted;
    }
  };

  // =========================
  // CANCIONES DE LA SECCIÓN
  // =========================

  const getSectionTracks = (): Track[] => {
    let sectionTracks: Track[] = [];

    if (section === 'favorites') {
      sectionTracks = tracks.filter(
        (track) => track.isFavorite,
      );
    } else if (
      section === 'downloaded'
    ) {
      sectionTracks = tracks.filter(
        (track) =>
          track.downloadState ===
          'completed' &&
          !track.isLocalFile,
      );
    } else if (section === 'local') {
      sectionTracks = tracks.filter(
        (track) => track.isLocalFile,
      );
    } else if (
      section === 'playlist' &&
      selectedPlaylist
    ) {
      sectionTracks =
        selectedPlaylist.trackIds
          .map((trackId) =>
            tracks.find(
              (track) =>
                track.id === trackId,
            ),
          )
          .filter(
            (track): track is Track =>
              track !== undefined,
          );
    } else {
      sectionTracks = tracks;
    }

    if (section === 'playlist') {
      return sectionTracks;
    }

    return sortTracks(sectionTracks);
  };

  // =========================
  // REORDENAR
  // =========================

  const reorderTracks = (
    list: Track[],
    fromIndex: number,
    toIndex: number,
  ): Track[] => {
    const result = [...list];

    const [movedTrack] =
      result.splice(fromIndex, 1);

    result.splice(
      toIndex,
      0,
      movedTrack,
    );

    return result;
  };

  // =========================
  // ANIMACIÓN DE LAS DEMÁS
  // =========================

  const updateTrackShiftAnimations = (
    draggedIndex: number,
    targetIndex: number,
  ) => {
    const currentTracks =
      getSectionTracks();

    currentTracks.forEach(
      (track, index) => {
        if (index === draggedIndex) {
          return;
        }

        let targetShift = 0;

        if (
          draggedIndex < targetIndex &&
          index > draggedIndex &&
          index <= targetIndex
        ) {
          targetShift = -78;
        }

        if (
          draggedIndex > targetIndex &&
          index >= targetIndex &&
          index < draggedIndex
        ) {
          targetShift = 78;
        }

        Animated.spring(
          getTrackShiftAnimation(
            track.id,
          ),
          {
            toValue: targetShift,
            useNativeDriver: true,
            friction: 8,
            tension: 80,
          },
        ).start();
      },
    );
  };

  const resetTrackShiftAnimations = () => {
    Object.values(
      trackShiftAnimations,
    ).forEach((animation) => {
      animation.setValue(0);
    });
  };

  // =========================
  // PAN RESPONDER
  // =========================

  const createTrackPanResponder = (
    trackId: string,
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder:
        () => false,

      onStartShouldSetPanResponderCapture:
        () => false,

      onMoveShouldSetPanResponderCapture: (
        _,
        gestureState,
      ) => {
        if (section !== 'playlist') {
          return false;
        }

        if (
          draggedTrackIdRef.current !==
          trackId
        ) {
          return false;
        }

        return (
          Math.abs(gestureState.dy) > 2
        );
      },

      onPanResponderGrant: () => {
        if (section !== 'playlist') {
          return;
        }
      },

      onPanResponderMove: (
        _,
        gestureState,
      ) => {
        if (
          section !== 'playlist' ||
          draggedTrackIdRef.current !==
          trackId
        ) {
          return;
        }

        // =========================
        // LA CANCIÓN SIGUE AL DEDO
        // =========================

        const dy = gestureState.dy;

        dragAnimatedY.setValue(dy);

        // =========================
        // CALCULAR POSICIÓN DESTINO
        // =========================

        const currentTracks =
          getSectionTracks();

        const originalIndex =
          draggedTrackIndexRef.current ??
          0;

        const ITEM_HEIGHT = 78;

        let targetIndex =
          originalIndex;

        if (dy > 0) {
          const movedSlots =
            Math.floor(
              (dy +
                ITEM_HEIGHT / 2) /
              ITEM_HEIGHT,
            );

          targetIndex =
            originalIndex +
            movedSlots;
        } else if (dy < 0) {
          const movedSlots =
            Math.ceil(
              (dy -
                ITEM_HEIGHT / 2) /
              ITEM_HEIGHT,
            );

          targetIndex =
            originalIndex +
            movedSlots;
        }

        targetIndex = Math.max(
          0,
          Math.min(
            targetIndex,
            currentTracks.length - 1,
          ),
        );

        // =========================
        // MOVER LAS DEMÁS CANCIONES
        // =========================

        if (
          dragOverIndexRef.current !==
          targetIndex
        ) {
          dragOverIndexRef.current =
            targetIndex;

          updateTrackShiftAnimations(
            originalIndex,
            targetIndex,
          );
        }
      },

      // =========================
      // SOLTAR
      // =========================

      onPanResponderRelease: () => {
        if (
          section !== 'playlist' ||
          !selectedPlaylist ||
          draggedTrackIndexRef.current === null ||
          dragOverIndexRef.current === null
        ) {
          draggedTrackIdRef.current = null;
          draggedTrackIndexRef.current = null;
          dragOverIndexRef.current = null;

          dragAnimatedY.setValue(0);
          resetTrackShiftAnimations();

          setDraggedTrackId(null);
          setDraggedTrackIndex(null);
          setDragOverIndex(null);

          return;
        }

        const fromIndex =
          draggedTrackIndexRef.current;

        const toIndex =
          dragOverIndexRef.current;

        const currentTracks =
          getSectionTracks();

        // ========================================
        // NO SE HA MOVIDO DE POSICIÓN
        // ========================================

        if (fromIndex === toIndex) {
          Animated.spring(dragAnimatedY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          }).start(() => {
            draggedTrackIdRef.current = null;
            draggedTrackIndexRef.current = null;
            dragOverIndexRef.current = null;

            setDraggedTrackId(null);
            setDraggedTrackIndex(null);
            setDragOverIndex(null);

            resetTrackShiftAnimations();
          });

          return;
        }

        // ========================================
        // NUEVO ORDEN
        // ========================================

        const reorderedTracks = reorderTracks(
          currentTracks,
          fromIndex,
          toIndex,
        );

        const updatedPlaylist: Playlist = {
          ...selectedPlaylist,
          trackIds: reorderedTracks.map(
            (track) => track.id,
          ),
        };

        libraryStorage.savePlaylist(
          updatedPlaylist,
        );

        // ========================================
        // ANIMAMOS LA CANCIÓN HASTA SU DESTINO
        // ========================================

        const finalOffset =
          (toIndex - fromIndex) * 78;

        Animated.timing(dragAnimatedY, {
          toValue: finalOffset,
          duration: 160,
          useNativeDriver: true,
        }).start(() => {
          setSelectedPlaylist(updatedPlaylist);

          requestAnimationFrame(() => {
            dragAnimatedY.setValue(0);
            resetTrackShiftAnimations();

            draggedTrackIdRef.current = null;
            draggedTrackIndexRef.current = null;
            dragOverIndexRef.current = null;

            setDraggedTrackId(null);
            setDraggedTrackIndex(null);
            setDragOverIndex(null);
          });
        });
      },


      // =========================
      // CANCELAR DRAG
      // =========================

      onPanResponderTerminate: () => {
        Animated.spring(
          dragAnimatedY,
          {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
          },
        ).start(() => {
          draggedTrackIdRef.current =
            null;

          draggedTrackIndexRef.current =
            null;

          dragOverIndexRef.current =
            null;

          setDraggedTrackId(null);
          setDraggedTrackIndex(null);
          setDragOverIndex(null);

          resetTrackShiftAnimations();
        });
      },
    });

  // =========================
  // TARJETA DE CANCIÓN
  // =========================

  const renderTrackItem = ({
    item,
  }: {
    item: Track;
  }) => {

    console.log(
      'RENDER:',
      item.title,
      'DRAG:',
      draggedTrackId,
    );

    const panResponder =
      createTrackPanResponder(item.id);

    const isDragging =
      draggedTrackId === item.id;

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.trackCard,
          {
            zIndex: isDragging ? 10 : 0,
            elevation: isDragging ? 10 : 0,
            backgroundColor: isDragging
              ? 'transparent'
              : '#111111',
            borderColor: isDragging
              ? 'transparent'
              : 'rgba(255,255,255,0.055)',
            transform: [
              {
                translateY:
                  getTrackShiftAnimation(
                    item.id,
                  ),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          delayLongPress={300}
          onLongPress={() => {
            if (section !== 'playlist') {
              return;
            }

            const currentTracks =
              getSectionTracks();

            const index =
              currentTracks.findIndex(
                (track) =>
                  track.id === item.id,
              );

            if (index === -1) {
              return;
            }

            draggedTrackIdRef.current =
              item.id;

            draggedTrackIndexRef.current =
              index;

            dragOverIndexRef.current =
              index;

            setDraggedTrackId(
              item.id,
            );

            setDraggedTrackIndex(
              index,
            );

            setDragOverIndex(index);

            dragAnimatedY.setValue(0);

            resetTrackShiftAnimations();
          }}
          onPress={() =>
            handlePlayTrack(item)
          }
          style={styles.trackContent}
        >
          {/* SOLO LA PARTE VISUAL SIGUE AL DEDO */}
          <Animated.View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              transform: [
                {
                  translateY:
                    isDragging
                      ? dragAnimatedY
                      : 0,
                },
              ],
            }}
          >
            <Image
              source={{
                uri: item.coverUrl,
              }}
              style={styles.coverImage}
            />

            <View style={styles.trackInfo}>
              <Text
                style={styles.title}
                numberOfLines={1}
              >
                {item.title}
              </Text>

              <Text
                style={styles.artist}
                numberOfLines={1}
              >
                {item.artist}
              </Text>

              {item.downloadState ===
                'downloading' && (
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

              {item.downloadState ===
                'completed' &&
                !item.isLocalFile && (
                  <View
                    style={
                      styles.downloadBadge
                    }
                  >
                    <Text
                      style={
                        styles.downloadBadgeText
                      }
                    >
                      OFFLINE
                    </Text>
                  </View>
                )}

              {item.isLocalFile && (
                <View
                  style={
                    styles.localBadge
                  }
                >
                  <Text
                    style={
                      styles.localBadgeText
                    }
                  >
                    LOCAL
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() =>
                  toggleFavorite(item)
                }
                style={
                  styles.actionButton
                }
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10,
                }}
              >
                <FontAwesome
                  name={
                    item.isFavorite
                      ? 'heart'
                      : 'heart-o'
                  }
                  size={20}
                  color={
                    item.isFavorite
                      ? '#FF5500'
                      : '#B3B3B3'
                  }
                />
              </TouchableOpacity>

              {section ===
                'playlist' ? (
                <TouchableOpacity
                  onPress={() =>
                    handleRemoveSongFromPlaylist(
                      item.id,
                    )
                  }
                  style={
                    styles.actionButton
                  }
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
                  onPress={() =>
                    handleConfirmDelete(
                      item,
                    )
                  }
                  style={
                    styles.actionButton
                  }
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
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };



  // =========================
  // HOME
  // =========================

  const renderHome = () => {
    const favoriteCount =
      tracks.filter(
        (track) => track.isFavorite,
      ).length;

    const downloadedCount =
      tracks.filter(
        (track) =>
          track.downloadState ===
          'completed' &&
          !track.isLocalFile,
      ).length;

    const localCount =
      tracks.filter(
        (track) => track.isLocalFile,
      ).length;

    const entranceStyle = {
      opacity: homeEntrance,
      transform: [
        {
          translateY: homeEntrance.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
      ],
    };

    return (
      <ScrollView
        style={{ backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.homeContent}
      >
        {/* TODO LO QUE YA TENÍAS DEL HOME */}
        {/* ==================================
            HERO
        ================================== */}

        <Animated.View
          style={[
            styles.homeHero,
            entranceStyle,
          ]}
        >

          <View
            style={styles.homeHeroGlowOne}
          />

          <View
            style={styles.homeHeroGlowTwo}
          />

          <View
            style={styles.homeHeroOrb}
          />

          <View
            pointerEvents="none"
            style={styles.homeHeroLineOne}
          />

          <View
            pointerEvents="none"
            style={styles.homeHeroLineTwo}
          />

          <Text style={styles.homeEyebrow}>
            SPOTUBE
          </Text>

          <Text style={styles.headerTitle}>
            Tu Biblioteca
          </Text>

          <Text style={styles.sectionSubtitle}>
            Todo tu universo musical,
            en un solo lugar.
          </Text>

          <View
            style={styles.homeHeroBottom}
          >
            <View>
              <Text
                style={styles.homeHeroNumber}
              >
                {tracks.length}
              </Text>

              <Text
                style={styles.homeHeroLabel}
              >
                canciones
              </Text>
            </View>

            <View
              style={styles.homeHeroDivider}
            />

            <View>
              <Text
                style={styles.homeHeroNumber}
              >
                {playlists.length}
              </Text>

              <Text
                style={styles.homeHeroLabel}
              >
                playlists
              </Text>
            </View>

            <View
              style={styles.homeHeroMusic}
            >
              <FontAwesome
                name="music"
                size={18}
                color="#FFFFFF"
              />
            </View>
          </View>
        </Animated.View>

        {/* ==================================
            TARJETAS PRINCIPALES
        ================================== */}

        <View style={styles.grid}>

          {/* FAVORITOS */}

          <Animated.View
            style={[
              styles.homeCardWrapper,
              {
                transform: [
                  {
                    translateY:
                      homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                  },
                  {
                    scale:
                      getHomeCardPressAnimation(
                        'favorites',
                      ),
                  },
                ],
                opacity: homeEntrance,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.squareCard,
                styles.likesCard,
              ]}
              onPress={() => {
                animateHomeCardPress(
                  'favorites',
                );

                setSection('favorites');
              }}
            >
              <View
                style={
                  styles.cardColorGlow
                }
              />

              <View
                style={
                  styles.favoriteBigGlow
                }
              />

              <FontAwesome
                name="heart"
                size={118}
                color="rgba(255,75,110,0.30)"
                style={styles.favoriteBigIcon}
              />

              <View
                style={styles.cardTopRow}
              >
                <View
                  style={[
                    styles.cardIconCircle,
                    styles.favoriteIconCircle,
                  ]}
                >
                  <FontAwesome
                    name="heart"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.cardArrowCircle}
                >
                  <FontAwesome
                    name="arrow-up"
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <View
                style={styles.cardBottom}
              >
                <Text
                  style={styles.cardEyebrow}
                >
                  COLECCIÓN
                </Text>

                <Text
                  style={styles.squareTitle}
                >
                  Tus Me Gusta
                </Text>

                <Text
                  style={styles.squareSubtitle}
                >
                  {favoriteCount}{' '}
                  {favoriteCount === 1
                    ? 'canción'
                    : 'canciones'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* DESCARGADAS */}

          <Animated.View
            style={[
              styles.homeCardWrapper,
              {
                transform: [
                  {
                    translateY:
                      homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                  },
                  {
                    scale:
                      getHomeCardPressAnimation(
                        'downloads',
                      ),
                  },
                ],
                opacity: homeEntrance,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.squareCard,
                styles.downloadsCard,
              ]}
              onPress={() => {
                animateHomeCardPress(
                  'downloads',
                );

                setSection('downloaded');
              }}
            >
              <View
                style={
                  styles.cardColorGlow
                }
              />

              <View
                style={
                  styles.downloadBigGlow
                }
              />

              <View
                style={
                  styles.downloadDecorLines
                }
              >
                <View
                  style={
                    styles.downloadDecorLine
                  }
                />
                <View
                  style={
                    styles.downloadDecorLine
                  }
                />
                <View
                  style={
                    styles.downloadDecorLine
                  }
                />
              </View>

              <View
                style={styles.cardTopRow}
              >
                <View
                  style={[
                    styles.cardIconCircle,
                    styles.downloadIconCircle,
                  ]}
                >
                  <FontAwesome
                    name="download"
                    size={19}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.cardArrowCircle}
                >
                  <FontAwesome
                    name="arrow-up"
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <View
                style={styles.cardBottom}
              >
                <Text
                  style={styles.cardEyebrow}
                >
                  SIN CONEXIÓN
                </Text>

                <Text
                  style={styles.squareTitle}
                >
                  Descargadas
                </Text>

                <Text
                  style={styles.squareSubtitle}
                >
                  {downloadedCount}{' '}
                  {downloadedCount === 1
                    ? 'canción'
                    : 'canciones'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* CREAR PLAYLIST */}

          <Animated.View
            style={[
              styles.homeCardWrapper,
              {
                transform: [
                  {
                    translateY:
                      homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                  },
                  {
                    scale:
                      getHomeCardPressAnimation(
                        'playlist',
                      ),
                  },
                ],
                opacity: homeEntrance,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.squareCard,
                styles.playlistCard,
              ]}
              onPress={() => {
                animateHomeCardPress(
                  'playlist',
                );

                handleCreatePlaylist();
              }}
            >
              <View
                style={
                  styles.playlistColorGlow
                }
              />

              <View
                style={
                  styles.playlistShapeBack
                }
              />

              <View
                style={
                  styles.playlistShapeMid
                }
              />

              <View
                style={
                  styles.playlistShapeMain
                }
              >
                <FontAwesome
                  name="plus"
                  size={27}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={styles.cardBottom}
              >
                <Text
                  style={styles.cardEyebrow}
                >
                  PERSONALIZA
                </Text>

                <Text
                  style={styles.squareTitle}
                >
                  Crear playlist
                </Text>

                <Text
                  style={styles.squareSubtitle}
                >
                  Crea tu propia lista
                </Text>
              </View>

              <View
                style={
                  styles.cardArrowCirclePlaylist
                }
              >
                <FontAwesome
                  name="plus"
                  size={12}
                  color="#FFFFFF"
                />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* LOCALES */}

          <Animated.View
            style={[
              styles.homeCardWrapper,
              {
                transform: [
                  {
                    translateY:
                      homeEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                  },
                  {
                    scale:
                      getHomeCardPressAnimation(
                        'local',
                      ),
                  },
                ],
                opacity: homeEntrance,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.squareCard,
                styles.localCard,
              ]}
              onPress={() => {
                animateHomeCardPress(
                  'local',
                );

                setSection('local');
              }}
            >
              <View
                style={
                  styles.localColorGlow
                }
              />

              <View
                style={
                  styles.localWaveOne
                }
              />

              <View
                style={
                  styles.localWaveTwo
                }
              />

              <View
                style={styles.cardTopRow}
              >
                <View
                  style={[
                    styles.cardIconCircle,
                    styles.localIconCircle,
                  ]}
                >
                  <FontAwesome
                    name="folder-open"
                    size={19}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.cardArrowCircle}
                >
                  <FontAwesome
                    name="arrow-up"
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <View
                style={styles.cardBottom}
              >
                <Text
                  style={styles.cardEyebrow}
                >
                  TU DISPOSITIVO
                </Text>

                <Text
                  style={styles.squareTitle}
                >
                  Archivos locales
                </Text>

                <Text
                  style={styles.squareSubtitle}
                >
                  {localCount > 0
                    ? `${localCount} archivos`
                    : 'MP3 · M4A · WAV'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ==================================
            PLAYLISTS
        ================================== */}

        <Animated.View
          style={[
            styles.playlistsSection,
            {
              opacity: homeEntrance,
              transform: [
                {
                  translateY:
                    homeEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [25, 0],
                    }),
                },
              ],
            },
          ]}
        >
          <View
            style={styles.playlistsHeader}
          >
            <View>
              <Text
                style={styles.playlistsTitle}
              >
                Tus playlists
              </Text>

              <Text
                style={
                  styles.playlistsSubtitle
                }
              >
                Tus listas personales
              </Text>
            </View>

            <View
              style={styles.playlistCount}
            >
              <Text
                style={
                  styles.playlistCountText
                }
              >
                {playlists.length}
              </Text>
            </View>
          </View>

          {playlists.length === 0 ? (
            <View
              style={styles.emptyPlaylists}
            >
              <View
                style={
                  styles.emptyPlaylistVisual
                }
              >
                <View
                  style={
                    styles.emptyPlaylistDiscOne
                  }
                />

                <View
                  style={
                    styles.emptyPlaylistDiscTwo
                  }
                >
                  <FontAwesome
                    name="music"
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
              </View>

              <Text
                style={
                  styles.emptyPlaylistTitle
                }
              >
                Todavía no tienes playlists
              </Text>

              <Text
                style={
                  styles.emptyPlaylistText
                }
              >
                Crea una y empieza a organizar
                tu música a tu manera.
              </Text>

              <TouchableOpacity
                style={styles.createButton}
                activeOpacity={0.85}
                onPress={
                  handleCreatePlaylist
                }
              >
                <FontAwesome
                  name="plus"
                  size={13}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.createButtonText
                  }
                >
                  Crear playlist
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={styles.playlistsGrid}
            >
              {playlists.map(
                (playlist, index) => {
                  const cardId = `playlist-${playlist.id}`;

                  return (
                    <Animated.View
                      key={playlist.id}
                      style={{
                        opacity: homeEntrance,
                        transform: [
                          {
                            translateY:
                              homeEntrance.interpolate(
                                {
                                  inputRange: [
                                    0,
                                    1,
                                  ],
                                  outputRange: [
                                    18 +
                                    index *
                                    4,
                                    0,
                                  ],
                                },
                              ),
                          },
                          {
                            scale:
                              getHomeCardPressAnimation(
                                cardId,
                              ),
                          },
                        ],
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={1}
                        style={
                          styles.playlistItem
                        }
                        onPress={() => {
                          animateHomeCardPress(
                            cardId,
                          );

                          setSelectedPlaylist(
                            playlist,
                          );

                          setSection(
                            'playlist',
                          );
                        }}
                      >
                        <View
                          style={
                            styles.playlistCover
                          }
                        >
                          <View
                            style={
                              styles.playlistCoverGlow
                            }
                          />

                          <FontAwesome
                            name="music"
                            size={29}
                            color="#FFFFFF"
                          />
                        </View>

                        <View
                          style={
                            styles.playlistInfo
                          }
                        >
                          <Text
                            style={
                              styles.playlistName
                            }
                            numberOfLines={1}
                          >
                            {
                              playlist.name
                            }
                          </Text>

                          <Text
                            style={
                              styles.playlistSongs
                            }
                          >
                            {
                              playlist
                                .trackIds
                                .length
                            }{' '}
                            {playlist
                              .trackIds
                              .length ===
                              1
                              ? 'canción'
                              : 'canciones'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={
                            styles.playlistMenuButton
                          }
                          onPress={() =>
                            setMenuPlaylist(
                              playlist,
                            )
                          }
                          hitSlop={{
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10,
                          }}
                        >
                          <FontAwesome
                            name="ellipsis-v"
                            size={17}
                            color="#A0A0A0"
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                },
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    );
  };

  // =========================
  // SECCIÓN
  // =========================

  const renderSection = () => {
    const sectionTracks =
      getSectionTracks();

    const sectionData = {
      favorites: {
        title: 'Tus Me Gusta',
        subtitle:
          'Las canciones que has guardado',
        count: tracks.filter(
          (track) => track.isFavorite,
        ).length,
        icon: 'heart',
        color: '#FF4F72',
        background: '#241017',
      },

      downloaded: {
        title: 'Descargadas',
        subtitle:
          'Música disponible sin conexión',
        count: tracks.filter(
          (track) =>
            track.downloadState ===
            'completed' &&
            !track.isLocalFile,
        ).length,
        icon: 'download',
        color: '#FF8A3D',
        background: '#24180F',
      },

      local: {
        title: 'Archivos locales',
        subtitle:
          'Música guardada en tu dispositivo',
        count: tracks.filter(
          (track) => track.isLocalFile,
        ).length,
        icon: 'folder-open',
        color: '#45C7E8',
        background: '#0D1D24',
      },

      playlist: {
        title:
          selectedPlaylist?.name ??
          'Playlist',
        subtitle:
          'Tu colección personalizada',
        count: sectionTracks.length,
        icon: 'music',
        color: '#A66BFF',
        background: '#191328',
      },
    };

    const current =
      section === 'home'
        ? sectionData.favorites
        : sectionData[section];

    const animatedSectionStyle = {
      opacity: sectionEntrance,

      transform: [
        {
          translateY:
            sectionEntrance.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
        },
      ],
    };

    return (
      <Animated.View
        style={[
          styles.sectionScreen,
          animatedSectionStyle,
        ]}
      >
        {/* =================================
            CABECERA
        ================================= */}

        <View
          style={styles.sectionTopBar}
        >
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.75}
            onPress={() => {
              setSection('home');
              setSelectedPlaylist(null);
            }}
          >
            <FontAwesome
              name="chevron-left"
              size={15}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View
            style={
              styles.sectionTopBarTitle
            }
          >
            <Text
              style={
                styles.sectionTopBarSmall
              }
            >
              BIBLIOTECA
            </Text>

            <Text
              style={
                styles.sectionTopBarMain
              }
              numberOfLines={1}
            >
              {current.title}
            </Text>
          </View>

          <View
            style={
              styles.sectionHeaderActions
            }
          >
            {section === 'local' && (
              <TouchableOpacity
                style={
                  styles.headerActionButton
                }
                activeOpacity={0.8}
                onPress={handleLocalFiles}
              >
                <FontAwesome
                  name="plus"
                  size={16}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {section === 'playlist' && (
              <TouchableOpacity
                style={[
                  styles.headerActionButton,
                  {
                    backgroundColor:
                      current.color,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedTrackIds(
                    [],
                  );

                  setShowAddSongs(true);
                }}
              >
                <FontAwesome
                  name="plus"
                  size={16}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {section !== 'playlist' && (
              <TouchableOpacity
                style={
                  styles.headerActionButton
                }
                activeOpacity={0.8}
                onPress={() =>
                  setShowSortMenu(true)
                }
              >
                <FontAwesome
                  name="sort"
                  size={15}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* =================================
            HERO
        ================================= */}

        <View
          style={[
            styles.sectionPremiumHero,
            {
              backgroundColor:
                current.background,
              borderColor:
                `${current.color}22`,
            },
          ]}
        >
          {/* HALOS */}

          <View
            style={[
              styles.sectionHeroGlow,
              {
                backgroundColor:
                  `${current.color}18`,
              },
            ]}
          />

          <View
            style={[
              styles.sectionHeroGlowSmall,
              {
                backgroundColor:
                  `${current.color}12`,
              },
            ]}
          />

          {/* ICONO */}

          <View
            style={[
              styles.sectionPremiumIcon,
              {
                backgroundColor:
                  `${current.color}20`,
                borderColor:
                  `${current.color}35`,
              },
            ]}
          >
            <FontAwesome
              name={current.icon}
              size={30}
              color={current.color}
            />
          </View>

          {/* INFORMACIÓN */}

          <View
            style={
              styles.sectionPremiumInfo
            }
          >
            <Text
              style={
                styles.sectionPremiumEyebrow
              }
            >
              {section === 'playlist'
                ? 'PLAYLIST'
                : 'COLECCIÓN'}
            </Text>

            <Text
              style={
                styles.sectionPremiumTitle
              }
              numberOfLines={2}
            >
              {current.title}
            </Text>

            <Text
              style={
                styles.sectionPremiumSubtitle
              }
            >
              {current.subtitle}
            </Text>

            <View
              style={
                styles.sectionPremiumStats
              }
            >
              <View
                style={
                  styles.sectionPremiumBadge
                }
              >
                <Text
                  style={[
                    styles.sectionPremiumBadgeText,
                    {
                      color:
                        current.color,
                    },
                  ]}
                >
                  {current.count}
                </Text>

                <Text
                  style={
                    styles.sectionPremiumBadgeLabel
                  }
                >
                  {current.count ===
                    1
                    ? 'canción'
                    : 'canciones'}
                </Text>
              </View>

              {section ===
                'playlist' && (
                  <TouchableOpacity
                    style={[
                      styles.playAllButton,
                      {
                        backgroundColor:
                          current.color,
                      },
                    ]}
                    activeOpacity={0.82}
                    onPress={() => {
                      if (
                        sectionTracks.length >
                        0
                      ) {
                        handlePlayTrack(
                          sectionTracks[0],
                        );
                      }
                    }}
                  >
                    <FontAwesome
                      name="play"
                      size={13}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.playAllButtonText
                      }
                    >
                      Reproducir
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        </View>

        {/* =================================
            LISTA
        ================================= */}

        <View
          style={styles.trackListContainer}
        >
          {sectionTracks.length > 0 ? (
            <FlatList
              data={sectionTracks}
              keyExtractor={(item) =>
                item.id
              }
              renderItem={
                renderTrackItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.trackListContent
              }
              scrollEnabled={
                !draggedTrackId
              }
              removeClippedSubviews={
                false
              }
            />
          ) : (
            <View
              style={
                styles.premiumEmptyState
              }
            >
              <View
                style={[
                  styles.premiumEmptyIcon,
                  {
                    backgroundColor:
                      `${current.color}14`,
                    borderColor:
                      `${current.color}25`,
                  },
                ]}
              >
                <FontAwesome
                  name={
                    current.icon
                  }
                  size={27}
                  color={
                    current.color
                  }
                />
              </View>

              <Text
                style={
                  styles.premiumEmptyTitle
                }
              >
                {section ===
                  'favorites'
                  ? 'Todavía no tienes favoritos'
                  : section ===
                    'downloaded'
                    ? 'No tienes descargas'
                    : section ===
                      'local'
                      ? 'No hay archivos locales'
                      : 'Esta playlist está vacía'}
              </Text>

              <Text
                style={
                  styles.premiumEmptyText
                }
              >
                {section ===
                  'favorites'
                  ? 'Pulsa el corazón en cualquier canción para guardarla aquí.'
                  : section ===
                    'downloaded'
                    ? 'Las canciones descargadas aparecerán aquí para escucharlas sin conexión.'
                    : section ===
                      'local'
                      ? 'Añade archivos de audio desde tu dispositivo.'
                      : 'Añade canciones para empezar a llenar esta playlist.'}
              </Text>

              {section ===
                'local' && (
                  <TouchableOpacity
                    style={[
                      styles.premiumEmptyButton,
                      {
                        backgroundColor:
                          current.color,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={
                      handleLocalFiles
                    }
                  >
                    <FontAwesome
                      name="folder-open"
                      size={14}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.premiumEmptyButtonText
                      }
                    >
                      Añadir archivos
                    </Text>
                  </TouchableOpacity>
                )}

              {section ===
                'playlist' && (
                  <TouchableOpacity
                    style={[
                      styles.premiumEmptyButton,
                      {
                        backgroundColor:
                          current.color,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedTrackIds(
                        [],
                      );

                      setShowAddSongs(
                        true,
                      );
                    }}
                  >
                    <FontAwesome
                      name="plus"
                      size={14}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.premiumEmptyButtonText
                      }
                    >
                      Añadir canciones
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  // =========================
  // LOADING
  // =========================

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.centered}
        >
          <ActivityIndicator
            size="large"
            color="#FF5500"
          />
        </View>
      </SafeAreaView>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <>
      {/* CREAR / RENOMBRAR PLAYLIST */}

      <Modal
        visible={
          showCreatePlaylist
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowCreatePlaylist(
            false,
          )
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={
              styles.modalContainer
            }
          >
            <Text
              style={styles.modalTitle}
            >
              {editingPlaylist
                ? 'Renombrar playlist'
                : 'Nueva playlist'}
            </Text>

            <Text
              style={
                styles.modalSubtitle
              }
            >
              Dale un nombre a tu nueva
              playlist
            </Text>

            <TextInput
              value={playlistName}
              onChangeText={
                setPlaylistName
              }
              placeholder="Nombre de la playlist"
              placeholderTextColor="#777777"
              autoFocus
              style={styles.modalInput}
              selectionColor="#FF5500"
            />

            <View
              style={
                styles.modalButtons
              }
            >
              <TouchableOpacity
                style={
                  styles.modalCancelButton
                }
                onPress={() =>
                  setShowCreatePlaylist(
                    false,
                  )
                }
              >
                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.modalCreateButton
                }
                onPress={
                  editingPlaylist
                    ? handleRenamePlaylist
                    : handleConfirmCreatePlaylist
                }
              >
                <Text
                  style={
                    styles.modalCreateText
                  }
                >
                  {editingPlaylist
                    ? 'Guardar'
                    : 'Crear'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MENÚ PLAYLIST */}

      <Modal
        visible={
          menuPlaylist !== null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMenuPlaylist(null)
        }
      >
        <TouchableOpacity
          style={
            styles.playlistMenuOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setMenuPlaylist(null)
          }
        >
          <View
            style={
              styles.playlistMenu
            }
          >
            <Text
              style={
                styles.playlistMenuTitle
              }
            >
              {menuPlaylist?.name}
            </Text>

            <TouchableOpacity
              style={
                styles.playlistMenuOption
              }
              onPress={() => {
                if (!menuPlaylist) {
                  return;
                }

                setEditingPlaylist(
                  menuPlaylist,
                );

                setPlaylistName(
                  menuPlaylist.name,
                );

                setMenuPlaylist(null);
                setShowCreatePlaylist(
                  true,
                );
              }}
            >
              <FontAwesome
                name="pencil"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.playlistMenuOptionText
                }
              >
                Renombrar playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.playlistMenuOption
              }
              onPress={
                handleDeletePlaylist
              }
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
              style={
                styles.playlistCancelButton
              }
              onPress={() =>
                setMenuPlaylist(null)
              }
            >
              <Text
                style={
                  styles.playlistCancelText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AÑADIR CANCIONES */}

      <Modal
        visible={showAddSongs}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddSongs(false);
          setSelectedTrackIds(
            [],
          );
        }}
      >
        <View
          style={
            styles.addSongsOverlay
          }
        >
          <View
            style={
              styles.addSongsContainer
            }
          >
            <View
              style={
                styles.addSongsHeader
              }
            >
              <Text
                style={
                  styles.addSongsTitle
                }
              >
                Añadir canciones
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowAddSongs(
                    false,
                  );

                  setSelectedTrackIds(
                    [],
                  );
                }}
              >
                <Text
                  style={
                    styles.addSongsClose
                  }
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.addSongsSubtitle
              }
            >
              Selecciona las canciones
              que quieres añadir
            </Text>

            <FlatList
              data={tracks}
              keyExtractor={(item) =>
                item.id
              }
              showsVerticalScrollIndicator={
                false
              }
              renderItem={({
                item,
              }) => {
                const isSelected =
                  selectedTrackIds.includes(
                    item.id,
                  );

                return (
                  <TouchableOpacity
                    style={[
                      styles.addSongItem,
                      isSelected &&
                      styles.addSongItemSelected,
                    ]}
                    onPress={() =>
                      toggleTrackSelection(
                        item.id,
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{
                        uri: item.coverUrl,
                      }}
                      style={
                        styles.addSongCover
                      }
                    />

                    <View
                      style={
                        styles.addSongInfo
                      }
                    >
                      <Text
                        style={
                          styles.addSongTitle
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {item.title}
                      </Text>

                      <Text
                        style={
                          styles.addSongArtist
                        }
                        numberOfLines={
                          1
                        }
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
                        <Text
                          style={
                            styles.addSongCheckText
                          }
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View
                  style={
                    styles.centered
                  }
                >
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    No tienes canciones en
                    tu biblioteca.
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={[
                styles.confirmAddSongsButton,
                selectedTrackIds.length ===
                0 &&
                styles.confirmAddSongsButtonDisabled,
              ]}
              disabled={
                selectedTrackIds.length ===
                0
              }
              onPress={
                handleAddSongsToPlaylist
              }
            >
              <Text
                style={
                  styles.confirmAddSongsText
                }
              >
                Añadir{' '}
                {selectedTrackIds.length >
                  0
                  ? `(${selectedTrackIds.length})`
                  : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MENÚ ORDENAR */}

      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowSortMenu(false)
        }
      >
        <TouchableOpacity
          style={
            styles.sortMenuOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setShowSortMenu(false)
          }
        >
          <View
            style={styles.sortMenu}
          >
            <Text
              style={
                styles.sortMenuTitle
              }
            >
              Ordenar canciones
            </Text>

            <TouchableOpacity
              style={
                styles.sortMenuOption
              }
              onPress={() => {
                setSortOrder(
                  'recent',
                );
                setShowSortMenu(false);
              }}
            >
              <Text
                style={
                  styles.sortMenuIcon
                }
              >
                ◷
              </Text>

              <Text
                style={
                  styles.sortMenuOptionText
                }
              >
                Más recientes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.sortMenuOption
              }
              onPress={() => {
                setSortOrder(
                  'oldest',
                );
                setShowSortMenu(false);
              }}
            >
              <Text
                style={
                  styles.sortMenuIcon
                }
              >
                ◴
              </Text>

              <Text
                style={
                  styles.sortMenuOptionText
                }
              >
                Más antiguas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.sortMenuOption
              }
              onPress={() => {
                setSortOrder(
                  'titleAsc',
                );
                setShowSortMenu(false);
              }}
            >
              <Text
                style={
                  styles.sortMenuIcon
                }
              >
                A
              </Text>

              <Text
                style={
                  styles.sortMenuOptionText
                }
              >
                Título A → Z
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.sortMenuOption
              }
              onPress={() => {
                setSortOrder(
                  'titleDesc',
                );
                setShowSortMenu(false);
              }}
            >
              <Text
                style={
                  styles.sortMenuIcon
                }
              >
                Z
              </Text>

              <Text
                style={
                  styles.sortMenuOptionText
                }
              >
                Título Z → A
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.sortMenuOption
              }
              onPress={() => {
                setSortOrder(
                  'artistAsc',
                );
                setShowSortMenu(false);
              }}
            >
              <Text
                style={
                  styles.sortMenuIcon
                }
              >
                ♪
              </Text>

              <Text
                style={
                  styles.sortMenuOptionText
                }
              >
                Artista A → Z
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.sortCancelButton
              }
              onPress={() =>
                setShowSortMenu(false)
              }
            >
              <Text
                style={
                  styles.sortCancelText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SafeAreaView
        style={styles.container}
      >
        {section === 'home'
          ? renderHome()
          : renderSection()}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({

  /* =========================================================
     BASE
     ========================================================= */

  container: {
    flex: 1,
    backgroundColor: '#15171F',
  },

  homeContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '900',
    letterSpacing: -1.4,
    lineHeight: 40,
  },

  sectionSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 6,
  },


  /* =========================================================
     HOME — GRID
     ========================================================= */

  grid: {
    width: '100%',

    flexDirection: 'row',
    flexWrap: 'wrap',

    justifyContent: 'space-between',

    margin: 0,
    padding: 0,
  },


  /* =========================================================
     HOME — TARJETAS
     ========================================================= */

  squareCard: {
    height: 195,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',

    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 5,
  },

  homeCardIconGlow: {
    position: 'absolute',
    width: 125,
    height: 125,
    borderRadius: 63,
    top: -28,
    right: -25,
  },

  homeCardIconContainer: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,

    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',

    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  homeCardIcon: {
    color: '#FFFFFF',
  },

  homeCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  homeCardSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 5,
    lineHeight: 15,
  },

  likesCard: {
    backgroundColor: '#63162D',
    borderColor: 'rgba(255, 70, 110, 0.60)',
  },

  downloadsCard: {
    backgroundColor: '#70330D',
    borderColor: 'rgba(255, 145, 45, 0.60)',
  },

  playlistCard: {
    backgroundColor: '#421B73',
    borderColor: 'rgba(180, 100, 255, 0.60)',
  },

  localCard: {
    backgroundColor: '#124858',
    borderColor: 'rgba(55, 215, 245, 0.60)',
  },


  /* =========================================================
     DECORACIÓN GENERAL
     ========================================================= */

  cardGlow: {
    position: 'absolute',

    width: 105,
    height: 105,

    borderRadius: 53,

    right: -42,
    top: -42,

    backgroundColor: 'rgba(255,255,255,0.045)',
  },


  /* =========================================================
     CARD HEADER
     ========================================================= */

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    zIndex: 5,
  },

  cardIconCircle: {
    width: 48,
    height: 48,

    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(0,0,0,0.20)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  cardIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  cardArrow: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 19,
    fontWeight: '700',
  },


  /* =========================================================
     CARD TEXT
     ========================================================= */

  cardBottom: {
    position: 'absolute',

    left: 17,
    right: 17,
    bottom: 17,

    zIndex: 8,
  },

  squareTitle: {
    color: '#FFFFFF',

    fontSize: 17,
    fontWeight: '900',

    letterSpacing: -0.4,
  },

  squareSubtitle: {
    color: 'rgba(255,255,255,0.54)',

    fontSize: 12.5,
    fontWeight: '600',

    marginTop: 5,
  },


  /* =========================================================
     FAVORITOS
     ========================================================= */

  backgroundSymbol: {
    position: 'absolute',

    right: -9,
    top: 58,

    color: 'rgba(255,255,255,0.055)',

    fontSize: 105,
    fontWeight: '900',

    zIndex: 1,
  },

  favoriteDecoration: {
    position: 'absolute',

    right: -30,
    top: 57,

    width: 135,
    height: 135,

    borderRadius: 68,

    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  favoriteDecorationText: {
    color: 'rgba(255,255,255,0.07)',
    fontSize: 100,
    fontWeight: '900',
  },


  /* =========================================================
     DESCARGADAS
     ========================================================= */

  downloadLines: {
    position: 'absolute',

    right: 19,
    top: 76,

    width: 80,

    opacity: 0.42,

    zIndex: 1,
  },

  downloadLine: {
    height: 1,

    marginBottom: 9,

    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  downloadDecoration: {
    position: 'absolute',

    right: -25,
    top: 51,

    width: 135,
    height: 135,

    borderRadius: 68,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  downloadCircle: {
    width: 88,
    height: 88,

    borderRadius: 44,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(0,0,0,0.08)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  downloadBigIcon: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 40,
    fontWeight: '300',
  },


  /* =========================================================
     CREAR PLAYLIST
     ========================================================= */

  albumBackOne: {
    position: 'absolute',

    width: 82,
    height: 82,

    borderRadius: 19,

    right: 31,
    top: 61,

    backgroundColor: '#282828',

    transform: [
      {
        rotate: '-11deg',
      },
    ],

    zIndex: 1,
  },

  albumBackTwo: {
    position: 'absolute',

    width: 82,
    height: 82,

    borderRadius: 19,

    right: 24,
    top: 66,

    backgroundColor: '#202020',

    transform: [
      {
        rotate: '6deg',
      },
    ],

    zIndex: 2,
  },

  albumMain: {
    position: 'absolute',

    width: 82,
    height: 82,

    borderRadius: 19,

    right: 17,
    top: 70,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 6,

    zIndex: 3,
  },

  albumMainIcon: {
    color: '#FFFFFF',

    fontSize: 31,
    fontWeight: '300',
  },

  playlistDecoration: {
    position: 'absolute',

    right: 10,
    top: 45,

    width: 125,
    height: 125,

    alignItems: 'center',
    justifyContent: 'center',
  },

  playlistDiscBack: {
    position: 'absolute',

    width: 98,
    height: 98,

    borderRadius: 20,

    backgroundColor: '#292929',

    transform: [
      {
        rotate: '12deg',
      },
    ],
  },

  playlistDisc: {
    width: 98,
    height: 98,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FF5500',
  },

  playlistDiscInner: {
    width: 39,
    height: 39,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(0,0,0,0.20)',
  },

  playlistPlus: {
    color: '#FFFFFF',

    fontSize: 28,
    fontWeight: '300',
  },

  cardArrowPlaylist: {
    position: 'absolute',

    right: 17,
    bottom: 17,

    color: '#FF5500',

    fontSize: 23,
    fontWeight: '800',

    zIndex: 10,
  },


  /* =========================================================
     ARCHIVOS LOCALES
     ========================================================= */

  localGrid: {
    position: 'absolute',

    right: 19,
    top: 72,

    width: 78,
    height: 78,

    flexDirection: 'row',
    flexWrap: 'wrap',

    justifyContent: 'space-between',
    alignContent: 'space-between',

    opacity: 0.40,

    zIndex: 1,
  },

  localGridDot: {
    width: 31,
    height: 31,

    borderRadius: 9,

    backgroundColor: 'rgba(255,255,255,0.12)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  localOrb: {
    position: 'absolute',

    right: -35,
    top: 50,

    width: 140,
    height: 140,

    borderRadius: 70,

    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  localDecoration: {
    position: 'absolute',

    right: 8,
    top: 47,

    width: 130,
    height: 130,

    alignItems: 'center',
    justifyContent: 'center',
  },

  localFolder: {
    width: 110,
    height: 78,

    position: 'relative',
  },

  localFolderTab: {
    position: 'absolute',

    left: 5,
    top: 0,

    width: 42,
    height: 18,

    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,

    backgroundColor: '#3C555C',
  },

  localFolderBody: {
    position: 'absolute',

    left: 0,
    right: 0,
    bottom: 0,

    height: 65,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#2B4248',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  localFolderIcon: {
    color: 'rgba(255,255,255,0.65)',

    fontSize: 34,
    fontWeight: '700',
  },


  /* =========================================================
     PLAYLISTS — CABECERA
     ========================================================= */

  playlistsHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 38,
    marginBottom: 16,
  },

  playlistsTitle: {
    color: '#FFFFFF',

    fontSize: 24,
    fontWeight: '900',

    letterSpacing: -0.7,
  },

  playlistsSubtitle: {
    color: '#626262',

    fontSize: 12,

    marginTop: 3,

    fontWeight: '500',
  },

  playlistCount: {
    width: 36,
    height: 36,

    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 'auto',

    backgroundColor: '#151515',

    borderWidth: 1,
    borderColor: '#242424',
  },

  playlistCountText: {
    color: '#A0A0A0',

    fontSize: 13,
    fontWeight: '800',
  },

  playlistsGrid: {
    width: '100%',

    gap: 10,

    alignSelf: 'stretch',
  },


  /* =========================================================
     PLAYLIST ITEM
     ========================================================= */

  playlistItem: {
    width: '100%',

    minHeight: 82,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,
    paddingVertical: 9,

    borderRadius: 20,

    backgroundColor: '#151218',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.07)',
  },

  playlistCover: {
    width: 64,
    height: 64,

    borderRadius: 17,

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',

    backgroundColor: '#271D3B',

    borderWidth: 1,
    borderColor:
      'rgba(165,105,255,0.22)',

    shadowColor: '#985DFF',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  playlistCoverGlow: {
    position: 'absolute',

    width: 80,
    height: 80,

    borderRadius: 40,

    right: -30,
    top: -30,

    backgroundColor:
      'rgba(175,105,255,0.30)',
  },

  playlistCoverIcon: {
    color: '#FF5500',

    fontSize: 39,
    fontWeight: '800',
  },

  playlistInfo: {
    flex: 1,

    justifyContent: 'center',

    marginLeft: 14,

    paddingRight: 42,
  },

  playlistName: {
    color: '#FFFFFF',

    fontSize: 16,
    fontWeight: '800',

    letterSpacing: -0.2,
  },

  playlistSongs: {
    color: '#626262',

    fontSize: 12,

    marginTop: 5,

    fontWeight: '500',
  },


  playlistMenuButton: {
    position: 'absolute',

    right: 8,
    top: 23,

    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',
  },


  /* =========================================================
     PLAYLISTS VACÍAS
     ========================================================= */

  emptyPlaylists: {
    alignItems: 'center',

    paddingHorizontal: 22,
    paddingVertical: 31,

    borderRadius: 23,

    backgroundColor: '#101010',

    borderWidth: 1,
    borderColor: '#1E1E1E',

    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 5,
  },

  emptyPlaylistIconContainer: {
    width: 56,
    height: 56,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 13,

    backgroundColor: 'rgba(255,85,0,0.08)',

    borderWidth: 1,
    borderColor: 'rgba(255,85,0,0.20)',
  },

  emptyPlaylistIcon: {
    color: '#FF5500',

    fontSize: 32,

    marginBottom: 10,
  },

  emptyPlaylistTitle: {
    color: '#FFFFFF',

    fontSize: 17,
    fontWeight: '800',

    textAlign: 'center',
  },

  emptyPlaylistText: {
    color: '#707070',

    fontSize: 13,

    marginTop: 7,

    textAlign: 'center',

    lineHeight: 19,
  },

  createButton: {
    backgroundColor: '#FF5500',

    borderRadius: 24,

    paddingHorizontal: 23,
    paddingVertical: 12,

    marginTop: 20,

    shadowColor: '#FF5500',
    shadowOpacity: 0.22,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 6,
  },

  createButtonText: {
    color: '#FFFFFF',

    fontSize: 14,
    fontWeight: '800',
  },


  /* =========================================================
     SECCIÓN
     ========================================================= */

  sectionContainer: {
    flex: 1,

    backgroundColor: '#080808',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 15,
  },

  backButton: {
    width: 40,
    height: 40,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.07)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  backButtonText: {
    color: '#FFFFFF',

    fontSize: 32,
    lineHeight: 35,

    marginTop: -3,
  },

  sectionTitleRow: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    flex: 1,

    color: '#FFFFFF',

    fontSize: 25,
    fontWeight: '900',

    letterSpacing: -0.7,
  },

  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 125,
  },


  /* =========================================================
     CANCIÓN
     ========================================================= */

  trackCard: {
    width: '100%',

    minHeight: 82,

    marginBottom: 9,

    paddingHorizontal: 10,
    paddingVertical: 10,

    borderRadius: 19,

    backgroundColor: '#111111',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.055)',

    overflow: 'visible',

    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  trackContent: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',
  },

  coverImage: {
    width: 60,
    height: 60,

    borderRadius: 14,

    backgroundColor: '#1D1D1D',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  trackInfo: {
    flex: 1,

    minWidth: 0,

    marginLeft: 12,

    justifyContent: 'center',

    paddingRight: 8,
  },

  title: {
    color: '#FFFFFF',

    fontSize: 13.5,
    fontWeight: '800',

    letterSpacing: -0.2,
  },

  artist: {
    color:
      'rgba(255,255,255,0.43)',

    fontSize: 11,

    fontWeight: '500',

    marginTop: 4,
  },


  /* =========================================================
     BADGES
     ========================================================= */

  downloadBadge: {
    alignSelf: 'flex-start',

    marginTop: 6,

    paddingHorizontal: 7,
    paddingVertical: 3,

    borderRadius: 6,

    backgroundColor: 'rgba(255,85,0,0.09)',

    borderWidth: 1,
    borderColor: 'rgba(255,85,0,0.50)',
  },

  downloadBadgeText: {
    color: '#FF6A22',

    fontSize: 8.5,
    fontWeight: '800',

    letterSpacing: 0.8,
  },

  downloadingBadge: {
    backgroundColor: 'rgba(255,174,0,0.09)',
    borderColor: 'rgba(255,174,0,0.50)',
  },

  downloadingBadgeText: {
    color: '#FF7A3D',
  },

  localBadge: {
    alignSelf: 'flex-start',

    marginTop: 5,

    paddingHorizontal: 7,
    paddingVertical: 2.5,

    borderRadius: 6,

    backgroundColor:
      'rgba(55,190,225,0.12)',
  },

  localBadgeText: {
    color: '#55CDE8',

    fontSize: 7.5,

    fontWeight: '900',

    letterSpacing: 0.7,
  },


  /* =========================================================
     ACCIONES
     ========================================================= */

  actions: {
    flexDirection: 'row',

    alignItems: 'center',

    marginLeft: 4,
  },

  actionButton: {
    width: 36,
    height: 36,

    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.035)',

    marginLeft: 3,
  },

  /* =========================================================
     EMPTY
     ========================================================= */

  centered: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 30,
    paddingTop: 60,
  },

  emptyIcon: {
    color: '#FF5500',

    fontSize: 44,

    marginBottom: 12,
  },

  emptyText: {
    color: '#929292',

    fontSize: 15,

    textAlign: 'center',

    lineHeight: 21,
  },


  /* =========================================================
     MODAL — PLAYLIST
     ========================================================= */

  modalOverlay: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 20,

    backgroundColor: 'rgba(0,0,0,0.82)',
  },

  modalContainer: {
    width: '100%',

    padding: 24,

    borderRadius: 26,

    backgroundColor: '#121212',

    borderWidth: 1,
    borderColor: '#292929',

    shadowColor: '#000000',
    shadowOpacity: 0.60,
    shadowRadius: 25,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 15,
  },

  modalTitle: {
    color: '#FFFFFF',

    fontSize: 23,
    fontWeight: '900',

    letterSpacing: -0.5,
  },

  modalSubtitle: {
    color: '#808080',

    fontSize: 14,

    marginTop: 7,
    marginBottom: 21,

    lineHeight: 19,
  },

  modalInput: {
    color: '#FFFFFF',

    fontSize: 16,

    paddingHorizontal: 15,
    paddingVertical: 14,

    borderRadius: 14,

    backgroundColor: '#1C1C1C',

    borderWidth: 1,
    borderColor: '#292929',
  },

  modalButtons: {
    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'flex-end',

    marginTop: 23,

    gap: 9,
  },

  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,

    borderRadius: 21,
  },

  modalCancelText: {
    color: '#999999',

    fontSize: 14,
    fontWeight: '700',
  },

  modalCreateButton: {
    paddingHorizontal: 21,
    paddingVertical: 11,

    borderRadius: 22,

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  modalCreateText: {
    color: '#FFFFFF',

    fontSize: 14,
    fontWeight: '800',
  },


  /* =========================================================
     AÑADIR CANCIONES
     ========================================================= */

  addSongsButton: {
    width: 43,
    height: 43,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 'auto',

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  addSongsButtonText: {
    color: '#FFFFFF',

    fontSize: 25,
    fontWeight: '500',
  },

  addSongsOverlay: {
    flex: 1,

    justifyContent: 'flex-end',

    backgroundColor: 'rgba(0,0,0,0.80)',
  },

  addSongsContainer: {
    height: '72%',

    padding: 20,

    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,

    backgroundColor: '#101010',

    borderTopWidth: 1,
    borderColor: '#292929',

    shadowColor: '#000000',
    shadowOpacity: 0.60,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: -5,
    },

    elevation: 15,
  },

  addSongsHeader: {
    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addSongsTitle: {
    color: '#FFFFFF',

    fontSize: 23,
    fontWeight: '900',

    letterSpacing: -0.4,
  },

  addSongsClose: {
    color: '#909090',

    fontSize: 20,

    padding: 7,
  },

  addSongsSubtitle: {
    color: '#707070',

    fontSize: 14,

    marginTop: 5,
    marginBottom: 19,
  },

  addSongItem: {
    flexDirection: 'row',

    alignItems: 'center',

    padding: 10,

    marginBottom: 8,

    borderRadius: 16,

    backgroundColor: '#171717',

    borderWidth: 1,
    borderColor: '#222222',
  },

  addSongItemSelected: {
    backgroundColor: 'rgba(255,85,0,0.075)',

    borderColor: 'rgba(255,85,0,0.55)',
  },

  addSongCover: {
    width: 50,
    height: 50,

    borderRadius: 9,

    backgroundColor: '#222222',
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
    color: '#737373',

    fontSize: 13,

    marginTop: 3,
  },

  addSongCheck: {
    width: 25,
    height: 25,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 10,

    borderWidth: 2,
    borderColor: '#454545',
  },

  addSongCheckSelected: {
    backgroundColor: '#FF5500',

    borderColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 3,
  },

  addSongCheckText: {
    color: '#FFFFFF',

    fontSize: 14,
    fontWeight: '900',
  },

  confirmAddSongsButton: {
    height: 50,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 12,
    marginBottom: 30,

    borderRadius: 25,

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.25,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  confirmAddSongsButtonDisabled: {
    backgroundColor: '#292929',

    shadowOpacity: 0,

    elevation: 0,
  },

  confirmAddSongsText: {
    color: '#FFFFFF',

    fontSize: 15,
    fontWeight: '800',
  },


  /* =========================================================
     ARCHIVOS LOCALES — BOTÓN
     ========================================================= */

  addLocalButton: {
    width: 43,
    height: 43,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  addLocalButtonText: {
    color: '#FFFFFF',

    fontSize: 28,
    fontWeight: '300',

    lineHeight: 30,
  },


  /* =========================================================
     MENÚ PLAYLIST
     ========================================================= */


  playlistMenuOverlay: {
    flex: 1,

    justifyContent: 'flex-end',

    paddingBottom: 24,

    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  playlistMenu: {
    marginHorizontal: 12,

    padding: 21,
    paddingBottom: 25,

    borderRadius: 26,

    backgroundColor: '#131313',

    borderWidth: 1,
    borderColor: '#292929',

    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 12,
  },

  playlistMenuTitle: {
    color: '#FFFFFF',

    fontSize: 21,
    fontWeight: '900',

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
    height: 51,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 10,

    borderRadius: 15,

    backgroundColor: '#202020',

    borderWidth: 1,
    borderColor: '#292929',
  },

  playlistCancelText: {
    color: '#FFFFFF',

    fontSize: 16,
    fontWeight: '700',
  },


  /* =========================================================
     ORDENAR
     ========================================================= */

  sortButton: {
    width: 41,
    height: 41,

    borderRadius: 21,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 6,
  },

  sortIcon: {
    color: '#A0A0A0',

    fontSize: 23,
    fontWeight: '400',
  },

  sortMenuOverlay: {
    flex: 1,

    justifyContent: 'flex-end',

    paddingBottom: 24,

    backgroundColor: 'rgba(0,0,0,0.75)',
  },

  sortMenu: {
    marginHorizontal: 12,

    padding: 21,
    paddingBottom: 25,

    borderRadius: 26,

    backgroundColor: '#131313',

    borderWidth: 1,
    borderColor: '#292929',

    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 12,
  },

  sortMenuTitle: {
    color: '#FFFFFF',

    fontSize: 21,
    fontWeight: '900',

    marginBottom: 14,
  },

  sortMenuOption: {
    height: 52,

    flexDirection: 'row',

    alignItems: 'center',
  },

  sortMenuIcon: {
    width: 32,

    color: '#A0A0A0',

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
    height: 51,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 10,

    borderRadius: 15,

    backgroundColor: '#202020',

    borderWidth: 1,
    borderColor: '#292929',
  },

  sortCancelText: {
    color: '#FFFFFF',

    fontSize: 16,
    fontWeight: '700',
  },

  /* =========================================================
   SECCIÓN — NUEVA CABECERA PREMIUM
   ========================================================= */

  sectionHeaderContent: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',

    minWidth: 0,
  },

  sectionHeaderIcon: {
    width: 43,
    height: 43,

    borderRadius: 15,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,

    backgroundColor: '#171717',

    borderWidth: 1,
    borderColor: '#292929',
  },

  sectionHeaderText: {
    flex: 1,

    minWidth: 0,
  },

  sectionSubtitleInside: {
    color: '#666666',

    fontSize: 11.5,
    fontWeight: '500',

    marginTop: 2,
  },

  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',

    marginLeft: 7,
  },

  headerActionButton: {
    width: 40,
    height: 40,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,

    backgroundColor: '#151515',

    borderWidth: 1,
    borderColor: '#242424',
  },

  headerActionButtonOrange: {
    width: 40,
    height: 40,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    marginLeft: 5,

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },


  /* =========================================================
     SECTION HERO
     ========================================================= */

  sectionHero: {
    marginHorizontal: 18,
    marginBottom: 7,

    minHeight: 104,

    padding: 17,

    borderRadius: 23,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    overflow: 'hidden',

    backgroundColor: '#111111',

    borderWidth: 1,
    borderColor: '#202020',
  },

  sectionHeroFavorites: {
    backgroundColor: '#271016',

    borderColor: '#421923',
  },

  sectionHeroDownloads: {
    backgroundColor: '#29170F',

    borderColor: '#442317',
  },

  sectionHeroLocal: {
    backgroundColor: '#101C20',

    borderColor: '#1D3035',
  },

  sectionHeroPlaylist: {
    backgroundColor: '#151313',

    borderColor: '#292424',
  },

  sectionHeroLeft: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',

    minWidth: 0,
  },

  sectionHeroIcon: {
    width: 61,
    height: 61,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 13,

    backgroundColor: 'rgba(0,0,0,0.22)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },

  sectionHeroInfo: {
    flex: 1,

    minWidth: 0,
  },

  sectionHeroTitle: {
    color: '#FFFFFF',

    fontSize: 18,
    fontWeight: '900',

    letterSpacing: -0.4,
  },

  sectionHeroSubtitle: {
    color: '#898989',

    fontSize: 12,

    marginTop: 5,

    fontWeight: '600',
  },

  sectionHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 9,
    paddingVertical: 6,

    borderRadius: 10,

    marginLeft: 8,

    backgroundColor: 'rgba(0,0,0,0.20)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  sectionHeroBadgeText: {
    color: '#858585',

    fontSize: 8.5,
    fontWeight: '900',

    letterSpacing: 0.8,

    marginLeft: 5,
  },


  /* =========================================================
     LIST HEADER
     ========================================================= */

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingTop: 12,
    paddingBottom: 6,

    marginBottom: 1,
  },

  listHeaderTitle: {
    flex: 1,

    color: '#6F6F6F',

    fontSize: 11,
    fontWeight: '800',

    textTransform: 'uppercase',

    letterSpacing: 1.1,
  },

  listHeaderHint: {
    color: '#4F4F4F',

    fontSize: 10,

    fontWeight: '500',
  },

  listHeaderCount: {
    color: '#555555',

    fontSize: 11,
    fontWeight: '700',
  },


  /* =========================================================
     EMPTY STATE
     ========================================================= */

  emptyIconContainer: {
    width: 66,
    height: 66,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 15,

    backgroundColor: 'rgba(255,85,0,0.08)',

    borderWidth: 1,
    borderColor: 'rgba(255,85,0,0.20)',
  },

  emptyTitle: {
    color: '#FFFFFF',

    fontSize: 18,
    fontWeight: '900',

    textAlign: 'center',

    letterSpacing: -0.3,
  },

  emptyActionButton: {
    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 19,
    height: 45,

    marginTop: 19,

    borderRadius: 23,

    backgroundColor: '#FF5500',

    shadowColor: '#FF5500',
    shadowOpacity: 0.20,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  emptyActionText: {
    color: '#FFFFFF',

    fontSize: 13,
    fontWeight: '800',

    marginLeft: 8,
  },

  /* =========================================================
   HOME — HERO
   ========================================================= */

  homeHero: {
    minHeight: 235,
    borderRadius: 29,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: '#171923',
    position: 'relative',
  },

  homeHeroGlowOne: {
    position: 'absolute',
    width: 330,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 85, 0, 0.14)',
    top: -55,
    right: -70,
    transform: [
      {
        rotate: '-12deg',
      },
    ],
  },

  homeHeroGlowTwo: {
    position: 'absolute',
    width: 280,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(150, 65, 255, 0.11)',
    bottom: -55,
    left: -80,
    transform: [
      {
        rotate: '10deg',
      },
    ],
  },

  homeHeroOrb: {
    position: 'absolute',

    width: 110,
    height: 110,

    borderRadius: 55,

    right: 38,
    bottom: 17,

    backgroundColor: 'rgba(255,255,255,0.025)',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  homeEyebrow: {
    color: '#FF7040',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 7,
  },

  homeHeroBottom: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 14,
  },

  homeHeroNumber: {
    color: '#FFFFFF',

    fontSize: 20,
    fontWeight: '900',

    letterSpacing: -0.5,
  },

  homeHeroLabel: {
    color: 'rgba(255,255,255,0.48)',

    fontSize: 10.5,
    fontWeight: '600',

    marginTop: 2,
  },

  homeHeroDivider: {
    width: 1,
    height: 29,

    marginHorizontal: 19,

    backgroundColor:
      'rgba(255,255,255,0.10)',
  },

  homeHeroMusic: {
    width: 42,
    height: 42,

    borderRadius: 21,

    marginLeft: 'auto',

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.08)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.10)',
  },

  homeCardWrapper: {
    width: '48%',
    marginBottom: 12,
  },

  playlistsSection: {
    marginTop: 8,
  },

  cardColorGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.09)',
    top: -80,
    right: -80,
  },

  cardArrowCircle: {
    width: 29,
    height: 29,

    borderRadius: 15,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.08)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  cardArrowCirclePlaylist: {
    position: 'absolute',

    right: 17,
    bottom: 17,

    width: 29,
    height: 29,

    borderRadius: 15,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(170,110,255,0.55)',
  },

  cardEyebrow: {
    color: 'rgba(255,255,255,0.43)',

    fontSize: 8.5,
    fontWeight: '900',

    letterSpacing: 1.25,

    marginBottom: 4,
  },

  /* =========================================================
   HOME — FAVORITOS
   ========================================================= */

  favoriteIconCircle: {
    backgroundColor:
      'rgba(255,60,100,0.18)',

    borderColor:
      'rgba(255,90,120,0.25)',
  },

  favoriteBigGlow: {
    position: 'absolute',
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: 'rgba(255,45,95,0.22)',
    right: -45,
    top: -40,
  },

  favoriteBigIcon: {
    position: 'absolute',
    right: 18,
    top: 18,
    opacity: 1,
    transform: [
      {
        rotate: '8deg',
      },
    ],
  },

  /* =========================================================
     HOME — DESCARGAS
     ========================================================= */

  downloadIconCircle: {
    backgroundColor:
      'rgba(255,115,35,0.17)',

    borderColor:
      'rgba(255,140,55,0.24)',
  },

  downloadBigGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 130, 20, 0.30)',
    top: -55,
    right: -55,
  },

  downloadDecorLines: {
    position: 'absolute',
    right: 22,
    top: 72,
    transform: [
      {
        rotate: '-18deg',
      },
    ],
  },

  downloadDecorLine: {
    width: 72,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginBottom: 9,
  },


  /* =========================================================
     HOME — PLAYLIST
     ========================================================= */

  playlistColorGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(175, 80, 255, 0.30)',
    top: -60,
    right: -60,
  },

  playlistShapeBack: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: 'rgba(180, 90, 255, 0.20)',
    right: 24,
    top: 28,
    transform: [
      {
        rotate: '12deg',
      },
    ],
  },

  playlistShapeMid: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(180, 90, 255, 0.32)',
    right: 31,
    top: 35,
    transform: [
      {
        rotate: '-7deg',
      },
    ],
  },

  playlistShapeMain: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 21,
    backgroundColor: '#A66BFF',
    right: 38,
    top: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 8,
  },


  /* =========================================================
     HOME — LOCALES
     ========================================================= */

  localIconCircle: {
    backgroundColor:
      'rgba(45,185,225,0.15)',

    borderColor:
      'rgba(70,205,240,0.24)',
  },

  localColorGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(20, 205, 245, 0.28)',
    top: -60,
    right: -60,
  },

  localWaveOne: {
    position: 'absolute',
    width: 150,
    height: 65,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(70,215,245,0.28)',
    right: -35,
    top: 38,
    transform: [
      {
        rotate: '-12deg',
      },
    ],
  },

  localWaveTwo: {
    position: 'absolute',
    width: 120,
    height: 52,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(70,215,245,0.20)',
    right: -20,
    top: 54,
    transform: [
      {
        rotate: '-12deg',
      },
    ],
  },

  emptyPlaylistVisual: {
    width: 90,
    height: 76,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 16,
  },

  emptyPlaylistDiscOne: {
    position: 'absolute',

    width: 58,
    height: 58,

    borderRadius: 18,

    right: 8,
    top: 8,

    backgroundColor: '#302344',

    transform: [
      {
        rotate: '12deg',
      },
    ],
  },

  emptyPlaylistDiscTwo: {
    width: 62,
    height: 62,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#985DFF',

    shadowColor: '#985DFF',
    shadowOpacity: 0.30,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 7,

    transform: [
      {
        rotate: '-7deg',
      },
    ],
  },

  /* =========================================================
   PREMIUM SECTION SCREEN
   ========================================================= */

  sectionScreen: {
    flex: 1,

    paddingHorizontal: 16,
  },

  sectionTopBar: {
    height: 64,

    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 4,
  },



  sectionTopBarTitle: {
    flex: 1,

    marginLeft: 13,
  },

  sectionTopBarSmall: {
    color:
      'rgba(255,255,255,0.38)',

    fontSize: 8.5,
    fontWeight: '900',

    letterSpacing: 1.5,

    marginBottom: 2,
  },

  sectionTopBarMain: {
    color: '#FFFFFF',

    fontSize: 16,
    fontWeight: '800',
  },

  sectionPremiumHero: {
    minHeight: 205,

    borderRadius: 29,

    padding: 20,

    marginBottom: 16,

    overflow: 'hidden',

    borderWidth: 1,

    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionHeroGlow: {
    position: 'absolute',

    width: 220,
    height: 220,

    borderRadius: 110,

    right: -90,
    top: -105,
  },

  sectionHeroGlowSmall: {
    position: 'absolute',

    width: 125,
    height: 125,

    borderRadius: 63,

    left: -65,
    bottom: -70,
  },

  sectionPremiumIcon: {
    width: 92,
    height: 92,

    borderRadius: 26,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,

    shadowColor: '#000000',
    shadowOpacity: 0.30,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 7,
  },

  sectionPremiumInfo: {
    flex: 1,

    marginLeft: 18,

    minWidth: 0,
  },

  sectionPremiumEyebrow: {
    color:
      'rgba(255,255,255,0.40)',

    fontSize: 8.5,
    fontWeight: '900',

    letterSpacing: 1.5,

    marginBottom: 4,
  },

  sectionPremiumTitle: {
    color: '#FFFFFF',

    fontSize: 25,
    fontWeight: '900',

    letterSpacing: -0.7,

    lineHeight: 29,
  },

  sectionPremiumSubtitle: {
    color:
      'rgba(255,255,255,0.47)',

    fontSize: 10.5,
    fontWeight: '600',

    marginTop: 4,

    lineHeight: 15,
  },

  sectionPremiumStats: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 13,
  },

  sectionPremiumBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',

    paddingHorizontal: 10,
    paddingVertical: 6,

    borderRadius: 13,

    backgroundColor:
      'rgba(255,255,255,0.07)',

    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.07)',
  },

  sectionPremiumBadgeText: {
    fontSize: 13,
    fontWeight: '900',
  },

  sectionPremiumBadgeLabel: {
    color:
      'rgba(255,255,255,0.42)',

    fontSize: 9,

    marginLeft: 4,
  },

  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',

    height: 34,

    paddingHorizontal: 13,

    borderRadius: 17,

    marginLeft: 8,
  },

  playAllButtonText: {
    color: '#FFFFFF',

    fontSize: 10.5,
    fontWeight: '900',

    marginLeft: 7,
  },

  trackListContainer: {
    flex: 1,
  },

  trackListContent: {
    paddingBottom: 30,
    paddingTop: 2,
  },

  premiumEmptyState: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 35,

    paddingBottom: 55,
  },

  premiumEmptyIcon: {
    width: 76,
    height: 76,

    borderRadius: 25,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,

    marginBottom: 16,
  },

  premiumEmptyTitle: {
    color: '#FFFFFF',

    fontSize: 17,
    fontWeight: '900',

    textAlign: 'center',

    letterSpacing: -0.3,
  },

  premiumEmptyText: {
    color:
      'rgba(255,255,255,0.42)',

    fontSize: 11.5,
    fontWeight: '500',

    lineHeight: 18,

    textAlign: 'center',

    marginTop: 7,

    maxWidth: 310,
  },

  premiumEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    height: 45,

    paddingHorizontal: 19,

    borderRadius: 23,

    marginTop: 20,
  },

  premiumEmptyButtonText: {
    color: '#FFFFFF',

    fontSize: 12,
    fontWeight: '900',

    marginLeft: 8,
  },

  homeHeroLineOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    right: -105,
    top: -85,
    transform: [
      {
        rotate: '18deg',
      },
    ],
  },

  homeHeroLineTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    right: -70,
    top: -55,
    transform: [
      {
        rotate: '18deg',
      },
    ],
  },

  homeScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },

});

