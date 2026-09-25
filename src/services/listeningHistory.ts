// src/services/listeningHistory.ts

import {
    DeviceEventEmitter,
} from 'react-native';

import TrackPlayer, {
    Event,
    State,
} from 'react-native-track-player';

import { TrackItem } from '../types/track';
import { storage } from '../database/storage';

/* -------------------------------------------------------------------------- */
/* CONFIGURATION                                                              */
/* -------------------------------------------------------------------------- */

const HISTORY_KEY = 'spottube_listening_history';

const MIN_LISTEN_MS = 10_000;

const MAX_HISTORY_ITEMS = 300;

export const LISTENING_HISTORY_UPDATED_EVENT =
    'spottube_listening_history_updated';

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface ListeningHistoryItem {
    trackId: string;

    title: string;
    artist: string;
    artwork: string;

    duration?: number;

    playCount: number;

    lastPlayed: number;

    albumName?: string;
    albumId?: string;
    albumArtwork?: string;

    artistId?: string;
    artistThumbnail?: string;

    isEP?: boolean;
}

type RuntimeTrack = TrackItem & {
    album?: string;
    albumName?: string;
    albumId?: string;
    albumArtwork?: string;
    artistId?: string;
    artistThumbnail?: string;
    isEP?: boolean;
    albumType?: string;
};

type TrackPlayerRuntimeTrack = {
    id?: unknown;
    title?: unknown;
    artist?: unknown;
    artwork?: unknown;
    duration?: unknown;

    album?: unknown;
    albumName?: unknown;
    albumId?: unknown;
    albumArtwork?: unknown;

    artistId?: unknown;
    artistThumbnail?: unknown;

    isEP?: unknown;
    albumType?: unknown;
};

/* -------------------------------------------------------------------------- */
/* RUNTIME STATE                                                              */
/* -------------------------------------------------------------------------- */

let trackerStarted = false;

let activeTrack: ListeningHistoryItem | null = null;

let playingStartedAt: number | null = null;

let accumulatedPlayingMs = 0;

let stateSubscription:
    | { remove: () => void }
    | null = null;

let trackSubscription:
    | { remove: () => void }
    | null = null;

/* -------------------------------------------------------------------------- */
/* NORMALIZATION HELPERS                                                      */
/* -------------------------------------------------------------------------- */

const normalizeText = (
    value: unknown
): string => {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .trim()
        .replace(/\s+/g, ' ');
};

const normalizeId = (
    value: unknown
): string => {
    return normalizeText(value);
};

const normalizeArtistKey = (
    artist: string
): string => {
    return normalizeText(artist)
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ');
};

const isPositiveNumber = (
    value: unknown
): value is number => {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
    );
};

/* -------------------------------------------------------------------------- */
/* HISTORY VALIDATION                                                         */
/* -------------------------------------------------------------------------- */

const isValidHistoryItem = (
    value: unknown
): value is ListeningHistoryItem => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const item =
        value as Partial<ListeningHistoryItem>;

    return (
        typeof item.trackId === 'string' &&
        item.trackId.trim().length > 0 &&
        typeof item.title === 'string' &&
        typeof item.artist === 'string' &&
        typeof item.artwork === 'string' &&
        typeof item.playCount === 'number' &&
        Number.isFinite(item.playCount) &&
        item.playCount >= 0 &&
        typeof item.lastPlayed === 'number' &&
        Number.isFinite(item.lastPlayed)
    );
};

/* -------------------------------------------------------------------------- */
/* READ / WRITE                                                               */
/* -------------------------------------------------------------------------- */

const readHistory = (): ListeningHistoryItem[] => {
    try {
        const json = storage.getString(HISTORY_KEY);

        if (!json) {
            return [];
        }

        const parsed: unknown = JSON.parse(json);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(isValidHistoryItem)
            .map((item) => ({
                ...item,

                title:
                    normalizeText(item.title) ||
                    'Canción sin título',

                artist:
                    normalizeText(item.artist) ||
                    'Artista desconocido',

                artwork:
                    normalizeText(item.artwork),

                playCount:
                    Math.max(
                        0,
                        Math.floor(item.playCount)
                    ),

                lastPlayed:
                    Math.max(
                        0,
                        item.lastPlayed
                    ),
            }))
            .sort(
                (a, b) =>
                    b.lastPlayed - a.lastPlayed
            );
    } catch (error) {
        console.warn(
            '[ListeningHistory] Historial corrupto o ilegible. Se ignora.',
            error
        );

        return [];
    }
};

const writeHistory = (
    history: ListeningHistoryItem[]
): void => {
    try {
        const cleaned = history
            .filter(isValidHistoryItem)
            .map((item) => ({
                ...item,

                title:
                    normalizeText(item.title) ||
                    'Canción sin título',

                artist:
                    normalizeText(item.artist) ||
                    'Artista desconocido',

                artwork:
                    normalizeText(item.artwork),

                playCount:
                    Math.max(
                        0,
                        Math.floor(item.playCount)
                    ),

                lastPlayed:
                    Math.max(
                        0,
                        item.lastPlayed
                    ),
            }))
            .sort(
                (a, b) =>
                    b.lastPlayed - a.lastPlayed
            )
            .slice(
                0,
                MAX_HISTORY_ITEMS
            );

        storage.set(
            HISTORY_KEY,
            JSON.stringify(cleaned)
        );
    } catch (error) {
        console.warn(
            '[ListeningHistory] No se pudo guardar el historial:',
            error
        );
    }
};

/* -------------------------------------------------------------------------- */
/* TRACK NORMALIZATION                                                        */
/* -------------------------------------------------------------------------- */

const runtimeTrackToObject = (
    track: unknown
): TrackPlayerRuntimeTrack | null => {
    if (
        !track ||
        typeof track !== 'object'
    ) {
        return null;
    }

    return track as TrackPlayerRuntimeTrack;
};

const normalizeRuntimeTrack = (
    track: unknown
): ListeningHistoryItem | null => {
    const runtimeTrack =
        runtimeTrackToObject(track);

    if (!runtimeTrack) {
        return null;
    }

    const trackId =
        normalizeId(runtimeTrack.id);

    if (!trackId) {
        return null;
    }

    const title =
        normalizeText(
            runtimeTrack.title
        ) ||
        'Canción sin título';

    const artist =
        normalizeText(
            runtimeTrack.artist
        ) ||
        'Artista desconocido';

    const artwork =
        normalizeText(
            runtimeTrack.artwork
        );

    const albumName =
        normalizeText(
            runtimeTrack.albumName
        ) ||
        normalizeText(
            runtimeTrack.album
        ) ||
        undefined;

    const albumType =
        normalizeText(
            runtimeTrack.albumType
        ).toLowerCase();

    const duration =
        isPositiveNumber(
            runtimeTrack.duration
        )
            ? runtimeTrack.duration
            : undefined;

    return {
        trackId,

        title,
        artist,
        artwork,

        duration,

        playCount: 0,
        lastPlayed: 0,

        albumName,

        albumId:
            normalizeId(
                runtimeTrack.albumId
            ) || undefined,

        albumArtwork:
            normalizeText(
                runtimeTrack.albumArtwork
            ) || undefined,

        artistId:
            normalizeId(
                runtimeTrack.artistId
            ) || undefined,

        artistThumbnail:
            normalizeText(
                runtimeTrack.artistThumbnail
            ) || undefined,

        isEP:
            runtimeTrack.isEP === true ||
            albumType === 'ep',
    };
};

/* -------------------------------------------------------------------------- */
/* PUBLIC READ API                                                            */
/* -------------------------------------------------------------------------- */

export const getListeningHistory =
    (): ListeningHistoryItem[] => {
        return readHistory();
    };

/* -------------------------------------------------------------------------- */
/* SORTING HELPERS                                                            */
/* -------------------------------------------------------------------------- */

export const getMostPlayedTracks =
    (
        limit = 20
    ): ListeningHistoryItem[] => {
        return readHistory()
            .sort((a, b) => {
                if (
                    b.playCount !==
                    a.playCount
                ) {
                    return (
                        b.playCount -
                        a.playCount
                    );
                }

                return (
                    b.lastPlayed -
                    a.lastPlayed
                );
            })
            .slice(
                0,
                Math.max(0, limit)
            );
    };

export const getRecentlyPlayedTracks =
    (
        limit = 20
    ): ListeningHistoryItem[] => {
        return readHistory()
            .sort(
                (a, b) =>
                    b.lastPlayed -
                    a.lastPlayed
            )
            .slice(
                0,
                Math.max(0, limit)
            );
    };

/* -------------------------------------------------------------------------- */
/* ARTIST AGGREGATION                                                         */
/* -------------------------------------------------------------------------- */

export interface ListeningArtistSummary {
    artistKey: string;

    artistName: string;
    artistId?: string;
    artistThumbnail?: string;

    totalPlayCount: number;
    trackCount: number;
    lastPlayed: number;
    topTrack?: ListeningHistoryItem;
}

export const getMostPlayedArtists =
    (
        limit = 20
    ): ListeningArtistSummary[] => {
        const history = readHistory();

        const artists =
            new Map<
                string,
                ListeningArtistSummary
            >();

        for (const track of history) {
            const artistName =
                normalizeText(
                    track.artist
                ) ||
                'Artista desconocido';

            const artistKey =
                normalizeArtistKey(
                    artistName
                );

            if (!artistKey) {
                continue;
            }

            const existing =
                artists.get(
                    artistKey
                );

            if (!existing) {
                artists.set(
                    artistKey,
                    {
                        artistKey,

                        artistName,

                        artistId:
                            track.artistId,

                        artistThumbnail:
                            track.artistThumbnail,

                        totalPlayCount:
                            track.playCount,

                        trackCount: 1,

                        lastPlayed:
                            track.lastPlayed,

                        topTrack: track,
                    }
                );

                continue;
            }

            existing.totalPlayCount +=
                track.playCount;

            existing.trackCount += 1;

            existing.lastPlayed =
                Math.max(
                    existing.lastPlayed,
                    track.lastPlayed
                );

            if (
                !existing.artistId &&
                track.artistId
            ) {
                existing.artistId =
                    track.artistId;
            }

            if (
                !existing.artistThumbnail &&
                track.artistThumbnail
            ) {
                existing.artistThumbnail =
                    track.artistThumbnail;
            }

            if (
                !existing.topTrack ||
                track.playCount >
                existing.topTrack.playCount ||
                (
                    track.playCount ===
                    existing.topTrack.playCount &&
                    track.lastPlayed >
                    existing.topTrack.lastPlayed
                )
            ) {
                existing.topTrack =
                    track;
            }
        }

        return Array.from(
            artists.values()
        )
            .sort((a, b) => {
                if (
                    b.totalPlayCount !==
                    a.totalPlayCount
                ) {
                    return (
                        b.totalPlayCount -
                        a.totalPlayCount
                    );
                }

                return (
                    b.lastPlayed -
                    a.lastPlayed
                );
            })
            .slice(
                0,
                Math.max(0, limit)
            );
    };

/* -------------------------------------------------------------------------- */
/* ALBUM AGGREGATION                                                          */
/* -------------------------------------------------------------------------- */

export interface ListeningAlbumSummary {
    albumKey: string;

    albumName: string;
    albumId?: string;
    albumArtwork?: string;

    artistName: string;

    totalPlayCount: number;
    trackCount: number;
    lastPlayed: number;

    isEP: boolean;

    topTrack?: ListeningHistoryItem;
}

export const getMostPlayedAlbums =
    (
        limit = 20
    ): ListeningAlbumSummary[] => {
        const history = readHistory();

        const albums =
            new Map<
                string,
                ListeningAlbumSummary
            >();

        for (const track of history) {
            const albumName =
                normalizeText(
                    track.albumName
                );

            if (!albumName) {
                continue;
            }

            const albumKey =
                normalizeText(
                    track.albumId
                ) ||
                `${albumName.toLocaleLowerCase()}::${normalizeArtistKey(
                    track.artist
                )}`;

            const existing =
                albums.get(
                    albumKey
                );

            if (!existing) {
                albums.set(
                    albumKey,
                    {
                        albumKey,

                        albumName,

                        albumId:
                            track.albumId,

                        albumArtwork:
                            track.albumArtwork ||
                            track.artwork,

                        artistName:
                            track.artist,

                        totalPlayCount:
                            track.playCount,

                        trackCount: 1,

                        lastPlayed:
                            track.lastPlayed,

                        isEP:
                            track.isEP === true,

                        topTrack: track,
                    }
                );

                continue;
            }

            existing.totalPlayCount +=
                track.playCount;

            existing.trackCount += 1;

            existing.lastPlayed =
                Math.max(
                    existing.lastPlayed,
                    track.lastPlayed
                );

            existing.isEP =
                existing.isEP ||
                track.isEP === true;

            if (
                !existing.albumArtwork &&
                (
                    track.albumArtwork ||
                    track.artwork
                )
            ) {
                existing.albumArtwork =
                    track.albumArtwork ||
                    track.artwork;
            }

            if (
                !existing.albumId &&
                track.albumId
            ) {
                existing.albumId =
                    track.albumId;
            }

            if (
                !existing.topTrack ||
                track.playCount >
                existing.topTrack.playCount ||
                (
                    track.playCount ===
                    existing.topTrack.playCount &&
                    track.lastPlayed >
                    existing.topTrack.lastPlayed
                )
            ) {
                existing.topTrack =
                    track;
            }
        }

        return Array.from(
            albums.values()
        )
            .sort((a, b) => {
                if (
                    b.totalPlayCount !==
                    a.totalPlayCount
                ) {
                    return (
                        b.totalPlayCount -
                        a.totalPlayCount
                    );
                }

                return (
                    b.lastPlayed -
                    a.lastPlayed
                );
            })
            .slice(
                0,
                Math.max(0, limit)
            );
    };

/* -------------------------------------------------------------------------- */
/* TRACK RECORDING                                                            */
/* -------------------------------------------------------------------------- */

const registerCompletedListen = (
    track: ListeningHistoryItem
): void => {
    try {
        const history =
            readHistory();

        const existingIndex =
            history.findIndex(
                (item) =>
                    item.trackId ===
                    track.trackId
            );

        const now =
            Date.now();

        if (
            existingIndex >= 0
        ) {
            const existing =
                history[
                existingIndex
                ];

            history[
                existingIndex
            ] = {
                ...existing,

                title:
                    track.title ||
                    existing.title,

                artist:
                    track.artist ||
                    existing.artist,

                artwork:
                    track.artwork ||
                    existing.artwork,

                duration:
                    track.duration ??
                    existing.duration,

                albumName:
                    track.albumName ??
                    existing.albumName,

                albumId:
                    track.albumId ??
                    existing.albumId,

                albumArtwork:
                    track.albumArtwork ??
                    existing.albumArtwork,

                artistId:
                    track.artistId ??
                    existing.artistId,

                artistThumbnail:
                    track.artistThumbnail ??
                    existing.artistThumbnail,

                isEP:
                    track.isEP ??
                    existing.isEP,

                playCount:
                    existing.playCount + 1,

                lastPlayed:
                    now,
            };
        } else {
            history.push({
                ...track,

                playCount: 1,

                lastPlayed:
                    now,
            });
        }

        writeHistory(
            history
        );

        DeviceEventEmitter.emit(
            LISTENING_HISTORY_UPDATED_EVENT
        );
    } catch (error) {
        console.warn(
            '[ListeningHistory] Error registrando escucha:',
            error
        );
    }
};

/* -------------------------------------------------------------------------- */
/* PLAYBACK CLOCK                                                             */
/* -------------------------------------------------------------------------- */

const stopPlayingClock =
    (): void => {
        if (
            playingStartedAt === null
        ) {
            return;
        }

        const elapsed =
            Date.now() -
            playingStartedAt;

        if (
            elapsed > 0
        ) {
            accumulatedPlayingMs +=
                elapsed;
        }

        playingStartedAt =
            null;
    };

const startPlayingClock =
    (): void => {
        if (!activeTrack) {
            return;
        }

        if (
            playingStartedAt !== null
        ) {
            return;
        }

        playingStartedAt =
            Date.now();
    };

const finalizeCurrentSession =
    (): void => {
        if (!activeTrack) {
            accumulatedPlayingMs = 0;
            playingStartedAt = null;
            return;
        }

        stopPlayingClock();

        const trackToSave =
            activeTrack;

        const totalPlayingMs =
            accumulatedPlayingMs;

        accumulatedPlayingMs = 0;
        playingStartedAt = null;

        if (
            totalPlayingMs <
            MIN_LISTEN_MS
        ) {
            return;
        }

        registerCompletedListen(
            trackToSave
        );
    };

/* -------------------------------------------------------------------------- */
/* ACTIVE TRACK CHANGED                                                       */
/* -------------------------------------------------------------------------- */

const handleActiveTrackChanged =
    async (
        event: unknown
    ): Promise<void> => {
        try {
            /*
             * Cerramos primero la sesión anterior.
             */
            finalizeCurrentSession();

            /*
             * Obtenemos la pista actualmente activa
             * directamente desde TrackPlayer.
             */
            let runtimeTrack: unknown =
                null;

            try {
                runtimeTrack =
                    await TrackPlayer.getActiveTrack();
            } catch {
                runtimeTrack = null;
            }

            if (!runtimeTrack) {
                activeTrack = null;
                accumulatedPlayingMs = 0;
                playingStartedAt = null;
                return;
            }

            /*
             * Convertimos la pista real de TrackPlayer
             * al formato del historial.
             */
            const normalizedTrack =
                normalizeRuntimeTrack(
                    runtimeTrack
                );

            if (!normalizedTrack) {
                activeTrack = null;
                accumulatedPlayingMs = 0;
                playingStartedAt = null;
                return;
            }

            activeTrack =
                normalizedTrack;

            /*
             * La nueva canción comienza una sesión
             * completamente independiente.
             */
            accumulatedPlayingMs = 0;
            playingStartedAt = null;

            /*
             * Si ya está sonando, empezamos a contar.
             */
            try {
                const playbackState =
                    await TrackPlayer.getPlaybackState();

                if (
                    playbackState.state ===
                    State.Playing
                ) {
                    startPlayingClock();
                }
            } catch {
                /*
                 * PlaybackState arrancará el reloj
                 * cuando TrackPlayer confirme Playing.
                 */
            }
        } catch (error) {
            console.warn(
                '[ListeningHistory] Error al cambiar de pista:',
                error
            );
        }
    };

/* -------------------------------------------------------------------------- */
/* PLAYBACK STATE                                                             */
/* -------------------------------------------------------------------------- */

const handlePlaybackState =
    (
        event: unknown
    ): void => {
        try {
            let playbackState:
                | State
                | undefined;

            if (
                event &&
                typeof event ===
                'object'
            ) {
                const typedEvent =
                    event as {
                        state?: State;
                    };

                playbackState =
                    typedEvent.state;
            }

            if (
                playbackState ===
                State.Playing
            ) {
                startPlayingClock();
                return;
            }

            /*
             * Al dejar de reproducir:
             *
             * - Paused
             * - Stopped
             * - Buffering
             * - Ready
             * - None
             *
             * dejamos de contar tiempo.
             */
            stopPlayingClock();

            /*
             * IMPORTANTE:
             *
             * Si ya hemos escuchado la canción durante
             * al menos 10 segundos y la pausamos,
             * registramos inmediatamente la escucha.
             *
             * Esto hace que Home pueda actualizarse
             * sin necesidad de cambiar de canción.
             */
            if (
                playbackState === State.Paused ||
                playbackState === State.Stopped
            ) {
                finalizeCurrentSession();
            }
        } catch (error) {
            console.warn(
                '[ListeningHistory] Error leyendo estado de reproducción:',
                error
            );
        }
    };

/* -------------------------------------------------------------------------- */
/* INITIAL PLAYER SYNC                                                        */
/* -------------------------------------------------------------------------- */

const synchronizeCurrentPlayer =
    async (): Promise<void> => {
        try {
            const runtimeTrack =
                await TrackPlayer.getActiveTrack();

            if (runtimeTrack) {
                activeTrack =
                    normalizeRuntimeTrack(
                        runtimeTrack
                    );
            } else {
                activeTrack =
                    null;
            }

            const playbackState =
                await TrackPlayer.getPlaybackState();

            if (
                activeTrack &&
                playbackState.state ===
                State.Playing
            ) {
                startPlayingClock();
            }
        } catch {
            /*
             * TrackPlayer puede todavía no estar
             * preparado al iniciar RootNavigator.
             */
        }
    };

/* -------------------------------------------------------------------------- */
/* START / STOP TRACKER                                                       */
/* -------------------------------------------------------------------------- */

export const initializeListeningHistoryTracking =
    (): (() => void) => {
        if (trackerStarted) {
            return () => { };
        }

        trackerStarted = true;

        try {
            stateSubscription =
                TrackPlayer.addEventListener(
                    Event.PlaybackState,
                    handlePlaybackState
                );

            trackSubscription =
                TrackPlayer.addEventListener(
                    Event.PlaybackActiveTrackChanged,
                    handleActiveTrackChanged
                );

            synchronizeCurrentPlayer().catch(
                () => { }
            );
        } catch (error) {
            console.warn(
                '[ListeningHistory] No se pudo inicializar el seguimiento:',
                error
            );

            stateSubscription =
                null;

            trackSubscription =
                null;

            trackerStarted =
                false;
        }

        return () => {
            if (!trackerStarted) {
                return;
            }

            finalizeCurrentSession();

            stateSubscription?.remove();
            trackSubscription?.remove();

            stateSubscription =
                null;

            trackSubscription =
                null;

            activeTrack =
                null;

            playingStartedAt =
                null;

            accumulatedPlayingMs =
                0;

            trackerStarted =
                false;
        };
    };

/* -------------------------------------------------------------------------- */
/* CLEAR HISTORY                                                              */
/* -------------------------------------------------------------------------- */

export const clearListeningHistory =
    (): void => {
        try {
            storage.remove(
                HISTORY_KEY
            );

            DeviceEventEmitter.emit(
                LISTENING_HISTORY_UPDATED_EVENT
            );
        } catch (error) {
            console.warn(
                '[ListeningHistory] No se pudo borrar el historial:',
                error
            );
        }
    };