// src/screens/SearchScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { youtubeService } from '../services/youtubeService';
import { playTrack } from '../services/playTrack';
import { TrackItem } from '../types/track';

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  // Debounce fluido para no bloquear la escritura en el teclado
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await youtubeService.searchTracks(query);
        setResults(data);
      } catch (err) {
        console.error('[SearchScreen] Error al buscar:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectTrack = async (item: TrackItem) => {
    setLoadingTrackId(item.id);
    try {
      await playTrack(item);
    } catch (err) {
      Alert.alert(
        'Error de Reproducción',
        'No se pudo reproducir este tema. Intenta con otra canción.'
      );
    } finally {
      setLoadingTrackId(null);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: TrackItem }) => {
      const isLoadingThis = loadingTrackId === item.id;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSelectTrack(item)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.artwork }} style={styles.artwork} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          {isLoadingThis && (
            <ActivityIndicator color="#FF5500" size="small" style={styles.loader} />
          )}
        </TouchableOpacity>
      );
    },
    [loadingTrackId]
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="¿Qué quieres escuchar?"
        placeholderTextColor="#888"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading && (
        <ActivityIndicator color="#FF5500" size="large" style={styles.centerLoader} />
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: '#282828',
    color: '#FFF',
    fontSize: 16,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  centerLoader: {
    marginVertical: 10,
  },
  list: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#181818',
    padding: 8,
    borderRadius: 6,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#282828',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 2,
  },
  loader: {
    marginLeft: 8,
  },
});