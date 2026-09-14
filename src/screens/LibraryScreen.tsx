// src/screens/LibraryScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedTracks, removeTrackFromLocalDb } from '../database/trackRepository';
import { playTrack } from '../services/playTrack';
import { TrackItem } from '../types/track';
import { COLORS } from '../constants/theme';

export const LibraryScreen = () => {
  const [savedTracks, setSavedTracks] = useState<TrackItem[]>([]);

  // Carga canciones actualizadas cada vez que la pantalla toma foco
  useFocusEffect(
    useCallback(() => {
      const tracks = getSavedTracks();
      setSavedTracks(tracks);
    }, [])
  );

  const handleRemove = (trackId: string) => {
    removeTrackFromLocalDb(trackId);
    setSavedTracks(getSavedTracks());
  };

  const renderTrackItem = ({ item }: { item: TrackItem }) => (
    <View style={styles.trackCard}>
      <TouchableOpacity
        style={styles.trackInfo}
        onPress={() => playTrack(item)}
      >
        <Image source={{ uri: item.artwork }} style={styles.artwork} />
        <View style={styles.trackDetails}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.offlineBadge}>⬇ Guardado</Text>
            <Text style={styles.artist} numberOfLines={1}> • {item.artist}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleRemove(item.id)}>
        <Text style={styles.deleteIcon}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Tu Biblioteca Offline</Text>

      {savedTracks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tienes canciones guardadas localmente.</Text>
        </View>
      ) : (
        <FlatList
          data={savedTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 48 },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  trackInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  artwork: { width: 52, height: 52, borderRadius: 6 },
  trackDetails: { marginLeft: 12, flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  offlineBadge: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
  artist: { color: COLORS.textSecondary, fontSize: 12 },
  deleteButton: { padding: 8 },
  deleteIcon: { fontSize: 18, color: COLORS.textSecondary },
});