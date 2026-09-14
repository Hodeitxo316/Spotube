// src/screens/SearchScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { searchTracks } from '../services/youtubeService';
import { playTrack } from '../services/playTrack';
import { TrackItem } from '../types/track';
import { COLORS } from '../constants/theme';

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const results = await searchTracks(query);
      setTracks(results);
    } catch (error) {
      console.error('Error durante la búsqueda:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTrackItem = ({ item }: { item: TrackItem }) => (
    <TouchableOpacity style={styles.trackCard} onPress={() => playTrack(item)}>
      <Image source={{ uri: item.artwork }} style={styles.artwork} />
      <View style={styles.trackDetails}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.input}
          placeholder="¿Qué quieres escuchar?"
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={tracks}
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
  searchBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 16,
  },
  loader: { marginTop: 32 },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  trackCard: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  artwork: { width: 52, height: 52, borderRadius: 6 },
  trackDetails: { marginLeft: 12, flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  artist: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
});