import { TUNNEL_DURATION, getTunnelDiameter, getTunnelLook } from "./tunnelConfig.js";

const FLOOR_WIDTH_SEGMENTS = 8;
const GRASS_FADE_DISTANCE = 16;

/**
 * Creates the interior walking surface independently from the tunnel shell.
 * It follows the same sampled spline, so the entrance join and every later
 * elevation change remain continuous even as the surrounding shell narrows.
 */
export function createTunnelFloor(scene, route, tunnelMaterial, grassMaterial, entranceFloorHeight) {
  const floor = createContinuousFloor(scene, route, tunnelMaterial, entranceFloorHeight);
  const grassPatches = createGrassTransition(scene, route, grassMaterial, entranceFloorHeight);

  return { floor, grassPatches, grassFadeDistance: GRASS_FADE_DISTANCE };
}

function createContinuousFloor(scene, route, material, entranceFloorHeight) {
  const paths = Array.from({ length: FLOOR_WIDTH_SEGMENTS + 1 }, () => []);

  for (let section = 0; section <= 188; section += 1) {
    const progress = section / 188;
    for (let column = 0; column <= FLOOR_WIDTH_SEGMENTS; column += 1) {
      const lane = -1 + (column / FLOOR_WIDTH_SEGMENTS) * 2;
      paths[column].push(floorPointAt(route, progress, lane, 0, entranceFloorHeight));
    }
  }

  const floor = BABYLON.MeshBuilder.CreateRibbon(
    "general-organic-tunnel-continuous-floor",
    { pathArray: paths, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  floor.material = material;
  floor.isPickable = false;
  floor.receiveShadows = false;
  return floor;
}

function createGrassTransition(scene, route, material, entranceFloorHeight) {
  if (!material) {
    return [];
  }

  // Overlapping, wavy strips use the existing grass material. They avoid an
  // alpha-blended mask and leave no straight material boundary on Quest.
  const definitions = [
    { start: 0, end: 5.4, side: 0, coverage: 0.93, seed: 1.1 },
    { start: 2.8, end: 9.2, side: -0.3, coverage: 0.58, seed: 2.7 },
    { start: 7.1, end: 13.1, side: 0.42, coverage: 0.34, seed: 4.4 },
    { start: 11.3, end: GRASS_FADE_DISTANCE, side: -0.22, coverage: 0.16, seed: 6.2 },
  ];

  return definitions.map((definition, index) => {
    const left = [];
    const right = [];
    const samples = 18;

    for (let sample = 0; sample <= samples; sample += 1) {
      const amount = sample / samples;
      const distance = BABYLON.Scalar.Lerp(definition.start, definition.end, amount);
      const progress = route.progressAtDistance(distance);
      const widthVariation = 0.8 + Math.sin(amount * 8.7 + definition.seed) * 0.12;
      const centerVariation = Math.sin(amount * 11.2 + definition.seed * 2) * 0.08;
      const halfCoverage = definition.coverage * widthVariation * 0.5;
      const center = definition.side + centerVariation;
      left.push(floorPointAt(route, progress, center - halfCoverage, 0.035, entranceFloorHeight));
      right.push(floorPointAt(route, progress, center + halfCoverage, 0.036, entranceFloorHeight));
    }

    const patch = BABYLON.MeshBuilder.CreateRibbon(
      `tunnel-grass-transition-${index}`,
      { pathArray: [left, right], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      scene,
    );
    patch.material = material;
    patch.isPickable = false;
    patch.receiveShadows = false;
    return patch;
  });
}

function floorPointAt(route, progress, lane, lift, entranceFloorHeight) {
  const frame = route.frameAt(progress);
  const time = progress * TUNNEL_DURATION;
  const radius = getTunnelDiameter(time) * 0.5;
  const lowerRadius = radius * 1.12;
  const distance = route.distanceAtProgress(progress);
  const shellFloorAtStart = route.start.y + 1.65 - getTunnelDiameter(0) * 0.56;
  // Match the actual terrain-conforming ivory floor at the seam, then taper
  // the correction over eight metres. No segment begins on a different Y.
  const joinLift = (entranceFloorHeight - shellFloorAtStart)
    * (1 - smoothstep(distance / 8));
  const edgeLift = lane * lane * radius * 0.2;
  const look = getTunnelLook(time);
  const lateralWobble = Math.sin(progress * 16 + lane * 2.4) * look.detail * 0.028;

  return frame.position
    .add(frame.vertical.scale(1.65 - lowerRadius + joinLift + edgeLift + lift))
    .add(frame.lateral.scale(lane * radius * 0.78 + lateralWobble));
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
