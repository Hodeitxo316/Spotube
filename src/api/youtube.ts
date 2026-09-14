// src/api/youtube.ts
import { Innertube } from 'youtubei.js';

let youtubeInstance: Innertube | null = null;

export const getYouTubeClient = async (): Promise<Innertube> => {
  if (youtubeInstance) {
    return youtubeInstance;
  }

  try {
    youtubeInstance = await Innertube.create({
      client_type: 'ANDROID_MUSIC' as any,
      generate_session_locally: true,
      retrieve_player: true,
    });
    
    return youtubeInstance;
  } catch (error) {
    console.error('Error al inicializar YouTube Client:', error);
    throw error;
  }
};