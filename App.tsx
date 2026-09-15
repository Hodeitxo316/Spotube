// App.tsx
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupAudioPlayer } from './src/services/playTrack';
import { youtubeService } from './src/services/youtubeService';
import { RootNavigator } from './src/navigation/RootNavigator';

const App = () => {
  useEffect(() => {
    // Inicialización no bloqueante en segundo plano
    setupAudioPlayer().catch((err) => console.error('[App] Error en setupAudioPlayer:', err));
    youtubeService.init().catch((err) => console.error('[App] Error en youtubeService:', err));
  }, []);

  return (
    <SafeAreaProvider>
      {/* @ts-ignore - La propiedad backgroundColor es válida en Android */}
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <RootNavigator />
    </SafeAreaProvider>
  );
};

export default App;