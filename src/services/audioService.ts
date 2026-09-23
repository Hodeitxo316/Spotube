// src/services/audioService.ts
import TrackPlayer, { Event } from 'react-native-track-player';

console.log('[EVENT TEST] PlaybackProgressUpdated:', Event.PlaybackProgressUpdated);
console.log('[EVENT TEST] PlaybackQueueEnded:', Event.PlaybackQueueEnded);
console.log('[EVENT TEST] PlaybackActiveTrackChanged:', Event.PlaybackActiveTrackChanged);
console.log('[EVENT TEST] PlaybackState:', Event.PlaybackState);

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log(
      '[PlaybackService] 🔄 Canción activa cambiada:',
      event.track,
    );
  });

};