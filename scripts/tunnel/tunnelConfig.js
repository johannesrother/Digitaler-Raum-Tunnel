export const TUNNEL_DURATION = 60;

export const TUNNEL_PHASES = [
  { id: "FIRST_UNEASE", start: 0, end: 10, diameter: 5.0, detail: 0.1, light: 0.9, pulse: 0.12, unreality: 0, twitchEvery: 8.6 },
  { id: "PHYSICAL_ACTIVATION", start: 10, end: 22, diameter: 4.05, detail: 0.26, light: 0.68, pulse: 0.32, unreality: 0.08, twitchEvery: 6.7 },
  { id: "FEEDBACK_LOOP", start: 22, end: 38, diameter: 2.4, detail: 0.52, light: 0.46, pulse: 0.64, unreality: 0.28, twitchEvery: 4.15 },
  { id: "PANIC_PEAK", start: 38, end: 52, diameter: 1.88, detail: 0.86, light: 0.28, pulse: 1, unreality: 0.76, twitchEvery: 2.45 },
  { id: "DECLINE", start: 52, end: 60, diameter: 1.5, detail: 0.42, light: 0.48, pulse: 0.08, unreality: 0.08, twitchEvery: 7.8 },
];

// Small releases stop the narrowing from becoming a mechanically linear ramp.
const DIAMETER_KEYS = [
  [0, 5.0], [10, 4.05], [16, 3.6], [22, 2.9], [28, 2.7],
  [31, 2.48], [34, 2.68], [38, 2.12], [45, 1.88], [52, 1.74],
  [56, 1.65], [60, 1.5],
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
