// src/components/MiniPlayer.tsx

import React from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import TrackPlayer, {
    useIsPlaying,
    useActiveTrack,
} from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';

interface MiniPlayerProps {
    onPressExpand: () => void;
    isArtistScreen?: boolean;
    isAlbumScreen?: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
    onPressExpand,
    isArtistScreen = false,
    isAlbumScreen = false,
}) => {
    const activeTrack = useActiveTrack();
    const { playing } = useIsPlaying();
    const insets = useSafeAreaInsets();

    if (!activeTrack) {
        return null;
    }

    const togglePlayPause = async () => {
        if (playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    };

    /*
     * Con barra inferior:
     * bottom más alto = MiniPlayer más arriba.
     *
     * Lo colocamos ligeramente más arriba que
     * la versión anterior.
     *
     * En artista/álbum no modificamos la posición.
     */
    const bottomPosition =
        isArtistScreen || isAlbumScreen
            ? Math.max(insets.bottom, 8) + 8
            : Math.max(insets.bottom, 8) + 80;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    bottom: bottomPosition,
                },
            ]}
            activeOpacity={0.95}
            onPress={onPressExpand}
        >
            {/* Fondo ambiental */}
            <View style={styles.ambientGlow} />

            {/* Reflejo superior */}
            <View style={styles.topReflection} />

            {/* CONTENIDO PRINCIPAL */}
            <View style={styles.content}>
                {/* CARÁTULA */}
                <View style={styles.artworkOuter}>
                    <View style={styles.artworkWrapper}>
                        <Image
                            source={{
                                uri: activeTrack.artwork,
                            }}
                            style={styles.artwork}
                        />

                        <View
                            style={
                                styles.artworkOverlay
                            }
                        />
                    </View>
                </View>

                {/* INFORMACIÓN */}
                <View style={styles.infoContainer}>
                    <View style={styles.statusRow}>
                        {playing ? (
                            <>
                                <View
                                    style={
                                        styles.statusDot
                                    }
                                />

                                <Text
                                    style={
                                        styles.statusText
                                    }
                                >
                                    EN REPRODUCCIÓN
                                </Text>
                            </>
                        ) : (
                            <Text
                                style={
                                    styles.statusTextPaused
                                }
                            >
                                EN PAUSA
                            </Text>
                        )}
                    </View>

                    <Text
                        style={styles.title}
                        numberOfLines={1}
                    >
                        {activeTrack.title}
                    </Text>

                    <Text
                        style={styles.artist}
                        numberOfLines={1}
                    >
                        {activeTrack.artist}
                    </Text>
                </View>

                {/* PLAY / PAUSE */}
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlayPause}
                    activeOpacity={0.78}
                    hitSlop={{
                        top: 8,
                        bottom: 8,
                        left: 8,
                        right: 8,
                    }}
                >
                    <View
                        style={
                            styles.playButtonInner
                        }
                    >
                        <Text
                            style={
                                styles.playIcon
                            }
                        >
                            {playing
                                ? '⏸'
                                : '▶'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    /*
     * =====================================================
     * CONTENEDOR
     * =====================================================
     */

    container: {
        position: 'absolute',

        left: 10,
        right: 10,

        height: 74,

        borderRadius: 23,

        backgroundColor: '#111216',

        borderWidth: 1,

        borderColor:
            'rgba(255,255,255,0.085)',

        zIndex: 100,

        elevation: 25,

        shadowColor: '#000000',

        shadowOffset: {
            width: 0,
            height: 12,
        },

        shadowOpacity: 0.58,

        shadowRadius: 22,

        overflow: 'hidden',
    },

    /*
     * Luz ambiental interior.
     */
    ambientGlow: {
        position: 'absolute',

        width: 230,
        height: 120,

        top: -72,
        left: 80,

        borderRadius: 100,

        backgroundColor:
            'rgba(255,255,255,0.025)',
    },

    /*
     * Reflejo superior.
     */
    topReflection: {
        position: 'absolute',

        top: 0,
        left: 32,
        right: 32,

        height: 1,

        backgroundColor:
            'rgba(255,255,255,0.20)',

        borderRadius: 999,
    },

    /*
     * =====================================================
     * CONTENIDO
     * =====================================================
     */

    content: {
        flex: 1,

        flexDirection: 'row',

        alignItems: 'center',

        paddingHorizontal: 7,
    },

    /*
     * =====================================================
     * CARÁTULA
     * =====================================================
     */

    artworkOuter: {
        width: 60,
        height: 60,

        borderRadius: 18,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor:
            'rgba(255,255,255,0.035)',

        borderWidth: 1,

        borderColor:
            'rgba(255,255,255,0.06)',

        shadowColor: '#000',

        shadowOffset: {
            width: 0,
            height: 5,
        },

        shadowOpacity: 0.45,

        shadowRadius: 9,

        elevation: 7,
    },

    artworkWrapper: {
        width: 56,
        height: 56,

        borderRadius: 16,

        overflow: 'hidden',

        backgroundColor: '#24252B',
    },

    artwork: {
        width: '100%',
        height: '100%',
    },

    artworkOverlay: {
        position: 'absolute',

        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        backgroundColor:
            'rgba(0,0,0,0.025)',
    },

    /*
     * =====================================================
     * INFORMACIÓN
     * =====================================================
     */

    infoContainer: {
        flex: 1,

        minWidth: 0,

        marginLeft: 13,

        marginRight: 10,

        justifyContent: 'center',
    },

    /*
     * Estado.
     */
    statusRow: {
        flexDirection: 'row',

        alignItems: 'center',

        height: 13,

        marginBottom: 2,
    },

    statusDot: {
        width: 5,
        height: 5,

        borderRadius: 2.5,

        backgroundColor:
            COLORS.primary,

        marginRight: 5,
    },

    statusText: {
        color:
            'rgba(255,255,255,0.43)',

        fontSize: 8,

        fontWeight: '800',

        letterSpacing: 1.1,
    },

    statusTextPaused: {
        color:
            'rgba(255,255,255,0.27)',

        fontSize: 8,

        fontWeight: '700',

        letterSpacing: 1.1,
    },

    /*
     * Título.
     */
    title: {
        color: '#FFFFFF',

        fontSize: 15,

        fontWeight: '800',

        letterSpacing: -0.35,

        lineHeight: 18,
    },

    /*
     * Artista.
     */
    artist: {
        color:
            'rgba(255,255,255,0.48)',

        fontSize: 11,

        fontWeight: '500',

        marginTop: 2,

        letterSpacing: 0,
    },

    /*
     * =====================================================
     * BOTÓN
     * =====================================================
     */

    playButton: {
        width: 50,
        height: 50,

        borderRadius: 25,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor:
            'rgba(255,255,255,0.045)',

        borderWidth: 1,

        borderColor:
            'rgba(255,255,255,0.075)',
    },

    playButtonInner: {
        width: 39,
        height: 39,

        borderRadius: 19.5,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor:
            COLORS.primary,

        shadowColor:
            COLORS.primary,

        shadowOffset: {
            width: 0,
            height: 4,
        },

        shadowOpacity: 0.38,

        shadowRadius: 9,

        elevation: 9,
    },

    playIcon: {
        color: '#FFFFFF',

        fontSize: 11,

        fontWeight: '900',

        marginLeft: 1,
    },
});