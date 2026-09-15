// src/types/global.d.ts
import { Buffer as BufferClass } from 'buffer';

// Declaración del módulo con herencia de tipos
declare module 'fast-text-encoding';
declare module 'youtubei.js/bundle/react-native' {
  export * from 'youtubei.js';
}

// Extensión del entorno global de TypeScript
declare global {
  var Buffer: typeof BufferClass;
  var TextEncoder: any;
  var TextDecoder: any;
}

export {};