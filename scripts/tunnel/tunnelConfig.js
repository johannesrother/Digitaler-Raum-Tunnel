export const TUNNEL_DURATION = 60;

export const TUNNEL_PHASES = [
  { id: "FIRST_UNEASE", start: 0, end: 8, diameter: 3.5, detail: 0.14, light: 0.88, pulse: 0.16, unreality: 0.02 },
  { id: "BODY_ALARM", start: 8, end: 18, diameter: 3.1, detail: 0.31, light: 0.62, pulse: 0.44, unreality: 0.1 },
  { id: "FEEDBACK_LOOP", start: 18, end: 30, diameter: 2.55, detail: 0.58, light: 0.42, pulse: 0.7, unreality: 0.3 },
  { id: "LOSS_OF_CONTROL", start: 30, end: 42, diameter: 2.02, detail: 0.78, light: 0.29, pulse: 0.92, unreality: 0.58 },
  { id: "PANIC_PEAK", start: 42, end: 53, diameter: 1.68, detail: 1, light: 0.2, pulse: 1, unreality: 0.94 },
  { id: "EXHAUSTION", start: 53, end: 60, diameter: 1.5, detail: 0.38, light: 0.5, pulse: 0.07, unreality: 0.06 },
];

// Small releases stop the narrowing from becoming a mechanically linear ramp.
const DIAMETER_KEYS = [
  [0, 3.5], [8, 3.1], [14, 2.86], [18, 2.55], [24, 2.4],
  [28, 2.58], [30, 2.22], [37, 2.02], [42, 1.82], [48, 1.68],
  [53, 1.62], [56, 1.7], [60, 1.5],
];

export function getTunnelPhase(time) {
  const clamped = BABYLON.Scalar.Clamp(time, 0, TUNNEL_DURATION);
  return TUNNEL_PHASES.find((phase) => clamped < phase.end) ?? TUNNEL_PHASES.at(-1);
}

export function getTunnelDiameter(time) {
  return interpolateKeys(DIAMETER_KEYS, time);
}

export function getTunnelLook(time) {
  const phase = getTunnelPhase(time);
  return {
    detail: phase.detail,
    light: phase.light,
    pulse: phase.pulse,
    unreality: phase.unreality,
  };
}

function interpolateKeys(keys, time) {
  const clamped = BABYLON.Scalar.Clamp(time, keys[0][0], keys.at(-1)[0]);
  const index = keys.findIndex(([keyTime]) => keyTime >= clamped);
  if (index <= 0) {
    return keys[0][1];
  }
  const [beforeTime, beforeValue] = keys[index - 1];
  const [afterTime, afterValue] = keys[index];
  return BABYLON.Scalar.Lerp(beforeValue, afterValue, smoothstep((clamped - beforeTime) / (afterTime - beforeTime)));
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
