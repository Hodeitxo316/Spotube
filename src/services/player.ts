// src/services/player.ts
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';

export const setupPlayer = async (): Promise<boolean> => {
  try {
    await TrackPlayer.setupPlayer({
      maxBuffer: 50,
      minBuffer: 15,
      playBuffer: 2, // Búfer ultracorto para arranque instantáneo
      backBuffer: 30,
    });

    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
    });

    return true;
  } catch (error) {
    // Si ya está inicializado, ignoramos el error
    console.log('TrackPlayer ya estaba inicializado o error:', error);
    return false;
  }
};