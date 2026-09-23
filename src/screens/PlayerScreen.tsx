// src/screens/PlayerScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import TrackPlayer, {
  useActiveTrack,
  useIsPlaying,
  useProgress,
} from 'react-native-track-player';
import { COLORS } from '../constants/theme';
import { saveTrackToLibrary } from '../services/downloadService';
import { fetchSyncedLyrics } from '../services/lyricsService';
import { LyricLine } from '../utils/lrcParser';
import { SyncedLyricsView } from '../components/SyncedLyricsView';
import {
  setCurrentQueueIndex,
  getPlayerQueue,
  prepareNextTrack,
} from '../services/playerQueue';
import { playTrack } from '../services/playTrack';

export const PlayerScreen = () => {
  const activeTrack = useActiveTrack();
  const { playing } = useIsPlaying();
  const { position, duration } = useProgress();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [shuffleMode, setShuffleMode] = useState(false);

  const shuffleOrderRef = useRef<number[]>([]);
  const shufflePositionRef = useRef(0);

  const createShuffleOrder = (queueLength: number, currentIndex: number) => {
    const order = Array.from(
      { length: queueLength },
      (_, index) => index
    );

    // Quitamos la canción actual
    const remaining = order.filter(
      index => index !== currentIndex
    );

    // Barajamos las demás canciones
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [remaining[i], remaining[j]] = [
        remaining[j],
        remaining[i],
      ];
    }

    // La canción actual va primero
    shuffleOrderRef.current = [
      currentIndex,
      ...remaining,
    ];

    shufflePositionRef.current = 0;
  };

  const skipStartTime = useRef<number | null>(null);
  const skipTrackId = useRef<string | null>(null);

  const autoNextTriggered = useRef(false);
  const isChangingTrack = useRef(false);

  const progressBarWidth = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = duration;

  const isSeeking = useRef(false);
  const seekPosition = useRef(0);

  const [visualSeekPosition, setVisualSeekPosition] =
    useState<number | null>(null);

  /*
   * CAMBIO DE CANCIÓN
   *
   * Cada vez que TrackPlayer cambia de pista:
   * - reseteamos el bloqueo de auto-next
   * - reseteamos la barra visual
   * - actualizamos el índice lógico
   * - cargamos las letras
   */
  useEffect(() => {
    if (!activeTrack) {
      return;
    }

    autoNextTriggered.current = false;
    isChangingTrack.current = false;

    setVisualSeekPosition(null);
    isSeeking.current = false;

    if (skipStartTime.current !== null) {
      skipTrackId.current = activeTrack.id;

      const elapsed = Date.now() - skipStartTime.current;

      console.log(
        `[SKIP TEST] ⏱️ Cambio a "${activeTrack.title}" en ${elapsed} ms`
      );

      const queue = getPlayerQueue();

      const index = queue.findIndex(
        track => track.id === activeTrack.id
      );

      if (index !== -1) {
        setCurrentQueueIndex(index);
      }
    }

    /*
    fetchSyncedLyrics(
      activeTrack.title || '',
      activeTrack.artist || '',
      activeTrack.duration || duration
    ).then(setLyrics);
    */
  }, [activeTrack?.id]);

  /*
   * MEDICIÓN DEL INICIO DE REPRODUCCIÓN
   */
  useEffect(() => {
    if (
      !activeTrack ||
      skipStartTime.current === null ||
      skipTrackId.current !== activeTrack.id
    ) {
      return;
    }

    if (position > 0.05) {
      const elapsed = Date.now() - skipStartTime.current;

      console.log(
        `[SKIP TEST] 🔊 "${activeTrack.title}" empezó a avanzar en ${elapsed} ms`
      );

      skipStartTime.current = null;
      skipTrackId.current = null;
    }
  }, [position, activeTrack?.id]);

  /*
   * AUTO NEXT
   *
   * OFF:
   *   pasa a la siguiente canción.
   *
   * ALL:
   *   pasa a la siguiente y, al llegar a la última,
   *   nuestra cola vuelve a la primera.
   *
   * ONE:
   *   vuelve a 0:00 de la misma canción.
   */
  useEffect(() => {
    if (!activeTrack || duration <= 0) {
      return;
    }

    if (position < duration - 0.5) {
      return;
    }

    if (autoNextTriggered.current) {
      return;
    }

    if (isChangingTrack.current) {
      return;
    }

    autoNextTriggered.current = true;

    console.log(
      '[AUTO NEXT] 🏁 Terminó:',
      activeTrack.title,
      '| modo:',
      repeatMode,
    );

    /*
     * REPETIR UNA
     *
     * No hacemos reset().
     * No volvemos a obtener la URL.
     * No modificamos la cola.
     *
     * Simplemente volvemos a 0 y continuamos.
     */
    if (repeatMode === 'one') {
      setVisualSeekPosition(0);

      TrackPlayer.seekTo(0)
        .then(() => TrackPlayer.play())
        .catch(error => {
          console.warn(
            '[REPEAT ONE] ❌ Error al reiniciar:',
            error,
          );
        });

      return;
    }

    const goToNext = async () => {
      try {
        isChangingTrack.current = true;

        await prepareNextTrack();
        await TrackPlayer.skipToNext();
      } catch (error) {
        isChangingTrack.current = false;

        console.warn(
          '[AUTO NEXT] ❌ Error al pasar a la siguiente:',
          error,
        );
      }
    };

    goToNext();
  }, [
    position,
    duration,
    activeTrack?.id,
    repeatMode,
  ]);

  if (!activeTrack) {
    return null;
  }

  const handleSaveTrack = async () => {
    console.log(
      '[DOWNLOAD DEBUG] Pulsado Guardar Localmente:',
      activeTrack.id,
    );

    await saveTrackToLibrary({
      id: activeTrack.id,
      title: activeTrack.title || 'Desconocido',
      artist: activeTrack.artist || 'Desconocido',
      artwork: activeTrack.artwork || '',
      duration: activeTrack.duration || 0,
    });

    console.log(
      '[DOWNLOAD DEBUG] saveTrackToLibrary terminado'
    );
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);

    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const calculateSeekPosition = (
    locationX: number
  ): number | null => {
    if (
      durationRef.current <= 0 ||
      progressBarWidth.current <= 0
    ) {
      return null;
    }

    const percentage = Math.max(
      0,
      Math.min(
        1,
        locationX / progressBarWidth.current
      )
    );

    return percentage * durationRef.current;
  };

  /*
   * SIGUIENTE
   */
  const handleNext = async () => {
    if (isChangingTrack.current) {
      return;
    }

    try {
      isChangingTrack.current = true;

      skipStartTime.current = Date.now();

      console.log('[SKIP TEST] ⏭ Pulsado');

      const queue = getPlayerQueue();

      if (shuffleMode && queue.length > 1) {
        const currentIndex = queue.findIndex(
          track => track.id === activeTrack.id
        );

        if (currentIndex === -1) {
          return;
        }

        // Creamos un nuevo orden si todavía no existe
        // o si hemos terminado la ronda anterior.
        if (
          shuffleOrderRef.current.length !== queue.length ||
          !shuffleOrderRef.current.includes(currentIndex)
        ) {
          createShuffleOrder(queue.length, currentIndex);
        }

        const nextPosition =
          shufflePositionRef.current + 1;

        // Si hemos llegado al final del orden,
        // empezamos una nueva ronda.
        if (
          nextPosition >= shuffleOrderRef.current.length
        ) {
          createShuffleOrder(queue.length, currentIndex);
          shufflePositionRef.current = 1;
        } else {
          shufflePositionRef.current = nextPosition;
        }

        const nextIndex =
          shuffleOrderRef.current[
          shufflePositionRef.current
          ];

        const nextTrack = queue[nextIndex];

        console.log(
          '[SHUFFLE] 🎲 Siguiente:',
          nextTrack.title
        );

        setCurrentQueueIndex(nextIndex);

        await playTrack(nextTrack);

        return;
      }

      await prepareNextTrack();
      await TrackPlayer.skipToNext();

    } catch (error) {
      isChangingTrack.current = false;

      console.warn(
        '[Queue] Error al pasar a la siguiente canción:',
        error,
      );
    }
  };

  /*
   * ANTERIOR
   */
  const handlePrevious = async () => {
    if (isChangingTrack.current) {
      return;
    }

    try {
      const queue = getPlayerQueue();

      if (queue.length === 0) {
        return;
      }

      const currentIndex = queue.findIndex(
        track => track.id === activeTrack.id
      );

      if (currentIndex === -1) {
        return;
      }

      const previousIndex =
        currentIndex === 0
          ? queue.length - 1
          : currentIndex - 1;

      const previousTrack = queue[previousIndex];

      isChangingTrack.current = true;

      skipStartTime.current = Date.now();

      console.log(
        '[SKIP TEST] ⏮ Anterior:',
        previousTrack.title,
      );

      setCurrentQueueIndex(previousIndex);

      await playTrack(previousTrack);
    } catch (error) {
      console.warn(
        '[Queue] Error al pasar a la canción anterior:',
        error,
      );

      isChangingTrack.current = false;
    }
  };

  /*
   * BUCLE
   *
   * OFF -> ALL -> ONE -> OFF
   */
  const handleRepeat = () => {
    setRepeatMode(current => {
      if (current === 'off') {
        return 'all';
      }

      if (current === 'all') {
        return 'one';
      }

      return 'off';
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleViewButton}
        onPress={() => setShowLyrics(!showLyrics)}
      >
        <Text style={styles.toggleViewText}>
          {showLyrics
            ? '🖼 Ver Carátula'
            : '🎤 Ver Letras'}
        </Text>
      </TouchableOpacity>

      {showLyrics ? (
        <View style={styles.lyricsContainer}>
          <SyncedLyricsView
            lyrics={lyrics}
            currentTime={position}
          />
        </View>
      ) : (
        <Image
          source={{ uri: activeTrack.artwork }}
          style={styles.cover}
        />
      )}

      <View style={styles.header}>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {activeTrack.title}
        </Text>

        <Text style={styles.artist}>
          {activeTrack.artist}
        </Text>
      </View>

      {/* BARRA DE PROGRESO */}
      <View
        style={styles.progressContainer}
        onLayout={(event) => {
          progressBarWidth.current =
            event.nativeEvent.layout.width;
        }}
        onTouchStart={(event) => {
          const newPosition =
            calculateSeekPosition(
              event.nativeEvent.locationX
            );

          if (newPosition !== null) {
            isSeeking.current = true;
            seekPosition.current = newPosition;
            setVisualSeekPosition(newPosition);
          }
        }}
        onTouchMove={(event) => {
          const newPosition =
            calculateSeekPosition(
              event.nativeEvent.locationX
            );

          if (newPosition !== null) {
            seekPosition.current = newPosition;
            setVisualSeekPosition(newPosition);
          }
        }}
        onTouchEnd={() => {
          if (!isSeeking.current) {
            return;
          }

          isSeeking.current = false;

          TrackPlayer.seekTo(
            seekPosition.current
          );
        }}
      >
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${(
                  (visualSeekPosition ?? position) /
                  (duration || 1)
                ) * 100
                  }%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {formatTime(
            visualSeekPosition ?? position
          )}
        </Text>

        <Text style={styles.timeText}>
          {formatTime(duration)}
        </Text>
      </View>

      {/* CONTROLES */}
      <View style={styles.controls}>

        {/* ALEATORIO */}
        <TouchableOpacity
          onPress={() => {
            setShuffleMode(current => {
              const newValue = !current;

              if (!newValue) {
                shuffleOrderRef.current = [];
                shufflePositionRef.current = 0;
              }

              return newValue;
            });
          }}
        >
          <FontAwesome
            name="random"
            size={20}
            color={
              shuffleMode
                ? COLORS.primary
                : COLORS.textSecondary
            }
          />
        </TouchableOpacity>

        {/* ANTERIOR */}
        <TouchableOpacity
          onPress={handlePrevious}
        >
          <FontAwesome
            name="step-backward"
            size={24}
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>

        {/* PLAY / PAUSE */}
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() =>
            playing
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
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>

        {/* SIGUIENTE */}
        <TouchableOpacity
          onPress={handleNext}
        >
          <FontAwesome
            name="step-forward"
            size={24}
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>

        {/* BUCLE */}
        <TouchableOpacity
          onPress={handleRepeat}
        >
          <View style={styles.repeatContainer}>
            <FontAwesome
              name="retweet"
              size={20}
              color={
                repeatMode === 'off'
                  ? COLORS.textSecondary
                  : COLORS.primary
              }
            />

            {repeatMode === 'one' && (
              <Text style={styles.repeatOne}>
                1
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* GUARDAR */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveTrack}
      >
        <Text style={styles.saveText}>
          ⬇ Guardar Localmente
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: 'center',
  },

  toggleViewButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    padding: 6,
  },

  toggleViewText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 20,
  },

  lyricsContainer: {
    width: '100%',
    height: 300,
    marginBottom: 20,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },

  artist: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },

  progressContainer: {
    height: 20,
    justifyContent: 'center',
  },

  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  timeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginVertical: 20,
  },

  mainButton: {
    backgroundColor: COLORS.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  repeatContainer: {
    position: 'relative',
  },

  repeatOne: {
    position: 'absolute',
    top: -8,
    right: -7,
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },

  saveButton: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },

  saveText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});