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
import { COLORS } from '../constants/theme';

interface MiniPlayerProps {
    onPressExpand: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
    onPressExpand,
}) => {
    const activeTrack = useActiveTrack();
    const { playing } = useIsPlaying();

    if (!activeTrack) return null;

    const togglePlayPause = async () => {
        if (playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    };

    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.92}
            onPress={onPressExpand}
        >
            <View style={styles.innerGlow} />

            <Image
                source={{
                    uri: activeTrack.artwork,
                }}
                style={styles.artwork}
            />

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

            <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayPause}
                activeOpacity={0.8}
            >
                <Text style={styles.playIcon}>
                    {playing ? '⏸' : '▶'}
                </Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 72,

        marginHorizontal: 12,
        marginBottom: 10,

        borderRadius: 22,

        backgroundColor: 'rgba(25, 26, 33, 0.88)',

        flexDirection: 'row',
        alignItems: 'center',

        paddingHorizontal: 10,

        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.11)',

        position: 'relative',
    },

    innerGlow: {
        position: 'absolute',

        top: 0,
        left: 22,
        right: 22,

        height: 1,

        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },

    artwork: {
        width: 54,
        height: 54,

        borderRadius: 15,

        backgroundColor: '#24252C',
    },

    infoContainer: {
        flex: 1,

        marginLeft: 13,
        marginRight: 10,
    },

    title: {
        color: '#FFFFFF',

        fontSize: 14,
        fontWeight: '700',

        letterSpacing: 0.1,
    },

    artistRow: {
        flexDirection: 'row',
        alignItems: 'center',

        marginTop: 6,
    },

    artistDot: {
        width: 5,
        height: 5,

        borderRadius: 3,

        backgroundColor: '#FF5500',

        marginRight: 6,
    },

    artist: {
        color: 'rgba(255, 255, 255, 0.55)',

        fontSize: 11,

        flex: 1,
    },

    playButton: {
        width: 44,
        height: 44,

        borderRadius: 22,

        backgroundColor: '#FF5500',

        alignItems: 'center',
        justifyContent: 'center',

        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.20)',
    },

    playIcon: {
        color: '#FFFFFF',

        fontSize: 14,

        marginLeft: 1,
    },
});