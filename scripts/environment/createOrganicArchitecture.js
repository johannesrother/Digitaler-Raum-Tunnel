const ENTRANCE_CENTER = new BABYLON.Vector3(9.3, 0, 2.45);
const VIEWER_POSITION = new BABYLON.Vector3(0, 0, -5.5);

/**
 * A single continuous ivory shell forms the Step-4 focal point. It is aligned
 * toward the visitor, so the opening reads as enterable from the rightward
 * glance rather than as a freestanding arch in the landscape.
 */
export function createIvoryArchitecture(scene, materials, getGroundHeight) {
  const axes = createEntranceAxes();
  const portal = createOrganicPortalShell(scene, materials.ivoryArchitecture, getGroundHeight, axes);
  const interior = createInvitingEntranceInterior(scene, materials.ivoryInterior, getGroundHeight, axes);

  return {
    shadowCasters: [portal, interior.floor],
    reflectors: [portal],
    tunnel: { portal, ...interior },
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
 * Creates a thick, asymmetric annular shell around an organic aperture. The
 * changing curves and offset rear surface prevent it from reading as a pipe,
 * a torus or a conventional doorway.
 */
function createOrganicPortalShell(scene, material, getGroundHeight, axes) {
  const segments = 44;
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = Math.PI - progress * Math.PI;
    const inner = aperturePoint(angle, 0, getGroundHeight, axes);
    const outer = aperturePoint(angle, 1, getGroundHeight, axes);
    const faceOffset = axes.forward.scale(-0.2 - Math.sin(angle) * 0.16);

    pushPoint(positions, inner.add(faceOffset));
    pushPoint(positions, outer.add(faceOffset));
    uvs.push(progress * 2.2, 0, progress * 2.2, 1);
  }

  for (let index = 0; index < segments; index += 1) {
    const current = index * 2;
    const next = current + 2;
    indices.push(
      current, current + 1, next + 1,
      current, next + 1, next,
    );
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

function aperturePoint(angle, layer, getGroundHeight, axes) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const isOuter = layer === 1;
  const widthBase = isOuter ? 3.95 : 2.18;
  const heightBase = isOuter ? 5.7 : 3.45;
  const width = widthBase * (1 + Math.sin(angle * 2.3 + (isOuter ? 0.6 : 0.1)) * 0.075);
  const height = heightBase * (1 + Math.sin(angle * 1.7 + (isOuter ? 1.1 : 0.4)) * 0.06);
  const lateralOffset = cos * width + sin * (isOuter ? 0.26 : 0.12);
  const forwardOffset = sin * (isOuter ? 0.7 : 0.22) + Math.sin(angle * 3.2) * 0.14;
  const x = ENTRANCE_CENTER.x + axes.lateral.x * lateralOffset + axes.forward.x * forwardOffset;
  const z = ENTRANCE_CENTER.z + axes.lateral.z * lateralOffset + axes.forward.z * forwardOffset;
  const baseY = getGroundHeight(x, z) - (isOuter ? 0.28 : 0.03);
  const y = baseY + sin * height + (isOuter ? sin * sin * 0.5 : 0);
  return new BABYLON.Vector3(x, y, z);
}

function createInvitingEntranceInterior(scene, material, getGroundHeight, axes) {
  const shell = createInteriorShell(scene, material, getGroundHeight, axes);
  const floor = createInteriorFloor(scene, material, getGroundHeight, axes);
  const lightPosition = ENTRANCE_CENTER
    .add(axes.forward.scale(1.45))
    .add(new BABYLON.Vector3(0, getGroundHeight(ENTRANCE_CENTER.x, ENTRANCE_CENTER.z) + 3.05, 0));
  const daylight = new BABYLON.PointLight("tunnel-mouth-soft-daylight", lightPosition, scene);
  daylight.diffuse = BABYLON.Color3.FromHexString("#ffe1b7");
  daylight.intensity = 0.42;
  daylight.range = 10;
  return { shell, floor, daylight };
}

function createInteriorShell(scene, material, getGroundHeight, axes) {
  const depthSegments = 16;
  const arcSegments = 32;
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const progress = depthIndex / depthSegments;
    const distance = 0.05 + progress * 5.15;
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

function pushPoint(target, point) {
  target.push(point.x, point.y, point.z);
}
