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
  const portal = createOrganicPortalShell(scene, materials.ivoryArchitecture, getGroundHeight, axes);
  const interior = createInvitingEntranceInterior(
    scene,
    materials.ivoryInterior,
    materials.ivoryInteriorFade,
    getGroundHeight,
    axes,
  );

  return {
    shadowCasters: [portal, interior.floor, interior.fade],
    reflectors: [portal],
    tunnel: { portal, ...interior },
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
  const rings = 4;
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = Math.PI - progress * Math.PI;

    for (let ring = 0; ring <= rings; ring += 1) {
      const point = aperturePoint(angle, ring / rings, getGroundHeight, axes);
      pushPoint(positions, point);
      uvs.push(progress * 2.4, ring / rings);
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
  vertexData.applyToMesh(portal);
  portal.material = material;
  portal.receiveShadows = true;
  portal.isPickable = false;
  return portal;
}

function aperturePoint(angle, spread, getGroundHeight, axes) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const innerWidth = cos < 0 ? 2.08 : 2.32;
  const outerWidth = cos < 0 ? 4.7 : 3.85;
  const innerHeight = 3.42;
  const outerHeight = cos < 0 ? 5.85 : 5.2;
  const width = BABYLON.Scalar.Lerp(innerWidth, outerWidth, spread)
    * (1 + Math.sin(angle * 2.1 + 0.45) * 0.055);
  const height = BABYLON.Scalar.Lerp(innerHeight, outerHeight, spread)
    * (1 + Math.sin(angle * 1.65 + 0.75) * 0.045);
  const lateralOffset = cos * width
    + sin * BABYLON.Scalar.Lerp(0.12, 0.58, spread)
    + spread * Math.sin(angle * 1.25) * 0.24;
  const fold = Math.sin(angle) * Math.sin(angle);
  const forwardOffset = sin * BABYLON.Scalar.Lerp(0.12, 0.72, spread)
    + fold * spread * 0.34
    + Math.sin(angle * 3.15 + spread * 2.5) * 0.1;
  const x = ENTRANCE_CENTER.x + axes.lateral.x * lateralOffset + axes.forward.x * forwardOffset;
  const z = ENTRANCE_CENTER.z + axes.lateral.z * lateralOffset + axes.forward.z * forwardOffset;
  const baseY = getGroundHeight(x, z) - BABYLON.Scalar.Lerp(0.04, 0.34, spread);
  const y = baseY + sin * height + fold * spread * 0.5;
  return new BABYLON.Vector3(x, y, z);
}

function createInvitingEntranceInterior(scene, material, fadeMaterial, getGroundHeight, axes) {
  const shell = createInteriorShell(scene, material, getGroundHeight, axes);
  const floor = createInteriorFloor(scene, material, getGroundHeight, axes);
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
  const depthSegments = 16;
  const arcSegments = 32;
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const progress = depthIndex / depthSegments;
    const distance = 0.05 + progress * 5.2;
    const center = ENTRANCE_CENTER.add(axes.forward.scale(distance));
    const width = 2.12 - progress * 0.33 + Math.sin(progress * 5.1) * 0.08;
    const height = 3.35 - progress * 0.32 + Math.sin(progress * 3.8) * 0.08;

    for (let arcIndex = 0; arcIndex <= arcSegments; arcIndex += 1) {
      const arc = arcIndex / arcSegments;
      const angle = Math.PI - arc * Math.PI;
      const side = Math.cos(angle) * width * (1 + Math.sin(angle * 2.5 + progress * 4.6) * 0.045);
      const forwardShift = Math.sin(angle) * 0.12 + Math.sin(angle * 3.1 + progress * 4.9) * 0.07;
      const x = center.x + axes.lateral.x * side + axes.forward.x * forwardShift;
      const z = center.z + axes.lateral.z * side + axes.forward.z * forwardShift;
      const baseY = getGroundHeight(x, z) + 0.04;
      positions.push(x, baseY + Math.sin(angle) * height, z);
      uvs.push(arc * 1.5, progress * 2.2);
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
  vertexData.applyToMesh(shell);
  shell.material = material;
  shell.isPickable = false;
  return shell;
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
