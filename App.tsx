// App.tsx
import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupPlayer } from './src/services/player';
import { RootNavigator } from './src/navigation/RootNavigator';

const App = () => {
  useEffect(() => {
    setupPlayer();
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor('#121212');
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <RootNavigator />
    </SafeAreaProvider>
  );
};

export default App;