import { createSeededRandom, randomRange } from "./random.js";

/**
 * Creates a softly irregular horizontal surface for mineral slabs, moss and water.
 * The radial outline avoids the repeated, tiled appearance of regular primitives.
 */
export function createOrganicSurface(scene, name, options) {
  const {
    center,
    radiusX,
    radiusZ,
    segments = 48,
    irregularity = 0.1,
    seed = 1,
  } = options;
  const random = createSeededRandom(seed);
  const positions = [center.x, center.y, center.z];
  const indices = [];
  const uvs = [0.5, 0.5];

  for (let index = 0; index < segments; index += 1) {
    const progress = index / segments;
    const angle = progress * Math.PI * 2;
    const softVariation =
      1 +
      Math.sin(angle * 3 + seed) * irregularity * 0.46 +
      Math.sin(angle * 7 - seed) * irregularity * 0.24 +
      randomRange(random, -irregularity * 0.3, irregularity * 0.3);
    const x = center.x + Math.cos(angle) * radiusX * softVariation;
    const z = center.z + Math.sin(angle) * radiusZ * softVariation;

    positions.push(x, center.y, z);
    uvs.push((Math.cos(angle) + 1) * 0.5, (Math.sin(angle) + 1) * 0.5);
  }

  for (let index = 0; index < segments; index += 1) {
    const nextIndex = (index + 1) % segments;
    indices.push(0, index + 1, nextIndex + 1);
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
  return mesh;
}

/**
 * A gently crowned, bevelled stone plate. Unlike a flat radial disc, the surface
 * has a soft edge, subtle relief and a naturally imperfect outline.
 */
export function createSculptedStonePatch(scene, name, options) {
  const {
    center,
    radiusX,
    radiusZ,
    segments = 56,
    rings = 6,
    irregularity = 0.14,
    crown = 0.055,
    edgeDrop = 0.12,
    seed = 1,
  } = options;
  const random = createSeededRandom(seed);
  const edgeProfile = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return (
      1 +
      Math.sin(angle * 3 + seed) * irregularity * 0.48 +
      Math.sin(angle * 7 - seed * 0.4) * irregularity * 0.23 +
      randomRange(random, -irregularity * 0.26, irregularity * 0.26)
    );
  });
  const positions = [center.x, center.y + crown, center.z];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let ring = 1; ring <= rings; ring += 1) {
    const progress = ring / rings;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const edge = edgeProfile[index];
      const x = center.x + Math.cos(angle) * radiusX * progress * edge;
      const z = center.z + Math.sin(angle) * radiusZ * progress * edge;
      const smallRelief =
        Math.sin(angle * 4 + ring * 0.7 + seed) * 0.012 * (1 - progress) +
        Math.sin(angle * 9 - ring) * 0.008 * progress;
      const y =
        center.y +
        crown * (1 - progress * progress) -
        edgeDrop * Math.pow(progress, 5) +
        smallRelief;
      positions.push(x, y, z);
      uvs.push((x - center.x) / (radiusX * 2) + 0.5, (z - center.z) / (radiusZ * 2) + 0.5);
    }
  }

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, next + 1, index + 1);
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const currentStart = 1 + (ring - 1) * segments;
    const nextStart = 1 + ring * segments;
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      indices.push(
        currentStart + index,
        nextStart + next,
        nextStart + index,
        currentStart + index,
        currentStart + next,
        nextStart + next,
      );
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
  mesh.receiveShadows = true;
  return mesh;
}

/** Smooth, slightly uneven mineral masses used to blend architecture into terrain. */
export function createOrganicBoulder(scene, name, options) {
  const {
    position,
    scaling,
    seed,
    material,
    subdivisions = 3,
  } = options;
  const random = createSeededRandom(seed);
  const radialSegments = Math.max(18, subdivisions * 6);
  const heightSegments = Math.max(8, subdivisions * 3);
  const positions = [];
  const indices = [];
  const uvs = [];
  const sectorOffsets = Array.from({ length: radialSegments }, () => randomRange(random, -0.16, 0.16));

  for (let heightIndex = 0; heightIndex <= heightSegments; heightIndex += 1) {
    const progress = heightIndex / heightSegments;
    const y = -1 + progress * 2;
    const crown = Math.pow(Math.sin(progress * Math.PI), 0.58);
    const taper = 0.28 + crown * 0.82 - Math.pow(Math.max(0, progress - 0.74) / 0.26, 1.7) * 0.18;

    for (let sector = 0; sector < radialSegments; sector += 1) {
      const angle = (sector / radialSegments) * Math.PI * 2;
      const sectorNoise =
        sectorOffsets[sector] +
        Math.sin(angle * 3 + seed * 0.11) * 0.1 +
        Math.sin(angle * 7 - seed * 0.07) * 0.055;
      const verticalNoise = Math.sin(progress * Math.PI * 3 + angle * 2.4 + seed) * 0.055 * crown;
      const radius = Math.max(0.12, taper * (1 + sectorNoise + verticalNoise));
      positions.push(
        Math.cos(angle) * radius * (0.88 + Math.sin(progress * Math.PI * 1.6 + angle) * 0.08),
        y + Math.sin(angle * 2 + seed) * 0.045 * crown,
        Math.sin(angle) * radius * (0.92 + Math.cos(progress * Math.PI * 1.3 - angle) * 0.075),
      );
      uvs.push(sector / radialSegments, progress);
    }
  }

  for (let heightIndex = 0; heightIndex < heightSegments; heightIndex += 1) {
    for (let sector = 0; sector < radialSegments; sector += 1) {
      const nextSector = (sector + 1) % radialSegments;
      const current = heightIndex * radialSegments + sector;
      const nextRow = current + radialSegments;
      indices.push(current, nextRow, nextRow + nextSector - sector, current, nextRow + nextSector - sector, current + nextSector - sector);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const boulder = new BABYLON.Mesh(name, scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(boulder);
  boulder.position.copyFrom(position);
  boulder.scaling.copyFrom(scaling);
  boulder.material = material;
  boulder.receiveShadows = true;
  boulder.isPickable = false;
  return boulder;
}
