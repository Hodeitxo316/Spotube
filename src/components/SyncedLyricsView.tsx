// src/components/SyncedLyricsView.tsx
import React, { useEffect, useRef } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { LyricLine } from '../utils/lrcParser';
import { COLORS } from '../constants/theme';

interface SyncedLyricsViewProps {
  lyrics: LyricLine[];
  currentTime: number;
}

export const SyncedLyricsView: React.FC<SyncedLyricsViewProps> = ({ lyrics, currentTime }) => {
  const flatListRef = useRef<FlatList>(null);

  // Calcula el índice de la línea actual
  const activeIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  useEffect(() => {
    if (activeIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.4,
      });
    }
  }, [activeIndex]);

  if (lyrics.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Letras sincronizadas no disponibles</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={lyrics}
      keyExtractor={(_, index) => index.toString()}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item, index }) => {
        const isActive = index === activeIndex;
        return (
          <Text style={[styles.lyricText, isActive && styles.activeText]}>
            {item.text}
          </Text>
        );
      }}
      contentContainerStyle={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 40, paddingHorizontal: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  lyricText: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 10,
    textAlign: 'center',
    opacity: 0.5,
  },
  activeText: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
    opacity: 1,
  },
});