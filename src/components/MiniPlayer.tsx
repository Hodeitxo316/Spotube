// src/components/MiniPlayer.tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import TrackPlayer, { useIsPlaying, useActiveTrack } from 'react-native-track-player';
import { COLORS } from '../constants/theme';

interface MiniPlayerProps {
  onPressExpand: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onPressExpand }) => {
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
    <TouchableOpacity style={styles.container} activeOpacity={0.9} onPress={onPressExpand}>
      <Image source={{ uri: activeTrack.artwork }} style={styles.artwork} />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>{activeTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{activeTrack.artist}</Text>
      </View>
      <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
        <Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  artwork: { width: 44, height: 44, borderRadius: 4 },
  infoContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  title: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  artist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  playButton: { padding: 8 },
  playIcon: { color: COLORS.primary, fontSize: 20 },
});