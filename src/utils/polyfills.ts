// src/utils/polyfills.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';

// Carga directa mediante CommonJS para evitar incompatibilidades de tipos
const fastTextEncoding = require('fast-text-encoding');

const globalRef = globalThis as any;

if (typeof globalRef.Buffer === 'undefined') {
  globalRef.Buffer = Buffer;
}

if (typeof globalRef.TextEncoder === 'undefined') {
  globalRef.TextEncoder = fastTextEncoding.TextEncoder;
}

if (typeof globalRef.TextDecoder === 'undefined') {
  globalRef.TextDecoder = fastTextEncoding.TextDecoder;
}