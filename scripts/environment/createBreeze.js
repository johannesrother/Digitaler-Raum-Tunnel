/**
 * A small CPU-side breeze controller for the limited number of approved kit
 * assets. It intentionally animates transform groups, never vertex buffers or
 * per-pixel effects, which keeps the pass comfortable for standalone WebXR.
 */
export function createBreeze(scene, placedAssets) {
  const anchorStates = [];
  const fernFrondStates = [];

  placedAssets.forEach((entry, index) => {
    if (entry.prefix.includes("moss-rock")) {
      return;
    }

    if (entry.prefix.includes("fern")) {
      entry.roots.forEach((root, rootIndex) => {
        fernFrondStates.push(createNodeState(
          root,
          index * 1.73 + rootIndex * 0.91,
        ));
      });
      return;
    }

    if (entry.prefix.includes("pink-flower") || entry.prefix.includes("white-flower")) {
      anchorStates.push(createAnchorState(entry.anchor, "flower", index));
      return;
    }

    if (entry.prefix.includes("shrub")) {
      anchorStates.push(createAnchorState(entry.anchor, "shrub", index));
    }
  });

  let elapsed = 0;
  let previousFrameTime = performance.now();
  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    elapsed += Math.min((frameTime - previousFrameTime) / 1000, 0.04);
    previousFrameTime = frameTime;
    anchorStates.forEach((state) => animateAnchor(state, elapsed));
    fernFrondStates.forEach((state) => animateFernFrond(state, elapsed));
  });

  return {
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
    },
  };
}

function createAnchorState(anchor, kind, index) {
  return {
    anchor,
    kind,
    baseRotation: anchor.rotation.clone(),
    basePosition: anchor.position.clone(),
    phase: index * 1.618 + (kind === "flower" ? 0.35 : 1.17),
    rate: kind === "flower" ? 0.34 + (index % 3) * 0.035 : 0.19 + (index % 3) * 0.028,
    amplitude: kind === "flower" ? 0.019 + (index % 2) * 0.004 : 0.009 + (index % 2) * 0.003,
  };
}

function createNodeState(node, phase) {
  // glTF nodes may carry a quaternion. Convert it once so that a tiny local
  // frond offset can be composed without allocating quaternions every frame.
  if (node.rotationQuaternion) {
    node.rotation.copyFrom(node.rotationQuaternion.toEulerAngles());
    node.rotationQuaternion = null;
  }

  return {
    node,
    baseRotation: node.rotation.clone(),
    phase,
    rate: 0.22 + (phase % 0.07),
    amplitude: 0.024 + ((phase * 7) % 0.013),
  };
}

function animateAnchor(state, time) {
  const main = organicSway(time, state.rate, state.phase);
  const cross = organicSway(time, state.rate * 0.71, state.phase + 2.1);
  const pulse = 0.68 + Math.sin(time * 0.075 + state.phase) * 0.2;
  const amount = state.amplitude * pulse;

  state.anchor.rotation.x = state.baseRotation.x + main * amount;
  state.anchor.rotation.z = state.baseRotation.z + cross * amount * 0.75;
  // Flowers occasionally rise a fraction more during a small local gust,
  // without becoming a detectable bobbing animation.
  state.anchor.position.y = state.basePosition.y + (state.kind === "flower" ? main * 0.006 : 0);
}

function animateFernFrond(state, time) {
  const main = organicSway(time, state.rate, state.phase);
  const cross = organicSway(time, state.rate * 1.37, state.phase + 1.8);
  const pulse = 0.58 + Math.sin(time * 0.065 + state.phase * 0.6) * 0.24;
  const amount = state.amplitude * pulse;

  state.node.rotation.x = state.baseRotation.x + main * amount;
  state.node.rotation.z = state.baseRotation.z + cross * amount * 0.8;
}

/** Multiple slow frequencies avoid a synchronized, loop-like sine animation. */
function organicSway(time, rate, phase) {
  return (
    Math.sin(time * rate + phase) * 0.68 +
    Math.sin(time * rate * 1.71 + phase * 2.31) * 0.22 +
    Math.sin(time * rate * 0.43 - phase * 0.7) * 0.1
  );
}
