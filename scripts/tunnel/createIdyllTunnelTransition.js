import {
  TUNNEL_DURATION,
  getTunnelDiameter,
  getTunnelPhase,
  getTunnelSpeed,
} from "./tunnelConfig.js";

const PEACEFUL_DURATION = 14;
const ATTRACTION_DURATION = 6;
const ACCELERATION_DURATION = 1.6;

/**
 * The only automatic motion in the experience. A parent transform carries
 * desktop and XR cameras through the route without ever writing head yaw.
 */
export function createIdyllTunnelTransition(scene, options) {
  const root = new BABYLON.TransformNode("idyll-to-tunnel-locomotion-root", scene);
  const start = options.startPosition.clone();
  const entry = createEntryPath(start, options.entrance, options.initialForward, options.tunnel.route.start);
  const route = createTimedRoute(entry, options.tunnel.route);
  const debug = createDebugPanel();
  let elapsed = 0;
  let xrCamera = null;
  let inXr = false;
  let tunnelVisible = false;
  let previousFrameTime = performance.now();

  options.desktopCamera.parent = root;
  options.tunnel.setEnabled(false);

  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.04);
    previousFrameTime = frameTime;
    elapsed += delta;
    const tunnelTime = BABYLON.Scalar.Clamp(elapsed - PEACEFUL_DURATION - ATTRACTION_DURATION, 0, TUNNEL_DURATION);

    options.breeze.setAttraction(attractionAmount(elapsed));
    options.tunnel.update(tunnelTime);

    if (elapsed >= PEACEFUL_DURATION + ATTRACTION_DURATION) {
      if (!tunnelVisible) {
        options.entranceFade.setEnabled(false);
        options.tunnel.setEnabled(true);
        tunnelVisible = true;
      }
      applyPathPosition(root, route.positionAtTime(tunnelTime), start, inXr);
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
          inXr = true;
          applyPathPosition(root, route.positionAtTime(Math.max(0, elapsed - 20)), start, true);
          return;
        }
        if (xrCamera) {
          xrCamera.parent = null;
          xrCamera = null;
        }
        inXr = false;
        applyPathPosition(root, route.positionAtTime(Math.max(0, elapsed - 20)), start, false);
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

function attractionAmount(time) {
  if (time <= PEACEFUL_DURATION) {
    return 0;
  }
  if (time < PEACEFUL_DURATION + 3) {
    return smoothstep((time - PEACEFUL_DURATION) / 3) * 0.35;
  }
  return BABYLON.Scalar.Lerp(0.35, 1, smoothstep((time - PEACEFUL_DURATION - 3) / 3));
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

function createTimedRoute(entryPoints, tunnelRoute) {
  const points = [...entryPoints];
  for (let index = 1; index <= 188; index += 1) {
    // The cap stays just ahead of the final ascent endpoint; the visitor can
    // never cross it or leave the visible tunnel volume.
    points.push(tunnelRoute.positionAt(index / 188 * 0.986));
  }
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + BABYLON.Vector3.Distance(points[index - 1], points[index]));
  }
  const totalLength = lengths.at(-1);
  const distanceTable = createDistanceTable(totalLength);

  return {
    positionAtTime(time) {
      const clamped = BABYLON.Scalar.Clamp(time, 0, TUNNEL_DURATION);
      const distance = sampleDistance(distanceTable, clamped);
      const next = lengths.findIndex((length) => length >= distance);
      if (next <= 0) {
        return points[0].clone();
      }
      const before = lengths[next - 1];
      const span = Math.max(lengths[next] - before, 0.0001);
      return BABYLON.Vector3.Lerp(points[next - 1], points[next], (distance - before) / span);
    },
  };
}

function createDistanceTable(totalLength) {
  const intervals = 240;
  const values = [0];
  let accumulated = 0;
  for (let index = 1; index <= intervals; index += 1) {
    const time = index / intervals * TUNNEL_DURATION;
    const acceleration = smoothstep(time / ACCELERATION_DURATION);
    accumulated += getTunnelSpeed(time) * acceleration * (TUNNEL_DURATION / intervals);
    values.push(accumulated);
  }
  return values.map((value, index) => ({ time: index / intervals * TUNNEL_DURATION, distance: value / accumulated * totalLength }));
}

function sampleDistance(table, time) {
  const index = Math.min(table.length - 2, Math.floor(time / TUNNEL_DURATION * (table.length - 1)));
  const before = table[index];
  const after = table[index + 1];
  return BABYLON.Scalar.Lerp(before.distance, after.distance, (time - before.time) / Math.max(after.time - before.time, 0.0001));
}

function applyPathPosition(root, position, start, inXr) {
  const offset = position.subtract(start);
  root.position.x = offset.x + (inXr ? start.x : 0);
  root.position.y = offset.y;
  root.position.z = offset.z + (inXr ? start.z : 0);
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
        `Speed: ${getTunnelSpeed(tunnelTime).toFixed(2)} m/s`,
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
