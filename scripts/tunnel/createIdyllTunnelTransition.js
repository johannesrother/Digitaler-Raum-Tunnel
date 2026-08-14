import {
  TUNNEL_DURATION,
  getTunnelDiameter,
  getTunnelPhase,
} from "./tunnelConfig.js";

const IDYLL_TRAVEL_DURATION = 20;
const RIFT_FORM_START = 16;
const RIFT_TUNNEL_REVEAL_START = 18.25;
const RIFT_PULL_DURATION = 2.25;
const TUNNEL_START = IDYLL_TRAVEL_DURATION + RIFT_PULL_DURATION;
const WHITE_ROOM_ARRIVAL_DURATION = 1;
const WHITE_ROOM_DURATION = 5;
const WHITE_PREVIEW_START = 30;
const RIFT_APPROACH_REMAINING_TIME = 3.4;
const RIFT_CLOSE_DURATION = 1.4;
const ENTRY_ROUTE_EASE_DURATION = 0.75;

/**
 * The only automatic motion in the experience. A parent transform carries
 * desktop and XR cameras through the route without ever writing head yaw.
 */
export function createIdyllTunnelTransition(scene, options) {
  const root = new BABYLON.TransformNode("idyll-to-tunnel-locomotion-root", scene);
  const start = options.startPosition.clone();
  const entry = createEntryPath(start, options.entrance, options.initialForward, options.tunnel.route.start);
  const tunnelRoute = createTunnelTravelRoute(entry, options.tunnel.route, options.entrance.center);
  const tunnelWorld = createTunnelWorldGroup(options);
  const rift = createSpacetimeRift(scene, options.entrance, options.tunnel.route.start);
  const riftApproachTime = Math.max(0.5, tunnelRoute.entryTime - RIFT_APPROACH_REMAINING_TIME);
  const debug = createDebugPanel();
  let elapsed = 0;
  let xrCamera = null;
  let previousWorldHidden = false;
  let idyllHidden = false;
  let whiteRoomFinished = false;
  let portalClosed = false;
  let previousFrameTime = performance.now();
  const initialHeading = headingFrom(options.initialForward);

  // Keep the camera at the root origin. The root can now yaw along the
  // spline without orbiting a desktop camera around the world origin.
  root.position.copyFrom(start);
  options.desktopCamera.parent = root;
  options.desktopCamera.position.set(0, options.desktopCamera.position.y - start.y, 0);
  // The real tunnel stays out of the idyll until the rift itself is open.
  tunnelWorld.hide();
  options.tunnel.setSequenceActive(false);

  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.04);
    previousFrameTime = frameTime;
    elapsed += delta;
    const riftFormation = smoothstep((elapsed - RIFT_FORM_START) / (IDYLL_TRAVEL_DURATION - RIFT_FORM_START));
    const tunnelReveal = smoothstep((elapsed - RIFT_TUNNEL_REVEAL_START) / (IDYLL_TRAVEL_DURATION - RIFT_TUNNEL_REVEAL_START));
    const tunnelElapsed = elapsed - TUNNEL_START;
    const tunnelTime = BABYLON.Scalar.Clamp(tunnelElapsed, 0, TUNNEL_DURATION);
    const hasEnteredTunnel = elapsed >= TUNNEL_START;
    const hasReachedWhiteRoom = tunnelElapsed >= TUNNEL_DURATION;

    if (!portalClosed) {
      tunnelWorld.reveal(tunnelReveal);
    }
    rift.update(elapsed, riftFormation, tunnelReveal, hasEnteredTunnel ? tunnelTime : -1);

    if (elapsed < IDYLL_TRAVEL_DURATION) {
      applyPathTransform(root, tunnelRoute, riftApproachTime * calmTravelProgress(elapsed / IDYLL_TRAVEL_DURATION), initialHeading, delta);
    } else if (!hasEnteredTunnel) {
      applyPathTransform(root, tunnelRoute, riftApproachTime + (tunnelRoute.entryTime - riftApproachTime)
        * riftPullProgress(elapsed - IDYLL_TRAVEL_DURATION, tunnelRoute, riftApproachTime), initialHeading, delta);
    } else if (!hasReachedWhiteRoom) {
      applyPathTransform(root, tunnelRoute, tunnelRoute.entryTime + tunnelTime, initialHeading, delta);
      options.tunnel.update(tunnelTime);
      if (!idyllHidden) {
        tunnelWorld.closePortal();
        portalClosed = true;
        idyllHidden = true;
      }
      options.whiteRoom.preview(smoothstep((tunnelTime - WHITE_PREVIEW_START) / (TUNNEL_DURATION - WHITE_PREVIEW_START)));
    } else {
      activateWhiteRoom(options, root);
      const whiteElapsed = tunnelElapsed - TUNNEL_DURATION;
      const arrival = smoothstep(whiteElapsed / WHITE_ROOM_ARRIVAL_DURATION);
      root.position.copyFrom(BABYLON.Vector3.Lerp(tunnelRoute.endPosition, options.whiteRoom.finalPosition, arrival));
      if (!previousWorldHidden && whiteElapsed >= WHITE_ROOM_ARRIVAL_DURATION) {
        isolatePreviousWorld(options);
        previousWorldHidden = true;
      }
      if (!whiteRoomFinished && whiteElapsed >= WHITE_ROOM_DURATION) {
        options.whiteRoomTone.deactivate();
        whiteRoomFinished = true;
      }
    }
    debug.update(elapsed, tunnelTime, tunnelRoute, hasEnteredTunnel, riftFormation);
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
          syncRootToExperienceTime(root, elapsed, tunnelRoute, options.whiteRoom, initialHeading, riftApproachTime);
          return;
        }
        if (xrCamera) {
          xrCamera.parent = null;
          xrCamera = null;
        }
        syncRootToExperienceTime(root, elapsed, tunnelRoute, options.whiteRoom, initialHeading, riftApproachTime);
      });
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      options.desktopCamera.parent = null;
      if (xrCamera) {
        xrCamera.parent = null;
      }
      debug.dispose();
      rift.dispose();
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

function createTunnelTravelRoute(entryPath, tunnelRoute, entranceCenter) {
  const points = [...entryPath];
  for (let index = 0; index <= 188; index += 1) {
    // The cap stays just ahead of the final ascent endpoint; the visitor can
    // never cross it or leave the visible tunnel volume.
    if (index > 0) {
      points.push(tunnelRoute.positionAt(index / 188 * 0.986));
    }
  }
  return createPolylineRoute(points, closestDistanceAlongPolyline(points, entranceCenter));
}

function createPolylineRoute(points, entranceDistance) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + BABYLON.Vector3.Distance(points[index - 1], points[index]));
  }
  const totalLength = lengths.at(-1);
  // The old 60-second clock included the approach from the idyll to the
  // opening. Keep that route and its gentle ease-in, but derive its duration
  // so the distance after the physical entrance always takes exactly 60 s.
  const distanceInsideTunnel = totalLength - entranceDistance;
  const duration = TUNNEL_DURATION * totalLength / distanceInsideTunnel
    + ENTRY_ROUTE_EASE_DURATION * 0.5;
  const normalTunnelSpeed = totalLength / (duration - ENTRY_ROUTE_EASE_DURATION * 0.5);

  const distanceAt = (time) => {
    const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
    if (clamped < ENTRY_ROUTE_EASE_DURATION) {
      const easeProgress = clamped / ENTRY_ROUTE_EASE_DURATION;
      return normalTunnelSpeed * ENTRY_ROUTE_EASE_DURATION
        * (easeProgress ** 3 - 0.5 * easeProgress ** 4);
    }
    return normalTunnelSpeed * (clamped - ENTRY_ROUTE_EASE_DURATION * 0.5);
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
    totalLength,
    duration,
    entryDistance: entranceDistance,
    entryTime: entranceDistance / normalTunnelSpeed + ENTRY_ROUTE_EASE_DURATION * 0.5,
    distanceAt,
    positionAt,
    speedAt(time) {
      const clamped = BABYLON.Scalar.Clamp(time, 0, duration);
      return normalTunnelSpeed * smoothstep(clamped / ENTRY_ROUTE_EASE_DURATION);
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

function closestDistanceAlongPolyline(points, target) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let distanceAlongPath = 0;
  let accumulated = 0;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const segment = points[index].subtract(from);
    const segmentLength = segment.length();
    const direction = segment.scale(1 / Math.max(segmentLength, 0.00001));
    const projection = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(target.subtract(from), direction), 0, segmentLength);
    const closestPoint = from.add(direction.scale(projection));
    const distance = BABYLON.Vector3.DistanceSquared(target, closestPoint);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      distanceAlongPath = accumulated + projection;
    }
    accumulated += segmentLength;
  }

  return distanceAlongPath;
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

function calmTravelProgress(amount) {
  const progress = BABYLON.Scalar.Clamp(amount, 0, 1);
  // This remains almost constant-speed, with just enough easing to avoid a
  // mathematical start/stop while crossing the open landscape.
  return progress + (smoothstep(progress) - progress) * 0.12;
}

function riftPullProgress(time, route, approachTime) {
  const progress = BABYLON.Scalar.Clamp(time / RIFT_PULL_DURATION, 0, 1);
  const virtualDuration = Math.max(route.entryTime - approachTime, 0.001);
  const approachSpeed = route.distanceAt(approachTime) / IDYLL_TRAVEL_DURATION;
  const startSlope = BABYLON.Scalar.Clamp(
    approachSpeed / route.normalTunnelSpeed * RIFT_PULL_DURATION / virtualDuration,
    0.05,
    0.5,
  );
  const endSlope = BABYLON.Scalar.Clamp(RIFT_PULL_DURATION / virtualDuration, 0.2, 1.3);
  const inverse = 1 - progress;
  return (progress ** 3 - 2 * progress ** 2 + progress) * startSlope
    + (-2 * progress ** 3 + 3 * progress ** 2)
    + (progress ** 3 - progress ** 2) * endSlope;
}

function createSpacetimeRift(scene, entrance, tunnelStart) {
  const segments = 52;
  const center = tunnelStart.add(new BABYLON.Vector3(0, 1.65, 0));
  const lateral = entrance.lateral.clone();
  const positions = [];
  const indices = [];
  const shape = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return {
      angle,
      inner: 1 + Math.sin(angle * 3.1 + 0.4) * 0.08 + Math.sin(angle * 7.2 - 0.7) * 0.035,
      rim: 0.13 + Math.sin(angle * 4.6 - 0.3) * 0.035,
    };
  });
  shape.forEach(() => positions.push(0, 0, 0, 0, 0, 0));
  for (let index = 0; index < segments; index += 1) {
    const first = index * 2;
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  }
  const mesh = new BABYLON.Mesh("spacetime-rift-edge", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, vertexData.normals);
  vertexData.applyToMesh(mesh);
  const material = new BABYLON.StandardMaterial("spacetime-rift-edge-material", scene);
  material.diffuseColor = BABYLON.Color3.FromHexString("#120f13");
  material.emissiveColor = BABYLON.Color3.FromHexString("#2a1c24");
  material.specularColor = BABYLON.Color3.Black();
  material.backFaceCulling = false;
  material.alpha = 0;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.setEnabled(false);

  const updateVertices = (elapsed, width, height) => {
    shape.forEach((point, index) => {
      const wobble = Math.sin(elapsed * 2.3 + point.angle * 5.4) * 0.025;
      const innerWidth = 1.72 * point.inner * width;
      const innerHeight = 1.92 * point.inner * height;
      const outerWidth = (1.72 * point.inner + point.rim) * width;
      const outerHeight = (1.92 * point.inner + point.rim * 1.15) * height;
      const writePoint = (vertex, radialWidth, radialHeight) => {
        const x = Math.cos(point.angle) * radialWidth;
        const y = Math.sin(point.angle) * radialHeight + wobble * height;
        positions[vertex] = center.x + lateral.x * x;
        positions[vertex + 1] = center.y + y;
        positions[vertex + 2] = center.z + lateral.z * x;
      };
      writePoint(index * 6, outerWidth, outerHeight);
      writePoint(index * 6 + 3, innerWidth, innerHeight);
    });
    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  };

  return {
    update(elapsed, formation, reveal, tunnelTime) {
      const isClosing = tunnelTime >= 0;
      const closure = isClosing ? 1 - smoothstep(tunnelTime / RIFT_CLOSE_DURATION) : 1;
      if (formation <= 0 || closure <= 0.01) {
        mesh.setEnabled(false);
        return;
      }
      const opening = smoothstep((elapsed - 18) / 2);
      const width = (0.035 + opening * 0.965) * closure;
      const height = (0.18 + formation * 0.82) * closure;
      updateVertices(elapsed, width, height);
      material.alpha = (0.22 + reveal * 0.62) * closure;
      mesh.setEnabled(true);
    },
    dispose() {
      material.dispose();
      mesh.dispose();
    },
  };
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

function syncRootToExperienceTime(root, elapsed, tunnelRoute, whiteRoom, initialHeading, riftApproachTime) {
  if (elapsed < IDYLL_TRAVEL_DURATION) {
    applyPathTransform(root, tunnelRoute, riftApproachTime * calmTravelProgress(elapsed / IDYLL_TRAVEL_DURATION), initialHeading, 0);
    return;
  }
  if (elapsed < TUNNEL_START) {
    applyPathTransform(root, tunnelRoute, riftApproachTime + (tunnelRoute.entryTime - riftApproachTime)
      * riftPullProgress(elapsed - IDYLL_TRAVEL_DURATION, tunnelRoute, riftApproachTime), initialHeading, 0);
    return;
  }
  const tunnelTime = elapsed - TUNNEL_START;
  if (tunnelTime < TUNNEL_DURATION) {
    applyPathTransform(root, tunnelRoute, tunnelRoute.entryTime + tunnelTime, initialHeading, 0);
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
    update(experienceTime, tunnelTime, tunnelRoute, hasEnteredTunnel, riftFormation) {
      const phase = getTunnelPhase(tunnelTime);
      const inWhiteRoom = experienceTime >= TUNNEL_START + TUNNEL_DURATION;
      const inTunnel = hasEnteredTunnel && tunnelTime < TUNNEL_DURATION;
      const controller = inWhiteRoom
        ? "white room"
        : inTunnel
        ? "tunnel travel"
        : experienceTime >= IDYLL_TRAVEL_DURATION
          ? "rift pull"
          : experienceTime >= RIFT_FORM_START
            ? "rift forming"
            : "idyll travel";
      const currentSpeed = inTunnel ? tunnelRoute.normalTunnelSpeed : 0;
      panel.textContent = [
        `Experience: ${experienceTime.toFixed(1)} s`,
        `Tunnel: ${tunnelTime.toFixed(1)} / ${TUNNEL_DURATION} s`,
        `Controller: ${controller}`,
        `Speed: ${currentSpeed.toFixed(2)} / ${tunnelRoute.normalTunnelSpeed.toFixed(2)} m/s`,
        `Rift: ${(riftFormation * 100).toFixed(0)} %`,
        `Phase: ${phase.id}`,
        `Progress: ${(tunnelTime / TUNNEL_DURATION * 100).toFixed(0)} %`,
        `Tunnel path: ${(inTunnel ? tunnelTime * tunnelRoute.normalTunnelSpeed : 0).toFixed(1)} m`,
        `Diameter: ${getTunnelDiameter(tunnelTime).toFixed(2)} m`,
      ].join("\n");
    },
    dispose() {
      panel.remove();
    },
  };
}

/**
 * One authoritative visibility controller owns the real tunnel, its entrance
 * shell, the previously visible ribbed interior, floor/fade helpers and their
 * lights. Disabled meshes do not render or cast shadows during the idyll.
 */
function createTunnelWorldGroup(options) {
  const entrance = options.tunnelEntrance;
  const entranceMeshes = [entrance.portal, entrance.shell, entrance.floor, entrance.fade]
    .filter(Boolean);
  const allMeshes = [options.tunnel.mesh, ...entranceMeshes];
  const originalVisibility = new Map(allMeshes.map((mesh) => [mesh, mesh.visibility]));

  const setEntranceEnabled = (enabled) => {
    entranceMeshes.forEach((mesh) => mesh.setEnabled(enabled));
    entrance.daylight?.setEnabled(enabled);
  };

  return {
    hide() {
      options.tunnel.setEnabled(false);
      setEntranceEnabled(false);
    },
    reveal(amount) {
      if (amount <= 0) {
        this.hide();
        return;
      }
      options.tunnel.setEnabled(true);
      setEntranceEnabled(amount > 0.14);
      allMeshes.forEach((mesh) => {
        mesh.visibility = originalVisibility.get(mesh) * amount;
      });
      // The entrance light only joins once the rupture already has volume, so
      // it cannot spill onto the idyll before the reveal.
      entrance.daylight?.setEnabled(amount > 0.48);
    },
    closePortal() {
      setEntranceEnabled(false);
      entranceMeshes.forEach((mesh) => {
        mesh.visibility = originalVisibility.get(mesh);
      });
      // The rupture has closed behind the visitor: the idyll is no longer a
      // renderable dimension from inside the tunnel, including through the
      // later White-Room sightline.
      options.idyllWorldMeshes.forEach((mesh) => mesh.setEnabled(false));
      options.onIdyllHidden?.();
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
