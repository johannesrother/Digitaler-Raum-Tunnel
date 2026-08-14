import {
  TUNNEL_DURATION,
  getTunnelDiameter,
  getTunnelLook,
  getTunnelPhase,
  getTunnelTwitchInterval,
} from "./tunnelConfig.js";
import { createTunnelFloor } from "./createTunnelFloor.js";

const EYE_HEIGHT = 1.65;
const PATH_SAMPLES = 188;
const PROFILE_SIDES = 26;
const WALL_DEFORMATION_TARGETS = 4;

/**
 * Builds one continuous, inward-facing biomorphic shell along a non-linear
 * path. The section profile, ribs and surface colour all evolve with time,
 * avoiding a cylinder or a visible sequence of rings.
 */
export function createOrganicTunnel(scene, options) {
  const route = createTunnelRoute(options.entrance);
  const { mesh, wallDeformation } = createTunnelShell(scene, route);
  const material = createTunnelMaterial(scene);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  const entranceFloorHeight = typeof options.getGroundHeight === "function"
    ? options.getGroundHeight(route.start.x, route.start.z) + 0.05
    : route.start.y;
  const floorTransition = createTunnelFloor(
    scene,
    route,
    material,
    options.grassMaterial,
    entranceFloorHeight,
  );

  const litMeshes = [mesh, floorTransition.floor, ...floorTransition.grassPatches];
  const lights = createTunnelLights(scene, litMeshes, route);
  let nextImpulseAt = 12.7;
  let impulse = 0;
  let activeTime = 0;
  let sequenceActive = false;
  let previousFrameTime = performance.now();
  const observer = scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    const delta = Math.min((frameTime - previousFrameTime) / 1000, 0.04);
    previousFrameTime = frameTime;
    if (sequenceActive) {
      activeTime = Math.min(activeTime + delta, TUNNEL_DURATION);
    }
    wallDeformation.update(activeTime);
    updateTunnelLights(lights, activeTime, impulse);
    impulse = Math.max(0, impulse - delta * 2.9);
  });

  return {
    mesh,
    floor: floorTransition.floor,
    grassPatches: floorTransition.grassPatches,
    grassFadeDistance: floorTransition.grassFadeDistance,
    route,
    setEnabled(enabled) {
      mesh.setEnabled(enabled);
      floorTransition.floor.setEnabled(enabled);
      floorTransition.grassPatches.forEach((patch) => patch.setEnabled(enabled));
      lights.points.forEach((light) => light.setEnabled(enabled));
      lights.fill.setEnabled(enabled);
    },
    update(tunnelTime) {
      sequenceActive = true;
      activeTime = BABYLON.Scalar.Clamp(tunnelTime, 0, TUNNEL_DURATION);
      const look = getTunnelLook(activeTime);
      if (activeTime >= nextImpulseAt) {
        impulse = 1;
        // Irrational-looking, deterministic intervals keep impulses rare and
        // non-musical without a per-frame random system.
        const interval = getTunnelTwitchInterval(activeTime);
        nextImpulseAt += interval > 0 ? interval * (0.72 + ((nextImpulseAt * 1.73) % 0.58)) : 9;
      }
      updateTunnelLights(lights, activeTime, impulse * (0.25 + look.detail * 0.75));
    },
    setSequenceActive(active) {
      sequenceActive = active;
      if (!active) {
        activeTime = 0;
        impulse = 0;
        updateTunnelLights(lights, 0, 0);
      }
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      lights.points.forEach((light) => light.dispose());
      lights.fill.dispose();
      floorTransition.grassPatches.forEach((patch) => patch.dispose());
      floorTransition.floor.dispose();
      wallDeformation.dispose();
      mesh.dispose();
      material.dispose();
    },
  };
}

function createTunnelRoute(entrance) {
  const fromEntrance = (forward, lateral, elevation) => {
    const point = entrance.center
      .add(entrance.forward.scale(forward))
      .add(entrance.lateral.scale(lateral));
    point.y = elevation;
    return point;
  };

  const controls = [
    fromEntrance(5.0, 0, 0),
    fromEntrance(16, -0.35, 0.04),
    fromEntrance(30, -1.45, -0.08),
    fromEntrance(45, -1.1, -0.13),
    fromEntrance(57, 0.45, -0.06),
    fromEntrance(65, 1.05, 0.02),
    fromEntrance(70, 0.65, 0.08),
    fromEntrance(73, 0.2, 0.1),
    fromEntrance(76, 0, 0.1),
  ];
  const samples = [];
  let totalLength = 0;
  let previous = controls[0].clone();

  for (let index = 0; index <= PATH_SAMPLES; index += 1) {
    const progress = index / PATH_SAMPLES;
    const point = sampleCatmullRom(controls, progress);
    if (index > 0) {
      totalLength += BABYLON.Vector3.Distance(previous, point);
    }
    samples.push({ point, length: totalLength });
    previous = point;
  }

  return {
    length: totalLength,
    start: samples[0].point.clone(),
    end: samples.at(-1).point.clone(),
    positionAt(progress) {
      const clamped = BABYLON.Scalar.Clamp(progress, 0, 1);
      const floatIndex = clamped * PATH_SAMPLES;
      const index = Math.min(PATH_SAMPLES - 1, Math.floor(floatIndex));
      return BABYLON.Vector3.Lerp(samples[index].point, samples[index + 1].point, floatIndex - index);
    },
    distanceAtProgress(progress) {
      const clamped = BABYLON.Scalar.Clamp(progress, 0, 1);
      const floatIndex = clamped * PATH_SAMPLES;
      const index = Math.min(PATH_SAMPLES - 1, Math.floor(floatIndex));
      return BABYLON.Scalar.Lerp(samples[index].length, samples[index + 1].length, floatIndex - index);
    },
    progressAtDistance(distance) {
      const clamped = BABYLON.Scalar.Clamp(distance, 0, totalLength);
      let lower = 0;
      let upper = samples.length - 1;
      while (upper - lower > 1) {
        const middle = Math.floor((lower + upper) / 2);
        if (samples[middle].length < clamped) {
          lower = middle;
        } else {
          upper = middle;
        }
      }
      const span = Math.max(samples[upper].length - samples[lower].length, 0.0001);
      return (lower + (clamped - samples[lower].length) / span) / PATH_SAMPLES;
    },
    tangentAt(progress) {
      const step = 1 / PATH_SAMPLES;
      const before = this.positionAt(Math.max(0, progress - step));
      const after = this.positionAt(Math.min(1, progress + step));
      return after.subtract(before).normalize();
    },
    frameAt(progress) {
      const tangent = this.tangentAt(progress);
      const lateral = BABYLON.Vector3.Cross(BABYLON.Axis.Y, tangent).normalize();
      const vertical = BABYLON.Vector3.Cross(tangent, lateral).normalize();
      return { position: this.positionAt(progress), tangent, lateral, vertical };
    },
  };
}

function createTunnelShell(scene, route) {
  const positions = [];
  const indices = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const deformationVertices = [];

  for (let section = 0; section <= PATH_SAMPLES; section += 1) {
    const progress = section / PATH_SAMPLES;
    const time = progress * TUNNEL_DURATION;
    const center = route.positionAt(progress);
    center.y += EYE_HEIGHT;
    const { lateral, vertical } = route.frameAt(progress);
    const diameter = getTunnelDiameter(time);
    const look = getTunnelLook(time);

    for (let side = 0; side < PROFILE_SIDES; side += 1) {
      const angle = (side / PROFILE_SIDES) * Math.PI * 2;
      const profile = organicProfile(angle, progress, look.detail);
      const radius = diameter * 0.5 * profile;
      const lowerFlatten = Math.max(0, -Math.sin(angle)) * radius * 0.12;
      const point = center
        .add(lateral.scale(Math.cos(angle) * radius * (1 + Math.sin(angle + progress * 5.2) * 0.045)))
        .add(vertical.scale(Math.sin(angle) * radius - lowerFlatten));
      positions.push(point.x, point.y, point.z);
      deformationVertices.push({
        angle,
        progress,
        radius,
        direction: point.subtract(center).normalize(),
      });
      uvs.push(progress * 9.2, side / PROFILE_SIDES * 2.8);
      pushTunnelColor(colors, time, angle, progress, look);
    }
  }

  for (let section = 0; section < PATH_SAMPLES; section += 1) {
    for (let side = 0; side < PROFILE_SIDES; side += 1) {
      const nextSide = (side + 1) % PROFILE_SIDES;
      const current = section * PROFILE_SIDES + side;
      const next = (section + 1) * PROFILE_SIDES + side;
      const currentNext = section * PROFILE_SIDES + nextSide;
      const nextNext = (section + 1) * PROFILE_SIDES + nextSide;
      // Reversed winding makes the calculated normals face toward the visitor.
      indices.push(current, nextNext, next, current, currentNext, nextNext);
    }
  }

  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new BABYLON.Mesh("general-organic-tunnel-v1", scene);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  data.colors = colors;
  data.applyToMesh(mesh);
  return {
    mesh,
    wallDeformation: createWallDeformation(scene, mesh, positions, indices, deformationVertices),
  };
}

/**
 * Four static, local contraction shapes are blended by Babylon's morph-target
 * system. The GPU interpolates the wall vertices, so the living surface has no
 * per-frame CPU vertex work and the locomotion corridor/floor stay untouched.
 */
function createWallDeformation(scene, mesh, basePositions, indices, vertices) {
  const manager = new BABYLON.MorphTargetManager(scene);
  const targets = Array.from({ length: WALL_DEFORMATION_TARGETS }, (_, targetIndex) => {
    const positions = basePositions.slice();
    vertices.forEach((vertex, index) => {
      const contraction = getLocalContraction(vertex.progress, vertex.angle, targetIndex);
      const offset = vertex.direction.scale(-vertex.radius * contraction);
      const position = index * 3;
      positions[position] += offset.x;
      positions[position + 1] += offset.y;
      positions[position + 2] += offset.z;
    });
    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const target = new BABYLON.MorphTarget(`organic-wall-pressure-${targetIndex}`, 0, scene);
    target.setPositions(positions);
    target.setNormals(normals);
    manager.addTarget(target);
    return target;
  });
  mesh.morphTargetManager = manager;

  return {
    update(time) {
      targets.forEach((target, targetIndex) => {
        target.influence = getPressureWaveInfluence(time, targetIndex);
      });
    },
    dispose() {
      manager.dispose();
    },
  };
}

function getLocalContraction(progress, angle, targetIndex) {
  // Each target owns two wide, separated regions. They overlap only softly,
  // making the pressure feel regional instead of like a scaled tube.
  const centers = [
    [0.16, 0.64],
    [0.29, 0.78],
    [0.43, 0.9],
    [0.53],
  ][targetIndex];
  const regionalMask = Math.max(...centers.map((center) => bell(progress, center, 0.105)));
  const entryMask = smoothstep((progress - 0.045) / 0.16);
  const exitMask = 1 - smoothstep((progress - 0.82) / 0.16);
  const journeyStrength = getJourneyDeformationStrength(progress * TUNNEL_DURATION);
  const asymmetricWallWeight = 0.76
    + Math.max(0, Math.sin(angle + targetIndex * 1.67)) * 0.18
    + Math.max(0, Math.sin(angle * 2.0 - targetIndex * 0.91)) * 0.08;
  return regionalMask * entryMask * exitMask * journeyStrength * asymmetricWallWeight;
}

function getJourneyDeformationStrength(time) {
  const arrival = smoothstep((time - 3) / 12);
  const release = 1 - smoothstep((time - 52) / 8);
  // 2.5% baseline, rising to a maximum local contraction below 8%.
  return (0.025 + arrival * 0.05) * release;
}

function getPressureWaveInfluence(time, targetIndex) {
  const cycle = 3.45 + targetIndex * 0.37;
  const phase = targetIndex * 1.91;
  const broadPulse = 0.5 + 0.5 * Math.sin((time / cycle) * Math.PI * 2 + phase);
  const secondaryPulse = 0.82 + 0.18 * Math.sin(time * 1.13 + targetIndex * 2.37);
  // A raised pulse leaves relaxed intervals between contractions and avoids a
  // mechanical in/out rhythm shared by the whole tunnel.
  return Math.pow(broadPulse, 1.55) * secondaryPulse;
}

function bell(value, center, width) {
  const distance = (value - center) / width;
  return Math.exp(-distance * distance * 3.2);
}

function organicProfile(angle, progress, detail) {
  const broadFold = Math.sin(angle * 2.0 + progress * 10.3) * (0.045 + detail * 0.11);
  const asymmetry = Math.sin(angle + progress * 4.8) * (0.035 + detail * 0.075);
  const ribBand = Math.pow(Math.max(0, Math.sin(progress * 74 + angle * 1.65)), 10) * detail * 0.1;
  const cavity = Math.pow(Math.max(0, Math.sin(angle * 3.0 - progress * 17)), 5) * detail * 0.055;
  return 1 + broadFold + asymmetry - ribBand - cavity;
}

function pushTunnelColor(target, time, angle, progress, look) {
  const warm = new BABYLON.Color3(0.82, 0.75, 0.64);
  const charcoal = new BABYLON.Color3(0.12, 0.12, 0.145);
  const progression = smoothstep((time - 5) / 53);
  const base = BABYLON.Color3.Lerp(warm, charcoal, progression);
  const groove = Math.pow(Math.max(0, Math.sin(progress * 74 + angle * 1.65)), 12);
  const redAmount = groove * look.red;
  target.push(
    BABYLON.Scalar.Lerp(base.r, 0.3, redAmount),
    BABYLON.Scalar.Lerp(base.g, 0.025, redAmount),
    BABYLON.Scalar.Lerp(base.b, 0.04, redAmount),
    1,
  );
}

function createTunnelMaterial(scene) {
  const material = new BABYLON.PBRMaterial("organic-tunnel-pbr", scene);
  material.albedoTexture = createTexture(scene, "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_color.jpg", 1, true);
  material.bumpTexture = createTexture(scene, "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_normalgl.jpg", 1, false);
  material.bumpTexture.level = 0.11;
  material.metallicTexture = createTexture(scene, "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_roughness.jpg", 1, false);
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.useVertexColors = true;
  material.albedoColor = BABYLON.Color3.White();
  material.metallic = 0;
  material.roughness = 0.84;
  material.environmentIntensity = 0.12;
  material.specularIntensity = 0.16;
  material.backFaceCulling = false;
  return material;
}

function createTunnelLights(scene, meshes, route) {
  const points = [0.01, 0.25, 0.52, 0.77, 0.94].map((progress, index) => {
    const position = route.positionAt(progress);
    position.y += EYE_HEIGHT;
    const light = new BABYLON.PointLight(`organic-tunnel-light-${index}`, position, scene);
    light.range = index === 0 ? 5.8 : 4.8;
    light.intensity = 0.56;
    light.diffuse = index < 2
      ? BABYLON.Color3.FromHexString("#ffd1a3")
      : BABYLON.Color3.FromHexString("#8f9bad");
    light.includedOnlyMeshes.push(...meshes);
    return light;
  });
  const fill = new BABYLON.HemisphericLight("organic-tunnel-low-fill", BABYLON.Axis.Y, scene);
  fill.diffuse = BABYLON.Color3.FromHexString("#aeb7c4");
  fill.groundColor = BABYLON.Color3.FromHexString("#321d26");
  fill.intensity = 0.2;
  fill.includedOnlyMeshes.push(...meshes);
  return { points, fill };
}

function updateTunnelLights(lights, time, impulse) {
  const look = getTunnelLook(time);
  const phase = getTunnelPhase(time);
  lights.fill.intensity = 0.08 + look.light * 0.2;
  lights.points.forEach((light, index) => {
    const proximity = 1 - Math.min(1, Math.abs(index / (lights.points.length - 1) - time / TUNNEL_DURATION) * 2.6);
    const pulse = index === 2 ? impulse * 0.16 : 0;
    light.intensity = (0.38 + proximity * 0.78) * look.light + pulse;
    if (phase.id === "PEAK" && index >= 3) {
      light.diffuse = BABYLON.Color3.FromHexString("#67252b");
    }
  });
}

function createTexture(scene, url, tiling, gammaSpace) {
  const texture = new BABYLON.Texture(url, scene, true, false);
  texture.uScale = tiling;
  texture.vScale = tiling;
  texture.gammaSpace = gammaSpace;
  texture.anisotropicFilteringLevel = 2;
  return texture;
}

function sampleCatmullRom(points, progress) {
  const scaled = progress * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - segment;
  const a = points[Math.max(0, segment - 1)];
  const b = points[segment];
  const c = points[segment + 1];
  const d = points[Math.min(points.length - 1, segment + 2)];
  return new BABYLON.Vector3(
    catmull(a.x, b.x, c.x, d.x, local),
    catmull(a.y, b.y, c.y, d.y, local),
    catmull(a.z, b.z, c.z, d.z, local),
  );
}

function catmull(a, b, c, d, value) {
  const square = value * value;
  const cube = square * value;
  return 0.5 * ((2 * b) + (-a + c) * value + (2 * a - 5 * b + 4 * c - d) * square + (-a + 3 * b - 3 * c + d) * cube);
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
