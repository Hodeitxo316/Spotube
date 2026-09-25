// src/services/playerQueue.ts
import TrackPlayer, {
    TrackType,
} from 'react-native-track-player';

import { TrackItem } from '../types/track';
import { getAudioUrlForPlayback } from './downloadService';

let currentQueue: TrackItem[] = [];
let currentIndex = 0;

export const setPlayerQueue = (
    tracks: TrackItem[],
    startIndex: number
): void => {
    currentQueue = tracks;
    currentIndex = startIndex;
};

export const getPlayerQueue = (): TrackItem[] => {
    return currentQueue;
};

export const getCurrentQueueIndex = (): number => {
    return currentIndex;
};

export const setCurrentQueueIndex = (
    index: number
): void => {
    currentIndex = index;
};

/**
 * Devuelve la siguiente canción de nuestra cola lógica.
 *
 * No modifica TrackPlayer.
 */
export const getNextTrack = (): TrackItem | null => {
    if (currentQueue.length === 0) {
        return null;
    }

    const nextIndex =
        currentIndex + 1 >= currentQueue.length
            ? 0
            : currentIndex + 1;

    return currentQueue[nextIndex] || null;
};

/**
 * Devuelve la canción anterior de nuestra cola lógica.
 *
 * No modifica TrackPlayer.
 */
export const getPreviousTrack = (): TrackItem | null => {
    if (currentQueue.length === 0) {
        return null;
    }

    const previousIndex =
        currentIndex - 1 < 0
            ? currentQueue.length - 1
            : currentIndex - 1;

    return currentQueue[previousIndex] || null;
};

/**
 * Prepara una cola real dentro de TrackPlayer.
 *
 * De momento NO la utilizamos desde PlayerScreen.
 * Se mantiene para no romper otras partes de la aplicación.
 */
export const preparePlayerQueue = async (
    tracks: TrackItem[],
    startIndex: number
): Promise<void> => {
    if (tracks.length === 0) {
        return;
    }

    const playerTracks: any[] = [];

    for (
        let i = startIndex;
        i < tracks.length;
        i++
    ) {
        const track = tracks[i];

        const { url, isLocal } =
            await getAudioUrlForPlayback(track);

        const playerTrack: any = {
            id: track.id,
            url,
            title: track.title,
            artist: track.artist,
            artwork: track.artwork,
            duration: track.duration,
            type: TrackType.Default,
        };

        if (!isLocal) {
            playerTrack.headers = {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };
        }

        playerTracks.push(playerTrack);
    }

    await TrackPlayer.reset();

    await TrackPlayer.add(
        playerTracks
    );

    currentQueue = tracks;
    currentIndex = startIndex;

    await TrackPlayer.skip(0);

    await TrackPlayer.play();
};

export const prepareAndAddTrack = async (
    track: TrackItem
): Promise<void> => {
    const { url, isLocal } =
        await getAudioUrlForPlayback(track);

    const playerTrack: any = {
        id: track.id,
        url,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
        type: TrackType.Default,
    };

    if (!isLocal) {
        playerTrack.headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/120.0.0.0',
        };
    }

    console.log(
        `[Queue] Añadiendo siguiente canción: ${track.title} (${isLocal ? 'LOCAL' : 'STREAMING'})`
    );

    await TrackPlayer.add(playerTrack);

    console.log(
        `[Queue] Siguiente canción lista: ${track.title}`
    );
};

export const prepareNextTrack = async (): Promise<void> => {
    let nextIndex = currentIndex + 1;

    if (nextIndex >= currentQueue.length) {
        nextIndex = 0;
    }

    const nextTrack = currentQueue[nextIndex];

    if (!nextTrack) {
        return;
    }

    await prepareAndAddTrack(nextTrack);

    currentIndex = nextIndex;
};