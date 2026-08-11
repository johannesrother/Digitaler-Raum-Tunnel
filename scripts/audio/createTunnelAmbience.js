/**
 * A quiet, layered internal resonance. It is intentionally not a heartbeat:
 * density and texture evolve while the visitor's movement stays controlled.
 */
export function createTunnelAmbience() {
  let context = null;
  let lowGain = null;
  let textureGain = null;
  let highGain = null;

  const arm = async () => {
    if (context) {
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    context = new AudioContext();
    lowGain = context.createGain();
    textureGain = context.createGain();
    highGain = context.createGain();
    [lowGain, textureGain, highGain].forEach((gain) => {
      gain.gain.value = 0;
      gain.connect(context.destination);
    });

    const low = context.createOscillator();
    low.type = "sine";
    low.frequency.value = 54;
    low.connect(lowGain);
    low.start();

    const high = context.createOscillator();
    high.type = "sine";
    high.frequency.value = 137;
    high.connect(highGain);
    high.start();

    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 739391;
    for (let index = 0; index < samples.length; index += 1) {
      seed = (seed * 16807) % 2147483647;
      samples[index] = (seed / 2147483647 * 2 - 1) * 0.22;
    }
    const texture = context.createBufferSource();
    texture.buffer = buffer;
    texture.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 310;
    filter.Q.value = 0.65;
    texture.connect(filter).connect(textureGain);
    texture.start();
    await context.resume();
  };

  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });

  const setGain = (gain, value) => {
    if (!context || !gain) {
      return;
    }
    gain.gain.setTargetAtTime(value, context.currentTime, 0.12);
  };

  return {
    update(time) {
      if (!context) {
        return;
      }
      const profile = ambienceProfile(time);
      // A slow, non-periodic interference makes the space feel unstable
      // without becoming a literal cardiac rhythm or a volume spike.
      const interference = 0.82 + Math.sin(time * 1.17) * 0.1 + Math.sin(time * 0.43 + 1.4) * 0.08;
      setGain(lowGain, profile.low * interference);
      setGain(textureGain, profile.texture * (0.9 + Math.sin(time * 0.71) * 0.1));
      setGain(highGain, profile.high);
    },
    deactivate() {
      setGain(lowGain, 0);
      setGain(textureGain, 0);
      setGain(highGain, 0);
    },
    dispose() {
      if (context) {
        context.close();
      }
    },
  };
}

function ambienceProfile(time) {
  if (time < 10) return { low: 0.003, texture: 0, high: 0 };
  if (time < 22) {
    const amount = (time - 10) / 12;
    return { low: lerp(0.004, 0.009, amount), texture: lerp(0.0005, 0.002, amount), high: 0 };
  }
  if (time < 38) {
    const amount = (time - 22) / 16;
    return { low: lerp(0.01, 0.017, amount), texture: lerp(0.0025, 0.006, amount), high: lerp(0.0004, 0.0018, amount) };
  }
  if (time < 52) return { low: 0.021, texture: 0.008, high: 0.0028 };
  const decline = 1 - (time - 52) / 8;
  return { low: 0.021 * decline, texture: 0.008 * decline * decline, high: 0.0028 * decline * decline };
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}
