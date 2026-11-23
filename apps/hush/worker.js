/* Hush worker: reads a recording, runs every bit of its sound through
 * DeepFilterNet3, and writes a new MP4 with the picture copied untouched.
 * Runs off the main thread so the page stays responsive on a phone. */
import * as MB from './vendor/mediabunny.min.mjs';
import { DeepFilter } from './vendor/deepfilter.mjs';

const RATE = 48000;
// DeepFilterNet looks ahead before it outputs a frame, so its output trails
// its input. Dropping this many leading samples puts the voice back on the lips.
const DELAY = 1440;

let conversion = null;
let aacReady = false;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    if (conversion) { try { await conversion.cancel(); } catch (err) { /* already stopped */ } }
    return;
  }
  if (msg.type === 'run') {
    try {
      await run(msg.file, msg.atten);
    } catch (err) {
      if (err instanceof MB.ConversionCanceledError) {
        self.postMessage({ type: 'canceled' });
      } else {
        self.postMessage({ type: 'error', message: (err && err.message) || String(err) });
      }
    } finally {
      conversion = null;
    }
  }
};

async function run(file, atten) {
  self.postMessage({ type: 'stage', text: 'Loading the noise model…' });
  const df = await DeepFilter.create({
    wasmUrl: new URL('./vendor/df_bg.wasm', import.meta.url).href,
    attenuationLimit: atten,
  });
  const N = df.frameLength;

  if (!aacReady) {
    if (!(await MB.canEncodeAudio('aac'))) {
      const { registerAacEncoder } = await import('./vendor/aac-encoder.min.mjs');
      registerAacEncoder();
    }
    aacReady = true;
  }

  self.postMessage({ type: 'stage', text: 'Reading the file…' });
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) throw new Error('This file has no sound track to clean.');
  const videoTrack = await input.getPrimaryVideoTrack();
  const duration = await input.computeDuration();

  const target = new MB.BufferTarget();
  const output = new MB.Output({
    format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  // Sound arrives in chunks of any length; DeepFilterNet wants exactly N
  // samples at a time. Queue input, run full frames, hand back what is done.
  let pending = new Float32Array(N * 4);
  let pendingLen = 0;
  let toDrop = DELAY;
  let t0 = null;
  let emitted = 0;

  function push(data) {
    if (pendingLen + data.length > pending.length) {
      const bigger = new Float32Array(Math.max(pending.length * 2, pendingLen + data.length));
      bigger.set(pending.subarray(0, pendingLen));
      pending = bigger;
    }
    pending.set(data, pendingLen);
    pendingLen += data.length;
  }

  conversion = await MB.Conversion.init({
    input,
    output,
    video: videoTrack ? {} : { discard: true },
    audio: {
      numberOfChannels: 1,
      sampleRate: RATE,
      codec: 'aac',
      bitrate: 160000,
      processedNumberOfChannels: 1,
      processedSampleRate: RATE,
      process: (sample) => {
        if (t0 === null) t0 = sample.timestamp;
        const bytes = sample.allocationSize({ planeIndex: 0, format: 'f32-planar' });
        const data = new Float32Array(bytes / 4);
        sample.copyTo(data, { planeIndex: 0, format: 'f32-planar' });
        push(data);

        const frames = Math.floor(pendingLen / N);
        if (frames === 0) return null;
        const out = new Float32Array(frames * N);
        for (let i = 0; i < frames; i++) {
          out.set(df.process(pending.slice(i * N, (i + 1) * N)), i * N);
        }
        pending.copyWithin(0, frames * N, pendingLen);
        pendingLen -= frames * N;

        let start = 0;
        if (toDrop > 0) {
          start = Math.min(toDrop, out.length);
          toDrop -= start;
        }
        if (start >= out.length) return null;
        const keep = out.subarray(start);
        const result = new MB.AudioSample({
          data: keep,
          format: 'f32-planar',
          numberOfChannels: 1,
          sampleRate: RATE,
          timestamp: t0 + emitted / RATE,
        });
        emitted += keep.length;
        return result;
      },
    },
  });

  if (!conversion.isValid) {
    const why = conversion.discardedTracks.map((d) => d.track.type + ': ' + d.reason).join(', ');
    throw new Error('This file cannot be converted on this phone (' + (why || 'unknown reason') + ').');
  }

  const started = Date.now();
  conversion.onProgress = (p) => {
    self.postMessage({ type: 'progress', value: p, elapsed: (Date.now() - started) / 1000 });
  };

  self.postMessage({ type: 'stage', text: 'Cleaning the sound…' });
  await conversion.execute();
  df.destroy();

  const buffer = target.buffer;
  self.postMessage(
    {
      type: 'done',
      buffer,
      mime: videoTrack ? 'video/mp4' : 'audio/mp4',
      hasVideo: !!videoTrack,
      duration,
      seconds: (Date.now() - started) / 1000,
    },
    [buffer]
  );
}
