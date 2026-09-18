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
  StatusBar,
} from 'react-native';

import { youtubeService } from '../services/youtubeService';
import { playTrack } from '../services/playTrack';
import { TrackItem } from '../types/track';

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [featuredImageError, setFeaturedImageError] = useState(false);

  // =========================================================
  // BÚSQUEDA
  // =========================================================

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await youtubeService.searchTracks(query);

        if (!cancelled) {
          setResults(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[SearchScreen] Error al buscar:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // =========================================================
  // REINICIAR PORTADA HD AL CAMBIAR RESULTADO
  // =========================================================

  useEffect(() => {
    setFeaturedImageError(false);
  }, [results]);

  // =========================================================
  // REPRODUCCIÓN
  // =========================================================

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

  // =========================================================
  // RESULTADOS
  // =========================================================

  const mainResult = results.length > 0 ? results[0] : null;
  const songResults = results.slice(1);


  // =========================================================
  // ITEM DE CANCIÓN
  // =========================================================

  const renderItem = useCallback(
    ({ item, index }: { item: TrackItem; index: number }) => {
      const isLoadingThis = loadingTrackId === item.id;

      return (
        <TouchableOpacity
          style={styles.songRow}
          onPress={() => handleSelectTrack(item)}
          activeOpacity={0.72}
        >
          {/* NÚMERO */}
          <View style={styles.songNumberContainer}>
            <Text style={styles.songNumber}>
              {String(index + 2).padStart(2, '0')}
            </Text>
          </View>

          {/* CARÁTULA */}
          <Image
            source={{ uri: item.artwork }}
            style={styles.songArtwork}
            resizeMode="cover"
          />

          {/* INFORMACIÓN */}
          <View style={styles.songInfo}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {item.title}
            </Text>

            <Text style={styles.songArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>

          {/* PLAY */}
          {isLoadingThis ? (
            <ActivityIndicator
              color="#FF5500"
              size="small"
              style={styles.songLoader}
            />
          ) : (
            <View style={styles.songPlay}>
              <Text style={styles.songPlayIcon}>▶</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [loadingTrackId]
  );

  // =========================================================
  // UI
  // =========================================================

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
      />

      <FlatList
        data={songResults}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}

        // =====================================================
        // TODO EL CONTENIDO SUPERIOR HACE SCROLL
        // =====================================================

        ListHeaderComponent={
          <>
            {/* =====================================================
                HEADER
            ===================================================== */}

            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>EXPLORAR</Text>
                <Text style={styles.headerTitle}>Buscar</Text>
              </View>

              <View style={styles.headerDot} />
            </View>

            {/* =====================================================
                BUSCADOR
            ===================================================== */}

            <View style={styles.searchBar}>
              <View style={styles.searchIconContainer}>
                <Text style={styles.searchIcon}>⌕</Text>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Canciones, artistas..."
                placeholderTextColor="#70727A"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor="#FF5500"
              />

              {query.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setQuery('')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearText}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* =====================================================
                LOADING
            ===================================================== */}

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  color="#FF5500"
                  size="small"
                />

                <Text style={styles.loadingText}>
                  Buscando música...
                </Text>
              </View>
            )}

            {/* =====================================================
                RESULTADO PRINCIPAL
            ===================================================== */}

            {mainResult && (
              <View style={styles.mainSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEyebrow}>
                    RESULTADO PRINCIPAL
                  </Text>

                  <View style={styles.sectionLine} />
                </View>

                <TouchableOpacity
                  style={styles.featuredCard}
                  activeOpacity={0.9}
                  onPress={() => handleSelectTrack(mainResult)}
                >
                  {/* IMAGEN */}
                  <View style={styles.featuredImageWrapper}>
                    <Image
                      source={{
                        uri: featuredImageError
                          ? `https://i.ytimg.com/vi/${mainResult.id}/hqdefault.jpg`
                          : mainResult.artwork,
                      }}
                      style={styles.featuredArtwork}
                      resizeMode="cover"
                      onError={() => setFeaturedImageError(true)}
                    />

                    {/* OVERLAY */}
                    <View style={styles.imageOverlay} />

                    {/* BADGE */}
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>
                        01
                      </Text>
                    </View>

                    {/* PLAY */}
                    <View style={styles.featuredPlayButton}>
                      {loadingTrackId === mainResult.id ? (
                        <ActivityIndicator
                          color="#111217"
                          size="small"
                        />
                      ) : (
                        <Text style={styles.featuredPlayIcon}>
                          ▶
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* INFORMACIÓN */}
                  <View style={styles.featuredInfo}>
                    <Text
                      style={styles.featuredTitle}
                      numberOfLines={2}
                    >
                      {mainResult.title}
                    </Text>

                    <Text
                      style={styles.featuredArtist}
                      numberOfLines={1}
                    >
                      {mainResult.artist}
                    </Text>

                    <View style={styles.featuredBottom}>
                      <View style={styles.featuredTag}>
                        <View style={styles.featuredTagDot} />

                        <Text style={styles.featuredTagText}>
                          CANCIÓN
                        </Text>
                      </View>

                      <Text style={styles.featuredAction}>
                        REPRODUCIR
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* =====================================================
                CANCIONES
            ===================================================== */}

            {songResults.length > 0 && (
              <View style={styles.songsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Canciones
                  </Text>

                  <Text style={styles.resultCount}>
                    {songResults.length} resultados
                  </Text>
                </View>
              </View>
            )}
          </>
        }
      />
    </View>
  );
};

// =============================================================
// ESTILOS
// =============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111217',
    paddingTop: 58,
    paddingHorizontal: 18,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  eyebrow: {
    color: '#FF5500',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 5,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 38,
  },

  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5500',
    marginBottom: 7,
    marginRight: 3,
  },

  // SEARCH
  searchBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1D24',
    borderRadius: 17,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
    marginBottom: 25,
  },

  searchIconContainer: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  searchIcon: {
    color: '#A4A6AE',
    fontSize: 27,
    lineHeight: 30,
    transform: [{ rotate: '-15deg' }],
  },

  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },

  clearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#292B33',
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearText: {
    color: '#A9ABB2',
    fontSize: 21,
    lineHeight: 22,
    fontWeight: '400',
  },

  // LOADING
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 9,
  },

  loadingText: {
    color: '#777981',
    fontSize: 12,
    fontWeight: '500',
  },

  // SECTION HEADER
  mainSection: {
    marginBottom: 28,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionEyebrow: {
    color: '#777981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },

  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.075)',
    marginLeft: 12,
  },

  // FEATURED CARD
  featuredCard: {
    backgroundColor: '#191B22',
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
  },

  featuredImageWrapper: {
    width: '100%',
    aspectRatio: 1.42,
    backgroundColor: '#24262D',
    position: 'relative',
    overflow: 'hidden',
  },

  featuredArtwork: {
    width: '100%',
    height: '100%',
  },

  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  featuredBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,18,23,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  featuredPlayButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FF5500',
    alignItems: 'center',
    justifyContent: 'center',
  },

  featuredPlayIcon: {
    color: '#111217',
    fontSize: 17,
    marginLeft: 3,
  },

  featuredInfo: {
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 16,
  },

  featuredTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.55,
    lineHeight: 28,
  },

  featuredArtist: {
    color: '#989AA2',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },

  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 17,
  },

  featuredTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  featuredTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5500',
    marginRight: 7,
  },

  featuredTagText: {
    color: '#73757D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  featuredAction: {
    color: '#FF5500',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  // SONGS
  songsSection: {
    marginBottom: 3,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  resultCount: {
    marginLeft: 'auto',
    color: '#686A72',
    fontSize: 11,
    fontWeight: '600',
  },

  // LIST
  list: {
    paddingTop: 3,
    paddingBottom: 45,
  },

  songRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.045)',
  },

  songNumberContainer: {
    width: 26,
    alignItems: 'flex-start',
  },

  songNumber: {
    color: '#555760',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  songArtwork: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#24262D',
  },

  songInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },

  songTitle: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.15,
  },

  songArtist: {
    color: '#777981',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  songPlay: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#181A20',
  },

  songPlayIcon: {
    color: '#B9BAC0',
    fontSize: 10,
    marginLeft: 2,
  },

  songLoader: {
    width: 35,
  },
});

