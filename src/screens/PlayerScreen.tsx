// src/screens/PlayerScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import TrackPlayer, {
  useActiveTrack,
  useIsPlaying,
  useProgress,
} from 'react-native-track-player';
import { COLORS } from '../constants/theme';
import { promoteToPermanentAndSave } from '../services/cacheManager';
import { fetchSyncedLyrics } from '../services/lyricsService';
import { LyricLine } from '../utils/lrcParser';
import { SyncedLyricsView } from '../components/SyncedLyricsView';
import {
  setCurrentQueueIndex,
  getPlayerQueue,
  prepareNextTrack,
} from '../services/playerQueue';

export const PlayerScreen = () => {
  const activeTrack = useActiveTrack();
  const { playing } = useIsPlaying();
  const { position, duration } = useProgress();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  const skipStartTime = useRef<number | null>(null);
  const skipTrackId = useRef<string | null>(null);

  useEffect(() => {
    if (activeTrack) {
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

          prepareNextTrack().catch((error) => {
            console.warn(
              '[Queue] No se pudo preparar la siguiente canción:',
              error
            );
          });
        }
      }

      fetchSyncedLyrics(
        activeTrack.title || '',
        activeTrack.artist || '',
        activeTrack.duration || duration
      ).then(setLyrics);
    }
  }, [activeTrack?.id]);

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

  if (!activeTrack) return null;

  const handleSaveTrack = async () => {
    await promoteToPermanentAndSave({
      id: activeTrack.id,
      title: activeTrack.title || 'Desconocido',
      artist: activeTrack.artist || 'Desconocido',
      artwork: activeTrack.artwork || '',
      duration: activeTrack.duration || 0,
    });
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleViewButton}
        onPress={() => setShowLyrics(!showLyrics)}
      >
        <Text style={styles.toggleViewText}>
          {showLyrics ? '🖼 Ver Carátula' : '🎤 Ver Letras'}
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

      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${(position / (duration || 1)) * 100}%`,
            },
          ]}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {formatTime(position)}
        </Text>

        <Text style={styles.timeText}>
          {formatTime(duration)}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => TrackPlayer.skipToPrevious()}
        >
          <Text style={styles.controlIcon}>⏮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mainButton}
          onPress={() =>
            playing
              ? TrackPlayer.pause()
              : TrackPlayer.play()
          }
        >
          <Text style={styles.mainIcon}>
            {playing ? '⏸' : '▶'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            skipStartTime.current = Date.now();

            console.log('[SKIP TEST] ⏭ Pulsado');

            TrackPlayer.skipToNext();
          }}
        >
          <Text style={styles.controlIcon}>⏭</Text>
        </TouchableOpacity>
      </View>

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

  controlIcon: {
    color: COLORS.textPrimary,
    fontSize: 28,
  },

  mainButton: {
    backgroundColor: COLORS.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  mainIcon: {
    color: COLORS.textPrimary,
    fontSize: 28,
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