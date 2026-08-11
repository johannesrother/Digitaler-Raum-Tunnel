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

/**
 * Builds one continuous, inward-facing biomorphic shell along a non-linear
 * path. The section profile, ribs and surface colour all evolve with time,
 * avoiding a cylinder or a visible sequence of rings.
 */
export function createOrganicTunnel(scene, options) {
  const route = createTunnelRoute(options.entrance);
  const shell = createTunnelShell(scene, route);
  const mesh = shell.mesh;
  const materials = createTunnelMaterials(scene);
  mesh.material = materials.surface;
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  const entranceFloorHeight = typeof options.getGroundHeight === "function"
    ? options.getGroundHeight(route.start.x, route.start.z) + 0.05
    : route.start.y;
  const floorTransition = createTunnelFloor(
    scene,
    route,
    materials.floor,
    options.grassMaterial,
    entranceFloorHeight,
  );

  const details = createOtherworldlyDetails(scene, route, materials);
  const litMeshes = [
    mesh,
    floorTransition.floor,
    ...floorTransition.grassPatches,
    ...details.litMeshes,
  ];
  const lights = createTunnelLights(scene, litMeshes, route);
  let nextImpulseAt = 12.7;
  let impulse = 0;
  let impulseProgress = 0;
  let exitGlow = 0;
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
    shell.updateDeformation(impulseProgress, impulse);
    details.update(activeTime, impulse, impulseProgress, delta);
    materials.updateSurface(activeTime);
    updateTunnelLights(lights, activeTime, impulse, exitGlow);
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
        impulseProgress = activeTime / TUNNEL_DURATION;
        // Irrational-looking, deterministic intervals keep impulses rare and
        // non-musical without a per-frame random system.
        const interval = getTunnelTwitchInterval(activeTime);
        nextImpulseAt += interval > 0 ? interval * (0.72 + ((nextImpulseAt * 1.73) % 0.58)) : 9;
      }
      shell.updateDeformation(impulseProgress, impulse);
      details.update(activeTime, impulse, impulseProgress, 0);
      materials.updateSurface(activeTime);
      updateTunnelLights(lights, activeTime, impulse * (0.25 + look.detail * 0.75), exitGlow);
    },
    setSequenceActive(active) {
      sequenceActive = active;
      if (!active) {
        activeTime = 0;
        impulse = 0;
        shell.updateDeformation(0, 0);
        details.update(0, 0, 0, 0);
        materials.updateSurface(0);
        updateTunnelLights(lights, 0, 0, 0);
      }
    },
    setExitGlow(amount) {
      exitGlow = BABYLON.Scalar.Clamp(amount, 0, 1);
    },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      lights.points.forEach((light) => light.dispose());
      lights.fill.dispose();
      floorTransition.grassPatches.forEach((patch) => patch.dispose());
      floorTransition.floor.dispose();
      details.dispose();
      mesh.dispose();
      materials.dispose();
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
    fromEntrance(13, -0.7, 0.04),
    fromEntrance(23, -1.9, -0.08),
    fromEntrance(34, -0.8, -0.14),
    fromEntrance(45, 1.5, -0.04),
    fromEntrance(55, 1.2, 0.18),
    fromEntrance(62, -0.3, 0.58),
    fromEntrance(65, 0.15, 1.42),
    fromEntrance(66, 0.4, 3.05),
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
  const radialOffsets = [];

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
      radialOffsets.push(point.x - center.x, point.y - center.y, point.z - center.z);
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

  const capCenter = positions.length / 3;
  const end = route.end.clone();
  end.y += EYE_HEIGHT;
  positions.push(end.x, end.y, end.z);
  uvs.push(1, 0.5);
  colors.push(0.04, 0.035, 0.05, 1);
  const endStart = PATH_SAMPLES * PROFILE_SIDES;
  for (let side = 0; side < PROFILE_SIDES; side += 1) {
    indices.push(capCenter, endStart + side, endStart + ((side + 1) % PROFILE_SIDES));
  }

  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new BABYLON.Mesh("general-organic-tunnel-v1", scene);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  data.colors = colors;
  data.applyToMesh(mesh, true);

  const restPositions = new Float32Array(positions);
  const workingPositions = new Float32Array(positions);
  let isDeformed = false;

  return {
    mesh,
    // Only an isolated ring of the existing shell contracts during an impulse.
    // Keeping the displacement below four centimetres avoids discomfort and
    // does not alter the approved tunnel diameter progression.
    updateDeformation(centerProgress, amount) {
      const strength = BABYLON.Scalar.Clamp(amount, 0, 1) * 0.024;
      if (strength < 0.0002 && !isDeformed) {
        return;
      }
      workingPositions.set(restPositions);
      if (strength >= 0.0002) {
        for (let section = 0; section <= PATH_SAMPLES; section += 1) {
          const progress = section / PATH_SAMPLES;
          const distance = (progress - centerProgress) / 0.026;
          const localAmount = Math.exp(-distance * distance) * strength;
          if (localAmount < 0.00003) {
            continue;
          }
          for (let side = 0; side < PROFILE_SIDES; side += 1) {
            const vertex = section * PROFILE_SIDES + side;
            const offset = vertex * 3;
            const angle = side / PROFILE_SIDES * Math.PI * 2;
            const asymmetricWeight = 0.58 + Math.pow(Math.max(0, Math.sin(angle * 1.7 + centerProgress * 11)), 2) * 0.42;
            workingPositions[offset] -= radialOffsets[offset] * localAmount * asymmetricWeight;
            workingPositions[offset + 1] -= radialOffsets[offset + 1] * localAmount * asymmetricWeight;
            workingPositions[offset + 2] -= radialOffsets[offset + 2] * localAmount * asymmetricWeight;
          }
        }
      }
      mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, workingPositions, false, false);
      isDeformed = strength >= 0.0002;
    },
  };
}

function organicProfile(angle, progress, detail) {
  const broadFold = Math.sin(angle * 1.85 + progress * 9.6 + Math.sin(progress * 3.7) * 0.8) * (0.045 + detail * 0.1);
  const asymmetry = Math.sin(angle * 0.92 + progress * 4.1) * (0.035 + detail * 0.07);
  const interruptedRidge = Math.pow(Math.max(0, Math.sin(progress * 53 + angle * 1.48 + Math.sin(progress * 17) * 1.9)), 13) * detail * 0.082;
  const cavity = Math.pow(Math.max(0, Math.sin(angle * 2.7 - progress * 14.2 + Math.sin(progress * 29))), 6) * detail * 0.06;
  const flowingFold = Math.sin(angle * 4.3 - progress * 22.7) * Math.sin(progress * 7.9 + angle) * detail * 0.032;
  return 1 + broadFold + asymmetry - interruptedRidge - cavity + flowingFold;
}

function pushTunnelColor(target, time, angle, progress, look) {
  const entryMineral = new BABYLON.Color3(0.29, 0.275, 0.29);
  const charcoal = new BABYLON.Color3(0.135, 0.14, 0.16);
  const progression = smoothstep((time - 4) / 49);
  const base = BABYLON.Color3.Lerp(entryMineral, charcoal, progression);
  target.push(base.r, base.g, base.b, 1);
}

function createTunnelMaterials(scene) {
  const textureSets = createTunnelTextureSets(scene);
  const createDarkMaterial = (name, color, roughness, textureSet, normalLevel = 0.13) => {
    const material = new BABYLON.PBRMaterial(name, scene);
    material.albedoTexture = textureSet.albedo;
    material.bumpTexture = textureSet.normal;
    material.bumpTexture.level = normalLevel;
    material.metallicTexture = textureSet.roughness;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = false;
    material.albedoColor = color;
    material.metallic = 0;
    material.roughness = roughness;
    material.environmentIntensity = 0.1;
    material.specularIntensity = 0.14;
    material.backFaceCulling = false;
    return material;
  };

  const surface = createDarkMaterial(
    "organic-tunnel-matte-surface",
    BABYLON.Color3.White(),
    0.9,
    textureSets.smooth,
    0.1,
  );
  surface.useVertexColors = true;
  surface.emissiveColor = BABYLON.Color3.FromHexString("#090a0e");

  const floor = createDarkMaterial(
    "organic-tunnel-charcoal-floor",
    BABYLON.Color3.FromHexString("#17191d"),
    0.86,
    textureSets.base,
    0.14,
  );

  const ridge = createDarkMaterial(
    "organic-tunnel-mineral-ridge",
    BABYLON.Color3.FromHexString("#303239"),
    0.46,
    textureSets.organic,
    0.2,
  );
  ridge.environmentIntensity = 0.2;
  ridge.specularIntensity = 0.3;

  const membrane = createDarkMaterial(
    "organic-tunnel-translucent-membrane",
    BABYLON.Color3.FromHexString("#4a4c52"),
    0.58,
    textureSets.deep,
    0.16,
  );
  membrane.alpha = 0.24;
  membrane.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  membrane.needDepthPrePass = false;
  membrane.environmentIntensity = 0.16;

  const particle = new BABYLON.StandardMaterial("organic-tunnel-suspended-matter", scene);
  particle.disableLighting = true;
  particle.emissiveColor = BABYLON.Color3.FromHexString("#b5bac1");
  particle.alpha = 0.34;

  return {
    surface,
    floor,
    ridge,
    membrane,
    particle,
    updateSurface(time) {
      const phase = getTunnelPhase(time).id;
      const profile = surfaceTextureProfile(phase, textureSets);
      if (surface.albedoTexture !== profile.textureSet.albedo) {
        surface.albedoTexture = profile.textureSet.albedo;
        surface.bumpTexture = profile.textureSet.normal;
        surface.metallicTexture = profile.textureSet.roughness;
      }
      surface.bumpTexture.level = profile.normalLevel;
      surface.roughness = profile.roughness;
    },
    dispose() {
      [surface, floor, ridge, membrane, particle].forEach((material) => material.dispose());
    },
  };
}

function createTunnelTextureSets(scene) {
  const path = "./assets/textures/tunnel/";
  const createSet = (albedo, normal, roughness) => ({
    albedo: createTexture(scene, `${path}${albedo}`, 1, true),
    normal: createTexture(scene, `${path}${normal}`, 1, false),
    roughness: createTexture(scene, `${path}${roughness}`, 1, false),
  });
  return {
    smooth: createSet(
      "rock_01_1k/textures/rock_01_diff_1k.jpg",
      "rock_01_1k/textures/rock_01_nor_gl_1k.jpg",
      "rock_01_1k/textures/rock_01_rough_1k.jpg",
    ),
    base: createSet(
      "Rock027_1K-JPG/Rock027_1K-JPG_Color.jpg",
      "Rock027_1K-JPG/Rock027_1K-JPG_NormalGL.jpg",
      "Rock027_1K-JPG/Rock027_1K-JPG_Roughness.jpg",
    ),
    organic: createSet(
      "rock_05_1k/textures/rock_05_diff_1k.jpg",
      "rock_05_1k/textures/rock_05_nor_gl_1k.jpg",
      "rock_05_1k/textures/rock_05_rough_1k.jpg",
    ),
    deep: createSet(
      "aerial_rocks_04_1k/textures/aerial_rocks_04_diff_1k.jpg",
      "aerial_rocks_04_1k/textures/aerial_rocks_04_nor_gl_1k.jpg",
      "aerial_rocks_04_1k/textures/aerial_rocks_04_rough_1k.jpg",
    ),
  };
}

function surfaceTextureProfile(phase, textureSets) {
  const profiles = {
    ENTRY: { textureSet: textureSets.smooth, normalLevel: 0.1, roughness: 0.92 },
    UNEASE: { textureSet: textureSets.base, normalLevel: 0.14, roughness: 0.89 },
    COMPRESSION: { textureSet: textureSets.base, normalLevel: 0.18, roughness: 0.86 },
    ACCELERATION: { textureSet: textureSets.organic, normalLevel: 0.22, roughness: 0.83 },
    PEAK: { textureSet: textureSets.deep, normalLevel: 0.26, roughness: 0.8 },
    FINAL_ASCENT: { textureSet: textureSets.deep, normalLevel: 0.2, roughness: 0.84 },
  };
  return profiles[phase] ?? profiles.ENTRY;
}

/**
 * Adds a deliberately small number of non-modular details on top of the
 * continuous shell. They follow the tunnel frame, rather than a world axis,
 * so they read as grown from the material instead of placed in it.
 */
function createOtherworldlyDetails(scene, route, materials) {
  const litMeshes = [];
  const disposableMaterials = [];
  const ribs = [];
  const membranes = [];
  const particles = [];

  const ribDefinitions = [
    [0.14, 0.28, 1.45, 0.025], [0.23, 2.76, 1.12, 0.032],
    [0.34, 4.04, 1.92, 0.035], [0.42, 0.74, 1.08, 0.043],
    [0.51, 3.28, 1.62, 0.038], [0.59, 5.02, 1.31, 0.048],
    [0.67, 1.61, 1.86, 0.042], [0.75, 3.88, 1.02, 0.054],
    [0.83, 5.37, 1.58, 0.047], [0.91, 2.29, 1.22, 0.04],
  ];
  ribDefinitions.forEach(([progress, angle, span, radius], index) => {
    const material = materials.ridge.clone(`organic-tunnel-ridge-${index}`);
    material.albedoColor = BABYLON.Color3.FromHexString(index % 3 === 0 ? "#3b3d43" : "#282b31");
    disposableMaterials.push(material);
    const mesh = createWallRidge(scene, route, progress, angle, span, radius, index);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    litMeshes.push(mesh);
    ribs.push({ material, progress });
  });

  const membraneDefinitions = [
    [0.46, 2.9, 0.76, 1.12], [0.64, 5.25, 0.94, 0.84], [0.82, 1.25, 0.7, 1.26],
  ];
  membraneDefinitions.forEach(([progress, angle, arc, length], index) => {
    const material = materials.membrane.clone(`organic-tunnel-membrane-${index}`);
    material.albedoColor = BABYLON.Color3.FromHexString(index === 1 ? "#505159" : "#3b3d43");
    disposableMaterials.push(material);
    const mesh = createWallMembrane(scene, route, progress, angle, arc, length, index);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    litMeshes.push(mesh);
    membranes.push({ material, progress });
  });

  // These are dim, irregular chips rather than a particle system: only nine
  // exist, all deeper in the tunnel, and none use additive glow or sprites.
  const particleDefinitions = [
    [0.47, 0.8, 0.04], [0.53, 4.5, 0.028], [0.61, 2.2, 0.034],
    [0.68, 5.7, 0.024], [0.73, 0.2, 0.031], [0.78, 3.1, 0.027],
    [0.84, 4.2, 0.022], [0.88, 1.4, 0.026], [0.92, 5.35, 0.02],
  ];
  particleDefinitions.forEach(([progress, angle, size], index) => {
    const mesh = BABYLON.MeshBuilder.CreateIcoSphere(
      `organic-tunnel-suspended-fragment-${index}`,
      { radius: size, subdivisions: 1 },
      scene,
    );
    const point = wallPoint(route, progress, angle, 0.52);
    mesh.position.copyFrom(point);
    mesh.scaling.set(0.65 + (index % 3) * 0.18, 1.6, 0.72 + (index % 2) * 0.2);
    mesh.rotation.set(index * 0.7, index * 1.17, index * 0.43);
    mesh.material = materials.particle;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    particles.push({ mesh, origin: point, progress, phase: index * 1.71 });
  });

  return {
    litMeshes,
    update(time, impulse, impulseProgress, delta) {
      const look = getTunnelLook(time);
      const otherness = smoothstep((time - 8) / 43);
      ribs.forEach(({ material, progress }) => {
        const response = Math.exp(-Math.pow((progress - impulseProgress) / 0.042, 2)) * impulse;
        const sheen = otherness * 0.006 + response * 0.035;
        material.emissiveColor.r = sheen * 0.72;
        material.emissiveColor.g = sheen * 0.78;
        material.emissiveColor.b = sheen;
      });
      membranes.forEach(({ material, progress }) => {
        const response = Math.exp(-Math.pow((progress - impulseProgress) / 0.06, 2)) * impulse;
        material.alpha = 0.18 + otherness * 0.09 + response * 0.055;
        material.emissiveColor.r = response * 0.022;
        material.emissiveColor.g = response * 0.025;
        material.emissiveColor.b = response * 0.032;
      });
      particles.forEach((particle) => {
        const visible = time > 18 && time < 57 && particle.progress <= time / TUNNEL_DURATION + 0.12;
        particle.mesh.setEnabled(visible);
        if (visible && delta > 0) {
          particle.mesh.position.y = particle.origin.y + Math.sin(time * 0.53 + particle.phase) * 0.012;
          particle.mesh.rotation.y += delta * (0.16 + (particle.phase % 0.11));
        }
      });
    },
    dispose() {
      litMeshes.forEach((mesh) => mesh.dispose());
      particles.forEach(({ mesh }) => mesh.dispose());
      disposableMaterials.forEach((material) => material.dispose());
    },
  };
}

function createWallRidge(scene, route, progress, angle, span, depth, index) {
  const paths = [];
  for (let row = 0; row <= 4; row += 1) {
    const width = row / 4 - 0.5;
    const path = [];
    for (let column = 0; column <= 11; column += 1) {
      const amount = column / 11;
      const tapered = Math.sin(amount * Math.PI);
      path.push(wallPoint(
        route,
        progress + width * (0.012 + tapered * 0.013),
        angle + span * amount + Math.sin(amount * Math.PI * 2) * 0.045,
        0.02 + depth * tapered * (0.7 + Math.cos(width * Math.PI) * 0.3),
      ));
    }
    paths.push(path);
  }
  return BABYLON.MeshBuilder.CreateRibbon(
    `organic-tunnel-grown-fold-${index}`,
    { pathArray: paths, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
}

function createWallMembrane(scene, route, progress, angle, arc, length, index) {
  const paths = [];
  for (let row = 0; row <= 4; row += 1) {
    const along = row / 4 - 0.5;
    const rowPath = [];
    for (let column = 0; column <= 6; column += 1) {
      const across = column / 6 - 0.5;
      rowPath.push(wallPoint(
        route,
        progress + along * length * 0.012,
        angle + across * arc + Math.sin(along * Math.PI) * 0.12,
        0.075 + Math.cos(across * Math.PI) * 0.018 + Math.sin((along + across + index) * Math.PI) * 0.008,
      ));
    }
    paths.push(rowPath);
  }
  return BABYLON.MeshBuilder.CreateRibbon(
    `organic-tunnel-thin-membrane-${index}`,
    { pathArray: paths, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
}

function wallPoint(route, progress, angle, inset) {
  const clampedProgress = BABYLON.Scalar.Clamp(progress, 0, 1);
  const time = clampedProgress * TUNNEL_DURATION;
  const center = route.positionAt(clampedProgress);
  center.y += EYE_HEIGHT;
  const { lateral, vertical } = route.frameAt(clampedProgress);
  const radius = getTunnelDiameter(time) * 0.5 * organicProfile(angle, clampedProgress, getTunnelLook(time).detail) - inset;
  const lowerFlatten = Math.max(0, -Math.sin(angle)) * radius * 0.12;
  return center
    .add(lateral.scale(Math.cos(angle) * radius))
    .add(vertical.scale(Math.sin(angle) * radius - lowerFlatten));
}

function createTunnelLights(scene, meshes, route) {
  const points = [0.01, 0.25, 0.52, 0.77, 0.94].map((progress, index) => {
    const position = route.positionAt(progress);
    position.y += EYE_HEIGHT;
    const light = new BABYLON.PointLight(`organic-tunnel-light-${index}`, position, scene);
    light.range = index === 0 ? 6.4 : 5.6;
    light.intensity = 0.72;
    light.diffuse = index < 2
      ? BABYLON.Color3.FromHexString("#ffd1a3")
      : BABYLON.Color3.FromHexString("#8f9bad");
    light.includedOnlyMeshes.push(...meshes);
    return light;
  });
  const fill = new BABYLON.HemisphericLight("organic-tunnel-low-fill", BABYLON.Axis.Y, scene);
  fill.diffuse = BABYLON.Color3.FromHexString("#aeb7c4");
  fill.groundColor = BABYLON.Color3.FromHexString("#171a20");
  fill.intensity = 0.27;
  fill.includedOnlyMeshes.push(...meshes);
  return { points, fill };
}

function updateTunnelLights(lights, time, impulse, exitGlow = 0) {
  const look = getTunnelLook(time);
  const phase = getTunnelPhase(time);
  lights.fill.intensity = 0.11 + look.light * 0.24;
  lights.points.forEach((light, index) => {
    const proximity = 1 - Math.min(1, Math.abs(index / (lights.points.length - 1) - time / TUNNEL_DURATION) * 2.6);
    const pulse = index === 2 ? impulse * 0.16 : 0;
    const exitBleed = index === lights.points.length - 1 ? exitGlow * 1.35 : 0;
    light.intensity = (0.52 + proximity * 0.94) * look.light + pulse + exitBleed;
    light.diffuse = BABYLON.Color3.FromHexString(phase.id === "PEAK" && index >= 3 ? "#5b606a" : "#d5d8dd");
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
