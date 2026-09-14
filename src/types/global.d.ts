// src/types/global.d.ts
import { Buffer as BufferClass } from 'buffer';

// Declaración del módulo sin tipos implícitos
declare module 'fast-text-encoding';

// Extensión del entorno global de TypeScript
declare global {
  var Buffer: typeof BufferClass;
  var TextEncoder: any;
  var TextDecoder: any;
}

export {};