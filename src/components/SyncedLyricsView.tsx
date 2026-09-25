// src/components/SyncedLyricsView.tsx

import React, {
  memo,
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

/*
 * ============================================================
 * FILA DE LETRA
 * ============================================================
 *
 * La línea activa cambia inmediatamente.
 *
 * Las animaciones solamente afectan a:
 *
 * - opacidad
 * - escala
 *
 * Nunca retrasamos la activación real de la línea.
 */
const LyricRow = memo<LyricRowProps>(
  ({
    item,
    index,
    activeIndex,
  }) => {
    const opacity = useRef(
      new Animated.Value(0.22)
    ).current;

    const scale = useRef(
      new Animated.Value(0.96)
    ).current;

    const distance =
      activeIndex >= 0
        ? Math.abs(index - activeIndex)
        : 99;

    const targetOpacity =
      distance === 0
        ? 1
        : distance === 1
          ? 0.62
          : distance === 2
            ? 0.38
            : 0.20;

    const targetScale =
      distance === 0
        ? 1.055
        : distance === 1
          ? 0.985
          : 0.96;

    const isActive =
      distance === 0;

    useEffect(() => {
      /*
       * Cancelamos cualquier transición anterior antes
       * de comenzar la nueva.
       *
       * Esto es importante cuando hay muchas líneas rápidas.
       */
      opacity.stopAnimation();
      scale.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: targetOpacity,
          duration: isActive ? 90 : 120,
          useNativeDriver: true,
        }),

        Animated.timing(scale, {
          toValue: targetScale,
          duration: isActive ? 100 : 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, [
      targetOpacity,
      targetScale,
      isActive,
      opacity,
      scale,
    ]);

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
            isActive &&
              styles.activeText,
          ]}
        >
          {item.text}
        </Text>
      </Animated.View>
    );
  }
);

LyricRow.displayName =
  'LyricRow';

export const SyncedLyricsView: React.FC<
  SyncedLyricsViewProps
> = ({
  lyrics,
  currentTime,
  loading = false,
}) => {
  const flatListRef =
    useRef<FlatList<LyricLine>>(null);

  /*
   * ============================================================
   * NORMALIZACIÓN
   * ============================================================
   *
   * No modificamos el array original recibido desde PlayerScreen.
   */
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
          line.time >= 0 &&
          typeof line.text === 'string' &&
          line.text.trim().length > 0
      )
      .map(line => ({
        time: line.time,
        text: line.text.trim(),
      }))
      .sort(
        (a, b) =>
          a.time - b.time
      );
  }, [lyrics]);

  /*
   * ============================================================
   * LÍNEA ACTIVA
   * ============================================================
   *
   * Buscamos la última línea cuyo timestamp ya ha llegado.
   *
   * Ejemplo:
   *
   * 10.00 -> línea A
   * 12.50 -> línea B
   * 15.20 -> línea C
   *
   * currentTime = 13.00
   * activeIndex = B
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

    while (low <= high) {
      const middle =
        Math.floor(
          (low + high) / 2
        );

      const middleTime =
        normalizedLyrics[middle].time;

      if (
        currentTime >=
        middleTime
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
   * Guardamos la última línea que hemos centrado.
   *
   * Esto evita mandar scrollToIndex repetidamente
   * cuando React recibe renders que no han cambiado
   * realmente de línea.
   */
  const lastScrolledIndexRef =
    useRef(-1);

  /*
   * ============================================================
   * CAMBIO DE CANCIÓN / NUEVAS LETRAS
   * ============================================================
   */
  useEffect(() => {
    lastScrolledIndexRef.current =
      -1;

    if (
      normalizedLyrics.length === 0
    ) {
      return;
    }

    requestAnimationFrame(() => {
      if (
        !flatListRef.current
      ) {
        return;
      }

      /*
       * Si ya sabemos qué línea está activa,
       * empezamos directamente cerca de ella.
       *
       * Si todavía estamos en 0, mostramos
       * el principio.
       */
      const initialIndex =
        activeIndex >= 0
          ? activeIndex
          : 0;

      flatListRef.current.scrollToIndex(
        {
          index: initialIndex,
          animated: false,
          viewPosition: 0.42,
        }
      );

      lastScrolledIndexRef.current =
        initialIndex;
    });
  }, [
    normalizedLyrics,
  ]);

  /*
   * ============================================================
   * SEGUIMIENTO DE LA LÍNEA ACTIVA
   * ============================================================
   *
   * Solo hacemos scroll cuando REALMENTE cambia la línea.
   *
   * Esto es muy importante porque currentTime puede actualizarse
   * muchas veces por segundo.
   */
  useEffect(() => {
    if (
      activeIndex < 0 ||
      normalizedLyrics.length === 0 ||
      !flatListRef.current
    ) {
      return;
    }

    if (
      lastScrolledIndexRef.current ===
      activeIndex
    ) {
      return;
    }

    lastScrolledIndexRef.current =
      activeIndex;

    requestAnimationFrame(() => {
      try {
        flatListRef.current?.scrollToIndex(
          {
            index: activeIndex,
            animated: true,
            viewPosition: 0.42,
          }
        );
      } catch {
        /*
         * FlatList puede todavía no haber medido
         * todos los elementos.
         *
         * onScrollToIndexFailed se encargará
         * del segundo intento.
         */
      }
    });
  }, [
    activeIndex,
    normalizedLyrics.length,
  ]);

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */
  if (loading) {
    return (
      <View
        style={
          styles.emptyContainer
        }
      >
        <ActivityIndicator
          size="small"
          color="#FFFFFF"
          style={
            styles.loadingIndicator
          }
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Cargando letras...
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
          Estamos buscando las letras
          sincronizadas
        </Text>
      </View>
    );
  }

  /*
   * ============================================================
   * SIN LETRAS
   * ============================================================
   */
  if (
    normalizedLyrics.length === 0
  ) {
    return (
      <View
        style={
          styles.emptyContainer
        }
      >
        <Text
          style={
            styles.emptyTitle
          }
        >
          Letras no disponibles
        </Text>

        <Text
          style={
            styles.emptyText
          }
        >
          Esta canción no tiene letras
          sincronizadas.
        </Text>
      </View>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */
  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={normalizedLyrics}
        keyExtractor={(
          item,
          index
        ) =>
          `lyric-${item.time}-${index}`
        }
        showsVerticalScrollIndicator={
          false
        }
        showsHorizontalScrollIndicator={
          false
        }
        bounces={true}
        removeClippedSubviews={
          false
        }
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={16}
        windowSize={11}
        scrollEventThrottle={16}
        contentContainerStyle={
          styles.container
        }
        getItemLayout={(
          _data,
          index
        ) => ({
          length: 96,
          offset: 96 * index,
          index,
        })}
        onScrollToIndexFailed={info => {
          /*
           * Primer intento usando la posición aproximada.
           */
          const approximateOffset =
            Math.max(
              0,
              info.averageItemLength *
                info.index
            );

          flatListRef.current?.scrollToOffset(
            {
              offset:
                approximateOffset,
              animated: false,
            }
          );

          /*
           * Después de que FlatList haya tenido
           * oportunidad de renderizar la zona,
           * repetimos el scroll exacto.
           */
          setTimeout(() => {
            if (
              !flatListRef.current
            ) {
              return;
            }

            flatListRef.current.scrollToIndex(
              {
                index: info.index,
                animated: false,
                viewPosition: 0.42,
              }
            );
          }, 80);
        }}
        renderItem={({
          item,
          index,
        }) => (
          <LyricRow
            item={item}
            index={index}
            activeIndex={
              activeIndex
            }
          />
        )}
      />
    </View>
  );
};

const styles =
  StyleSheet.create({
    wrapper: {
      flex: 1,
      width: '100%',
    },

    container: {
      paddingTop: 120,
      paddingBottom: 190,
      paddingHorizontal: 22,
    },

    lineContainer: {
      minHeight: 96,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
    },

    lyricText: {
      color: '#FFFFFF',
      fontSize: 23,
      lineHeight: 31,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 10,
      letterSpacing: -0.25,
    },

    activeText: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '800',
      letterSpacing: -0.45,
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
      color:
        'rgba(255,255,255,0.50)',
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
      color:
        'rgba(255,255,255,0.50)',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
  });