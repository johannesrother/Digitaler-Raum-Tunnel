const PEACEFUL_DURATION = 14;
const ATTRACTION_DURATION = 6;
const ACCELERATION_DURATION = 1.6;
const WALKING_SPEED = 0.78;
// Stop in the first visible metres of the approved ivory threshold. The
// later fade surface remains ahead for a future tunnel-expansion step.
const INSIDE_DISTANCE = 2.35;

/**
 * Drives the first, comfortable transition toward the approved entrance.
 * Translation is applied only to a parent transform: the desktop camera and
 * XR camera keep their own orientation, so looking around remains unrestricted.
 */
export function createIdyllTunnelTransition(scene, options) {
  const root = new BABYLON.TransformNode("idyll-to-tunnel-locomotion-root", scene);
  const start = options.startPosition.clone();
  const entrance = options.entrance;
  const path = createEntryPath(start, entrance, options.initialForward);
  let elapsed = 0;
  let travelled = 0;
  let xrCamera = null;
  let inXr = false;

  options.desktopCamera.parent = root;

  const observer = scene.onBeforeRenderObservable.add(() => {
    const delta = Math.min(scene.getEngine().getDeltaTime(), 40) / 1000;
    elapsed += delta;

    const attraction = attractionAmount(elapsed);
    options.breeze.setAttraction(attraction);

    if (elapsed >= PEACEFUL_DURATION + ATTRACTION_DURATION) {
      travelled = Math.min(
        travelled + walkingSpeed(elapsed) * delta,
        path.length,
      );
      applyPathPosition(root, path.positionAtDistance(travelled), start, inXr);
    }
  });

  return {
    attachWebXR(xr) {
      if (!xr) {
        return;
      }

      xr.onStateChangedObservable.add((state) => {
        const isInXr = state === BABYLON.WebXRState.IN_XR;
        if (isInXr) {
          xrCamera = xr.baseExperience.camera;
          xrCamera.parent = root;
          inXr = true;
          applyPathPosition(root, path.positionAtDistance(travelled), start, true);
          return;
        }

        if (xrCamera) {
          xrCamera.parent = null;
          xrCamera = null;
        }
        inXr = false;
        applyPathPosition(root, path.positionAtDistance(travelled), start, false);
      });
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      options.desktopCamera.parent = null;
      if (xrCamera) {
        xrCamera.parent = null;
      }
      root.dispose();
    },
  };
}

function attractionAmount(time) {
  if (time <= PEACEFUL_DURATION) {
    return 0;
  }
  if (time < PEACEFUL_DURATION + 3) {
    return smoothstep((time - PEACEFUL_DURATION) / 3) * 0.35;
  }
  return BABYLON.Scalar.Lerp(0.35, 1, smoothstep((time - PEACEFUL_DURATION - 3) / 3));
}

function walkingSpeed(time) {
  const acceleration = smoothstep(
    (time - PEACEFUL_DURATION - ATTRACTION_DURATION) / ACCELERATION_DURATION,
  );
  return WALKING_SPEED * acceleration;
}

function createEntryPath(start, entrance, initialForward) {
  const firstDirection = initialForward.clone();
  firstDirection.y = 0;
  firstDirection.normalize();
  const controlA = start.add(firstDirection.scale(4.2));
  const controlB = entrance.center.subtract(entrance.forward.scale(3.1));
  const finish = entrance.center.add(entrance.forward.scale(INSIDE_DISTANCE));
  const samples = [];
  let totalLength = 0;
  let previous = start.clone();

  for (let index = 0; index <= 96; index += 1) {
    const point = cubicBezier(start, controlA, controlB, finish, index / 96);
    if (index > 0) {
      totalLength += BABYLON.Vector3.Distance(previous, point);
    }
    samples.push({ point, length: totalLength });
    previous = point;
  }

  return {
    length: totalLength,
    positionAtDistance(distance) {
      const clamped = BABYLON.Scalar.Clamp(distance, 0, totalLength);
      const nextIndex = samples.findIndex((sample) => sample.length >= clamped);
      if (nextIndex <= 0) {
        return samples[0].point;
      }
      const before = samples[nextIndex - 1];
      const after = samples[nextIndex];
      const span = Math.max(after.length - before.length, 0.0001);
      return BABYLON.Vector3.Lerp(before.point, after.point, (clamped - before.length) / span);
    },
  };
}

function applyPathPosition(root, position, start, inXr) {
  const offset = position.subtract(start);
  root.position.x = offset.x + (inXr ? start.x : 0);
  root.position.y = 0;
  root.position.z = offset.z + (inXr ? start.z : 0);
}

function cubicBezier(start, controlA, controlB, finish, amount) {
  const inverse = 1 - amount;
  return start.scale(inverse ** 3)
    .add(controlA.scale(3 * inverse * inverse * amount))
    .add(controlB.scale(3 * inverse * amount * amount))
    .add(finish.scale(amount ** 3));
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
