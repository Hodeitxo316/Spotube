// src/services/audioService.ts

import TrackPlayer, {
  Event,
} from 'react-native-track-player';

import {
  getPlayerQueue,
  getNextTrack,
  getPreviousTrack,
  getCurrentQueueIndex,
  setCurrentQueueIndex,
} from './playerQueue';

import {
  playTrack,
} from './playTrack';

export const PlaybackService =
  async function () {

    /*
     * ============================================================
     * PLAY
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.RemotePlay,
      async () => {
        try {
          await TrackPlayer.play();
        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ Play:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * PAUSE
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.RemotePause,
      async () => {
        try {
          await TrackPlayer.pause();
        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ Pause:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * NEXT DESDE NOTIFICACIÓN
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.RemoteNext,
      async () => {
        try {
          const queue =
            getPlayerQueue();

          if (queue.length === 0) {
            console.warn(
              '[PlaybackService] ⚠️ Cola vacía'
            );
            return;
          }

          const nextTrack =
            getNextTrack();

          if (!nextTrack) {
            return;
          }

          const nextIndex =
            queue.findIndex(
              track =>
                track.id ===
                nextTrack.id
            );

          if (nextIndex !== -1) {
            setCurrentQueueIndex(
              nextIndex
            );
          }

          console.log(
            '[PlaybackService] ⏭️ Siguiente:',
            nextTrack.title
          );

          await playTrack(
            nextTrack
          );

        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ RemoteNext:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * PREVIOUS DESDE NOTIFICACIÓN
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.RemotePrevious,
      async () => {
        try {
          const queue =
            getPlayerQueue();

          if (queue.length === 0) {
            console.warn(
              '[PlaybackService] ⚠️ Cola vacía'
            );
            return;
          }

          const previousTrack =
            getPreviousTrack();

          if (!previousTrack) {
            return;
          }

          const previousIndex =
            queue.findIndex(
              track =>
                track.id ===
                previousTrack.id
            );

          if (previousIndex !== -1) {
            setCurrentQueueIndex(
              previousIndex
            );
          }

          console.log(
            '[PlaybackService] ⏮️ Anterior:',
            previousTrack.title
          );

          await playTrack(
            previousTrack
          );

        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ RemotePrevious:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * SEEK
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.RemoteSeek,
      async event => {
        try {
          await TrackPlayer.seekTo(
            event.position
          );
        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ Seek:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * FIN DE CANCIÓN
     * ============================================================
     *
     * Cuando TrackPlayer termina la única canción que tiene
     * cargada, avanzamos manualmente usando nuestra cola.
     *
     * IMPORTANTE:
     * PlayerScreen mantiene su propio AUTO NEXT cuando está
     * abierto. Este listener sirve principalmente para que
     * funcione también con la app en segundo plano / bloqueo.
     */

    TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      async () => {
        try {
          const queue =
            getPlayerQueue();

          if (queue.length === 0) {
            console.warn(
              '[PlaybackService] ⚠️ Cola vacía al terminar'
            );
            return;
          }

          const currentIndex =
            getCurrentQueueIndex();

          const nextIndex =
            currentIndex + 1 >=
              queue.length
              ? 0
              : currentIndex + 1;

          const nextTrack =
            queue[nextIndex];

          if (!nextTrack) {
            console.warn(
              '[PlaybackService] ⚠️ No hay siguiente canción'
            );
            return;
          }

          console.log(
            '[PlaybackService] 🏁 Canción terminada'
          );

          console.log(
            '[PlaybackService] ⏭️ Auto-next:',
            nextTrack.title
          );

          setCurrentQueueIndex(
            nextIndex
          );

          await playTrack(
            nextTrack
          );

        } catch (error) {
          console.warn(
            '[PlaybackService] ❌ Auto-next:',
            error
          );
        }
      }
    );

    /*
     * ============================================================
     * TRACK ACTIVO
     * ============================================================
     */

    TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      event => {
        console.log(
          '[PlaybackService] 🔄 Canción activa:',
          event.track
        );
      }
    );
  };