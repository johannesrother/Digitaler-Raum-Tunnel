import {
  TUNNEL_DURATION,
  getTunnelDiameter,
  getTunnelPhase,
} from "./tunnelConfig.js";

const TUNNEL_START = 20;
const TUNNEL_END = TUNNEL_START + TUNNEL_DURATION;
const WHITE_ROOM_DECELERATION_DURATION = 2;
const TUNNEL_RELEASE_DURATION = 2;
const WHITE_ROOM_DURATION = 5;
const MOVEMENT_EASE_IN_DURATION = 0.8;
const WHITE_PREVIEW_START = TUNNEL_DURATION - 3;

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
  let outsideGroundHidden = false;
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
      options.tunnelAmbience.update(tunnelTime);
      applyPathTransform(root, tunnelRoute, tunnelTime, initialHeading, delta);
      const whitePreview = smoothstep((tunnelTime - WHITE_PREVIEW_START) / (TUNNEL_DURATION - WHITE_PREVIEW_START));
      options.whiteRoom.preview(whitePreview);
      options.tunnel.setExitGlow(whitePreview);
      options.whiteRoomTone.preview(whitePreview);
      // Keep the idyll readable behind the visitor immediately after crossing
      // the threshold, then remove its large ground surfaces before they can
      // intrude into the deeper tunnel volume.
      if (!outsideGroundHidden && tunnelTime >= 12) {
        options.outsideGroundMeshes.forEach((mesh) => mesh.setEnabled(false));
        outsideGroundHidden = true;
      }
    } else if (elapsed >= TUNNEL_END) {
      const transitionTime = elapsed - TUNNEL_END;
      activateWhiteRoom(options, root);
      options.tunnelAmbience.deactivate();
      const arrival = easeOutCubic(transitionTime / WHITE_ROOM_DECELERATION_DURATION);
      root.position.copyFrom(BABYLON.Vector3.Lerp(tunnelRoute.endPosition, options.whiteRoom.finalPosition, arrival));
      if (transitionTime >= TUNNEL_RELEASE_DURATION) {
        options.tunnel.setEnabled(false);
        options.tunnel.setSequenceActive(false);
      }
      if (!whiteRoomFinished && elapsed >= TUNNEL_END + WHITE_ROOM_DURATION) {
        options.whiteRoomTone.deactivate();
        whiteRoomFinished = true;
      }
    }
    debug.update(elapsed, tunnelTime);
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
    // Stop just inside the open exit; the final two seconds continue
    // horizontally into the physically present White Room.
    if (index > 0) {
      points.push(tunnelRoute.positionAt(index / 188 * 0.986));
    }
  }
  return createPolylineRoute(points, TUNNEL_DURATION, createDistanceTable);
}

function createPolylineRoute(points, duration, distanceTableFactory = null) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + BABYLON.Vector3.Distance(points[index - 1], points[index]));
  }
  const totalLength = lengths.at(-1);
  const distanceTable = distanceTableFactory ? distanceTableFactory(totalLength) : null;

  const positionAt = (time) => {
    const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
    const distance = distanceTable ? sampleDistance(distanceTable, clamped) : clamped * totalLength;
    const next = lengths.findIndex((length) => length >= distance);
    if (next <= 0) {
      return points[0].clone();
    }
    const before = lengths[next - 1];
    const span = Math.max(lengths[next] - before, 0.0001);
    return BABYLON.Vector3.Lerp(points[next - 1], points[next], (distance - before) / span);
  };

  return {
    length: totalLength,
    endPosition: points.at(-1).clone(),
    positionAt,
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

function createDistanceTable(totalLength) {
  const intervals = 480;
  const step = TUNNEL_DURATION / intervals;
  const speedAt = (time) => smoothstep(time / MOVEMENT_EASE_IN_DURATION);
  const values = [0];
  let accumulated = 0;
  for (let index = 1; index <= intervals; index += 1) {
    accumulated += speedAt((index - 0.5) * step) * step;
    values.push(accumulated);
  }
  return values.map((value, index) => ({ time: index * step, distance: value / accumulated * totalLength }));
}

function sampleDistance(table, time) {
  const index = Math.min(table.length - 2, Math.floor(time / TUNNEL_DURATION * (table.length - 1)));
  const before = table[index];
  const after = table[index + 1];
  return BABYLON.Scalar.Lerp(before.distance, after.distance, (time - before.time) / Math.max(after.time - before.time, 0.0001));
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

function easeOutCubic(amount) {
  const clamped = BABYLON.Scalar.Clamp(amount, 0, 1);
  return 1 - (1 - clamped) ** 3;
}

function syncRootToExperienceTime(root, elapsed, tunnelRoute, whiteRoom, initialHeading) {
  if (elapsed < TUNNEL_START) {
    return;
  }
  if (elapsed < TUNNEL_END) {
    applyPathTransform(root, tunnelRoute, elapsed - TUNNEL_START, initialHeading, 0);
    return;
  }
  if (elapsed < TUNNEL_END + WHITE_ROOM_DECELERATION_DURATION) {
    const arrival = easeOutCubic((elapsed - TUNNEL_END) / WHITE_ROOM_DECELERATION_DURATION);
    root.position.copyFrom(BABYLON.Vector3.Lerp(tunnelRoute.endPosition, whiteRoom.finalPosition, arrival));
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

function createDebugPanel() {
  const enabled = new URLSearchParams(window.location.search).has("debugTunnel");
  if (!enabled) {
    return { update() {}, dispose() {} };
  }
  const panel = document.createElement("pre");
  panel.className = "tunnel-debug-panel";
  document.body.append(panel);
  return {
    update(experienceTime, tunnelTime) {
      const phase = getTunnelPhase(tunnelTime);
      panel.textContent = [
        `Experience: ${experienceTime.toFixed(1)} s`,
        `Tunnel: ${tunnelTime.toFixed(1)} / ${TUNNEL_DURATION} s`,
        `Phase: ${phase.id}`,
        `Progress: ${(tunnelTime / TUNNEL_DURATION * 100).toFixed(0)} %`,
        `Diameter: ${getTunnelDiameter(tunnelTime).toFixed(2)} m`,
        "Speed: controlled",
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

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
