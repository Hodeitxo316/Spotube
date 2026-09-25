// src/screens/HomeScreen.tsx

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    ActivityIndicator,
    FlatList,
    Image,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    DeviceEventEmitter,
} from 'react-native';

import {
    useFocusEffect,
    useNavigation,
} from '@react-navigation/native';

import FontAwesome from '@react-native-vector-icons/fontawesome';

import { TrackItem } from '../types/track';

import {
    useLibrary,
} from '../hooks/useLibrary';

import {
    getListeningHistory,
    getMostPlayedAlbums,
    getMostPlayedArtists,
    getMostPlayedTracks,
    getRecentlyPlayedTracks,
    ListeningHistoryItem,
    LISTENING_HISTORY_UPDATED_EVENT,
    ListeningArtistSummary,
    ListeningAlbumSummary,
} from '../services/listeningHistory';

import {
    setPlayerQueue,
    prepareNextTrack,
} from '../services/playerQueue';

import {
    playTrack,
} from '../services/playTrack';

import {
    COLORS,
} from '../constants/theme';

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type ArtistSummary = {
    id: string;
    name: string;
    artwork: string;
    artistId?: string;
    artistThumbnail?: string;
    totalPlayCount: number;
    trackCount: number;
    topTrack?: TrackItem;
};

type AlbumSummary = {
    id: string;
    name: string;
    artist: string;
    artwork: string;
    tracks: TrackItem[];
    isEP: boolean;
    totalPlayCount: number;
    lastPlayed: number;
};

type HomeSection =
    | {
        key: string;
        type: 'featured';
        title: string;
        subtitle?: string;
        data: TrackItem[];
    }
    | {
        key: string;
        type: 'tracks';
        title: string;
        subtitle?: string;
        data: TrackItem[];
    }
    | {
        key: string;
        type: 'artists';
        title: string;
        subtitle?: string;
        data: ArtistSummary[];
    }
    | {
        key: string;
        type: 'albums';
        title: string;
        subtitle?: string;
        data: AlbumSummary[];
    };

type HomeNavigation = {
    navigate: (
        screen: string,
        params?: any,
    ) => void;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const safeText = (
    value: unknown,
    fallback: string,
): string => {
    if (
        typeof value !== 'string' ||
        !value.trim()
    ) {
        return fallback;
    }

    return value.trim();
};

const normalizeKey = (
    value: string,
): string => {
    return value
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ');
};

const historyToTrack = (
    item: ListeningHistoryItem,
): TrackItem => {
    return {
        id: item.trackId,
        title: safeText(
            item.title,
            'Canción',
        ),
        artist: safeText(
            item.artist,
            'Artista',
        ),
        artwork: safeText(
            item.artwork,
            '',
        ),
        duration:
            item.duration ?? 0,
    };
};

const getArtwork = (
    artwork?: string,
): string => {
    if (
        typeof artwork !== 'string'
    ) {
        return '';
    }

    return artwork.trim();
};

const deduplicateTracks = (
    tracks: TrackItem[],
): TrackItem[] => {
    const seen =
        new Set<string>();

    const result: TrackItem[] = [];

    for (const track of tracks) {
        if (!track.id) {
            continue;
        }

        if (seen.has(track.id)) {
            continue;
        }

        seen.add(track.id);
        result.push(track);
    }

    return result;
};

const diversifyTracks = (
    tracks: TrackItem[],
    limit: number,
): TrackItem[] => {
    const result: TrackItem[] = [];

    const artistCounts =
        new Map<string, number>();

    for (const track of tracks) {
        const artistKey =
            normalizeKey(
                safeText(
                    track.artist,
                    'unknown',
                ),
            );

        const count =
            artistCounts.get(
                artistKey,
            ) ?? 0;

        if (count >= 2) {
            continue;
        }

        artistCounts.set(
            artistKey,
            count + 1,
        );

        result.push(track);

        if (
            result.length >=
            limit
        ) {
            break;
        }
    }

    return result;
};

const getGreeting = (): string => {
    const hour =
        new Date().getHours();

    if (
        hour >= 6 &&
        hour < 13
    ) {
        return 'Buenos días';
    }

    if (
        hour >= 13 &&
        hour < 20
    ) {
        return 'Buenas tardes';
    }

    return 'Buenas noches';
};

const getHeaderSubtitle = (
    historyLength: number,
): string => {
    if (historyLength === 0) {
        return 'Empieza a escuchar y SpotTube irá aprendiendo de ti.';
    }

    if (historyLength < 5) {
        return 'Estamos empezando a conocer tus gustos.';
    }

    if (historyLength < 15) {
        return 'Tu música empieza a tomar forma.';
    }

    return 'Una selección basada en lo que realmente escuchas.';
};

const getArtistInitials = (
    name: string,
): string => {
    const clean =
        safeText(
            name,
            'A',
        );

    const words =
        clean
            .split(/\s+/)
            .filter(Boolean);

    if (words.length === 1) {
        return words[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[1].charAt(0)
    ).toUpperCase();
};

/* -------------------------------------------------------------------------- */
/* ARTWORK                                                                    */
/* -------------------------------------------------------------------------- */

const Artwork = memo(
    ({
        uri,
        size,
        radius = 14,
    }: {
        uri?: string;
        size: number;
        radius?: number;
    }) => {
        const source =
            getArtwork(uri);

        if (!source) {
            return (
                <View
                    style={[
                        styles.artworkPlaceholder,
                        {
                            width: size,
                            height: size,
                            borderRadius: radius,
                        },
                    ]}
                >
                    <FontAwesome
                        name="music"
                        size={Math.max(
                            20,
                            size * 0.22,
                        )}
                        color="#555555"
                    />
                </View>
            );
        }

        return (
            <Image
                source={{
                    uri: source,
                }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: radius,
                }}
                resizeMode="cover"
            />
        );
    },
);

Artwork.displayName =
    'Artwork';

/* -------------------------------------------------------------------------- */
/* ARTIST ARTWORK                                                             */
/* -------------------------------------------------------------------------- */

const ArtistArtwork = memo(
    ({
        artist,
        size,
    }: {
        artist: ArtistSummary;
        size: number;
    }) => {
        /*
         * Preferimos SIEMPRE la foto real del artista si existe.
         *
         * Si el historial antiguo no tiene artistThumbnail,
         * utilizamos la portada de su canción principal como
         * fallback visual. Así nunca queda un círculo vacío.
         */
        const thumbnail =
            getArtwork(
                artist.artistThumbnail,
            );

        const fallbackArtwork =
            getArtwork(
                artist.artwork,
            );

        const source =
            thumbnail ||
            fallbackArtwork;

        if (source) {
            return (
                <Image
                    source={{
                        uri: source,
                    }}
                    style={{
                        width: size,
                        height: size,
                        borderRadius:
                            size / 2,
                    }}
                    resizeMode="cover"
                />
            );
        }

        return (
            <View
                style={[
                    styles.artistFallback,
                    {
                        width: size,
                        height: size,
                        borderRadius:
                            size / 2,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.artistFallbackText,
                        {
                            fontSize:
                                size * 0.26,
                        },
                    ]}
                >
                    {getArtistInitials(
                        artist.name,
                    )}
                </Text>
            </View>
        );
    },
);

ArtistArtwork.displayName =
    'ArtistArtwork';

/* -------------------------------------------------------------------------- */
/* FEATURED HERO                                                              */
/* -------------------------------------------------------------------------- */

const FeaturedTrackCard = memo(
    ({
        track,
        playCount,
        onPress,
    }: {
        track: TrackItem;
        playCount: number;
        onPress: () => void;
    }) => {
        return (
            <TouchableOpacity
                activeOpacity={0.94}
                onPress={onPress}
                style={
                    styles.heroCard
                }
                accessibilityRole="button"
                accessibilityLabel={`Reproducir ${track.title} de ${track.artist}`}
            >
                <View
                    style={
                        styles.heroBackground
                    }
                >
                    <Artwork
                        uri={
                            track.artwork
                        }
                        size={999}
                        radius={0}
                    />

                    <View
                        style={
                            styles.heroDarkOverlay
                        }
                    />

                    <View
                        style={
                            styles.heroOrangeGlow
                        }
                    />

                    <View
                        style={
                            styles.heroTopFade
                        }
                    />
                </View>

                <View
                    style={
                        styles.heroContent
                    }
                >
                    <View
                        style={
                            styles.heroLabelRow
                        }
                    >
                        <View
                            style={
                                styles.heroLiveDot
                            }
                        />

                        <Text
                            style={
                                styles.heroLabel
                            }
                        >
                            TU NÚMERO UNO
                        </Text>
                    </View>

                    <View
                        style={
                            styles.heroBottom
                        }
                    >
                        <View
                            style={
                                styles.heroTextBlock
                            }
                        >
                            <Text
                                style={
                                    styles.heroTitle
                                }
                                numberOfLines={
                                    2
                                }
                            >
                                {safeText(
                                    track.title,
                                    'Canción',
                                )}
                            </Text>

                            <Text
                                style={
                                    styles.heroArtist
                                }
                                numberOfLines={
                                    1
                                }
                            >
                                {safeText(
                                    track.artist,
                                    'Artista',
                                )}
                            </Text>

                            <View
                                style={
                                    styles.heroStats
                                }
                            >
                                <FontAwesome
                                    name="headphones"
                                    size={10}
                                    color="#D0D0D0"
                                />

                                <Text
                                    style={
                                        styles.heroStatsText
                                    }
                                >
                                    {playCount}{' '}
                                    {playCount ===
                                        1
                                        ? 'reproducción'
                                        : 'reproducciones'}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={
                                styles.heroPlay
                            }
                        >
                            <FontAwesome
                                name="play"
                                size={18}
                                color="#FFFFFF"
                            />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    },
);

FeaturedTrackCard.displayName =
    'FeaturedTrackCard';

/* -------------------------------------------------------------------------- */
/* TRACK CARD                                                                 */
/* -------------------------------------------------------------------------- */

const TrackCard = memo(
    ({
        track,
        playCount,
        onPress,
    }: {
        track: TrackItem;
        playCount?: number;
        onPress: () => void;
    }) => {
        return (
            <TouchableOpacity
                style={
                    styles.trackCard
                }
                activeOpacity={0.88}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Reproducir ${track.title} de ${track.artist}`}
            >
                <View
                    style={
                        styles.trackArtworkWrapper
                    }
                >
                    <Artwork
                        uri={
                            track.artwork
                        }
                        size={156}
                        radius={17}
                    />

                    <View
                        style={
                            styles.trackImageShade
                        }
                    />

                    <View
                        style={
                            styles.trackPlayButton
                        }
                    >
                        <FontAwesome
                            name="play"
                            size={12}
                            color="#FFFFFF"
                        />
                    </View>
                </View>

                <Text
                    style={
                        styles.trackTitle
                    }
                    numberOfLines={1}
                >
                    {safeText(
                        track.title,
                        'Canción',
                    )}
                </Text>

                <Text
                    style={
                        styles.trackArtist
                    }
                    numberOfLines={1}
                >
                    {safeText(
                        track.artist,
                        'Artista',
                    )}
                </Text>

                {playCount !==
                    undefined ? (
                    <View
                        style={
                            styles.trackCount
                        }
                    >
                        <FontAwesome
                            name="headphones"
                            size={8}
                            color="#777777"
                        />

                        <Text
                            style={
                                styles.trackCountText
                            }
                        >
                            {playCount}x
                        </Text>
                    </View>
                ) : null}
            </TouchableOpacity>
        );
    },
);

TrackCard.displayName =
    'TrackCard';

/* -------------------------------------------------------------------------- */
/* ARTIST CARD                                                                */
/* -------------------------------------------------------------------------- */

const ArtistCard = memo(
    ({
        artist,
        onPress,
    }: {
        artist: ArtistSummary;
        onPress?: () => void;
    }) => {
        const content = (
            <>
                <View
                    style={
                        styles.artistImageShadow
                    }
                >
                    <View
                        style={
                            styles.artistImageRing
                        }
                    >
                        <ArtistArtwork
                            artist={artist}
                            size={116}
                        />
                    </View>
                </View>

                <Text
                    style={
                        styles.artistName
                    }
                    numberOfLines={1}
                >
                    {artist.name}
                </Text>

                <Text
                    style={
                        styles.artistPlays
                    }
                >
                    {artist.totalPlayCount}{' '}
                    {artist.totalPlayCount === 1
                        ? 'reproducción'
                        : 'reproducciones'}
                </Text>
            </>
        );

        if (!onPress) {
            return (
                <View
                    style={
                        styles.artistCard
                    }
                >
                    {content}
                </View>
            );
        }

        return (
            <TouchableOpacity
                style={
                    styles.artistCard
                }
                activeOpacity={0.85}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Abrir artista ${artist.name}`}
            >
                {content}
            </TouchableOpacity>
        );
    },
);

ArtistCard.displayName =
    'ArtistCard';

/* -------------------------------------------------------------------------- */
/* ALBUM CARD                                                                 */
/* -------------------------------------------------------------------------- */

const AlbumCard = memo(
    ({
        album,
        onPress,
    }: {
        album: AlbumSummary;
        onPress: () => void;
    }) => {
        return (
            <TouchableOpacity
                style={
                    styles.albumCard
                }
                activeOpacity={0.88}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${album.isEP ? 'EP' : 'álbum'} ${album.name}`}
            >
                <View
                    style={
                        styles.albumArtwork
                    }
                >
                    <Artwork
                        uri={
                            album.artwork
                        }
                        size={158}
                        radius={18}
                    />

                    <View
                        style={
                            styles.albumShade
                        }
                    />

                    <View
                        style={
                            styles.albumBadge
                        }
                    >
                        <Text
                            style={
                                styles.albumBadgeText
                            }
                        >
                            {album.isEP
                                ? 'EP'
                                : 'ÁLBUM'}
                        </Text>
                    </View>
                </View>

                <Text
                    style={
                        styles.albumTitle
                    }
                    numberOfLines={2}
                >
                    {safeText(
                        album.name,
                        'Proyecto',
                    )}
                </Text>

                <Text
                    style={
                        styles.albumArtist
                    }
                    numberOfLines={1}
                >
                    {safeText(
                        album.artist,
                        'Artista',
                    )}
                </Text>

                <Text
                    style={
                        styles.albumPlays
                    }
                >
                    {album.totalPlayCount}{' '}
                    {album.totalPlayCount === 1
                        ? 'reproducción'
                        : 'reproducciones'}
                </Text>
            </TouchableOpacity>
        );
    },
);

AlbumCard.displayName =
    'AlbumCard';

/* -------------------------------------------------------------------------- */
/* SECTION HEADER                                                             */
/* -------------------------------------------------------------------------- */

const SectionHeader = memo(
    ({
        title,
        subtitle,
    }: {
        title: string;
        subtitle?: string;
    }) => {
        return (
            <View
                style={
                    styles.sectionHeader
                }
            >
                <View
                    style={
                        styles.sectionHeaderText
                    }
                >
                    <Text
                        style={
                            styles.sectionTitle
                        }
                    >
                        {title}
                    </Text>

                    {subtitle ? (
                        <Text
                            style={
                                styles.sectionSubtitle
                            }
                            numberOfLines={1}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                <View
                    style={
                        styles.sectionArrow
                    }
                >
                    <FontAwesome
                        name="angle-right"
                        size={17}
                        color="#888888"
                    />
                </View>
            </View>
        );
    },
);

SectionHeader.displayName =
    'SectionHeader';

/* -------------------------------------------------------------------------- */
/* TRACK SECTION                                                              */
/* -------------------------------------------------------------------------- */

const TrackSectionList = memo(
    ({
        tracks,
        playCounts,
        onPlayTracks,
    }: {
        tracks: TrackItem[];
        playCounts?: Map<
            string,
            number
        >;
        onPlayTracks: (
            tracks: TrackItem[],
            index: number,
        ) => void;
    }) => {
        return (
            <FlatList<TrackItem>
                data={tracks}
                horizontal
                showsHorizontalScrollIndicator={
                    false
                }
                keyExtractor={(
                    item,
                    index,
                ) =>
                    `track-${item.id}-${index}`
                }
                contentContainerStyle={
                    styles.horizontalContent
                }
                renderItem={({
                    item,
                    index,
                }) => (
                    <TrackCard
                        track={item}
                        playCount={
                            playCounts?.get(
                                item.id,
                            )
                        }
                        onPress={() =>
                            onPlayTracks(
                                tracks,
                                index,
                            )
                        }
                    />
                )}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews
            />
        );
    },
);

TrackSectionList.displayName =
    'TrackSectionList';

/* -------------------------------------------------------------------------- */
/* ARTIST SECTION                                                             */
/* -------------------------------------------------------------------------- */

const ArtistSectionList = memo(
    ({
        artists,
        onOpenArtist,
    }: {
        artists: ArtistSummary[];
        onOpenArtist: (
            artist: ArtistSummary,
        ) => void;
    }) => {
        return (
            <FlatList<ArtistSummary>
                data={artists}
                horizontal
                showsHorizontalScrollIndicator={
                    false
                }
                keyExtractor={(
                    item,
                    index,
                ) =>
                    `artist-${item.id}-${index}`
                }
                contentContainerStyle={
                    styles.horizontalContent
                }
                renderItem={({
                    item,
                }) => (
                    <ArtistCard
                        artist={item}
                        onPress={
                            item.artistId
                                ? () =>
                                    onOpenArtist(
                                        item,
                                    )
                                : undefined
                        }
                    />
                )}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews
            />
        );
    },
);

ArtistSectionList.displayName =
    'ArtistSectionList';

/* -------------------------------------------------------------------------- */
/* ALBUM SECTION                                                              */
/* -------------------------------------------------------------------------- */

const AlbumSectionList = memo(
    ({
        albums,
        onOpenAlbum,
    }: {
        albums: AlbumSummary[];
        onOpenAlbum: (
            album: AlbumSummary,
        ) => void;
    }) => {
        return (
            <FlatList<AlbumSummary>
                data={albums}
                horizontal
                showsHorizontalScrollIndicator={
                    false
                }
                keyExtractor={(
                    item,
                    index,
                ) =>
                    `album-${item.id}-${index}`
                }
                contentContainerStyle={
                    styles.horizontalContent
                }
                renderItem={({
                    item,
                }) => (
                    <AlbumCard
                        album={item}
                        onPress={() =>
                            onOpenAlbum(
                                item,
                            )
                        }
                    />
                )}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews
            />
        );
    },
);

AlbumSectionList.displayName =
    'AlbumSectionList';

/* -------------------------------------------------------------------------- */
/* FEATURED SECTION                                                           */
/* -------------------------------------------------------------------------- */

const FeaturedSection = memo(
    ({
        track,
        playCount,
        onPress,
    }: {
        track: TrackItem;
        playCount: number;
        onPress: () => void;
    }) => {
        return (
            <View
                style={
                    styles.featuredSection
                }
            >
                <SectionHeader
                    title="Tu número uno"
                    subtitle="La canción que más has escuchado"
                />

                <View
                    style={
                        styles.featuredHorizontal
                    }
                >
                    <FeaturedTrackCard
                        track={track}
                        playCount={playCount}
                        onPress={onPress}
                    />
                </View>
            </View>
        );
    },
);

FeaturedSection.displayName =
    'FeaturedSection';

/* -------------------------------------------------------------------------- */
/* HOME SECTION                                                               */
/* -------------------------------------------------------------------------- */

const HomeSectionView = memo(
    ({
        section,
        onPlayTracks,
        onOpenArtist,
        onOpenAlbum,
        playCounts,
    }: {
        section: HomeSection;
        onPlayTracks: (
            tracks: TrackItem[],
            index: number,
        ) => void;
        onOpenArtist: (
            artist: ArtistSummary,
        ) => void;
        onOpenAlbum: (
            album: AlbumSummary,
        ) => void;
        playCounts: Map<
            string,
            number
        >;
    }) => {
        if (
            section.data.length === 0
        ) {
            return null;
        }

        if (
            section.type ===
            'featured'
        ) {
            const track =
                section.data[0];

            if (!track) {
                return null;
            }

            const count =
                playCounts.get(
                    track.id,
                ) ?? 0;

            return (
                <FeaturedSection
                    track={track}
                    playCount={count}
                    onPress={() =>
                        onPlayTracks(
                            section.data,
                            0,
                        )
                    }
                />
            );
        }

        return (
            <View
                style={
                    styles.section
                }
            >
                <SectionHeader
                    title={
                        section.title
                    }
                    subtitle={
                        section.subtitle
                    }
                />

                {section.type ===
                    'tracks' ? (
                    <TrackSectionList
                        tracks={
                            section.data
                        }
                        playCounts={
                            playCounts
                        }
                        onPlayTracks={
                            onPlayTracks
                        }
                    />
                ) : null}

                {section.type ===
                    'artists' ? (
                    <ArtistSectionList
                        artists={
                            section.data
                        }
                        onOpenArtist={
                            onOpenArtist
                        }
                    />
                ) : null}

                {section.type ===
                    'albums' ? (
                    <AlbumSectionList
                        albums={
                            section.data
                        }
                        onOpenAlbum={
                            onOpenAlbum
                        }
                    />
                ) : null}
            </View>
        );
    },
);

HomeSectionView.displayName =
    'HomeSectionView';

/* -------------------------------------------------------------------------- */
/* HOME                                                                       */
/* -------------------------------------------------------------------------- */

export const HomeScreen = () => {
    const navigation =
        useNavigation<HomeNavigation>();

    const {
        tracks: libraryTracks,
        isLoading: libraryLoading,
    } = useLibrary();

    const [
        history,
        setHistory,
    ] = useState<
        ListeningHistoryItem[]
    >([]);

    const [
        isLoadingHistory,
        setIsLoadingHistory,
    ] = useState(true);

    /* ---------------------------------------------------------------------- */
    /* HISTORY                                                                 */
    /* ---------------------------------------------------------------------- */

    const loadHistory =
        useCallback(() => {
            try {
                const nextHistory =
                    getListeningHistory();

                setHistory(
                    nextHistory,
                );
            } catch (error) {
                console.warn(
                    '[HomeScreen] Error cargando historial:',
                    error,
                );

                setHistory([]);
            } finally {
                setIsLoadingHistory(
                    false,
                );
            }
        }, []);

    useEffect(() => {
        loadHistory();

        const subscription =
            DeviceEventEmitter.addListener(
                LISTENING_HISTORY_UPDATED_EVENT,
                loadHistory,
            );

        return () => {
            subscription.remove();
        };
    }, [loadHistory]);

    useFocusEffect(
        useCallback(() => {
            loadHistory();

            return undefined;
        }, [loadHistory]),
    );

    /* ---------------------------------------------------------------------- */
    /* PLAY COUNTS                                                             */
    /* ---------------------------------------------------------------------- */

    const playCounts =
        useMemo(() => {
            const map =
                new Map<
                    string,
                    number
                >();

            for (const item of history) {
                map.set(
                    item.trackId,
                    Math.max(
                        0,
                        Math.floor(
                            item.playCount,
                        ),
                    ),
                );
            }

            return map;
        }, [history]);

    /* ---------------------------------------------------------------------- */
    /* RECENTLY PLAYED                                                         */
    /* ---------------------------------------------------------------------- */

    const recentlyPlayed =
        useMemo(() => {
            /*
             * IMPORTANTE:
             *
             * No reconstruimos esto manualmente.
             * listeningHistory ya sabe ordenar por
             * lastPlayed correctamente.
             */
            return getRecentlyPlayedTracks(
                12,
            )
                .map(
                    historyToTrack,
                )
                .filter(
                    (track) =>
                        Boolean(
                            track.id,
                        ),
                );
        }, [history]);

    /* ---------------------------------------------------------------------- */
    /* MOST PLAYED                                                             */
    /* ---------------------------------------------------------------------- */

    const mostPlayed =
        useMemo(() => {
            /*
             * Utilizamos directamente la API oficial
             * del servicio de historial.
             *
             * Así:
             *
             * 1. playCount DESC
             * 2. lastPlayed DESC
             */
            const tracks =
                getMostPlayedTracks(
                    30,
                ).map(
                    historyToTrack,
                );

            /*
             * Para la sección "Más escuchadas"
             * exigimos que exista al menos una
             * repetición real.
             */
            return diversifyTracks(
                tracks,
                12,
            );
        }, [history, playCounts]);

    /* ---------------------------------------------------------------------- */
    /* NUMBER ONE                                                              */
    /* ---------------------------------------------------------------------- */

    const numberOne =
        useMemo(() => {
            const top =
                getMostPlayedTracks(
                    1,
                )[0];

            if (!top) {
                return null;
            }

            return {
                track:
                    historyToTrack(
                        top,
                    ),
                playCount:
                    Math.max(
                        0,
                        top.playCount,
                    ),
            };
        }, [history]);

    /* ---------------------------------------------------------------------- */
    /* TOP ARTISTS                                                             */
    /* ---------------------------------------------------------------------- */

    const artistSummaries =
        useMemo<ArtistSummary[]>(
            () => {
                const summaries =
                    getMostPlayedArtists(
                        20,
                    );

                return summaries
                    .filter(
                        (
                            artist,
                        ) =>
                            artist.totalPlayCount >
                            0,
                    )
                    .map(
                        (
                            artist: ListeningArtistSummary,
                        ) => {
                            const topTrack =
                                artist.topTrack
                                    ? historyToTrack(
                                        artist.topTrack,
                                    )
                                    : undefined;

                            /*
                             * Si no existe artistThumbnail,
                             * usamos la portada de la canción
                             * principal como fallback.
                             */
                            const artwork =
                                getArtwork(
                                    artist.artistThumbnail,
                                ) ||
                                getArtwork(
                                    artist.topTrack
                                        ?.artwork,
                                );

                            return {
                                id:
                                    artist.artistId ||
                                    artist.artistKey,

                                name:
                                    safeText(
                                        artist.artistName,
                                        'Artista',
                                    ),

                                artwork,

                                artistId:
                                    artist.artistId,

                                artistThumbnail:
                                    getArtwork(
                                        artist.artistThumbnail,
                                    ),

                                totalPlayCount:
                                    artist.totalPlayCount,

                                trackCount:
                                    artist.trackCount,

                                topTrack,
                            };
                        },
                    )
                    .sort(
                        (a, b) => {
                            if (
                                b.totalPlayCount !==
                                a.totalPlayCount
                            ) {
                                return (
                                    b.totalPlayCount -
                                    a.totalPlayCount
                                );
                            }

                            return (
                                b.trackCount -
                                a.trackCount
                            );
                        },
                    )
                    .slice(0, 12);
            },
            [history],
        );

    /* ---------------------------------------------------------------------- */
    /* ALBUMS                                                                  */
    /* ---------------------------------------------------------------------- */

    const albumSummaries =
        useMemo<AlbumSummary[]>(
            () => {
                const summaries =
                    getMostPlayedAlbums(
                        30,
                    );

                return summaries
                    .map(
                        (
                            album: ListeningAlbumSummary,
                        ) => {
                            /*
                             * Recuperamos todas las canciones
                             * del historial pertenecientes a
                             * este proyecto.
                             */
                            const albumTracks =
                                history
                                    .filter(
                                        (
                                            item,
                                        ) => {
                                            if (
                                                album.albumId &&
                                                item.albumId
                                            ) {
                                                return (
                                                    item.albumId ===
                                                    album.albumId
                                                );
                                            }

                                            return (
                                                normalizeKey(
                                                    item.albumName ||
                                                    '',
                                                ) ===
                                                normalizeKey(
                                                    album.albumName,
                                                ) &&
                                                normalizeKey(
                                                    item.artist,
                                                ) ===
                                                normalizeKey(
                                                    album.artistName,
                                                )
                                            );
                                        },
                                    )
                                    .sort(
                                        (a, b) => {
                                            if (
                                                b.playCount !==
                                                a.playCount
                                            ) {
                                                return (
                                                    b.playCount -
                                                    a.playCount
                                                );
                                            }

                                            return (
                                                b.lastPlayed -
                                                a.lastPlayed
                                            );
                                        },
                                    )
                                    .map(
                                        historyToTrack,
                                    );

                            const deduplicated =
                                deduplicateTracks(
                                    albumTracks,
                                );

                            return {
                                id:
                                    album.albumId ||
                                    album.albumKey,

                                name:
                                    safeText(
                                        album.albumName,
                                        'Proyecto',
                                    ),

                                artist:
                                    safeText(
                                        album.artistName,
                                        'Artista',
                                    ),

                                artwork:
                                    getArtwork(
                                        album.albumArtwork,
                                    ) ||
                                    getArtwork(
                                        album.topTrack
                                            ?.artwork,
                                    ),

                                tracks:
                                    deduplicated,

                                isEP:
                                    album.isEP,

                                totalPlayCount:
                                    Math.max(
                                        0,
                                        album.totalPlayCount,
                                    ),

                                lastPlayed:
                                    album.lastPlayed,
                            };
                        },
                    )
                    .filter(
                        (
                            album,
                        ) =>
                            album.tracks.length >
                            0 &&
                            Boolean(
                                album.name,
                            ),
                    );
            },
            [history],
        );

    /* ---------------------------------------------------------------------- */
    /* ALBUMS / EPS                                                           */
    /* ---------------------------------------------------------------------- */

    const albums =
        useMemo(
            () => {
                return albumSummaries
                    .filter(
                        (
                            album,
                        ) =>
                            !album.isEP,
                    )
                    .sort(
                        (a, b) => {
                            if (
                                b.totalPlayCount !==
                                a.totalPlayCount
                            ) {
                                return (
                                    b.totalPlayCount -
                                    a.totalPlayCount
                                );
                            }

                            return (
                                b.lastPlayed -
                                a.lastPlayed
                            );
                        },
                    )
                    .slice(
                        0,
                        12,
                    );
            },
            [albumSummaries],
        );

    const eps =
        useMemo(
            () => {
                return albumSummaries
                    .filter(
                        (
                            album,
                        ) =>
                            album.isEP,
                    )
                    .sort(
                        (a, b) => {
                            if (
                                b.totalPlayCount !==
                                a.totalPlayCount
                            ) {
                                return (
                                    b.totalPlayCount -
                                    a.totalPlayCount
                                );
                            }

                            return (
                                b.lastPlayed -
                                a.lastPlayed
                            );
                        },
                    )
                    .slice(
                        0,
                        12,
                    );
            },
            [albumSummaries],
        );

    /* ---------------------------------------------------------------------- */
    /* FAVORITES                                                               */
    /* ---------------------------------------------------------------------- */

    const favoriteTracks =
        useMemo(() => {
            return libraryTracks
                .filter(
                    (track) =>
                        track.isFavorite,
                )
                .sort(
                    (a, b) =>
                        b.addedAt -
                        a.addedAt,
                )
                .map(
                    (track) => ({
                        id:
                            track.id,

                        title:
                            track.title,

                        artist:
                            track.artist,

                        artwork:
                            track.coverUrl,

                        duration:
                            track.duration ??
                            0,

                        streamUrl:
                            typeof track.localPath ===
                                'string' &&
                                track.localPath.trim()
                                ? track.localPath.startsWith(
                                    'content://',
                                ) ||
                                    track.localPath.startsWith(
                                        'file://',
                                    )
                                    ? track.localPath
                                    : `file://${track.localPath}`
                                : undefined,
                    }),
                )
                .slice(
                    0,
                    12,
                );
        }, [libraryTracks]);

    /* ---------------------------------------------------------------------- */
    /* MEANINGFUL HISTORY                                                      */
    /* ---------------------------------------------------------------------- */

    const totalPlayCount =
        useMemo(() => {
            return history.reduce(
                (
                    total,
                    item,
                ) =>
                    total +
                    Math.max(
                        0,
                        Math.floor(
                            item.playCount,
                        ),
                    ),
                0,
            );
        }, [history]);

    const hasListeningData =
        history.length > 0 &&
        totalPlayCount > 0;

    /* ---------------------------------------------------------------------- */
    /* SECTIONS                                                                */
    /* ---------------------------------------------------------------------- */

    const sections =
        useMemo<HomeSection[]>(
            () => {
                const result:
                    HomeSection[] = [];

                /*
                 * HERO
                 *
                 * Solo una sección utiliza
                 * la tarjeta gigante.
                 */
                if (
                    numberOne &&
                    numberOne.playCount > 0
                ) {
                    result.push({
                        key:
                            'number-one',

                        type:
                            'featured',

                        title:
                            'Tu número uno',

                        subtitle:
                            'La canción que más has escuchado',

                        data: [
                            numberOne.track,
                        ],
                    });
                }

                /*
                 * RECIENTES
                 */
                if (
                    recentlyPlayed.length >
                    0
                ) {
                    result.push({
                        key:
                            'recent',

                        type:
                            'tracks',

                        title:
                            'Escuchado recientemente',

                        subtitle:
                            'Vuelve a lo último que estabas escuchando',

                        data:
                            recentlyPlayed,
                    });
                }

                /*
                 * ARTISTAS
                 */
                if (
                    artistSummaries.length >
                    0
                ) {
                    result.push({
                        key:
                            'artists',

                        type:
                            'artists',

                        title:
                            'Tus artistas',

                        subtitle:
                            'Los artistas que más escuchas',

                        data:
                            artistSummaries,
                    });
                }

                /*
                 * MÁS ESCUCHADAS
                 */
                if (
                    mostPlayed.length >
                    0
                ) {
                    result.push({
                        key:
                            'most-played',

                        type:
                            'tracks',

                        title:
                            'Más escuchadas',

                        subtitle:
                            'Las canciones que más vuelven a sonar',

                        data:
                            mostPlayed,
                    });
                }

                /*
                 * ÁLBUMES
                 */
                if (
                    albums.length >
                    0
                ) {
                    result.push({
                        key:
                            'albums',

                        type:
                            'albums',

                        title:
                            'Álbumes',

                        subtitle:
                            'Tus proyectos más escuchados',

                        data:
                            albums,
                    });
                }

                /*
                 * EPS
                 */
                if (
                    eps.length >
                    0
                ) {
                    result.push({
                        key:
                            'eps',

                        type:
                            'albums',

                        title:
                            'EPs',

                        subtitle:
                            'Tus proyectos cortos',

                        data:
                            eps,
                    });
                }

                /*
                 * FAVORITOS
                 */
                if (
                    favoriteTracks.length >
                    0
                ) {
                    result.push({
                        key:
                            'favorites',

                        type:
                            'tracks',

                        title:
                            'Tus favoritos',

                        subtitle:
                            'Las canciones que has guardado',

                        data:
                            favoriteTracks,
                    });
                }

                return result;
            },
            [
                numberOne,
                recentlyPlayed,
                artistSummaries,
                mostPlayed,
                albums,
                eps,
                favoriteTracks,
            ],
        );

    /* ---------------------------------------------------------------------- */
    /* PLAYBACK                                                                */
    /* ---------------------------------------------------------------------- */

    const handlePlayTracks =
        useCallback(
            async (
                tracks: TrackItem[],
                index: number,
            ) => {
                const selected =
                    tracks[index];

                if (!selected) {
                    return;
                }

                try {
                    /*
                     * NO CAMBIAR ESTE ORDEN.
                     *
                     * Mantiene:
                     * - cola
                     * - siguiente canción
                     * - PlayerScreen
                     * - swipe
                     * - preparación anticipada
                     */
                    setPlayerQueue(
                        tracks,
                        index,
                    );

                    await playTrack(
                        selected,
                    );

                    prepareNextTrack().catch(
                        (error) => {
                            console.warn(
                                '[Home] No se pudo preparar la siguiente canción:',
                                error,
                            );
                        },
                    );
                } catch (error) {
                    console.warn(
                        '[Home] Error reproduciendo canción:',
                        error,
                    );
                }
            },
            [],
        );

    /* ---------------------------------------------------------------------- */
    /* NAVIGATION                                                               */
    /* ---------------------------------------------------------------------- */

    const handleOpenArtist =
        useCallback(
            (
                artist: ArtistSummary,
            ) => {
                if (
                    !artist.artistId
                ) {
                    return;
                }

                navigation.navigate(
                    'Artist',
                    {
                        artistId:
                            artist.artistId,

                        artistName:
                            artist.name,

                        artistThumbnail:
                            artist.artistThumbnail ||
                            artist.artwork ||
                            '',
                    },
                );
            },
            [navigation],
        );

    const handleOpenAlbum =
        useCallback(
            (
                album: AlbumSummary,
            ) => {
                if (
                    album.tracks.length ===
                    0
                ) {
                    return;
                }

                navigation.navigate(
                    'Album',
                    {
                        albumName:
                            album.name,

                        artistName:
                            album.artist,

                        albumArtwork:
                            album.artwork,

                        tracks:
                            album.tracks,
                    },
                );
            },
            [navigation],
        );

    /* ---------------------------------------------------------------------- */
    /* RENDER                                                                  */
    /* ---------------------------------------------------------------------- */

    const renderSection =
        useCallback(
            ({
                item,
            }: {
                item: HomeSection;
            }) => {
                return (
                    <HomeSectionView
                        section={item}
                        onPlayTracks={
                            handlePlayTracks
                        }
                        onOpenArtist={
                            handleOpenArtist
                        }
                        onOpenAlbum={
                            handleOpenAlbum
                        }
                        playCounts={
                            playCounts
                        }
                    />
                );
            },
            [
                handlePlayTracks,
                handleOpenArtist,
                handleOpenAlbum,
                playCounts,
            ],
        );

    const greeting =
        getGreeting();

    const subtitle =
        getHeaderSubtitle(
            history.length,
        );

    const showInitialState =
        !libraryLoading &&
        !isLoadingHistory &&
        !hasListeningData;

    const showLoading =
        libraryLoading &&
        isLoadingHistory;

    const androidTopInset =
        Platform.OS === 'android'
            ? StatusBar.currentHeight ?? 0
            : 0;

    return (
        <SafeAreaView
            style={
                styles.safeArea
            }
        >
            <StatusBar
                barStyle="light-content"
            />

            <View
                style={
                    styles.container
                }
            >
                <FlatList<HomeSection>
                    data={sections}
                    keyExtractor={(
                        item,
                    ) =>
                        item.key
                    }
                    renderItem={
                        renderSection
                    }
                    showsVerticalScrollIndicator={
                        false
                    }
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    windowSize={5}
                    removeClippedSubviews
                    contentContainerStyle={[
                        styles.content,
                        {
                            paddingTop:
                                androidTopInset +
                                8,
                        },
                    ]}
                    ListHeaderComponent={
                        <View
                            style={
                                styles.header
                            }
                        >
                            <View
                                style={
                                    styles.headerGlow
                                }
                            />

                            <View
                                style={
                                    styles.headerTop
                                }
                            >
                                <View
                                    style={
                                        styles.headerText
                                    }
                                >
                                    <Text
                                        style={
                                            styles.greeting
                                        }
                                    >
                                        {greeting}
                                    </Text>

                                    <Text
                                        style={
                                            styles.headerTitle
                                        }
                                    >
                                        Tu música
                                    </Text>

                                    <Text
                                        style={
                                            styles.contextSubtitle
                                        }
                                        numberOfLines={
                                            2
                                        }
                                    >
                                        {subtitle}
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.headerLogo
                                    }
                                >
                                    <View
                                        style={
                                            styles.headerLogoInner
                                        }
                                    >
                                        <FontAwesome
                                            name="music"
                                            size={18}
                                            color={
                                                COLORS.primary
                                            }
                                        />
                                    </View>
                                </View>
                            </View>

                            {showLoading ? (
                                <View
                                    style={
                                        styles.loadingContainer
                                    }
                                >
                                    <ActivityIndicator
                                        size="small"
                                        color={
                                            COLORS.primary
                                        }
                                    />

                                    <Text
                                        style={
                                            styles.loadingText
                                        }
                                    >
                                        Preparando tu música...
                                    </Text>
                                </View>
                            ) : null}

                            {showInitialState ? (
                                <View
                                    style={
                                        styles.emptyHero
                                    }
                                >
                                    <View
                                        style={
                                            styles.emptyGlow
                                        }
                                    />

                                    <View
                                        style={
                                            styles.emptyIcon
                                        }
                                    >
                                        <FontAwesome
                                            name="headphones"
                                            size={27}
                                            color={
                                                COLORS.primary
                                            }
                                        />
                                    </View>

                                    <Text
                                        style={
                                            styles.emptyTitle
                                        }
                                    >
                                        Tu música empieza aquí
                                    </Text>

                                    <Text
                                        style={
                                            styles.emptyText
                                        }
                                    >
                                        Escucha normalmente y
                                        SpotTube irá construyendo
                                        poco a poco una Home
                                        hecha para ti.
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
    );
};

/* -------------------------------------------------------------------------- */
/* STYLES                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor:
            '#090909',
    },

    container: {
        flex: 1,
        backgroundColor:
            '#090909',
    },

    content: {
        paddingBottom: 145,
    },

    /* ---------------------------------------------------------------------- */
    /* HEADER                                                                  */
    /* ---------------------------------------------------------------------- */

    header: {
        paddingHorizontal: 20,
        paddingTop: 17,
        paddingBottom: 3,
        position: 'relative',
        overflow: 'hidden',
    },

    headerGlow: {
        position: 'absolute',
        width: 230,
        height: 230,
        borderRadius: 115,
        right: -120,
        top: -120,
        backgroundColor:
            'rgba(255, 85, 0, 0.07)',
    },

    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent:
            'space-between',
    },

    headerText: {
        flex: 1,
        minWidth: 0,
        paddingRight: 15,
    },

    greeting: {
        color:
            '#8C8C8C',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        letterSpacing: 0.1,
    },

    headerTitle: {
        color:
            '#FFFFFF',
        fontSize: 38,
        lineHeight: 43,
        fontWeight: '900',
        letterSpacing: -1.6,
        marginTop: 1,
    },

    contextSubtitle: {
        color:
            '#747474',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '500',
        marginTop: 7,
        maxWidth: 330,
    },

    headerLogo: {
        width: 51,
        height: 51,
        borderRadius: 26,
        padding: 1,
        backgroundColor:
            'rgba(255, 85, 0, 0.20)',
        marginLeft: 5,
    },

    headerLogoInner: {
        flex: 1,
        borderRadius: 25,
        backgroundColor:
            '#151515',
        alignItems: 'center',
        justifyContent:
            'center',
    },

    loadingContainer: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },

    loadingText: {
        color:
            '#737373',
        fontSize: 12,
        fontWeight: '500',
    },

    /* ---------------------------------------------------------------------- */
    /* HERO                                                                    */
    /* ---------------------------------------------------------------------- */

    featuredSection: {
        marginTop: 27,
        marginBottom: 3,
    },

    featuredHorizontal: {
        paddingHorizontal: 20,
    },

    heroCard: {
        width: '100%',
        height: 330,
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor:
            '#171717',
        position: 'relative',
        elevation: 10,
    },

    heroBackground: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor:
            '#171717',
    },

    heroDarkOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor:
            'rgba(0, 0, 0, 0.38)',
    },

    heroOrangeGlow: {
        position: 'absolute',
        left: -90,
        bottom: -110,
        width: 320,
        height: 280,
        borderRadius: 160,
        backgroundColor:
            'rgba(255, 85, 0, 0.24)',
    },

    heroTopFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 170,
        backgroundColor:
            'rgba(0, 0, 0, 0.30)',
    },

    heroContent: {
        flex: 1,
        padding: 20,
        justifyContent:
            'space-between',
    },

    heroLabelRow: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 11,
        height: 28,
        borderRadius: 14,
        backgroundColor:
            'rgba(0, 0, 0, 0.48)',
        borderWidth: 1,
        borderColor:
            'rgba(255, 255, 255, 0.10)',
    },

    heroLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor:
            COLORS.primary,
        marginRight: 7,
    },

    heroLabel: {
        color:
            '#F2F2F2',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    },

    heroBottom: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent:
            'space-between',
    },

    heroTextBlock: {
        flex: 1,
        minWidth: 0,
        paddingRight: 16,
    },

    heroTitle: {
        color:
            '#FFFFFF',
        fontSize: 28,
        lineHeight: 32,
        fontWeight: '900',
        letterSpacing: -0.8,
    },

    heroArtist: {
        color:
            '#D2D2D2',
        fontSize: 14,
        lineHeight: 19,
        fontWeight: '600',
        marginTop: 5,
    },

    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },

    heroStatsText: {
        color:
            '#BDBDBD',
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 6,
    },

    heroPlay: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor:
            COLORS.primary,
        alignItems: 'center',
        justifyContent:
            'center',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },

    /* ---------------------------------------------------------------------- */
    /* SECTIONS                                                                */
    /* ---------------------------------------------------------------------- */

    section: {
        marginTop: 32,
        marginBottom: 1,
    },

    sectionHeader: {
        paddingHorizontal: 20,
        marginBottom: 15,
        flexDirection: 'row',
        alignItems: 'center',
    },

    sectionHeaderText: {
        flex: 1,
        minWidth: 0,
    },

    sectionTitle: {
        color:
            '#FFFFFF',
        fontSize: 22,
        lineHeight: 27,
        fontWeight: '900',
        letterSpacing: -0.5,
    },

    sectionSubtitle: {
        color:
            '#707070',
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '500',
        marginTop: 3,
    },

    sectionArrow: {
        width: 31,
        height: 31,
        borderRadius: 16,
        backgroundColor:
            '#151515',
        alignItems: 'center',
        justifyContent:
            'center',
        marginLeft: 10,
    },

    horizontalContent: {
        paddingHorizontal: 20,
        paddingRight: 5,
    },

    /* ---------------------------------------------------------------------- */
    /* TRACKS                                                                  */
    /* ---------------------------------------------------------------------- */

    trackCard: {
        width: 156,
        marginRight: 16,
    },

    trackArtworkWrapper: {
        width: 156,
        height: 156,
        borderRadius: 17,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor:
            '#181818',
    },

    trackImageShade: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor:
            'rgba(0, 0, 0, 0.08)',
    },

    trackPlayButton: {
        position: 'absolute',
        right: 9,
        bottom: 9,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor:
            COLORS.primary,
        alignItems: 'center',
        justifyContent:
            'center',
        elevation: 7,
    },

    trackTitle: {
        color:
            '#F4F4F4',
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '700',
        marginTop: 10,
    },

    trackArtist: {
        color:
            '#808080',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
        marginTop: 3,
    },

    trackCount: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },

    trackCountText: {
        color:
            '#666666',
        fontSize: 9,
        fontWeight: '600',
        marginLeft: 5,
    },

    /* ---------------------------------------------------------------------- */
    /* ARTISTS                                                                 */
    /* ---------------------------------------------------------------------- */

    artistCard: {
        width: 130,
        marginRight: 15,
        alignItems: 'center',
    },

    artistImageShadow: {
        width: 122,
        height: 122,
        borderRadius: 61,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            '#171717',
        elevation: 8,
    },

    artistImageRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        padding: 2,
        borderWidth: 1,
        borderColor:
            'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    artistFallback: {
        backgroundColor:
            '#1D1D1D',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor:
            '#303030',
    },

    artistFallbackText: {
        color:
            '#FFFFFF',
        fontWeight: '900',
        letterSpacing: -0.8,
    },

    artistName: {
        color:
            '#F1F1F1',
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '700',
        marginTop: 10,
        width: 126,
        textAlign: 'center',
    },

    artistPlays: {
        color:
            '#696969',
        fontSize: 9,
        lineHeight: 14,
        fontWeight: '500',
        marginTop: 3,
        textAlign: 'center',
    },

    /* ---------------------------------------------------------------------- */
    /* ALBUMS                                                                  */
    /* ---------------------------------------------------------------------- */

    albumCard: {
        width: 158,
        marginRight: 16,
    },

    albumArtwork: {
        width: 158,
        height: 158,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor:
            '#181818',
    },

    albumShade: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor:
            'rgba(0, 0, 0, 0.05)',
    },

    albumBadge: {
        position: 'absolute',
        left: 9,
        top: 9,
        height: 24,
        paddingHorizontal: 9,
        borderRadius: 12,
        backgroundColor:
            'rgba(0, 0, 0, 0.65)',
        borderWidth: 1,
        borderColor:
            'rgba(255, 255, 255, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    albumBadgeText: {
        color:
            '#F0F0F0',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.7,
    },

    albumTitle: {
        color:
            '#F2F2F2',
        fontSize: 14,
        lineHeight: 19,
        fontWeight: '700',
        marginTop: 10,
    },

    albumArtist: {
        color:
            '#808080',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
        marginTop: 3,
    },

    albumPlays: {
        color:
            '#666666',
        fontSize: 9,
        lineHeight: 14,
        fontWeight: '600',
        marginTop: 4,
    },

    /* ---------------------------------------------------------------------- */
    /* PLACEHOLDER                                                             */
    /* ---------------------------------------------------------------------- */

    artworkPlaceholder: {
        backgroundColor:
            '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ---------------------------------------------------------------------- */
    /* EMPTY STATE                                                             */
    /* ---------------------------------------------------------------------- */

    emptyHero: {
        marginTop: 28,
        minHeight: 260,
        borderRadius: 26,
        backgroundColor:
            '#111111',
        borderWidth: 1,
        borderColor:
            'rgba(255, 255, 255, 0.07)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 35,
        overflow: 'hidden',
        position: 'relative',
    },

    emptyGlow: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor:
            'rgba(255, 85, 0, 0.08)',
        top: -100,
        right: -80,
    },

    emptyIcon: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor:
            'rgba(255, 85, 0, 0.10)',
        borderWidth: 1,
        borderColor:
            'rgba(255, 85, 0, 0.24)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },

    emptyTitle: {
        color:
            '#FFFFFF',
        fontSize: 22,
        lineHeight: 28,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.5,
    },

    emptyText: {
        color:
            '#858585',
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 10,
    },
});

export default HomeScreen;