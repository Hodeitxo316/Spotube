// src/api/youtube.ts
import type { Innertube as InnertubeType } from 'youtubei.js';

let youtubeInstance: InnertubeType | null = null;

export const getYouTubeClient = async (): Promise<InnertubeType> => {
  if (youtubeInstance) {
    return youtubeInstance;
  }

  try {
    // Require diferido para asegurar que index.js ya ejecutó todos los polyfills
    const YTModule = require('youtubei.js/bundle/react-native');
    const Innertube = YTModule.Innertube || YTModule.default?.Innertube || YTModule.default || YTModule;

    if (!Innertube || typeof Innertube.create !== 'function') {
      throw new Error('No se pudo resolver el método Innertube.create en el módulo cargado.');
    }

    const client = await Innertube.create({
      client_type: 'ANDROID_MUSIC',
      generate_session_locally: true,
      retrieve_player: true,
    });

    youtubeInstance = client as InnertubeType;
    return youtubeInstance;
  } catch (error) {
    console.error('Error al inicializar YouTube Client:', error);
    throw error;
  }
};