import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    StyleSheet,
    FlatList,
} from 'react-native';
import { youtubeService } from '../services/youtubeService';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TrackItem } from '../types/track';
import { playTrack } from '../services/playTrack';

type RootStackParamList = {
    Main: undefined;
    Album: {
        albumName: string;
        artistName: string;
        albumArtwork: string;
        tracks: TrackItem[];
    };
    Artist: {
        artistId: string;
        artistName: string;
        artistThumbnail: string;
    };
};

type ArtistScreenProps =
    NativeStackScreenProps<
        RootStackParamList,
        'Artist'
    >;

export const ArtistScreen = ({
    route,
    navigation,
}: ArtistScreenProps) => {
    const {
        artistId,
        artistName,
        artistThumbnail,
    } = route.params;

    const [loading, setLoading] = useState(true);
    const [artist, setArtist] = useState<any>(null);

    useEffect(() => {
        const loadArtist = async () => {
            const details =
                await youtubeService.getArtistDetails(
                    artistId,
                    artistName,
                    artistThumbnail
                );

            setArtist(details);
            setLoading(false);
        };

        loadArtist();
    }, [
        artistId,
        artistName,
        artistThumbnail,
    ]);

    const handlePlayTrack = async (
        track: TrackItem
    ) => {
        await playTrack(track);
    };

    const handleOpenAlbum = async (
        albumId: string,
        albumName: string,
        albumThumbnail: string
    ) => {
        await youtubeService.testAlbumTracks(
            albumId
        );

        const tracks =
            await youtubeService.searchAlbumTracks(
                albumId,
                artistName
            );

        const albumArtist =
            tracks[0]?.artist || artistName;

        navigation.navigate('Album', {
            albumName,
            artistName: albumArtist,
            albumArtwork: albumThumbnail,
            tracks,
        });
    };

    if (loading) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: '#111217',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <ActivityIndicator
                    size="large"
                    color="#FF5500"
                />
            </SafeAreaView>
        );
    }

    const topSongs: TrackItem[] =
        artist?.topSongs || [];

    return (
        <SafeAreaView style={styles.container}>

            <FlatList
                data={topSongs}
                keyExtractor={(item, index) =>
                    `${item.id}-${index}`
                }
                showsVerticalScrollIndicator={false}

                ListHeaderComponent={
                    <View>

                        <View style={styles.artistHero}>

                            <Image
                                source={{
                                    uri: artistThumbnail.replace(
                                        /w\d+-h\d+/,
                                        'w600-h600'
                                    ),
                                }}
                                style={
                                    styles.artistHeroArtwork
                                }
                                resizeMode="cover"
                            />

                            <View
                                style={
                                    styles.artistHeroOverlay
                                }
                            />

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() =>
                                    navigation.goBack()
                                }
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={
                                        styles.backButtonText
                                    }
                                >
                                    ‹
                                </Text>
                            </TouchableOpacity>

                        </View>

                        <View
                            style={
                                styles.artistInfoContainer
                            }
                        >

                            <Text
                                style={styles.artistLabel}
                            >
                                ARTISTA
                            </Text>

                            <Text
                                style={styles.artistName}
                                numberOfLines={2}
                            >
                                {artist?.artist?.name ||
                                    artistName}
                            </Text>

                            <View
                                style={
                                    styles.artistMetaRow
                                }
                            >

                                <View
                                    style={styles.artistDot}
                                />

                                <Text
                                    style={
                                        styles.artistInfo
                                    }
                                >
                                    {topSongs.length} canciones
                                </Text>

                                <Text
                                    style={
                                        styles.artistSeparator
                                    }
                                >
                                    ·
                                </Text>

                                <Text
                                    style={
                                        styles.artistInfo
                                    }
                                >
                                    {artist?.albums?.length ||
                                        0}{' '}
                                    álbumes
                                </Text>

                            </View>

                            <View
                                style={
                                    styles.artistActions
                                }
                            >

                                <TouchableOpacity
                                    style={
                                        styles.playArtistButton
                                    }
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        if (
                                            topSongs.length >
                                            0
                                        ) {
                                            handlePlayTrack(
                                                topSongs[0]
                                            );
                                        }
                                    }}
                                >
                                    <Text
                                        style={
                                            styles.playArtistIcon
                                        }
                                    >
                                        ▶
                                    </Text>

                                    <Text
                                        style={
                                            styles.playArtistText
                                        }
                                    >
                                        REPRODUCIR
                                    </Text>
                                </TouchableOpacity>

                            </View>

                        </View>


                        {/* ÁLBUMES */}
                        {artist?.albums?.length > 0 && (
                            <View
                                style={
                                    styles.albumsSection
                                }
                            >

                                <View
                                    style={
                                        styles.tracksHeader
                                    }
                                >

                                    <Text
                                        style={
                                            styles.tracksHeaderText
                                        }
                                    >
                                        ÁLBUMES
                                    </Text>

                                    <View
                                        style={
                                            styles.tracksHeaderLine
                                        }
                                    />

                                </View>

                                <FlatList
                                    data={artist.albums}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={(item) =>
                                        item.id
                                    }
                                    contentContainerStyle={
                                        styles.albumsList
                                    }
                                    renderItem={({
                                        item,
                                    }) => (
                                        <TouchableOpacity
                                            style={
                                                styles.albumCard
                                            }
                                            activeOpacity={0.8}
                                            onPress={() =>
                                                handleOpenAlbum(
                                                    item.id,
                                                    item.name,
                                                    item.thumbnail
                                                )
                                            }
                                        >

                                            <Image
                                                source={{
                                                    uri: item.thumbnail,
                                                }}
                                                style={
                                                    styles.albumArtwork
                                                }
                                            />

                                            <Text
                                                style={
                                                    styles.albumTitle
                                                }
                                                numberOfLines={2}
                                            >
                                                {item.name}
                                            </Text>

                                        </TouchableOpacity>
                                    )}
                                />

                            </View>
                        )}


                        {/* SINGLES & EPs */}
                        {artist?.singles?.length > 0 && (
                            <View
                                style={
                                    styles.albumsSection
                                }
                            >

                                <View
                                    style={
                                        styles.tracksHeader
                                    }
                                >

                                    <Text
                                        style={
                                            styles.tracksHeaderText
                                        }
                                    >
                                        SINGLES & EPs
                                    </Text>

                                    <View
                                        style={
                                            styles.tracksHeaderLine
                                        }
                                    />

                                </View>

                                <FlatList
                                    data={artist.singles}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={(item) =>
                                        item.id
                                    }
                                    contentContainerStyle={
                                        styles.albumsList
                                    }
                                    renderItem={({
                                        item,
                                    }) => (
                                        <TouchableOpacity
                                            style={
                                                styles.albumCard
                                            }
                                            activeOpacity={0.8}
                                            onPress={() =>
                                                handleOpenAlbum(
                                                    item.id,
                                                    item.name,
                                                    item.thumbnail
                                                )
                                            }
                                        >

                                            <Image
                                                source={{
                                                    uri: item.thumbnail,
                                                }}
                                                style={
                                                    styles.albumArtwork
                                                }
                                            />

                                            <Text
                                                style={
                                                    styles.albumTitle
                                                }
                                                numberOfLines={2}
                                            >
                                                {item.name}
                                            </Text>

                                        </TouchableOpacity>
                                    )}
                                />

                            </View>
                        )}


                        {/* MAYORES ÉXITOS */}
                        <View
                            style={
                                styles.tracksHeader
                            }
                        >

                            <Text
                                style={
                                    styles.tracksHeaderText
                                }
                            >
                                MAYORES ÉXITOS
                            </Text>

                            <View
                                style={
                                    styles.tracksHeaderLine
                                }
                            />

                        </View>

                    </View>
                }

                renderItem={({
                    item,
                    index,
                }) => (
                    <TouchableOpacity
                        style={styles.trackRow}
                        onPress={() =>
                            handlePlayTrack(item)
                        }
                        activeOpacity={0.7}
                    >

                        <Text
                            style={
                                styles.trackNumber
                            }
                        >
                            {index + 1}
                        </Text>

                        <Image
                            source={{
                                uri: item.artwork,
                            }}
                            style={
                                styles.trackArtwork
                            }
                        />

                        <View
                            style={
                                styles.trackInfo
                            }
                        >

                            <Text
                                style={
                                    styles.trackTitle
                                }
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>

                            <Text
                                style={
                                    styles.trackArtist
                                }
                                numberOfLines={1}
                            >
                                {item.artist}
                            </Text>

                        </View>

                    </TouchableOpacity>
                )}

                contentContainerStyle={
                    styles.content
                }
            />

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111217',
    },

    content: {
        paddingBottom: 100,
        paddingTop: 18,
    },

    artistHero: {
        height: 390,
        position: 'relative',
    },

    artistHeroArtwork: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },

    artistHeroOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 180,

        experimental_backgroundImage:
            'linear-gradient(180deg, rgba(17,18,23,0), rgba(17,18,23,0.35), #111217)',
    },

    backButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor:
            'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    backButtonText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: '300',
        marginTop: -4,
    },

    artistInfoContainer: {
        paddingHorizontal: 18,
        marginTop: -25,
    },

    artistLabel: {
        color: '#FF5500',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.8,
        marginBottom: 5,
    },

    artistName: {
        color: '#FFFFFF',
        fontSize: 34,
        fontWeight: '900',
    },

    artistMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },

    artistDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FF5500',
        marginRight: 8,
    },

    artistInfo: {
        color: '#A9ABB4',
        fontSize: 12,
        fontWeight: '600',
    },

    artistSeparator: {
        color: '#555861',
        marginHorizontal: 7,
        fontSize: 12,
    },

    artistActions: {
        marginTop: 20,
    },

    playArtistButton: {
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FF5500',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        alignSelf: 'flex-start',
    },

    playArtistIcon: {
        color: '#FFFFFF',
        fontSize: 15,
        marginRight: 9,
    },

    playArtistText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },

    tracksHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 30,
        marginBottom: 10,
    },

    tracksHeaderText: {
        color: '#8B8D96',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.2,
    },

    tracksHeaderLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#272931',
        marginLeft: 12,
    },

    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
    },

    trackNumber: {
        width: 28,
        color: '#777982',
        fontSize: 14,
        textAlign: 'center',
    },

    trackArtwork: {
        width: 52,
        height: 52,
        borderRadius: 8,
        marginLeft: 8,
    },

    trackInfo: {
        flex: 1,
        marginLeft: 14,
    },

    trackTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },

    trackArtist: {
        color: '#858790',
        fontSize: 13,
        marginTop: 4,
    },

    albumsSection: {
        marginTop: 18,
        marginBottom: 30,
    },

    albumsList: {
        paddingHorizontal: 18,
    },

    albumCard: {
        width: 145,
        marginRight: 14,
    },

    albumArtwork: {
        width: 145,
        height: 145,
        borderRadius: 12,
        backgroundColor: '#191B22',
    },

    albumTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 9,
    },
});