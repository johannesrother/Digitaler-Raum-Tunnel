export const TUNNEL_DURATION = 60;

export const TUNNEL_PHASES = [
  { id: "ENTRY", start: 0, end: 10, diameter: 3.5, detail: 0.08, red: 0, light: 0.92, twitchEvery: 0 },
  { id: "UNEASE", start: 10, end: 22, diameter: 3.0, detail: 0.22, red: 0.05, light: 0.7, twitchEvery: 8.2 },
  { id: "COMPRESSION", start: 22, end: 36, diameter: 2.4, detail: 0.44, red: 0.16, light: 0.5, twitchEvery: 6.1 },
  { id: "INTENSIFICATION", start: 36, end: 48, diameter: 2.0, detail: 0.62, red: 0.32, light: 0.38, twitchEvery: 4.2 },
  { id: "PEAK", start: 48, end: 56, diameter: 1.65, detail: 0.86, red: 0.62, light: 0.28, twitchEvery: 2.7 },
  { id: "FINAL_ASCENT", start: 56, end: 60, diameter: 1.5, detail: 0.78, red: 0.4, light: 0.34, twitchEvery: 4.6 },
];

// Small releases stop the narrowing from becoming a mechanically linear ramp.
const DIAMETER_KEYS = [
  [0, 3.5], [10, 3.2], [16, 3.3], [22, 2.9], [28, 2.7],
  [31, 2.48], [34, 2.68], [36, 2.35], [42, 2.12], [48, 2.0],
  [52, 1.74], [56, 1.65], [60, 1.5],
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
  const next = TUNNEL_PHASES[TUNNEL_PHASES.indexOf(phase) + 1] ?? phase;
  const amount = smoothstep((time - phase.start) / Math.max(phase.end - phase.start, 0.001));
  return {
    detail: BABYLON.Scalar.Lerp(phase.detail, next.detail, amount),
    red: BABYLON.Scalar.Lerp(phase.red, next.red, amount),
    light: BABYLON.Scalar.Lerp(phase.light, next.light, amount),
  };
}

export function getTunnelTwitchInterval(time) {
  return getTunnelPhase(time).twitchEvery;
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
