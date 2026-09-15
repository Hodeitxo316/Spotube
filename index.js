// index.js

// index.js (al inicio del archivo)
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import './src/utils/polyfills';

import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { name as appName } from './app.json';
import { PlaybackService } from './src/services/audioService';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => PlaybackService);