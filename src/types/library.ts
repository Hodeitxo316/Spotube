export type DownloadState =
  | 'idle'
  | 'downloading'
  | 'completed'
  | 'error';

export interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration?: number;
  localPath?: string;
  isFavorite: boolean;
  downloadState: DownloadState;
  fileSizeBytes?: number;
  addedAt: number;
  isLocalFile?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackIds: string[];
  createdAt: number;
}

export type LibraryFilter =
  | 'all'
  | 'favorites'
  | 'downloaded'
  | 'local'
  | 'playlists';