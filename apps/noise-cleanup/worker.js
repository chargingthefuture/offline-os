/* Noise Cleanup worker: reads a recording, runs every bit of its sound through
 * DeepFilterNet3, and writes a new MP4 with the picture copied untouched.
 * Runs off the main thread so the page stays responsive on a phone.
 *
 * Two routes to the same result:
 *  - Direct: the browser can decode the sound itself (Chrome, Android, recent
 *    Safari), so one Conversion reads, cleans and writes it.
 *  - Via the page: the browser has no audio decoder for workers (older iPhone
 *    Safari, and every iOS browser, since they all use Safari's engine). The
 *    sound track is copied out undecoded, the page decodes it with Web Audio,
 *    and this worker cleans it and writes the MP4 by hand. */
import * as MB from './vendor/mediabunny.min.mjs';
import { DeepFilter } from './vendor/deepfilter.mjs';

const RATE = 48000;
// DeepFilterNet looks ahead before it outputs a frame, so its output trails
// its input. Dropping this many leading samples puts the voice back on the lips.
const DELAY = 1440;
const BITRATE = 160000;

let conversion = null;
let canceled = false;
let aacReady = false;
let pcmWaiter = null;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    canceled = true;
    if (conversion) { try { await conversion.cancel(); } catch (err) { /* already stopped */ } }
    if (pcmWaiter) pcmWaiter.reject(new MB.ConversionCanceledError());
    return;
  }
  if (msg.type === 'pcm' || msg.type === 'pcmError') {
    if (pcmWaiter) {
      if (msg.type === 'pcm') pcmWaiter.resolve(msg.data);
      else pcmWaiter.reject(new Error(msg.message));
    }
    return;
  }
  if (msg.type === 'run') {
    canceled = false;
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
      pcmWaiter = null;
    }
  }
};

function checkCanceled() {
  if (canceled) throw new MB.ConversionCanceledError();
}

/* Feeds sound of any chunk length through DeepFilterNet, which wants exactly
 * `frameLength` samples at a time, and hands back the cleaned samples that are
 * ready, already shifted back into sync. */
function makeCleaner(df) {
  const N = df.frameLength;
  let pending = new Float32Array(N * 4);
  let pendingLen = 0;
  let toDrop = DELAY;
  return function clean(data) {
    if (pendingLen + data.length > pending.length) {
      const bigger = new Float32Array(Math.max(pending.length * 2, pendingLen + data.length));
      bigger.set(pending.subarray(0, pendingLen));
      pending = bigger;
    }
    pending.set(data, pendingLen);
    pendingLen += data.length;

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
    return start >= out.length ? null : out.subarray(start);
  };
}

function monoSample(data, timestamp) {
  return new MB.AudioSample({ data, format: 'f32-planar', numberOfChannels: 1, sampleRate: RATE, timestamp });
}

async function run(file, atten) {
  self.postMessage({ type: 'stage', text: 'Loading the noise model…' });
  const df = await DeepFilter.create({
    wasmUrl: new URL('./vendor/df_bg.wasm', import.meta.url).href,
    attenuationLimit: atten,
  });

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

  const started = Date.now();
  const progress = (p) => {
    self.postMessage({ type: 'progress', value: p, elapsed: (Date.now() - started) / 1000 });
  };

  if (await audioTrack.canDecode()) {
    await runDirect(input, output, videoTrack, df, progress);
  } else {
    await runViaPage(input, output, audioTrack, videoTrack, df, progress);
  }
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

async function runDirect(input, output, videoTrack, df, progress) {
  const clean = makeCleaner(df);
  let t0 = null;
  let emitted = 0;

  conversion = await MB.Conversion.init({
    input,
    output,
    video: videoTrack ? {} : { discard: true },
    audio: {
      numberOfChannels: 1,
      sampleRate: RATE,
      codec: 'aac',
      bitrate: BITRATE,
      processedNumberOfChannels: 1,
      processedSampleRate: RATE,
      process: (sample) => {
        if (t0 === null) t0 = sample.timestamp;
        const bytes = sample.allocationSize({ planeIndex: 0, format: 'f32-planar' });
        const data = new Float32Array(bytes / 4);
        sample.copyTo(data, { planeIndex: 0, format: 'f32-planar' });
        const out = clean(data);
        if (!out) return null;
        const result = monoSample(out, t0 + emitted / RATE);
        emitted += out.length;
        return result;
      },
    },
  });

  if (!conversion.isValid) {
    const why = conversion.discardedTracks.map((d) => d.track.type + ': ' + d.reason).join(', ');
    throw new Error('This file cannot be converted on this phone (' + (why || 'unknown reason') + ').');
  }
  conversion.onProgress = progress;
  self.postMessage({ type: 'stage', text: 'Cleaning the sound…' });
  await conversion.execute();
}

/* Copies the sound track out undecoded into a small audio-only file, so the
 * page never has to load the full video into memory to decode it. */
async function extractAudio(input) {
  const target = new MB.BufferTarget();
  const out = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  conversion = await MB.Conversion.init({ input, output: out, video: { discard: true }, audio: {} });
  if (!conversion.isValid) {
    throw new Error('This phone cannot read the sound in this file.');
  }
  await conversion.execute();
  conversion = null;
  return target.buffer;
}

async function runViaPage(input, output, audioTrack, videoTrack, df, progress) {
  self.postMessage({ type: 'stage', text: 'Reading the sound…' });
  const audioOnly = await extractAudio(input);
  checkCanceled();
  const pcm = await new Promise((resolve, reject) => {
    pcmWaiter = { resolve, reject };
    self.postMessage({ type: 'needPcm', buffer: audioOnly }, [audioOnly]);
  });
  pcmWaiter = null;
  checkCanceled();

  let videoSource = null;
  let packets = null;
  let videoConfig = null;
  if (videoTrack) {
    const codec = await videoTrack.getCodec();
    if (!codec) throw new Error('This phone cannot copy the picture in this file.');
    videoSource = new MB.EncodedVideoPacketSource(codec);
    output.addVideoTrack(videoSource, { rotation: await videoTrack.getRotation() });
    videoConfig = await videoTrack.getDecoderConfig();
    packets = new MB.EncodedPacketSink(videoTrack).packets();
  }
  const audioSource = new MB.AudioSampleSource({ codec: 'aac', bitrate: BITRATE });
  output.addAudioTrack(audioSource);
  await output.start();

  self.postMessage({ type: 'stage', text: 'Cleaning the sound…' });
  const clean = makeCleaner(df);
  // AAC tracks start with a short encoder lead-in stamped before zero; Web
  // Audio has already trimmed it, so the decoded sound begins at zero.
  const t0 = Math.max(0, await audioTrack.getFirstTimestamp());
  const CHUNK = RATE; // one second at a time
  let read = 0;
  let emitted = 0;

  // Writes cleaned sound up to `untilSeconds`, so sound and picture are
  // written side by side rather than one after the other.
  async function audioUntil(untilSeconds) {
    while (read < pcm.length && t0 + read / RATE < untilSeconds) {
      checkCanceled();
      const out = clean(pcm.subarray(read, Math.min(pcm.length, read + CHUNK)));
      read = Math.min(pcm.length, read + CHUNK);
      if (out) {
        const sample = monoSample(out, t0 + emitted / RATE);
        await audioSource.add(sample);
        sample.close();
        emitted += out.length;
      }
      progress(read / pcm.length);
    }
  }

  if (packets) {
    let first = true;
    for await (const packet of packets) {
      checkCanceled();
      await audioUntil(packet.timestamp + 1);
      await videoSource.add(packet, first && videoConfig ? { decoderConfig: videoConfig } : undefined);
      first = false;
    }
    videoSource.close();
  }
  await audioUntil(Infinity);
  audioSource.close();
  await output.finalize();
}
