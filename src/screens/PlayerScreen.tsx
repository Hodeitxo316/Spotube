// src/screens/PlayerScreen.tsx

import React, {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
} from 'react-native';

import FontAwesome from '@react-native-vector-icons/fontawesome';

import TrackPlayer, {
  useActiveTrack,
  useIsPlaying,
  useProgress,
} from 'react-native-track-player';

import { COLORS } from '../constants/theme';

import {
  saveTrackToLibrary,
} from '../services/downloadService';

import {
  LyricLine,
} from '../utils/lrcParser';

import {
  SyncedLyricsView,
} from '../components/SyncedLyricsView';

import {
  setCurrentQueueIndex,
  getPlayerQueue,
  getNextTrack,
  getPreviousTrack,
} from '../services/playerQueue';

import {
  playTrack,
} from '../services/playTrack';

import {
  fetchSyncedLyrics,
} from '../services/lyricsService';

type PlayerScreenProps = {
  onClose: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const PlayerScreen = ({ onClose }: PlayerScreenProps) => {
  const activeTrack = useActiveTrack();
  const { playing } = useIsPlaying();

  const { position, duration } = useProgress(100);

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  /*
   * ============================================================
   * RELOJ REAL DE LAS LETRAS
   * ============================================================
   */

  const [lyricsCurrentTime, setLyricsCurrentTime] =
    useState(0);

  const lyricsBasePositionRef =
    useRef(0);

  const lyricsBaseTimestampRef =
    useRef(Date.now());

  const lyricsTrackIdRef =
    useRef<string | undefined>(undefined);

  const lyricsPlayingRef =
    useRef(playing);

  useEffect(() => {
    lyricsPlayingRef.current =
      playing;
  }, [playing]);

  /*
   * Cada actualización de TrackPlayer vuelve a anclar
   * nuestro reloj visual de las letras.
   */
  useEffect(() => {
    const safePosition =
      Number.isFinite(position)
        ? Math.max(0, position)
        : 0;

    lyricsBasePositionRef.current =
      safePosition;

    lyricsBaseTimestampRef.current =
      Date.now();

    if (!playing) {
      setLyricsCurrentTime(
        safePosition
      );
    }
  }, [
    position,
    playing,
  ]);

  /*
   * Cuando cambia la canción, las letras empiezan
   * inmediatamente desde 0.
   */
  useEffect(() => {
    if (!activeTrack?.id) {
      lyricsTrackIdRef.current =
        undefined;

      lyricsBasePositionRef.current =
        0;

      lyricsBaseTimestampRef.current =
        Date.now();

      setLyricsCurrentTime(0);

      return;
    }

    if (
      lyricsTrackIdRef.current !==
      activeTrack.id
    ) {
      lyricsTrackIdRef.current =
        activeTrack.id;

      lyricsBasePositionRef.current =
        0;

      lyricsBaseTimestampRef.current =
        Date.now();

      setLyricsCurrentTime(0);
    }
  }, [
    activeTrack?.id,
  ]);

  /*
   * Reloj visual de las letras.
   *
   * TrackPlayer actualiza position aproximadamente cada 100 ms.
   * Entre esas actualizaciones avanzamos usando Date.now().
   */
  useEffect(() => {
    if (!playing) {
      return;
    }

    const interval =
      setInterval(() => {
        const elapsed =
          (
            Date.now() -
            lyricsBaseTimestampRef.current
          ) / 1000;

        const nextTime =
          Math.max(
            0,
            lyricsBasePositionRef.current +
            elapsed
          );

        setLyricsCurrentTime(
          nextTime
        );
      }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [
    playing,
  ]);

  const [repeatMode, setRepeatMode] =
    useState<'off' | 'all' | 'one'>('off');

  const [shuffleMode, setShuffleMode] =
    useState(false);

  const [isMenuVisible, setIsMenuVisible] =
    useState(false);

  type SwipePreviewTrack = {
    id?: string;
    title?: string;
    artist?: string;
    artwork?: string;
    duration?: number;
  };

  const [swipePreviewTrack, setSwipePreviewTrack] =
    useState<SwipePreviewTrack | null>(null);

  const shuffleOrderRef = useRef<number[]>([]);
  const shufflePositionRef = useRef(0);
  const skipStartTime = useRef<number | null>(null);
  const skipTrackId = useRef<string | null>(null);
  const autoNextTriggered = useRef(false);
  const isChangingTrack = useRef(false);

  const isSwipeTransitioningRef =
    useRef(false);

  const swipeDirectionRef =
    useRef<'next' | 'previous' | null>(null);

  const activeTrackRef =
    useRef(activeTrack);

  const lyricsRequestRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (activeTrack) {
      activeTrackRef.current =
        activeTrack;
    }
  }, [activeTrack]);

  /*
   * ============================================================
   * LETRAS SINCRONIZADAS
   * ============================================================
   */

  useEffect(() => {
    if (!activeTrack) {
      setLyrics([]);
      setLyricsLoading(false);
      lyricsRequestRef.current = null;
      return;
    }

    const title =
      typeof activeTrack.title === 'string'
        ? activeTrack.title.trim()
        : '';

    const artist =
      typeof activeTrack.artist === 'string'
        ? activeTrack.artist.trim()
        : '';

    if (!title || !artist) {
      setLyrics([]);
      setLyricsLoading(false);
      lyricsRequestRef.current = null;
      return;
    }

    /*
     * Preferimos la duración del propio track.
     * Si todavía no existe, utilizamos la de TrackPlayer.
     */
    const trackDuration =
      typeof activeTrack.duration === 'number' &&
        Number.isFinite(activeTrack.duration) &&
        activeTrack.duration > 0
        ? activeTrack.duration
        : (
          Number.isFinite(duration) &&
            duration > 0
            ? duration
            : 0
        );

    /*
     * La duración forma parte de la clave.
     *
     * Esto es importante:
     *
     * 1. Puede empezar siendo 0.
     * 2. TrackPlayer puede proporcionar la duración unos
     *    instantes después.
     * 3. Cuando aparece la duración real, permitimos una
     *    nueva búsqueda para que lyricsService pueda elegir
     *    una versión más adecuada.
     */
    const normalizedDuration =
      trackDuration > 0
        ? Math.round(trackDuration)
        : 0;

    const requestKey =
      `${activeTrack.id || ''}-${title}-${artist}-${normalizedDuration}`;

    if (
      lyricsRequestRef.current ===
      requestKey
    ) {
      return;
    }

    lyricsRequestRef.current =
      requestKey;

    let cancelled = false;

    setLyrics([]);
    setLyricsLoading(true);

    const loadLyrics = async () => {
      try {
        console.log(
          '[PLAYER LYRICS] 🔎 Buscando:',
          {
            title,
            artist,
            duration: trackDuration,
          }
        );

        const fetchedLyrics =
          await fetchSyncedLyrics(
            title,
            artist,
            trackDuration
          );

        if (cancelled) {
          return;
        }

        console.log(
          '[PLAYER LYRICS] ✅ Letras recibidas:',
          fetchedLyrics.length
        );

        setLyrics(
          Array.isArray(fetchedLyrics)
            ? fetchedLyrics
            : []
        );

        setLyricsLoading(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          '[PLAYER LYRICS] ❌ Error cargando letras:',
          error
        );

        setLyrics([]);
        setLyricsLoading(false);
      }
    };

    loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [
    activeTrack?.id,
    activeTrack?.title,
    activeTrack?.artist,
    duration,
  ]);

  const progressBarWidth =
    useRef(0);

  const durationRef =
    useRef(0);

  durationRef.current =
    duration;

  const isSeeking =
    useRef(false);

  const seekPosition =
    useRef(0);

  const [visualSeekPosition, setVisualSeekPosition] =
    useState<number | null>(null);

  const [trackPositionOverride, setTrackPositionOverride] =
    useState<number | null>(null);

  const waitingForNewTrackPosition =
    useRef(false);

  const swipeX =
    useRef(new Animated.Value(0)).current;

  const swipeY =
    useRef(new Animated.Value(0)).current;

  const swipeScale =
    useRef(new Animated.Value(1)).current;

  const swipeOpacity =
    useRef(new Animated.Value(1)).current;

  const incomingX =
    useRef(new Animated.Value(0)).current;

  const incomingScale =
    useRef(new Animated.Value(1)).current;

  const incomingOpacity =
    useRef(new Animated.Value(1)).current;

  const entranceY =
    useRef(
      new Animated.Value(
        SCREEN_HEIGHT * 0.07
      )
    ).current;

  const entranceScale =
    useRef(
      new Animated.Value(0.97)
    ).current;

  const entranceOpacity =
    useRef(
      new Animated.Value(0)
    ).current;

  /*
   * ============================================================
   * BARRA DE PROGRESO
   * ============================================================
   *
   * La dejamos declarada aquí para poder reiniciarla
   * instantáneamente cuando cambia la canción.
   */
  const animatedProgress =
    useRef(
      new Animated.Value(0)
    ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(entranceY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 55,
        friction: 9,
      }),

      Animated.spring(entranceScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 9,
      }),

      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    entranceY,
    entranceScale,
    entranceOpacity,
  ]);

  const resetSwipe = () => {
    Animated.parallel([
      Animated.spring(swipeX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 180,
        friction: 14,
      }),

      Animated.spring(swipeY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 180,
        friction: 14,
      }),

      Animated.spring(swipeScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 14,
      }),

      Animated.spring(swipeOpacity, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 14,
      }),
    ]).start();
  };

  const closePlayerWithAnimation = () => {
    Animated.parallel([
      Animated.timing(entranceY, {
        toValue:
          SCREEN_HEIGHT * 0.08,
        duration: 180,
        useNativeDriver: true,
      }),

      Animated.timing(entranceScale, {
        toValue: 0.97,
        duration: 180,
        useNativeDriver: true,
      }),

      Animated.timing(entranceOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const prepareTrackChange = () => {
    waitingForNewTrackPosition.current =
      true;

    setTrackPositionOverride(0);
    setVisualSeekPosition(null);

    isSeeking.current = false;
    seekPosition.current = 0;

    /*
     * Reiniciamos inmediatamente la barra visual.
     *
     * Esto evita que durante el cambio de canción
     * se vea durante unos frames el porcentaje de la
     * canción anterior.
     */
    animatedProgress.stopAnimation();
    animatedProgress.setValue(0);

    /*
     * Reiniciamos también el reloj de letras.
     */
    lyricsBasePositionRef.current = 0;
    lyricsBaseTimestampRef.current =
      Date.now();

    setLyricsCurrentTime(0);
  };

  const changeTrackWithSwipe = async (
    direction: 'next' | 'previous'
  ) => {
    try {
      if (direction === 'next') {
        await handleNext();
      } else {
        await handlePrevious();
      }
    } catch (error) {
      console.warn(
        '[SWIPE] ❌ Error cambiando canción:',
        error
      );
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        true,

      onStartShouldSetPanResponderCapture: () =>
        true,

      onMoveShouldSetPanResponder: () =>
        true,

      onMoveShouldSetPanResponderCapture: () =>
        true,

      onPanResponderGrant: () => {
        swipeX.stopAnimation();
        swipeY.stopAnimation();
        swipeScale.stopAnimation();
        swipeOpacity.stopAnimation();

        incomingX.stopAnimation();
        incomingScale.stopAnimation();
        incomingOpacity.stopAnimation();
      },

      onPanResponderMove: (
        _evt,
        gestureState
      ) => {
        const { dx } =
          gestureState;

        swipeX.setValue(dx);

        const progress =
          Math.min(
            Math.abs(dx) /
            SCREEN_WIDTH,
            1
          );

        swipeScale.setValue(
          1 - progress * 0.025
        );

        swipeOpacity.setValue(
          1 - progress * 0.04
        );
      },

      onPanResponderRelease: (
        _evt,
        gestureState
      ) => {
        const { dx } =
          gestureState;

        const SWIPE_DISTANCE =
          SCREEN_WIDTH * 0.15;

        if (
          dx >
          SWIPE_DISTANCE
        ) {
          const targetTrack =
            getNextTrack();

          if (!targetTrack) {
            resetSwipe();
            return;
          }

          isSwipeTransitioningRef.current =
            true;

          swipeDirectionRef.current =
            'next';

          incomingX.setValue(
            -SCREEN_WIDTH
          );

          incomingScale.setValue(
            0.985
          );

          incomingOpacity.setValue(
            1
          );

          setSwipePreviewTrack(
            targetTrack
          );

          requestAnimationFrame(() => {
            Animated.parallel([
              Animated.timing(
                swipeX,
                {
                  toValue:
                    SCREEN_WIDTH,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                swipeScale,
                {
                  toValue: 0.975,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                swipeOpacity,
                {
                  toValue: 0.96,
                  duration: 180,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                incomingX,
                {
                  toValue: 0,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                incomingScale,
                {
                  toValue: 1,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),
            ]).start(() => {
              requestAnimationFrame(() => {
                changeTrackWithSwipe(
                  'next'
                );
              });
            });
          });

          return;
        }

        if (
          dx <
          -SWIPE_DISTANCE
        ) {
          const targetTrack =
            getPreviousTrack();

          if (!targetTrack) {
            resetSwipe();
            return;
          }

          isSwipeTransitioningRef.current =
            true;

          swipeDirectionRef.current =
            'previous';

          incomingX.setValue(
            SCREEN_WIDTH
          );

          incomingScale.setValue(
            0.985
          );

          incomingOpacity.setValue(
            1
          );

          setSwipePreviewTrack(
            targetTrack
          );

          requestAnimationFrame(() => {
            Animated.parallel([
              Animated.timing(
                swipeX,
                {
                  toValue:
                    -SCREEN_WIDTH,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                swipeScale,
                {
                  toValue: 0.975,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                swipeOpacity,
                {
                  toValue: 0.96,
                  duration: 180,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                incomingX,
                {
                  toValue: 0,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),

              Animated.timing(
                incomingScale,
                {
                  toValue: 1,
                  duration: 200,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver: true,
                }
              ),
            ]).start(() => {
              requestAnimationFrame(() => {
                changeTrackWithSwipe(
                  'previous'
                );
              });
            });
          });

          return;
        }

        resetSwipe();
      },

      onPanResponderTerminate: () => {
        resetSwipe();
      },

      onPanResponderTerminationRequest: () =>
        false,
    })
  ).current;

  useEffect(() => {
    if (!activeTrack) {
      return;
    }

    waitingForNewTrackPosition.current =
      true;

    setTrackPositionOverride(0);
    setVisualSeekPosition(null);

    isSeeking.current = false;
    seekPosition.current = 0;

    /*
     * Reinicio instantáneo de la barra cuando
     * realmente cambia activeTrack.
     */
    animatedProgress.stopAnimation();
    animatedProgress.setValue(0);

    /*
     * Reinicio inmediato del reloj de letras.
     */
    lyricsBasePositionRef.current = 0;
    lyricsBaseTimestampRef.current =
      Date.now();

    setLyricsCurrentTime(0);

    if (
      swipePreviewTrack &&
      activeTrack.id ===
      swipePreviewTrack.id
    ) {
      setSwipePreviewTrack(null);

      incomingX.setValue(0);
      incomingScale.setValue(1);
      incomingOpacity.setValue(1);

      swipeX.setValue(0);
      swipeY.setValue(0);
      swipeScale.setValue(1);
      swipeOpacity.setValue(1);

      isSwipeTransitioningRef.current =
        false;

      swipeDirectionRef.current =
        null;
    } else if (
      !isSwipeTransitioningRef.current
    ) {
      resetSwipe();
    }

    autoNextTriggered.current =
      false;

    isChangingTrack.current =
      false;

    if (
      skipStartTime.current !== null
    ) {
      skipTrackId.current =
        activeTrack.id;

      const queue =
        getPlayerQueue();

      const index =
        queue.findIndex(
          track =>
            track.id ===
            activeTrack.id
        );

      if (index !== -1) {
        setCurrentQueueIndex(
          index
        );
      }
    }
  }, [
    activeTrack?.id,
    animatedProgress,
  ]);

  useEffect(() => {
    if (!activeTrack) {
      return;
    }

    if (
      !waitingForNewTrackPosition.current
    ) {
      return;
    }

    if (position <= 0.25) {
      waitingForNewTrackPosition.current =
        false;

      setTrackPositionOverride(null);
    }
  }, [
    position,
    activeTrack?.id,
  ]);

  useEffect(() => {
    if (
      !activeTrack ||
      skipStartTime.current === null ||
      skipTrackId.current !==
      activeTrack.id
    ) {
      return;
    }

    if (position > 0.05) {
      skipStartTime.current =
        null;

      skipTrackId.current =
        null;
    }
  }, [
    position,
    activeTrack?.id,
  ]);

  useEffect(() => {
    if (
      !activeTrack ||
      duration <= 0
    ) {
      return;
    }

    if (
      position <
      duration - 0.5
    ) {
      return;
    }

    if (
      autoNextTriggered.current ||
      isChangingTrack.current
    ) {
      return;
    }

    autoNextTriggered.current =
      true;

    if (
      repeatMode === 'one'
    ) {
      setTrackPositionOverride(0);
      setVisualSeekPosition(0);

      waitingForNewTrackPosition.current =
        true;

      animatedProgress.stopAnimation();
      animatedProgress.setValue(0);

      lyricsBasePositionRef.current = 0;
      lyricsBaseTimestampRef.current =
        Date.now();

      setLyricsCurrentTime(0);

      TrackPlayer.seekTo(0)
        .then(() =>
          TrackPlayer.play()
        )
        .catch(error =>
          console.warn(
            '[REPEAT ONE] ❌ Error:',
            error
          )
        );

      return;
    }

    const goToNext =
      async () => {
        try {
          isChangingTrack.current =
            true;

          const queue =
            getPlayerQueue();

          if (
            queue.length === 0
          ) {
            return;
          }

          let nextTrack =
            null;

          if (
            shuffleMode &&
            queue.length > 1
          ) {
            const currentIndex =
              queue.findIndex(
                track =>
                  track.id ===
                  activeTrack.id
              );

            if (
              currentIndex === -1
            ) {
              return;
            }

            if (
              shuffleOrderRef
                .current
                .length !==
              queue.length ||
              !shuffleOrderRef.current.includes(
                currentIndex
              )
            ) {
              createShuffleOrder(
                queue.length,
                currentIndex
              );
            }

            let nextPosition =
              shufflePositionRef
                .current + 1;

            if (
              nextPosition >=
              shuffleOrderRef
                .current.length
            ) {
              createShuffleOrder(
                queue.length,
                currentIndex
              );

              nextPosition = 1;
            }

            shufflePositionRef.current =
              nextPosition;

            const nextIndex =
              shuffleOrderRef
                .current[
                shufflePositionRef
                  .current
              ];

            nextTrack =
              queue[nextIndex];
          } else {
            nextTrack =
              getNextTrack();
          }

          if (!nextTrack) {
            return;
          }

          const nextIndex =
            queue.findIndex(
              track =>
                track.id ===
                nextTrack.id
            );

          if (
            nextIndex !== -1
          ) {
            setCurrentQueueIndex(
              nextIndex
            );
          }

          prepareTrackChange();

          skipStartTime.current =
            Date.now();

          await playTrack(
            nextTrack
          );
        } catch (error) {
          console.warn(
            '[AUTO NEXT] ❌ Error:',
            error
          );
        } finally {
          isChangingTrack.current =
            false;
        }
      };

    goToNext();
  }, [
    position,
    duration,
    activeTrack?.id,
    repeatMode,
    shuffleMode,
    animatedProgress,
  ]);

  useEffect(() => {
    if (
      visualSeekPosition === null ||
      isSeeking.current
    ) {
      return;
    }

    const difference =
      Math.abs(
        position -
        visualSeekPosition
      );

    if (
      difference <= 0.75
    ) {
      setVisualSeekPosition(
        null
      );
    }
  }, [
    position,
    visualSeekPosition,
  ]);

  const createShuffleOrder = (
    queueLength: number,
    currentIndex: number
  ) => {
    const order =
      Array.from(
        {
          length: queueLength,
        },
        (_, index) => index
      );

    const remaining =
      order.filter(
        index =>
          index !== currentIndex
      );

    for (
      let i =
        remaining.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );

      [
        remaining[i],
        remaining[j],
      ] = [
        remaining[j],
        remaining[i],
      ];
    }

    shuffleOrderRef.current =
      [
        currentIndex,
        ...remaining,
      ];

    shufflePositionRef.current =
      0;
  };

  const handleSaveTrack =
    async () => {
      const trackToSave =
        activeTrack ||
        activeTrackRef.current;

      if (!trackToSave) {
        return;
      }

      await saveTrackToLibrary({
        id: trackToSave.id,
        title:
          trackToSave.title ||
          'Desconocido',
        artist:
          trackToSave.artist ||
          'Desconocido',
        artwork:
          trackToSave.artwork ||
          '',
        duration:
          trackToSave.duration ||
          0,
      });
    };

  const formatTime = (
    secs: number
  ) => {
    const safeSecs =
      Math.max(
        0,
        Number.isFinite(secs)
          ? secs
          : 0
      );

    const mins =
      Math.floor(
        safeSecs / 60
      );

    const remainder =
      Math.floor(
        safeSecs % 60
      );

    return `${mins}:${remainder < 10
      ? '0'
      : ''
      }${remainder}`;
  };

  const calculateSeekPosition = (
    locationX: number
  ): number | null => {
    const width =
      progressBarWidth.current;

    const currentDuration =
      durationRef.current;

    if (
      currentDuration <= 0 ||
      width <= 0
    ) {
      return null;
    }

    const safeLocationX =
      Math.max(
        0,
        Math.min(
          width,
          locationX
        )
      );

    const percentage =
      safeLocationX / width;

    return Math.max(
      0,
      Math.min(
        currentDuration,
        percentage *
        currentDuration
      )
    );
  };

  const handleNext =
    async () => {
      if (
        isChangingTrack.current
      ) {
        return;
      }

      try {
        isChangingTrack.current =
          true;

        const queue =
          getPlayerQueue();

        if (
          queue.length === 0
        ) {
          return;
        }

        if (
          shuffleMode &&
          queue.length > 1
        ) {
          const currentIndex =
            queue.findIndex(
              track =>
                track.id ===
                (
                  activeTrack?.id ||
                  activeTrackRef
                    .current?.id
                )
            );

          if (
            currentIndex === -1
          ) {
            return;
          }

          if (
            shuffleOrderRef
              .current
              .length !==
            queue.length ||
            !shuffleOrderRef.current.includes(
              currentIndex
            )
          ) {
            createShuffleOrder(
              queue.length,
              currentIndex
            );
          }

          let nextPosition =
            shufflePositionRef
              .current + 1;

          if (
            nextPosition >=
            shuffleOrderRef
              .current.length
          ) {
            createShuffleOrder(
              queue.length,
              currentIndex
            );

            nextPosition = 1;
          }

          shufflePositionRef.current =
            nextPosition;

          const nextIndex =
            shuffleOrderRef
              .current[
              shufflePositionRef
                .current
            ];

          const nextTrack =
            queue[nextIndex];

          if (!nextTrack) {
            return;
          }

          prepareTrackChange();

          setCurrentQueueIndex(
            nextIndex
          );

          skipStartTime.current =
            Date.now();

          await playTrack(
            nextTrack
          );

          return;
        }

        const nextTrack =
          getNextTrack();

        if (!nextTrack) {
          return;
        }

        const nextIndex =
          queue.findIndex(
            track =>
              track.id ===
              nextTrack.id
          );

        if (
          nextIndex !== -1
        ) {
          setCurrentQueueIndex(
            nextIndex
          );
        }

        prepareTrackChange();

        skipStartTime.current =
          Date.now();

        await playTrack(
          nextTrack
        );
      } catch (error) {
        console.warn(
          '[Queue] Error:',
          error
        );
      } finally {
        isChangingTrack.current =
          false;
      }
    };

  const handlePrevious =
    async () => {
      if (
        isChangingTrack.current
      ) {
        return;
      }

      try {
        isChangingTrack.current =
          true;

        const queue =
          getPlayerQueue();

        if (
          queue.length === 0
        ) {
          return;
        }

        const previousTrack =
          getPreviousTrack();

        if (!previousTrack) {
          return;
        }

        const previousIndex =
          queue.findIndex(
            track =>
              track.id ===
              previousTrack.id
          );

        if (
          previousIndex === -1
        ) {
          return;
        }

        prepareTrackChange();

        skipStartTime.current =
          Date.now();

        setCurrentQueueIndex(
          previousIndex
        );

        await playTrack(
          previousTrack
        );
      } catch (error) {
        console.warn(
          '[Queue] Error:',
          error
        );
      } finally {
        isChangingTrack.current =
          false;
      }
    };

  const handleRepeat =
    () => {
      setRepeatMode(
        current => {
          if (
            current === 'off'
          ) {
            return 'all';
          }

          if (
            current === 'all'
          ) {
            return 'one';
          }

          return 'off';
        }
      );
    };

  const displayedPosition =
    Math.max(
      0,
      Math.min(
        duration > 0
          ? duration
          : Number.MAX_SAFE_INTEGER,
        trackPositionOverride !==
          null
          ? trackPositionOverride
          : visualSeekPosition !==
            null
            ? visualSeekPosition
            : position
      )
    );

  const progressPercentage =
    duration > 0
      ? Math.max(
        0,
        Math.min(
          100,
          (
            displayedPosition /
            duration
          ) * 100
        )
      )
      : 0;

  /*
   * ============================================================
   * ANIMACIÓN DE LA BARRA
   * ============================================================
   *
   * Antes:
   *
   *   TrackPlayer -> actualización ~100 ms
   *   Animated.timing -> duración 250 ms
   *
   * Eso podía provocar que varias animaciones estuvieran
   * compitiendo entre sí.
   *
   * Ahora:
   *
   *   1. Cancelamos la animación anterior.
   *   2. Actualizamos la nueva posición.
   *   3. La transición dura solo 60 ms.
   *
   * Así la barra sigue visualmente al reproductor sin
   * quedarse "persiguiendo" posiciones antiguas.
   */
  useEffect(() => {
    animatedProgress.stopAnimation();

    if (isSeeking.current) {
      animatedProgress.setValue(
        progressPercentage
      );

      return;
    }

    Animated.timing(
      animatedProgress,
      {
        toValue:
          progressPercentage,
        duration: 60,
        easing:
          Easing.linear,
        useNativeDriver: false,
      }
    ).start();
  }, [
    progressPercentage,
    animatedProgress,
  ]);

  const renderPlayerContent = (
    track: SwipePreviewTrack | null,
    isPreview = false
  ) => {
    if (!track) {
      return null;
    }

    return (
      <SafeAreaView
        style={styles.content}
        pointerEvents={
          isPreview
            ? 'none'
            : 'auto'
        }
      >
        <View
          style={styles.topBar}
        >
          <TouchableOpacity
            onPress={
              closePlayerWithAnimation
            }
            hitSlop={{
              top: 15,
              bottom: 15,
              left: 15,
              right: 15,
            }}
          >
            <FontAwesome
              name="chevron-down"
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pillButton,
              showLyrics &&
              styles.pillButtonLyrics,
            ]}
            onPress={() => {
              setShowLyrics(
                current => !current
              );
            }}
          >
            <Text
              style={styles.pillText}
            >
              {showLyrics
                ? 'VER CARÁTULA'
                : 'VER LETRAS'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setIsMenuVisible(
                true
              )
            }
            hitSlop={{
              top: 15,
              bottom: 15,
              left: 15,
              right: 15,
            }}
          >
            <FontAwesome
              name="ellipsis-v"
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>

        <View
          style={styles.middleSection}
        >
          {showLyrics &&
            !isPreview && (
              <SyncedLyricsView
                lyrics={lyrics}
                currentTime={
                  lyricsCurrentTime
                }
                loading={lyricsLoading}
              />
            )}

          {!isPreview && !showLyrics && (
            <View
              style={styles.swipeArea}
              {...panResponder.panHandlers}
            />
          )}
        </View>

        <View
          style={styles.bottomSection}
        >
          <View
            style={styles.infoRow}
          >
            <View
              style={styles.infoLeft}
            >
              <Image
                source={{
                  uri: track.artwork,
                }}
                style={
                  styles.smallArtwork
                }
              />

              <View
                style={styles.textInfo}
              >
                <Text
                  style={styles.title}
                  numberOfLines={1}
                >
                  {track.title}
                </Text>

                <Text
                  style={styles.artist}
                  numberOfLines={1}
                >
                  {track.artist}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={
                handleSaveTrack
              }
              style={
                styles.saveIcon
              }
            >
              <FontAwesome
                name="download"
                size={24}
                color={
                  COLORS.primary
                }
              />
            </TouchableOpacity>
          </View>

          <View
            style={
              styles.progressContainerWrapper
            }
          >
            <View
              style={
                styles.progressContainer
              }
              onLayout={event => {
                if (!isPreview) {
                  progressBarWidth.current =
                    event.nativeEvent.layout.width;
                }
              }}
              onStartShouldSetResponder={() =>
                !isPreview
              }
              onMoveShouldSetResponder={() =>
                !isPreview
              }
              onResponderGrant={event => {
                if (isPreview) {
                  return;
                }

                const newPosition =
                  calculateSeekPosition(
                    event
                      .nativeEvent
                      .locationX
                  );

                if (
                  newPosition ===
                  null
                ) {
                  return;
                }

                isSeeking.current =
                  true;

                seekPosition.current =
                  newPosition;

                setVisualSeekPosition(
                  newPosition
                );

                lyricsBasePositionRef.current =
                  newPosition;

                lyricsBaseTimestampRef.current =
                  Date.now();

                setLyricsCurrentTime(
                  newPosition
                );

                /*
                 * El dedo manda directamente sobre la barra.
                 */
                animatedProgress.stopAnimation();

                animatedProgress.setValue(
                  (
                    newPosition /
                    currentDurationSafe(
                      durationRef.current
                    )
                  ) * 100
                );
              }}
              onResponderMove={event => {
                if (
                  isPreview ||
                  !isSeeking.current
                ) {
                  return;
                }

                const newPosition =
                  calculateSeekPosition(
                    event
                      .nativeEvent
                      .locationX
                  );

                if (
                  newPosition ===
                  null
                ) {
                  return;
                }

                seekPosition.current =
                  newPosition;

                setVisualSeekPosition(
                  newPosition
                );

                lyricsBasePositionRef.current =
                  newPosition;

                lyricsBaseTimestampRef.current =
                  Date.now();

                setLyricsCurrentTime(
                  newPosition
                );

                animatedProgress.stopAnimation();

                animatedProgress.setValue(
                  (
                    newPosition /
                    currentDurationSafe(
                      durationRef.current
                    )
                  ) * 100
                );
              }}
              onResponderRelease={() => {
                if (
                  isPreview ||
                  !isSeeking.current
                ) {
                  return;
                }

                const newPosition =
                  seekPosition.current;

                isSeeking.current =
                  false;

                lyricsBasePositionRef.current =
                  newPosition;

                lyricsBaseTimestampRef.current =
                  Date.now();

                setLyricsCurrentTime(
                  newPosition
                );

                TrackPlayer.seekTo(
                  newPosition
                ).catch(
                  error => {
                    console.warn(
                      '[SEEK] ❌ Error:',
                      error
                    );

                    setVisualSeekPosition(
                      null
                    );
                  }
                );
              }}
              onResponderTerminate={() => {
                isSeeking.current =
                  false;

                setVisualSeekPosition(
                  null
                );
              }}
            >
              <View
                style={
                  styles.progressTrack
                }
              >
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width:
                        animatedProgress.interpolate(
                          {
                            inputRange: [
                              0,
                              100,
                            ],
                            outputRange: [
                              '0%',
                              '100%',
                            ],
                          }
                        ),
                    },
                  ]}
                />

                <Animated.View
                  style={[
                    styles.progressThumb,
                    {
                      left:
                        animatedProgress.interpolate(
                          {
                            inputRange: [
                              0,
                              100,
                            ],
                            outputRange: [
                              '0%',
                              '100%',
                            ],
                          }
                        ),
                    },
                  ]}
                />
              </View>
            </View>

            <View
              style={styles.timeRow}
            >
              <Text
                style={styles.timeText}
              >
                {formatTime(
                  displayedPosition
                )}
              </Text>

              <Text
                style={styles.timeText}
              >
                {formatTime(
                  duration
                )}
              </Text>
            </View>
          </View>

          <View
            style={styles.controls}
          >
            <TouchableOpacity
              onPress={() => {
                if (isPreview) {
                  return;
                }

                setShuffleMode(
                  current => {
                    const newValue =
                      !current;

                    if (!newValue) {
                      shuffleOrderRef.current =
                        [];

                      shufflePositionRef.current =
                        0;
                    } else {
                      const queue =
                        getPlayerQueue();

                      const currentIndex =
                        queue.findIndex(
                          qTrack =>
                            qTrack.id ===
                            (
                              activeTrack?.id ||
                              activeTrackRef
                                .current?.id
                            )
                        );

                      if (
                        currentIndex !==
                        -1 &&
                        queue.length >
                        1
                      ) {
                        createShuffleOrder(
                          queue.length,
                          currentIndex
                        );
                      }
                    }

                    return newValue;
                  }
                );
              }}
            >
              <FontAwesome
                name="random"
                size={22}
                color={
                  shuffleMode
                    ? COLORS.primary
                    : '#FFF'
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={
                isPreview
                  ? undefined
                  : handlePrevious
              }
            >
              <FontAwesome
                name="step-backward"
                size={28}
                color="#FFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.mainButton
              }
              onPress={() =>
                isPreview
                  ? undefined
                  : playing
                    ? TrackPlayer.pause()
                    : TrackPlayer.play()
              }
            >
              <FontAwesome
                name={
                  playing
                    ? 'pause'
                    : 'play'
                }
                size={24}
                color="#FFF"
                style={
                  playing
                    ? {}
                    : {
                      marginLeft: 4,
                    }
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={
                isPreview
                  ? undefined
                  : handleNext
              }
            >
              <FontAwesome
                name="step-forward"
                size={28}
                color="#FFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!isPreview) {
                  handleRepeat();
                }
              }}
            >
              <View
                style={
                  styles.repeatContainer
                }
              >
                <FontAwesome
                  name="retweet"
                  size={22}
                  color={
                    repeatMode ===
                      'off'
                      ? '#FFF'
                      : COLORS.primary
                  }
                />

                {repeatMode ===
                  'one' && (
                  <Text
                    style={
                      styles.repeatOne
                    }
                  >
                    1
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  };

  const displayTrack =
    activeTrack ||
    activeTrackRef.current ||
    swipePreviewTrack;

  if (!displayTrack) {
    return (
      <View
        style={styles.container}
      />
    );
  }

  return (
    <ImageBackground
      source={{
        uri: displayTrack.artwork,
      }}
      style={styles.container}
      blurRadius={
        showLyrics ? 18 : 0
      }
      imageStyle={
        showLyrics
          ? styles.blurredBackgroundImage
          : undefined
      }
    >
      <View
        style={[
          styles.overlay,
          showLyrics &&
          styles.lyricsOverlay,
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.animatedScreen,
          {
            opacity:
              Animated.multiply(
                entranceOpacity,
                swipeOpacity
              ),

            transform: [
              {
                translateX:
                  swipeX,
              },

              {
                translateY:
                  Animated.add(
                    entranceY,
                    swipeY
                  ),
              },

              {
                scale:
                  Animated.multiply(
                    entranceScale,
                    swipeScale
                  ),
              },
            ],
          },
        ]}
      >
        {renderPlayerContent(
          (
            activeTrack ||
            activeTrackRef.current ||
            null
          ) as SwipePreviewTrack | null
        )}
      </Animated.View>

      {swipePreviewTrack && (
        <Animated.View
          style={[
            styles.previewScreen,
            {
              opacity:
                incomingOpacity,

              transform: [
                {
                  translateX:
                    incomingX,
                },

                {
                  scale:
                    incomingScale,
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <ImageBackground
            source={{
              uri:
                swipePreviewTrack.artwork,
            }}
            style={
              styles.previewBackground
            }
            blurRadius={
              showLyrics ? 18 : 0
            }
          >
            <View
              style={[
                styles.overlay,
                showLyrics &&
                styles.lyricsOverlay,
              ]}
            />

            {renderPlayerContent(
              swipePreviewTrack,
              true
            )}
          </ImageBackground>
        </Animated.View>
      )}

      {isMenuVisible && (
        <View
          style={styles.menuOverlay}
        >
          <TouchableOpacity
            style={
              styles.menuBackdrop
            }
            activeOpacity={1}
            onPress={() =>
              setIsMenuVisible(
                false
              )
            }
          />

          <View
            style={styles.menuSheet}
          >
            <View
              style={
                styles.menuHandle
              }
            />

            <Text
              style={
                styles.menuTitle
              }
              numberOfLines={1}
            >
              {displayTrack.title}
            </Text>

            <Text
              style={
                styles.menuArtist
              }
              numberOfLines={1}
            >
              {displayTrack.artist}
            </Text>

            <TouchableOpacity
              style={
                styles.menuItem
              }
              onPress={() => {
                setIsMenuVisible(
                  false
                );

                handleSaveTrack();
              }}
            >
              <View
                style={
                  styles.menuIcon
                }
              >
                <FontAwesome
                  name="download"
                  size={20}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.menuItemText
                }
              >
                Guardar localmente
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.menuItem,
                styles.menuItemDisabled,
              ]}
            >
              <View
                style={
                  styles.menuIcon
                }
              >
                <FontAwesome
                  name="list"
                  size={20}
                  color="#777"
                />
              </View>

              <View
                style={
                  styles.menuItemTextContainer
                }
              >
                <Text
                  style={[
                    styles.menuItemText,
                    styles.menuItemTextDisabled,
                  ]}
                >
                  Añadir a playlist
                </Text>

                <Text
                  style={
                    styles.comingSoonText
                  }
                >
                  Próximamente
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={
                styles.menuItem
              }
              onPress={() => {
                setIsMenuVisible(
                  false
                );

                closePlayerWithAnimation();
              }}
            >
              <View
                style={
                  styles.menuIcon
                }
              >
                <FontAwesome
                  name="chevron-down"
                  size={20}
                  color="#FFF"
                />
              </View>

              <Text
                style={
                  styles.menuItemText
                }
              >
                Cerrar reproductor
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ImageBackground>
  );
};

/*
 * Evita divisiones por 0 durante el seek.
 */
const currentDurationSafe = (
  value: number
): number => {
  return value > 0
    ? value
    : 1;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor:
      'rgba(0,0,0,0.58)',
  },

  lyricsOverlay: {
    backgroundColor:
      'rgba(0,0,0,0.68)',
  },

  blurredBackgroundImage: {
    transform: [
      {
        scale: 1.06,
      },
    ],
  },

  animatedScreen: {
    flex: 1,
  },

  previewScreen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  previewBackground: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 38,
    justifyContent: 'space-between',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },

  pillButton: {
    backgroundColor:
      'rgba(20,20,20,0.72)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.12)',
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  pillButtonLyrics: {
    backgroundColor:
      'rgba(255,255,255,0.10)',
    borderColor:
      'rgba(255,255,255,0.18)',
  },

  pillText: {
    color:
      'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },

  middleSection: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },

  swipeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  bottomSection: {
    paddingBottom: 4,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  smallArtwork: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 15,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },

  textInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingRight: 4,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.25,
  },

  artist: {
    color:
      'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 5,
    letterSpacing: 0.05,
  },

  saveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor:
      'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.11)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 7,
    elevation: 5,
  },

  progressContainerWrapper: {
    marginBottom: 4,
  },

  progressContainer: {
    height: 28,
    justifyContent: 'center',
  },

  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor:
      'rgba(255,255,255,0.20)',
    borderRadius: 999,
    position: 'relative',
    overflow: 'visible',
  },

  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },

  progressThumb: {
    position: 'absolute',
    width: 11,
    height: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    top: -3.5,
    transform: [
      {
        translateX: -5.5,
      },
    ],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -2,
    paddingHorizontal: 1,
  },

  timeText: {
    color:
      'rgba(255,255,255,0.50)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.15,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 4,
    paddingHorizontal: 10,
  },

  mainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor:
      COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor:
      COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 10,
  },

  repeatContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  repeatOne: {
    position: 'absolute',
    top: -5,
    right: -5,
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: '#080808',
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    textAlign: 'center',
    lineHeight: 13,
  },

  menuOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },

  menuBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor:
      'rgba(0,0,0,0.62)',
  },

  menuSheet: {
    backgroundColor: '#171717',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor:
      'rgba(255,255,255,0.10)',
    elevation: 20,
  },

  menuHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor:
      'rgba(255,255,255,0.25)',
    marginBottom: 18,
  },

  menuTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },

  menuArtist: {
    color:
      'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 18,
  },

  menuItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 12,
    marginBottom: 6,
  },

  menuItemDisabled: {
    opacity: 0.65,
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  menuItemTextContainer: {
    flex: 1,
  },

  menuItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  menuItemTextDisabled: {
    color: '#777777',
  },

  comingSoonText: {
    color: '#666666',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});