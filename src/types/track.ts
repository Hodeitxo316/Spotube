// src/types/track.ts
export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number; // Duración en segundos
  streamUrl?: string;
}