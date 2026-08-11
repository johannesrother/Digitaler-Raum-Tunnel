/**
 * Web Audio needs a user gesture. The oscillator is therefore armed silently
 * on the first interaction and fades to one comfortable sine tone only when
 * the White Room begins.
 */
export function createWhiteRoomTone() {
  let context = null;
  let gain = null;
  let oscillator = null;
  let activated = false;

  const arm = async () => {
    if (context) {
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = 0;
    oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 196;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    await context.resume();
  };

  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });

  return {
    preview(amount) {
      if (!context || !gain) {
        return;
      }
      const level = BABYLON.Scalar.Lerp(0, 0.018, BABYLON.Scalar.Clamp(amount, 0, 1));
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(level, context.currentTime + 0.12);
    },
    activate() {
      if (activated || !context || !gain) {
        return;
      }
      activated = true;
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.045, context.currentTime + 0.8);
    },
    deactivate() {
      if (!context || !gain) {
        return;
      }
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.25);
    },
    dispose() {
      if (oscillator) {
        oscillator.stop();
      }
      if (context) {
        context.close();
      }
    },
  };
}
