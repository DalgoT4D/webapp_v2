/**
 * Jest Polyfills
 *
 * This file must run BEFORE any other setup files.
 * It polyfills Node.js globals required by MSW and other libraries.
 *
 * Note: The order of polyfills matters! Some depend on others.
 */

import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { MessageChannel, MessagePort } from 'worker_threads';

// Polyfill TextEncoder/TextDecoder (required by undici)
global.TextEncoder = TextEncoder;
// @ts-expect-error - polyfilling globals
global.TextDecoder = TextDecoder;

// Polyfill Streams API (required by undici/MSW)
// @ts-expect-error - polyfilling globals
global.ReadableStream = ReadableStream;
// @ts-expect-error - polyfilling globals
global.TransformStream = TransformStream;
// @ts-expect-error - polyfilling globals
global.WritableStream = WritableStream;

// Polyfill MessageChannel/MessagePort (required by undici)
// @ts-expect-error - polyfilling globals
global.MessageChannel = MessageChannel;
// @ts-expect-error - polyfilling globals
global.MessagePort = MessagePort;

// Polyfill fetch APIs from undici (required by MSW 2.x)
const { fetch, Headers, Request, Response, FormData, File } = require('undici');

// @ts-expect-error - polyfilling globals
global.fetch = fetch;
// @ts-expect-error - polyfilling globals
global.Headers = Headers;
// @ts-expect-error - polyfilling globals
global.Request = Request;
// @ts-expect-error - polyfilling globals
global.Response = Response;
// @ts-expect-error - polyfilling globals
global.FormData = FormData;
// @ts-expect-error - polyfilling globals
global.File = File;

// Polyfill BroadcastChannel (required by MSW)
// @ts-expect-error - polyfilling globals
global.BroadcastChannel = class BroadcastChannel {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};
