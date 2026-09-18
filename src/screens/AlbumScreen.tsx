import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
    useNavigation,
} from '@react-navigation/native';
import {
    View,
    Text,
    Image,
    ImageBackground,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
} from 'react-native';

import { TrackItem } from '../types/track';
import { playTrack } from '../services/playTrack';

type AlbumRouteParams = {
    Album: {
        albumName: string;
        artistName: string;
        albumArtwork: string;
        tracks: TrackItem[];
    };
};

type AlbumRouteProp = RouteProp<AlbumRouteParams, 'Album'>;

export const AlbumScreen = () => {
    const route = useRoute<AlbumRouteProp>();
    const navigation = useNavigation();

    const {
        albumName,
        artistName,
        albumArtwork,
        tracks,
    } = route.params;

    const handlePlayTrack = async (track: TrackItem) => {
        await playTrack(track);
    };

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={tracks}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={styles.header}>

                        <View style={styles.albumHero}>

                            <Image
                                source={{ uri: albumArtwork }}
                                style={styles.albumHeroArtwork}
                                resizeMode="cover"
                            />

                            <View style={styles.albumHeroOverlay} />

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.backButtonText}>‹</Text>
                            </TouchableOpacity>

                        </View>

                        <View style={styles.albumInfoContainer}>

                            <Text
                                style={styles.albumName}
                                numberOfLines={2}
                            >
                                {albumName}
                            </Text>

                            <Text
                                style={styles.artistName}
                                numberOfLines={1}
                            >
                                {artistName}
                            </Text>

                            <View style={styles.albumMetaRow}>

                                <View style={styles.albumDot} />

                                <Text style={styles.albumInfo}>
                                    ÁLBUM
                                </Text>

                                <Text style={styles.albumSeparator}>
                                    ·
                                </Text>

                                <Text style={styles.albumInfo}>
                                    {tracks.length} canciones
                                </Text>

                            </View>

                            <View style={styles.albumActions}>

                                <TouchableOpacity
                                    style={styles.playAlbumButton}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        if (tracks.length > 0) {
                                            handlePlayTrack(tracks[0]);
                                        }
                                    }}
                                >
                                    <Text style={styles.playAlbumIcon}>
                                        ▶
                                    </Text>

                                    <Text style={styles.playAlbumText}>
                                        REPRODUCIR
                                    </Text>
                                </TouchableOpacity>

                            </View>

                        </View>

                        <View style={styles.tracksHeader}>

                            <Text style={styles.tracksHeaderText}>
                                CANCIONES
                            </Text>

                            <View style={styles.tracksHeaderLine} />

                        </View>

                    </View>
                }
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        style={styles.trackRow}
                        onPress={() => handlePlayTrack(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.trackNumber}>
                            {index + 1}
                        </Text>

                        <Image
                            source={{ uri: item.artwork }}
                            style={styles.trackArtwork}
                        />

                        <View style={styles.trackInfo}>
                            <Text
                                style={styles.trackTitle}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>

                            <Text
                                style={styles.trackArtist}
                                numberOfLines={1}
                            >
                                {item.artist}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                contentContainerStyle={styles.content}
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
    },

    header: {
        paddingBottom: 25,
    },

    albumArtwork: {
        width: 260,
        height: 260,
        borderRadius: 12,
        marginBottom: 24,
    },

    albumName: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    artistName: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },

    albumInfo: {
        color: '#8B8D96',
        fontSize: 14,
        marginTop: 6,
        textAlign: 'center',
    },

    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 9,
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

    albumBanner: {
        width: '100%',
        height: 330,
        justifyContent: 'flex-end',
        position: 'relative',
    },

    albumBannerWrapper: {
        width: '100%',
        height: 380,
        position: 'relative',
        backgroundColor: '#111217',
    },

    albumGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 140,
        backgroundColor: 'rgba(17, 18, 23, 0.75)',
    },

    backButton: {
        position: 'absolute',
        top: 45,
        left: 18,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(17, 18, 23, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },

    backButtonText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: '300',
        lineHeight: 36,
    },

    albumInfoContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },

    albumHero: {
        width: '100%',
        height: 390,
        position: 'relative',
        backgroundColor: '#111217',
    },

    albumHeroArtwork: {
        width: '100%',
        height: '100%',
    },

    albumHeroOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 180,

        experimental_backgroundImage:
            'linear-gradient(180deg, rgba(17,18,23,0), rgba(17,18,23,0.35), #111217)',
    },

    albumMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },

    albumDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FF5500',
        marginRight: 8,
    },

    albumSeparator: {
        color: '#555761',
        fontSize: 14,
        marginHorizontal: 7,
    },

    albumActions: {
        marginTop: 20,
        flexDirection: 'row',
    },

    playAlbumButton: {
        height: 50,
        paddingHorizontal: 22,
        borderRadius: 25,
        backgroundColor: '#FF5500',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },

    playAlbumIcon: {
        color: '#FFFFFF',
        fontSize: 16,
        marginRight: 9,
    },

    playAlbumText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.6,
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
});