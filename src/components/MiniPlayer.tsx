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
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
    onPressExpand,
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
     * La barra inferior mide 72px y está situada:
     *
     * bottom = max(insets.bottom, 8) + 8
     *
     * Por eso colocamos el MiniPlayer justo encima de ella.
     */
    const bottomPosition =
        Math.max(insets.bottom, 8) + 90;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    bottom: bottomPosition,
                },
            ]}
            activeOpacity={0.94}
            onPress={onPressExpand}
        >
            {/* Brillo superior */}
            <View style={styles.topHighlight} />

            {/* Borde luminoso sutil */}
            <View style={styles.borderGlow} />

            {/* CARÁTULA */}
            <View style={styles.artworkWrapper}>
                <Image
                    source={{
                        uri: activeTrack.artwork,
                    }}
                    style={styles.artwork}
                />

                <View style={styles.artworkOverlay} />
            </View>

            {/* INFORMACIÓN */}
            <View style={styles.infoContainer}>
                <Text
                    style={styles.title}
                    numberOfLines={1}
                >
                    {activeTrack.title}
                </Text>

                <View style={styles.artistRow}>
                    <View style={styles.artistDot} />

                    <Text
                        style={styles.artist}
                        numberOfLines={1}
                    >
                        {activeTrack.artist}
                    </Text>
                </View>
            </View>

            {/* PLAY / PAUSE */}
            <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayPause}
                activeOpacity={0.82}
                hitSlop={{
                    top: 8,
                    bottom: 8,
                    left: 8,
                    right: 8,
                }}
            >
                <View style={styles.playButtonInner}>
                    <Text style={styles.playIcon}>
                        {playing ? '⏸' : '▶'}
                    </Text>
                </View>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',

        left: 12,
        right: 12,

        height: 68,

        borderRadius: 20,

        backgroundColor: '#17181D',

        flexDirection: 'row',
        alignItems: 'center',

        paddingHorizontal: 9,

        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.13)',

        zIndex: 100,
        elevation: 18,

        shadowColor: '#000000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.45,
        shadowRadius: 16,
    },

    topHighlight: {
        position: 'absolute',

        top: 0,
        left: 22,
        right: 22,

        height: 1,

        backgroundColor:
            'rgba(255,255,255,0.22)',

        borderRadius: 999,
    },

    borderGlow: {
        position: 'absolute',

        top: 1,
        left: 20,
        right: 20,

        height: 20,

        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,

        backgroundColor:
            'rgba(255,85,0,0.025)',
    },

    artworkWrapper: {
        width: 52,
        height: 52,

        borderRadius: 14,

        overflow: 'hidden',

        backgroundColor: '#24252C',

        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.14)',

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.4,
        shadowRadius: 7,
        elevation: 5,
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
            'rgba(0,0,0,0.06)',
    },

    infoContainer: {
        flex: 1,

        minWidth: 0,

        marginLeft: 13,
        marginRight: 10,
    },

    title: {
        color: '#FFFFFF',

        fontSize: 14,

        fontWeight: '700',

        letterSpacing: -0.1,
    },

    artistRow: {
        flexDirection: 'row',

        alignItems: 'center',

        marginTop: 5,
    },

    artistDot: {
        width: 5,
        height: 5,

        borderRadius: 3,

        backgroundColor: COLORS.primary,

        marginRight: 6,
    },

    artist: {
        flex: 1,

        color:
            'rgba(255,255,255,0.55)',

        fontSize: 11,

        fontWeight: '500',

        letterSpacing: 0.1,
    },

    playButton: {
        width: 46,
        height: 46,

        borderRadius: 23,

        alignItems: 'center',
        justifyContent: 'center',

        backgroundColor:
            'rgba(255,255,255,0.075)',

        borderWidth: 1,

        borderColor:
            'rgba(255,255,255,0.13)',
    },

    playButtonInner: {
        width: 38,
        height: 38,

        borderRadius: 19,

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

        shadowOpacity: 0.32,
        shadowRadius: 7,

        elevation: 7,
    },

    playIcon: {
        color: '#FFFFFF',

        fontSize: 13,

        marginLeft: 1,
    },
});

