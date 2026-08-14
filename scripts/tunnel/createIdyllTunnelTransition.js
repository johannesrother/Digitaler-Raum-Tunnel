import {
  TUNNEL_DURATION,
  getTunnelDiameter,
  getTunnelPhase,
} from "./tunnelConfig.js";

const TUNNEL_START = 20;
const TUNNEL_END = TUNNEL_START + TUNNEL_DURATION;
const WHITE_ROOM_ARRIVAL_DURATION = 1;
const WHITE_ROOM_DURATION = 5;
const MOVEMENT_EASE_IN_DURATION = 0.75;
const WHITE_PREVIEW_START = 30;

/**
 * The only automatic motion in the experience. A parent transform carries
 * desktop and XR cameras through the route without ever writing head yaw.
 */
export function createIdyllTunnelTransition(scene, options) {
  const root = new BABYLON.TransformNode("idyll-to-tunnel-locomotion-root", scene);
  const start = options.startPosition.clone();
  const entry = createEntryPath(start, options.entrance, options.initialForward, options.tunnel.route.start);
  const tunnelRoute = createTunnelTravelRoute(entry, options.tunnel.route);
  const debug = createDebugPanel();
  let elapsed = 0;
  let xrCamera = null;
  let previousWorldHidden = false;
  let whiteRoomFinished = false;
  let previousFrameTime = performance.now();
  const initialHeading = headingFrom(options.initialForward);

  // Keep the camera at the root origin. The root can now yaw along the
  // spline without orbiting a desktop camera around the world origin.
  root.position.copyFrom(start);
  options.desktopCamera.parent = root;
  options.desktopCamera.position.set(0, options.desktopCamera.position.y - start.y, 0);
  // The tunnel and its first visible section belong to the idyll from frame
  // one. Only its time-based behaviour waits for the actual entry.
  options.entranceFade.setEnabled(false);
  options.tunnel.setEnabled(true);
  options.tunnel.setSequenceActive(false);

  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.04);
    previousFrameTime = frameTime;
    elapsed += delta;
    let tunnelTime = 0;

    if (elapsed >= TUNNEL_START && elapsed < TUNNEL_END) {
      tunnelTime = elapsed - TUNNEL_START;
      options.tunnel.update(tunnelTime);
      applyPathTransform(root, tunnelRoute, tunnelTime, initialHeading, delta);
      options.whiteRoom.preview(smoothstep((tunnelTime - WHITE_PREVIEW_START) / (TUNNEL_DURATION - WHITE_PREVIEW_START)));
    } else if (elapsed >= TUNNEL_END) {
      activateWhiteRoom(options, root);
      const arrival = smoothstep((elapsed - TUNNEL_END) / WHITE_ROOM_ARRIVAL_DURATION);
      root.position.copyFrom(BABYLON.Vector3.Lerp(tunnelRoute.endPosition, options.whiteRoom.finalPosition, arrival));
      if (!previousWorldHidden && elapsed >= TUNNEL_END + WHITE_ROOM_ARRIVAL_DURATION) {
        isolatePreviousWorld(options);
        previousWorldHidden = true;
      }
      if (!whiteRoomFinished && elapsed >= TUNNEL_END + WHITE_ROOM_DURATION) {
        options.whiteRoomTone.deactivate();
        whiteRoomFinished = true;
      }
    }
    debug.update(elapsed, tunnelTime, tunnelRoute);
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
          syncRootToExperienceTime(root, elapsed, tunnelRoute, options.whiteRoom, initialHeading);
          return;
        }
        if (xrCamera) {
          xrCamera.parent = null;
          xrCamera = null;
        }
        syncRootToExperienceTime(root, elapsed, tunnelRoute, options.whiteRoom, initialHeading);
      });
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      options.desktopCamera.parent = null;
      if (xrCamera) {
        xrCamera.parent = null;
      }
      debug.dispose();
      root.dispose();
    },
  };
}

function createEntryPath(start, entrance, initialForward, finish) {
  const direction = initialForward.clone();
  direction.y = 0;
  direction.normalize();
  const controlA = start.add(direction.scale(4.2));
  const controlB = entrance.center.subtract(entrance.forward.scale(3.1));
  const points = [];
  for (let index = 0; index <= 88; index += 1) {
    points.push(cubicBezier(start, controlA, controlB, finish, index / 88));
  }
  return points;
}

function createTunnelTravelRoute(entryPath, tunnelRoute) {
  const points = [...entryPath];
  for (let index = 0; index <= 188; index += 1) {
    // The cap stays just ahead of the final ascent endpoint; the visitor can
    // never cross it or leave the visible tunnel volume.
    if (index > 0) {
      points.push(tunnelRoute.positionAt(index / 188 * 0.986));
    }
  }
  return createPolylineRoute(points, TUNNEL_DURATION);
}

function createPolylineRoute(points, duration) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + BABYLON.Vector3.Distance(points[index - 1], points[index]));
  }
  const totalLength = lengths.at(-1);
  const normalTunnelSpeed = totalLength / (duration - MOVEMENT_EASE_IN_DURATION * 0.5);

  const distanceAt = (time) => {
    const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
    if (clamped < MOVEMENT_EASE_IN_DURATION) {
      const easeProgress = clamped / MOVEMENT_EASE_IN_DURATION;
      return normalTunnelSpeed * MOVEMENT_EASE_IN_DURATION
        * (easeProgress ** 3 - 0.5 * easeProgress ** 4);
    }
    return normalTunnelSpeed * (clamped - MOVEMENT_EASE_IN_DURATION * 0.5);
  };

  const positionAt = (time) => {
    const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
    const distance = distanceAt(clamped);
    const next = lengths.findIndex((length) => length >= distance);
    if (next <= 0) {
      return points[0].clone();
    }
    const before = lengths[next - 1];
    const span = Math.max(lengths[next] - before, 0.0001);
    return BABYLON.Vector3.Lerp(points[next - 1], points[next], (distance - before) / span);
  };

  return {
    endPosition: points.at(-1).clone(),
    positionAt,
    speedAt(time) {
      const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
      return normalTunnelSpeed * smoothstep(clamped / MOVEMENT_EASE_IN_DURATION);
    },
    normalTunnelSpeed,
    tangentAt(time) {
      // A short future sample filters tiny spline detail without delaying the
      // turning response into a visible late rotation.
      const lookAhead = 0.62;
      const lookBehind = 0.18;
      const before = positionAt(Math.max(0, time - lookBehind));
      const after = positionAt(Math.min(duration, time + lookAhead));
      const tangent = after.subtract(before);
      tangent.y = 0;
      return tangent.lengthSquared() > 0.00001
        ? tangent.normalize()
        : BABYLON.Axis.Z.clone();
    },
  };
}

function applyPathTransform(root, route, time, initialHeading, delta) {
  const position = route.positionAt(time);
  root.position.copyFrom(position);

  // Only the locomotion body rotates. A WebXR camera remains free to receive
  // its headset-local orientation, while the desktop camera naturally faces
  // along the same body frame.
  const desiredYaw = normalizeAngle(headingFrom(route.tangentAt(time)) - initialHeading);
  const smoothing = 1 - Math.exp(-Math.max(0, delta) * 2.6);
  root.rotation.y = lerpAngle(root.rotation.y, desiredYaw, smoothing);
}

function activateWhiteRoom(options, root) {
  if (options.whiteRoomActive) {
    return;
  }
  options.whiteRoomActive = true;
  options.whiteRoom.activate();
  options.whiteRoomTone.activate();
  root.rotation.x = 0;
  root.rotation.z = 0;
}

function isolatePreviousWorld(options) {
  options.tunnel.setEnabled(false);
  options.tunnel.setSequenceActive(false);
  options.previousWorldMeshes.forEach((mesh) => mesh.setEnabled(false));
  options.previousWorldLights.forEach((light) => light.setEnabled(false));
}

function syncRootToExperienceTime(root, elapsed, tunnelRoute, whiteRoom, initialHeading) {
  if (elapsed < TUNNEL_START) {
    return;
  }
  if (elapsed < TUNNEL_END) {
    applyPathTransform(root, tunnelRoute, elapsed - TUNNEL_START, initialHeading, 0);
    return;
  }
  root.position.copyFrom(whiteRoom.finalPosition);
}

function headingFrom(direction) {
  return Math.atan2(direction.x, direction.z);
}

function lerpAngle(from, to, amount) {
  return from + normalizeAngle(to - from) * amount;
}

function normalizeAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function createDebugPanel() {
  const enabled = new URLSearchParams(window.location.search).has("debugTunnel");
  if (!enabled) {
    return { update() {}, dispose() {} };
  }
  const panel = document.createElement("pre");
  panel.className = "tunnel-debug-panel";
  document.body.append(panel);
  return {
    update(experienceTime, tunnelTime, tunnelRoute) {
      const phase = getTunnelPhase(tunnelTime);
      const moving = experienceTime >= TUNNEL_START && experienceTime < TUNNEL_END;
      const currentSpeed = moving ? tunnelRoute.speedAt(tunnelTime) : 0;
      panel.textContent = [
        `Experience: ${experienceTime.toFixed(1)} s`,
        `Tunnel: ${tunnelTime.toFixed(1)} / ${TUNNEL_DURATION} s`,
        `Controller: ${moving ? "continuous tunnel route" : "stationary idyll"}`,
        `Speed: ${currentSpeed.toFixed(2)} / ${tunnelRoute.normalTunnelSpeed.toFixed(2)} m/s`,
        `Phase: ${phase.id}`,
        `Progress: ${(tunnelTime / TUNNEL_DURATION * 100).toFixed(0)} %`,
        `Diameter: ${getTunnelDiameter(tunnelTime).toFixed(2)} m`,
      ].join("\n");
    },
    dispose() {
      panel.remove();
    },
  };
}

function cubicBezier(start, controlA, controlB, finish, amount) {
  const inverse = 1 - amount;
  return start.scale(inverse ** 3)
    .add(controlA.scale(3 * inverse * inverse * amount))
    .add(controlB.scale(3 * inverse * amount * amount))
    .add(finish.scale(amount ** 3));
}
