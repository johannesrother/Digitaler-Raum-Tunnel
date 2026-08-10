/**
 * A small CPU-side breeze controller for the limited number of approved kit
 * assets. It intentionally animates transform groups, never vertex buffers or
 * per-pixel effects, which keeps the pass comfortable for standalone WebXR.
 */
export function createBreeze(scene, placedAssets, attractionTarget) {
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
          entry.anchor.position,
          attractionTarget,
        ));
      });
      return;
    }

    if (entry.prefix.includes("pink-flower") || entry.prefix.includes("white-flower")) {
      anchorStates.push(createAnchorState(entry.anchor, "flower", index, attractionTarget));
      return;
    }

    if (entry.prefix.includes("shrub")) {
      anchorStates.push(createAnchorState(entry.anchor, "shrub", index, attractionTarget));
    }
  });

  let elapsed = 0;
  let attraction = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += Math.min(scene.getEngine().getDeltaTime(), 40) / 1000;
    anchorStates.forEach((state) => animateAnchor(state, elapsed, attraction));
    fernFrondStates.forEach((state) => animateFernFrond(state, elapsed, attraction));
  });

  return {
    setAttraction(amount) {
      attraction = BABYLON.Scalar.Clamp(amount, 0, 1);
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
    },
  };
}

function createAnchorState(anchor, kind, index, attractionTarget) {
  return {
    anchor,
    kind,
    baseRotation: anchor.rotation.clone(),
    basePosition: anchor.position.clone(),
    phase: index * 1.618 + (kind === "flower" ? 0.35 : 1.17),
    rate: kind === "flower" ? 0.34 + (index % 3) * 0.035 : 0.19 + (index % 3) * 0.028,
    amplitude: kind === "flower" ? 0.019 + (index % 2) * 0.004 : 0.009 + (index % 2) * 0.003,
    attractionDirection: directionToward(anchor.position, attractionTarget),
    attractionWeight: proximityToEntrance(anchor.position, attractionTarget),
  };
}

function createNodeState(node, phase, anchorPosition, attractionTarget) {
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
    attractionDirection: directionToward(anchorPosition, attractionTarget),
    attractionWeight: proximityToEntrance(anchorPosition, attractionTarget),
  };
}

function animateAnchor(state, time, attraction) {
  const main = organicSway(time, state.rate, state.phase);
  const cross = organicSway(time, state.rate * 0.71, state.phase + 2.1);
  const pulse = 0.68 + Math.sin(time * 0.075 + state.phase) * 0.2;
  const amount = state.amplitude * pulse;

  const directionalLean = attraction * state.attractionWeight * (state.kind === "flower" ? 0.018 : 0.009);
  state.anchor.rotation.x = state.baseRotation.x + main * amount + state.attractionDirection.z * directionalLean;
  state.anchor.rotation.z = state.baseRotation.z + cross * amount * 0.75 - state.attractionDirection.x * directionalLean;
  // Flowers occasionally rise a fraction more during a small local gust,
  // without becoming a detectable bobbing animation.
  state.anchor.position.y = state.basePosition.y + (state.kind === "flower" ? main * 0.006 : 0);
}

function animateFernFrond(state, time, attraction) {
  const main = organicSway(time, state.rate, state.phase);
  const cross = organicSway(time, state.rate * 1.37, state.phase + 1.8);
  const pulse = 0.58 + Math.sin(time * 0.065 + state.phase * 0.6) * 0.24;
  const amount = state.amplitude * pulse;

  const directionalLean = attraction * state.attractionWeight * 0.014;
  state.node.rotation.x = state.baseRotation.x + main * amount + state.attractionDirection.z * directionalLean;
  state.node.rotation.z = state.baseRotation.z + cross * amount * 0.8 - state.attractionDirection.x * directionalLean;
}

function directionToward(position, target) {
  if (!target) {
    return BABYLON.Vector3.Zero();
  }
  const direction = target.subtract(position);
  direction.y = 0;
  return direction.lengthSquared() > 0.001 ? direction.normalize() : BABYLON.Vector3.Zero();
}

function proximityToEntrance(position, target) {
  if (!target) {
    return 0;
  }
  const distance = BABYLON.Vector3.Distance(position, target);
  return BABYLON.Scalar.Clamp(1 - distance / 22, 0, 1);
}

/** Multiple slow frequencies avoid a synchronized, loop-like sine animation. */
function organicSway(time, rate, phase) {
  return (
    Math.sin(time * rate + phase) * 0.68 +
    Math.sin(time * rate * 1.71 + phase * 2.31) * 0.22 +
    Math.sin(time * rate * 0.43 - phase * 0.7) * 0.1
  );
}
