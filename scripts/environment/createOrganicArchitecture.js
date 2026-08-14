// The camera initially looks along (-5.5, 8) from the standing position.
// This centre is deliberately 30° to the visitor's right of that direction,
// so the opening is present in the forward/right composition rather than at
// the edge of a ninety-degree head turn.
const ENTRANCE_CENTER = new BABYLON.Vector3(-1.02, 0, 7.35);
const VIEWER_POSITION = new BABYLON.Vector3(0, 0, -5.5);

/**
 * A single continuous ivory shell forms the focal point. It is a folded,
 * asymmetric mineral surface around the opening, rather than a conventional
 * circular arch or a separate tunnel object.
 */
export function createIvoryArchitecture(scene, materials, getGroundHeight) {
  const axes = createEntranceAxes();

  return {
    shadowCasters: [],
    reflectors: [],
    // The timed reveal remains the dimensional portal.  No beige facade or
    // threshold geometry is placed between the idyll and the dark tunnel.
    tunnel: { portal: null, shell: null, floor: null, fade: null, daylight: null },
    entrance: {
      center: ENTRANCE_CENTER.clone(),
      forward: axes.forward.clone(),
      lateral: axes.lateral.clone(),
    },
  };
}

function createEntranceAxes() {
  const forward = ENTRANCE_CENTER.subtract(VIEWER_POSITION).normalize();
  forward.y = 0;
  forward.normalize();
  return {
    forward,
    lateral: new BABYLON.Vector3(forward.z, 0, -forward.x),
  };
}

/**
 * Creates a wide, folded shell around the aperture. Four curved surface bands
 * make the facade read as a sculpted piece of landscape instead of a flat,
 * graphic arch.
 */
function createOrganicPortalShell(scene, material, getGroundHeight, axes) {
  const segments = 52;
  // A broad mantle avoids the former stack of concentric portal bands.
  const rings = 2;
  const positions = [];
  const indices = [];
  const uvs = [];
  const colors = [];

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = Math.PI - progress * Math.PI;

    for (let ring = 0; ring <= rings; ring += 1) {
      const spread = ring / rings;
      const point = aperturePoint(angle, spread, getGroundHeight, axes);
      pushPoint(positions, point);
      uvs.push(progress * 2.4, spread);
      pushPortalColor(colors, spread, angle);
    }
  }

  for (let index = 0; index < segments; index += 1) {
    for (let ring = 0; ring < rings; ring += 1) {
      const current = index * (rings + 1) + ring;
      const next = current + rings + 1;
      indices.push(current, current + 1, next + 1, current, next + 1, next);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const portal = new BABYLON.Mesh("right-asymmetric-ivory-portal-shell", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.colors = colors;
  vertexData.applyToMesh(portal);
  portal.material = material;
  portal.receiveShadows = true;
  portal.isPickable = false;
  return portal;
}

function aperturePoint(angle, spread, getGroundHeight, axes) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  // The inner aperture resolves to the 3.5 m tunnel diameter instead of
  // reading as a wider architectural doorway.
  const innerWidth = cos < 0 ? 1.72 : 1.82;
  const outerWidth = cos < 0 ? 3.4 : 3.05;
  const innerHeight = 3.36;
  const outerHeight = cos < 0 ? 4.45 : 4.08;
  const width = BABYLON.Scalar.Lerp(innerWidth, outerWidth, spread)
    * (1 + Math.sin(angle * 2.1 + 0.45) * 0.055);
  const height = BABYLON.Scalar.Lerp(innerHeight, outerHeight, spread)
    * (1 + Math.sin(angle * 1.65 + 0.75) * 0.045);
  const outerGrowth = spread * spread;
  const lateralOffset = cos * width
    + sin * BABYLON.Scalar.Lerp(0.12, 0.58, spread)
    + spread * Math.sin(angle * 1.25) * 0.24
    + outerGrowth * Math.sin(angle * 1.55 + 0.4) * 0.3;
  const fold = Math.sin(angle) * Math.sin(angle);
  const innerTransition = 1 - spread;
  const forwardOffset = sin * BABYLON.Scalar.Lerp(0.12, 0.72, spread)
    + fold * spread * 0.34
    + Math.sin(angle * 3.15 + spread * 2.5) * 0.1
    + Math.sin(angle * 2.1 + spread * 15.5) * innerTransition * 0.12
    + outerGrowth * (0.62 + Math.sin(angle * 1.4 + 0.7) * 0.24);
  const x = ENTRANCE_CENTER.x + axes.lateral.x * lateralOffset + axes.forward.x * forwardOffset;
  const z = ENTRANCE_CENTER.z + axes.lateral.z * lateralOffset + axes.forward.z * forwardOffset;
  const baseY = getGroundHeight(x, z) - BABYLON.Scalar.Lerp(0.04, 0.48, spread);
  const y = baseY + sin * height + fold * spread * 0.5
    + outerGrowth * Math.sin(angle * 2.35 - 0.8) * 0.32;
  return new BABYLON.Vector3(x, y, z);
}

function createInvitingEntranceInterior(scene, transitionMaterial, floorMaterial, fadeMaterial, getGroundHeight, axes) {
  const shell = createInteriorShell(scene, transitionMaterial, getGroundHeight, axes);
  const floor = createInteriorFloor(scene, floorMaterial, getGroundHeight, axes);
  const fade = createInteriorFade(scene, fadeMaterial, getGroundHeight, axes);
  const lightPosition = ENTRANCE_CENTER
    .add(axes.forward.scale(1.6))
    .add(new BABYLON.Vector3(0, getGroundHeight(ENTRANCE_CENTER.x, ENTRANCE_CENTER.z) + 3.05, 0));
  const daylight = new BABYLON.PointLight("tunnel-mouth-soft-daylight", lightPosition, scene);
  daylight.diffuse = BABYLON.Color3.FromHexString("#ffe1b7");
  daylight.intensity = 0.42;
  daylight.range = 10;
  return { shell, floor, fade, daylight };
}

function createInteriorShell(scene, material, getGroundHeight, axes) {
  const depthSegments = 28;
  const arcSegments = 42;
  const positions = [];
  const indices = [];
  const uvs = [];
  const colors = [];

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const progress = depthIndex / depthSegments;
    const distance = 0.05 + progress * 5.2;
    const center = ENTRANCE_CENTER.add(axes.forward.scale(distance));
    const transition = smoothstep(progress);
    const widthBase = BABYLON.Scalar.Lerp(2.05, 1.76, progress);
    const heightBase = BABYLON.Scalar.Lerp(3.35, 3.4, progress);

    for (let arcIndex = 0; arcIndex <= arcSegments; arcIndex += 1) {
      const arc = arcIndex / arcSegments;
      const angle = Math.PI - arc * Math.PI;
      const rib = Math.pow(Math.max(0, Math.sin(progress * 24 + angle * 1.65)), 10) * transition;
      const fold = Math.sin(angle * 2.0 + progress * 10.3) * (0.025 + transition * 0.105);
      const asymmetry = Math.sin(angle + progress * 4.8) * (0.02 + transition * 0.07);
      const width = widthBase * (1 + fold + asymmetry - rib * 0.11);
      const height = heightBase * (1 + fold * 0.55 - rib * 0.07);
      const side = Math.cos(angle) * width;
      const forwardShift = Math.sin(angle) * 0.12
        + Math.sin(angle * 3.1 + progress * 4.9) * 0.07
        + Math.sin(progress * 27 + angle * 1.65) * transition * 0.12;
      const x = center.x + axes.lateral.x * side + axes.forward.x * forwardShift;
      const z = center.z + axes.lateral.z * side + axes.forward.z * forwardShift;
      const baseY = getGroundHeight(x, z) + 0.04;
      positions.push(x, baseY + Math.sin(angle) * height, z);
      uvs.push(arc * 1.5, progress * 2.2);
      pushEntranceColor(colors, progress, angle, rib);
    }
  }

  for (let depthIndex = 0; depthIndex < depthSegments; depthIndex += 1) {
    for (let arcIndex = 0; arcIndex < arcSegments; arcIndex += 1) {
      const current = depthIndex * (arcSegments + 1) + arcIndex;
      const nextDepth = current + arcSegments + 1;
      indices.push(current, nextDepth, nextDepth + 1, current, nextDepth + 1, current + 1);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const shell = new BABYLON.Mesh("right-inviting-ivory-interior", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.colors = colors;
  vertexData.applyToMesh(shell);
  shell.material = material;
  shell.isPickable = false;
  return shell;
}

/**
 * Uses the tunnel's mineral response while leaving the exterior at a warm,
 * Golden-Hour-friendly ivory. Vertex colours are cheaper than a blended map
 * and make the material transition continuous across the same mesh.
 */
function createTunnelTransitionMaterial(source) {
  const material = source.clone("ivory-to-organic-tunnel-transition");
  material.albedoColor = BABYLON.Color3.White();
  material.emissiveColor = BABYLON.Color3.FromHexString("#090707");
  material.useVertexColors = true;
  material.bumpTexture.level = 0.11;
  material.roughness = 0.84;
  material.environmentIntensity = 0.12;
  material.specularIntensity = 0.16;
  material.backFaceCulling = false;
  return material;
}

function createPortalTransitionMaterial(source) {
  const material = source.clone("warm-ivory-organic-entrance-mantle");
  material.albedoColor = BABYLON.Color3.White();
  material.emissiveColor = BABYLON.Color3.FromHexString("#130c06");
  material.useVertexColors = true;
  material.bumpTexture.level = 0.13;
  material.roughness = 0.84;
  material.environmentIntensity = 0.18;
  material.specularIntensity = 0.16;
  material.backFaceCulling = false;
  return material;
}

function pushPortalColor(target, spread, angle) {
  const outerIvory = new BABYLON.Color3(1.0, 0.92, 0.8);
  const innerMineral = new BABYLON.Color3(0.84, 0.77, 0.67);
  const inward = smoothstep(1 - spread);
  const base = BABYLON.Color3.Lerp(outerIvory, innerMineral, inward);
  const fold = Math.pow(Math.max(0, Math.sin(angle * 2.1 + spread * 14)), 8) * inward;
  target.push(
    BABYLON.Scalar.Lerp(base.r, 0.46, fold * 0.22),
    BABYLON.Scalar.Lerp(base.g, 0.36, fold * 0.22),
    BABYLON.Scalar.Lerp(base.b, 0.31, fold * 0.2),
    1,
  );
}

function pushEntranceColor(target, progress, angle, rib) {
  const outerIvory = new BABYLON.Color3(1.0, 0.91, 0.78);
  const tunnelIvory = new BABYLON.Color3(0.82, 0.75, 0.64);
  const base = BABYLON.Color3.Lerp(outerIvory, tunnelIvory, smoothstep(progress));
  const groove = rib * (0.14 + progress * 0.16);
  const redAccent = rib * Math.max(0, progress - 0.78) * 0.08;
  target.push(
    BABYLON.Scalar.Lerp(base.r, 0.31, groove),
    BABYLON.Scalar.Lerp(base.g, 0.12, groove + redAccent),
    BABYLON.Scalar.Lerp(base.b, 0.14, groove + redAccent),
    1,
  );
}

function createInteriorFloor(scene, material, getGroundHeight, axes) {
  const route = Array.from({ length: 14 }, (_, index) => {
    const progress = index / 13;
    const center = ENTRANCE_CENTER.add(axes.forward.scale(progress * 5.1));
    return {
      center: new BABYLON.Vector3(
        center.x,
        getGroundHeight(center.x, center.z) + 0.05,
        center.z,
      ),
      width: 1.95 - progress * 0.2,
    };
  });
  const left = [];
  const right = [];
  route.forEach((point) => {
    left.push(point.center.add(axes.lateral.scale(point.width)));
    right.push(point.center.subtract(axes.lateral.scale(point.width)));
  });

  const floor = BABYLON.MeshBuilder.CreateRibbon(
    "right-inviting-ivory-floor",
    { pathArray: [left, right], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  floor.material = material;
  floor.receiveShadows = true;
  floor.isPickable = false;
  return floor;
}

/**
 * The short interior gently resolves into an illuminated mineral surface.
 * This gives the five-metre threshold depth without exposing a second,
 * graphic arch or a black void behind the entrance.
 */
function createInteriorFade(scene, material, getGroundHeight, axes) {
  const segments = 30;
  const distance = 5.28;
  const center = ENTRANCE_CENTER.add(axes.forward.scale(distance));
  const positions = [];
  const indices = [];
  const uvs = [];
  const width = 1.78;
  const height = 3.02;

  positions.push(
    center.x,
    getGroundHeight(center.x, center.z) + 0.06 + height * 0.42,
    center.z,
  );
  uvs.push(0.5, 0.42);

  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI - (index / segments) * Math.PI;
    const side = Math.cos(angle) * width;
    const forwardShift = Math.sin(angle) * 0.18;
    const x = center.x + axes.lateral.x * side + axes.forward.x * forwardShift;
    const z = center.z + axes.lateral.z * side + axes.forward.z * forwardShift;
    positions.push(x, getGroundHeight(x, z) + 0.06 + Math.sin(angle) * height, z);
    uvs.push(index / segments, 1);
  }

  for (let index = 0; index < segments; index += 1) {
    indices.push(0, index + 2, index + 1);
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const fade = new BABYLON.Mesh("ivory-threshold-light-fade", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(fade);
  fade.material = material;
  fade.isPickable = false;
  return fade;
}

function pushPoint(target, point) {
  target.push(point.x, point.y, point.z);
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
