import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLibrary } from '../hooks/useLibrary';
import { Track, LibraryFilter } from '../types/library';
import { TrackItem } from '../types/track';
import { playTrack } from '../services/playTrack';

export const LibraryScreen = () => {
  const {
    tracks,
    filter,
    setFilter,
    isLoading,
    refreshLibrary,
    toggleFavorite,
    deleteTrackCompletely,
  } = useLibrary();

  // Recarga la pantalla de biblioteca cada vez que el usuario navega a esta pestaña
  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, [refreshLibrary])
  );

  /**
   * Envía la canción seleccionada al motor de audio adaptando Track -> TrackItem.
   */
  const handlePlayTrack = async (track: Track) => {
    try {
      const trackToPlay: TrackItem = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.coverUrl,
        duration: track.duration || 0,
      };

      await playTrack(trackToPlay);
    } catch (error) {
      console.error('[LibraryScreen] Error al reproducir la pista:', error);
    }
  };

  /**
   * Dispara una alerta de confirmación antes del borrado atómico.
   */
  const handleConfirmDelete = (track: Track) => {
    Alert.alert(
      'Eliminar canción',
      `¿Deseas eliminar "${track.title}" de tu biblioteca y liberar su espacio en disco?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteTrackCompletely(track.id),
        },
      ]
    );
  };

  /**
   * Renderizado de chips de filtrado.
   */
  const renderFilterChip = (label: string, value: LibraryFilter) => {
    const isActive = filter === value;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setFilter(value)}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  /**
   * Renderizado individual de cada item de la biblioteca.
   */
  const renderTrackItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.trackCard}
      onPress={() => handlePlayTrack(item)}
    >
      <Image source={{ uri: item.coverUrl }} style={styles.coverImage} />

      <View style={styles.trackInfo}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>

        {item.downloadState === 'downloading' && (
          <View style={[styles.downloadBadge, styles.downloadingBadge]}>
            <Text style={[styles.downloadBadgeText, styles.downloadingBadgeText]}>
              DESCARGANDO...
            </Text>
          </View>
        )}

        {item.downloadState === 'completed' && (
          <View style={styles.downloadBadge}>
            <Text style={styles.downloadBadgeText}>OFFLINE</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => toggleFavorite(item)}
          style={styles.actionButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.favoriteIcon, item.isFavorite && styles.favoriteActive]}>
            {item.isFavorite ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleConfirmDelete(item)}
          style={styles.actionButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Tu Biblioteca</Text>

      {/* Pestañas de Filtrado */}
      <View style={styles.filterContainer}>
        {renderFilterChip('Todas', 'all')}
        {renderFilterChip('Tus Me Gusta', 'favorites')}
        {renderFilterChip('Descargadas', 'downloaded')}
      </View>

      {/* Lista de Canciones */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF5500" />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No hay canciones en esta sección.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#282828',
  },
  chipActive: {
    backgroundColor: '#FF5500',
  },
  chipText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#282828',
  },
  coverImage: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: '#282828',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  artist: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 2,
  },
  downloadBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    borderColor: '#FF5500',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  downloadBadgeText: {
    color: '#FF5500',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  downloadingBadge: {
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
    borderColor: '#FFAA00',
  },
  downloadingBadgeText: {
    color: '#FFAA00',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 6,
  },
  favoriteIcon: {
    color: '#B3B3B3',
    fontSize: 22,
  },
  favoriteActive: {
    color: '#FF5500',
  },
  deleteIcon: {
    color: '#B3B3B3',
    fontSize: 18,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 15,
  },
});