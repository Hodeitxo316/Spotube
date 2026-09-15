// src/utils/polyfills.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
// @ts-ignore
import structuredClone from '@ungap/structured-clone';

const globalRef = globalThis as any;

// 1. Buffer
if (typeof globalRef.Buffer === 'undefined') {
  globalRef.Buffer = Buffer;
}

// 2. TextEncoder y TextDecoder
const fastTextEncoding = require('fast-text-encoding');
const EncoderClass =
  fastTextEncoding.TextEncoder ||
  fastTextEncoding.default?.TextEncoder ||
  fastTextEncoding;
const DecoderClass =
  fastTextEncoding.TextDecoder ||
  fastTextEncoding.default?.TextDecoder ||
  fastTextEncoding;

if (typeof globalRef.TextEncoder === 'undefined' && EncoderClass) {
  globalRef.TextEncoder = EncoderClass;
}

if (typeof globalRef.TextDecoder === 'undefined' && DecoderClass) {
  globalRef.TextDecoder = DecoderClass;
}

// 3. CustomEvent
if (typeof globalRef.CustomEvent === 'undefined') {
  globalRef.CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail || null;
    }
  };
}

// 4. structuredClone
if (typeof globalRef.structuredClone === 'undefined') {
  globalRef.structuredClone = structuredClone;
}