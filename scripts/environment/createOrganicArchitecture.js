/**
 * Curved mineral masses are generated as variable lofts. Their profile, depth
 * and thickness change over the span so no part reads as a stock tube or arch.
 */
export function createOrganicArchitecture(scene, materials, getGroundHeight) {
  const shadowCasters = [];
  const vineAnchors = [];

  const tunnel = createIntegratedTunnel(scene, materials, getGroundHeight);
  shadowCasters.push(...tunnel.shadowCasters);
  vineAnchors.push(...tunnel.vineAnchors);

  const sculptural = createSculpturalArchitecture(scene, materials, getGroundHeight);
  shadowCasters.push(...sculptural.shadowCasters);

  return { shadowCasters, vineAnchors, sculptural };
}

function createFlowingMineralLoft(scene, name, options) {
  const {
    center,
    span,
    height,
    thickness,
    depth,
    drift,
    seed,
    material,
    getGroundHeight,
  } = options;
  const pathSegments = 48;
  const profileSegments = 16;
  const positions = [];
  const indices = [];
  const uvs = [];
  const leftBase = getGroundHeight(center.x - span * 0.5, center.z) - 0.18;
  const rightBase = getGroundHeight(center.x + span * 0.5, center.z) - 0.18;

  for (let pathIndex = 0; pathIndex <= pathSegments; pathIndex += 1) {
    const progress = pathIndex / pathSegments;
    const angle = Math.PI - progress * Math.PI;
    const archWeight = Math.pow(Math.sin(progress * Math.PI), 0.8);
    const baseY = leftBase + (rightBase - leftBase) * progress;
    const centerX =
      center.x +
      Math.cos(angle) * span * 0.5 +
      Math.sin(progress * Math.PI * 2.1 + seed * 0.13) * span * 0.044;
    const centerY =
      baseY +
      archWeight * height +
      Math.sin(progress * Math.PI * 3.2 + seed) * 0.2;
    const centerZ =
      center.z +
      archWeight * drift +
      Math.sin(progress * Math.PI * 1.45 + seed * 0.21) * 0.34;
    const outward = new BABYLON.Vector3(
      Math.cos(angle) / (span * 0.5),
      Math.sin(angle) / height,
      0,
    ).normalize();

    for (let profileIndex = 0; profileIndex < profileSegments; profileIndex += 1) {
      const profile = (profileIndex / profileSegments) * Math.PI * 2;
      const upperWeight = (Math.sin(profile) + 1) * 0.5;
      const profileMass = 0.64 + Math.pow(1 - archWeight, 0.52) * 0.7 + upperWeight * 0.12;
      const thicknessVariation =
        1 +
        Math.sin(progress * Math.PI * 3.7 + profile * 2.1 + seed) * 0.18 +
        Math.cos(progress * Math.PI * 1.3 - profile * 3.5) * 0.11;
      const radial = Math.cos(profile) * thickness * thicknessVariation * profileMass;
      const lateral = Math.sin(profile) * depth * (0.62 + upperWeight * 0.58);
      const mergedBase = Math.pow(1 - archWeight, 2.2) * (0.72 + upperWeight * 0.38);
      const grain = Math.sin(profile * 5 + progress * 11 + seed) * 0.12;

      positions.push(
        centerX + outward.x * radial,
        centerY + outward.y * radial + grain + mergedBase,
        centerZ + lateral + Math.sin(progress * Math.PI * 4 + profile) * 0.15,
      );
      uvs.push(progress * 3.4, profileIndex / profileSegments);
    }
  }

  for (let pathIndex = 0; pathIndex < pathSegments; pathIndex += 1) {
    for (let profileIndex = 0; profileIndex < profileSegments; profileIndex += 1) {
      const nextProfile = (profileIndex + 1) % profileSegments;
      const current = pathIndex * profileSegments + profileIndex;
      const nextPath = (pathIndex + 1) * profileSegments + profileIndex;
      const currentNext = pathIndex * profileSegments + nextProfile;
      const nextPathNext = (pathIndex + 1) * profileSegments + nextProfile;
      indices.push(current, nextPath, nextPathNext, current, nextPathNext, currentNext);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new BABYLON.Mesh(name, scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

function createIntegratedTunnel(scene, materials, getGroundHeight) {
  // The entrance is deliberately offset to the right edge of the opening view:
  // present at arrival, but never competing with the calm forward landscape.
  const centerX = 9.4;
  const centerZ = -1.2;
  const shadowCasters = [];
  const vineAnchors = [];

  const facade = createTunnelFacade(scene, centerX, centerZ, materials, getGroundHeight);
  shadowCasters.push(facade);

  const cavity = createTunnelCavity(scene, centerX, centerZ, materials, getGroundHeight);
  const floor = createTunnelFloor(scene, centerX, centerZ, materials, getGroundHeight);
  shadowCasters.push(floor);

  vineAnchors.push(
    new BABYLON.Vector3(centerX - 4.25, getGroundHeight(centerX - 4.25, centerZ) + 5.4, centerZ + 0.6),
    new BABYLON.Vector3(centerX + 3.85, getGroundHeight(centerX + 3.85, centerZ) + 5.65, centerZ + 1.2),
    new BABYLON.Vector3(centerX - 2.75, getGroundHeight(centerX - 2.75, centerZ) + 6.45, centerZ + 1.7),
  );

  return { shadowCasters, vineAnchors, cavity };
}

/**
 * A broad, variable cave facade. Unlike a swept tube, it is a thick mineral
 * landscape surface whose uneven lower edge gradually creates the tunnel mouth.
 */
function createTunnelFacade(scene, centerX, centerZ, materials, getGroundHeight) {
  const spanSegments = 42;
  const depthSegments = 5;
  const innerSpan = 6.4;
  const innerHeight = 4.9;
  const depth = 3.1;
  const positions = [];
  const indices = [];
  const uvs = [];

  const getIndex = (depthIndex, spanIndex, boundary) =>
    (depthIndex * (spanSegments + 1) + spanIndex) * 2 + boundary;

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const depthProgress = depthIndex / depthSegments;
    for (let spanIndex = 0; spanIndex <= spanSegments; spanIndex += 1) {
      const progress = spanIndex / spanSegments;
      const archWeight = Math.pow(Math.sin(progress * Math.PI), 0.74);
      const localGround = getGroundHeight(
        centerX + (progress - 0.5) * innerSpan,
        centerZ + depthProgress * depth,
      );
      const innerX =
        centerX +
        (progress - 0.5) * innerSpan +
        Math.sin(progress * Math.PI * 2.4 + depthProgress * 1.6) * 0.22;
      const innerY =
        localGround +
        archWeight * innerHeight +
        Math.sin(progress * Math.PI * 4.3 + depthProgress * 2.4) * 0.18;
      const innerZ = centerZ + depthProgress * depth + Math.sin(progress * Math.PI * 1.7) * 0.38;
      const outerX = centerX + (innerX - centerX) * (1.13 + (1 - archWeight) * 0.12);
      const outerY =
        innerY +
        1.4 +
        archWeight * 1.32 +
        Math.sin(progress * Math.PI * 3.1 + depthProgress) * 0.22 -
        (1 - archWeight) * 1.7;
      const outerZ = innerZ - 0.92 + Math.cos(progress * Math.PI * 2) * 0.18;

      positions.push(innerX, innerY, innerZ, outerX, outerY, outerZ);
      uvs.push(progress * 2.3, depthProgress * 2.2, progress * 2.3, depthProgress * 2.2);
    }
  }

  for (let depthIndex = 0; depthIndex < depthSegments; depthIndex += 1) {
    for (let spanIndex = 0; spanIndex < spanSegments; spanIndex += 1) {
      const inner = getIndex(depthIndex, spanIndex, 0);
      const outer = getIndex(depthIndex, spanIndex, 1);
      const nextSpanInner = getIndex(depthIndex, spanIndex + 1, 0);
      const nextSpanOuter = getIndex(depthIndex, spanIndex + 1, 1);
      const nextDepthInner = getIndex(depthIndex + 1, spanIndex, 0);
      const nextDepthOuter = getIndex(depthIndex + 1, spanIndex, 1);
      const diagonalInner = getIndex(depthIndex + 1, spanIndex + 1, 0);
      const diagonalOuter = getIndex(depthIndex + 1, spanIndex + 1, 1);

      // Inner ceiling/walls and outer grown surface.
      indices.push(inner, nextDepthInner, diagonalInner, inner, diagonalInner, nextSpanInner);
      indices.push(outer, diagonalOuter, nextDepthOuter, outer, nextSpanOuter, diagonalOuter);
    }
  }

  // Close the thickness only at the actual mouth and the far transition. Keeping
  // these faces out of the intermediate depth strips avoids repeated arch rings.
  for (let spanIndex = 0; spanIndex < spanSegments; spanIndex += 1) {
    const frontInner = getIndex(0, spanIndex, 0);
    const frontOuter = getIndex(0, spanIndex, 1);
    const frontNextInner = getIndex(0, spanIndex + 1, 0);
    const frontNextOuter = getIndex(0, spanIndex + 1, 1);
    indices.push(frontInner, frontNextInner, frontNextOuter, frontInner, frontNextOuter, frontOuter);

    const rearInner = getIndex(depthSegments, spanIndex, 0);
    const rearOuter = getIndex(depthSegments, spanIndex, 1);
    const rearNextInner = getIndex(depthSegments, spanIndex + 1, 0);
    const rearNextOuter = getIndex(depthSegments, spanIndex + 1, 1);
    indices.push(rearInner, rearOuter, rearNextOuter, rearInner, rearNextOuter, rearNextInner);
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const facade = new BABYLON.Mesh("right-tunnel-landscape-facade", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(facade);
  facade.material = materials.mineral;
  facade.receiveShadows = true;
  facade.isPickable = false;
  return facade;
}

/** Creates a real, warm mineral interior rather than a dark opening on a plane. */
function createTunnelCavity(scene, centerX, centerZ, materials, getGroundHeight) {
  const depthSegments = 22;
  const arcSegments = 26;
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const progress = depthIndex / depthSegments;
    const width = 3.18 - progress * 0.76 + Math.sin(progress * 4.1) * 0.16;
    const height = 3.42 - progress * 0.78 + Math.sin(progress * 3.7) * 0.13;
    const centerY = getGroundHeight(centerX, centerZ + progress * 10.6) + 0.1 + progress * 0.18;
    const centerShift = Math.sin(progress * Math.PI * 1.2) * 0.44;
    const z = centerZ + progress * 10.6;

    for (let arcIndex = 0; arcIndex <= arcSegments; arcIndex += 1) {
      const arcProgress = arcIndex / arcSegments;
      const angle = Math.PI - arcProgress * Math.PI;
      const sideSoftening = 1 + Math.sin(angle * 2.7 + progress * 4.4) * 0.07;
      positions.push(
        centerX + centerShift + Math.cos(angle) * width * sideSoftening,
        centerY + Math.sin(angle) * height * (0.94 + Math.cos(angle * 2) * 0.035),
        z + Math.sin(angle * 3 + progress * 5) * 0.1,
      );
      uvs.push(arcProgress * 1.7, progress * 3.1);
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
  const cavity = new BABYLON.Mesh("right-tunnel-sculpted-interior", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(cavity);
  cavity.material = materials.mineralInterior;
  cavity.backFaceCulling = false;
  cavity.isPickable = false;
  return cavity;
}

function createTunnelFloor(scene, centerX, centerZ, materials, getGroundHeight) {
  const route = [];
  for (let index = 0; index <= 16; index += 1) {
    const progress = index / 16;
    const z = centerZ + progress * 10.4;
    const center = new BABYLON.Vector3(
      centerX + Math.sin(progress * Math.PI * 1.1) * 0.35,
      getGroundHeight(centerX, z) + 0.07 + progress * 0.1,
      z,
    );
    const width = 2.8 - progress * 0.62;
    route.push({ center, width });
  }

  const left = [];
  const right = [];
  route.forEach((point, index) => {
    const before = route[Math.max(0, index - 1)].center;
    const after = route[Math.min(route.length - 1, index + 1)].center;
    const direction = after.subtract(before).normalize();
    const side = new BABYLON.Vector3(-direction.z, 0, direction.x);
    left.push(point.center.add(side.scale(point.width)));
    right.push(point.center.subtract(side.scale(point.width)));
  });

  const floor = BABYLON.MeshBuilder.CreateRibbon(
    "right-tunnel-ground-continuation",
    { pathArray: [left, right], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  floor.material = materials.mineralWeathered;
  floor.receiveShadows = true;
  floor.isPickable = false;
  return floor;
}
import { createSculpturalArchitecture } from "./createSculpturalArchitecture.js";
