// src/components/SyncedLyricsView.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  FlatList,
  Text,
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';

import { LyricLine } from '../utils/lrcParser';

interface SyncedLyricsViewProps {
  lyrics: LyricLine[];
  currentTime: number;
  loading?: boolean;
}

interface LyricRowProps {
  item: LyricLine;
  index: number;
  activeIndex: number;
}

const LyricRow: React.FC<LyricRowProps> = ({
  item,
  index,
  activeIndex,
}) => {
  const opacity = useRef(
    new Animated.Value(0.35)
  ).current;

  const scale = useRef(
    new Animated.Value(0.96)
  ).current;

  const distance =
    activeIndex >= 0
      ? Math.abs(index - activeIndex)
      : 4;

  const targetOpacity =
    distance === 0
      ? 1
      : distance === 1
        ? 0.62
        : distance === 2
          ? 0.38
          : 0.18;

  const targetScale =
    distance === 0
      ? 1.06
      : distance === 1
        ? 0.99
        : 0.96;

  useEffect(() => {
    /*
     * IMPORTANTE:
     * La línea activa debe cambiar inmediatamente cuando
     * llega su timestamp. No usamos 300ms aquí porque eso
     * hacía que las letras rápidas fueran visualmente tarde.
     *
     * La transición sigue existiendo, pero es muy corta.
     */
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: targetOpacity,
        duration: 70,
        useNativeDriver: true,
      }),

      Animated.timing(scale, {
        toValue: targetScale,
        duration: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    targetOpacity,
    targetScale,
    opacity,
    scale,
  ]);

  const isActive = distance === 0;

  return (
    <Animated.View
      style={[
        styles.lineContainer,
        {
          opacity,
          transform: [
            {
              scale,
            },
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.lyricText,
          isActive && styles.activeText,
        ]}
      >
        {item.text}
      </Text>
    </Animated.View>
  );
};

export const SyncedLyricsView: React.FC<
  SyncedLyricsViewProps
> = ({
  lyrics,
  currentTime,
  loading = false,
}) => {
  const flatListRef =
    useRef<FlatList<LyricLine>>(null);

  const normalizedLyrics = useMemo(() => {
    if (!Array.isArray(lyrics)) {
      return [];
    }

    return lyrics
      .filter(
        line =>
          line &&
          typeof line.time === 'number' &&
          Number.isFinite(line.time) &&
          typeof line.text === 'string'
      )
      .sort(
        (a, b) => a.time - b.time
      );
  }, [lyrics]);

  /*
   * ============================================================
   * LÍNEA ACTIVA
   * ============================================================
   *
   * No añadimos ningún offset artificial.
   *
   * Si una línea empieza exactamente en 18.420s,
   * se activa exactamente cuando currentTime alcanza 18.420s.
   *
   * Esto es especialmente importante en canciones rápidas,
   * donde 150ms puede ser una diferencia muy visible.
   */
  const activeIndex = useMemo(() => {
    if (
      normalizedLyrics.length === 0 ||
      !Number.isFinite(currentTime)
    ) {
      return -1;
    }

    let low = 0;
    let high =
      normalizedLyrics.length - 1;
    let result = -1;

    /*
     * Búsqueda binaria.
     *
     * Además de ser más eficiente con canciones que tienen
     * muchas líneas, evita recorrer todas las letras cada vez
     * que se actualiza el reloj.
     */
    while (low <= high) {
      const middle =
        Math.floor(
          (low + high) / 2
        );

      if (
        currentTime >=
        normalizedLyrics[middle].time
      ) {
        result = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return result;
  }, [
    normalizedLyrics,
    currentTime,
  ]);

  /*
   * Cuando cambia la canción/letra,
   * volvemos al principio.
   */
  useEffect(() => {
    if (normalizedLyrics.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    });
  }, [normalizedLyrics]);

  /*
   * Seguimos automáticamente la línea activa.
   *
   * Usamos animated:false para que el scroll no introduzca
   * retraso respecto al timestamp real de la letra.
   *
   * La animación de la propia línea sigue dando el efecto
   * visual suave.
   */
  useEffect(() => {
    if (
      activeIndex < 0 ||
      !flatListRef.current ||
      normalizedLyrics.length === 0
    ) {
      return;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: activeIndex,
        animated: false,
        viewPosition: 0.42,
      });
    });
  }, [
    activeIndex,
    normalizedLyrics.length,
  ]);

  /*
   * Mientras LRCLIB está buscando las letras,
   * NO mostramos "Letras no disponibles".
   */
  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator
          size="small"
          color="#FFFFFF"
          style={styles.loadingIndicator}
        />

        <Text style={styles.loadingTitle}>
          Cargando letras...
        </Text>

        <Text style={styles.loadingText}>
          Estamos buscando las letras sincronizadas
        </Text>
      </View>
    );
  }

  /*
   * Solo mostramos "no disponibles"
   * cuando realmente terminó la búsqueda
   * y no se encontraron letras.
   */
  if (normalizedLyrics.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          Letras no disponibles
        </Text>

        <Text style={styles.emptyText}>
          Esta canción no tiene letras sincronizadas.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={normalizedLyrics}
        keyExtractor={(_, index) =>
          `lyric-${index}`
        }
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        scrollEventThrottle={16}
        contentContainerStyle={
          styles.container
        }
        onScrollToIndexFailed={info => {
          flatListRef.current?.scrollToOffset({
            offset: Math.max(
              0,
              info.averageItemLength *
              info.index
            ),
            animated: false,
          });

          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
              viewPosition: 0.42,
            });
          }, 50);
        }}
        renderItem={({
          item,
          index,
        }) => (
          <LyricRow
            item={item}
            index={index}
            activeIndex={activeIndex}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
  },

  container: {
    paddingTop: 100,
    paddingBottom: 180,
    paddingHorizontal: 22,
  },

  lineContainer: {
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },

  lyricText: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  activeText: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '800',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 35,
  },

  loadingIndicator: {
    marginBottom: 14,
  },

  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  loadingText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  emptyText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});