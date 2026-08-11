/**
 * A quiet, layered internal resonance. It is intentionally not a heartbeat:
 * density and texture evolve while the visitor's movement stays controlled.
 */
export function createTunnelAmbience() {
  let context = null;
  let lowGain = null;
  let textureGain = null;
  let highGain = null;
  let pulseGain = null;

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
    pulseGain = context.createGain();
    [lowGain, textureGain, highGain, pulseGain].forEach((gain) => {
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

    const pulse = context.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = 72;
    pulse.connect(pulseGain);
    pulse.start();

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
      const breathPressure = 0.68 + Math.sin(time * profile.breathRate + 0.9) * 0.22 + Math.sin(time * 0.37) * 0.1;
      setGain(textureGain, profile.texture * breathPressure);
      setGain(highGain, profile.high);
    },
    pulse(strength) {
      if (!context || !pulseGain) {
        return;
      }
      const now = context.currentTime;
      const peak = 0.006 + strength * 0.018;
      pulseGain.gain.cancelScheduledValues(now);
      pulseGain.gain.setValueAtTime(0, now);
      pulseGain.gain.linearRampToValueAtTime(peak, now + 0.025);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
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
  if (time < 8) return { low: 0.003, texture: 0.0004, high: 0, breathRate: 0.45 };
  if (time < 18) {
    const amount = (time - 8) / 10;
    return { low: lerp(0.005, 0.011, amount), texture: lerp(0.0015, 0.0035, amount), high: 0.0003, breathRate: lerp(0.58, 0.8, amount) };
  }
  if (time < 30) {
    const amount = (time - 18) / 12;
    return { low: lerp(0.012, 0.019, amount), texture: lerp(0.004, 0.007, amount), high: lerp(0.0008, 0.0025, amount), breathRate: lerp(0.86, 1.08, amount) };
  }
  if (time < 42) return { low: 0.022, texture: 0.009, high: 0.0035, breathRate: 1.23 };
  if (time < 53) return { low: 0.024, texture: 0.011, high: 0.0045, breathRate: 1.48 };
  const decline = 1 - (time - 53) / 7;
  return { low: 0.024 * decline, texture: 0.011 * decline * decline, high: 0.0045 * decline * decline, breathRate: lerp(1.15, 0.35, 1 - decline) };
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}
