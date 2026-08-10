import { createSeededRandom, randomRange } from "./random.js";

const TERRAIN_SIZE = 92;
const START_POSITION = new BABYLON.Vector3(0, 0, -5.5);

/**
 * A continuous, gently shaped landscape. Its outer rise naturally meets the
 * horizon, so the former visible procedural ridge is no longer required.
 */
export function createTerrain(scene, materials) {
  const terrain = BABYLON.MeshBuilder.CreateGround(
    "idyll-continuous-terrain",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: 96 },
    scene,
  );
  const positions = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const indices = terrain.getIndices();

  for (let index = 0; index < positions.length; index += 3) {
    positions[index + 1] = getTerrainHeight(positions[index], positions[index + 2]);
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  terrain.material = materials.terrain;
  terrain.receiveShadows = true;
  terrain.isPickable = false;

  const groundCoverZones = createGroundCoverZones(scene, materials.mixedGround);
  const distantHorizon = createDistantHorizon(scene, materials.terrain);

  return {
    terrain,
    groundCoverZones,
    distantHorizon,
    startPosition: START_POSITION.clone(),
    getGroundHeight: getTerrainHeight,
    shadowCasters: [],
  };
}

/**
 * A quiet extension of the existing terrain softens the map edge into distant,
 * low landscape forms. It remains intentionally understated behind the kit
 * vegetation and leaves the right-side composition open.
 */
function createDistantHorizon(scene, terrainMaterial) {
  const angularSegments = 72;
  const radii = [44, 64, 92, 128];
  const profiles = [0.5, 0.9, 1.45, 2.05];
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let row = 0; row < radii.length; row += 1) {
    for (let sector = 0; sector < angularSegments; sector += 1) {
      const angle = (sector / angularSegments) * Math.PI * 2;
      const radius = radii[row] + Math.sin(angle * 4.3 + row) * 0.9;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 1.5;
      const silhouette =
        Math.sin(angle * 2.1 + 0.6) * 0.58 +
        Math.sin(angle * 5.2 - 1.3) * 0.26;
      // This is a controlled far silhouette, rather than an extension of the
      // near terrain's rising edge. Its low cap preserves an open sky in every
      // direction while visually absorbing the map boundary.
      positions.push(x, profiles[row] + silhouette * (row / 3), z);
      uvs.push((sector / angularSegments) * 7, row * 1.2);
    }
  }

  for (let row = 0; row < radii.length - 1; row += 1) {
    for (let sector = 0; sector < angularSegments; sector += 1) {
      const next = (sector + 1) % angularSegments;
      const current = row * angularSegments + sector;
      const nextRow = current + angularSegments;
      const currentNext = row * angularSegments + next;
      const nextRowNext = nextRow - sector + next;
      indices.push(current, nextRow, nextRowNext, current, nextRowNext, currentNext);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const horizon = new BABYLON.Mesh("quiet-distant-horizon", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(horizon);
  const horizonMaterial = terrainMaterial.clone("quiet-distant-horizon-material");
  horizonMaterial.albedoColor = BABYLON.Color3.FromHexString("#9cae9b");
  horizonMaterial.environmentIntensity = 0.04;
  horizonMaterial.specularIntensity = 0;
  horizonMaterial.roughness = 0.99;
  horizon.material = horizonMaterial;
  horizon.isPickable = false;
  return horizon;
}

/**
 * Small, terrain-conforming mixed-ground zones break up the grass material
 * around the water without creating tiled paths or decorative placeholders.
 */
function createGroundCoverZones(scene, material) {
  const definitions = [
    { x: -6.7, z: -0.9, radiusX: 2.15, radiusZ: 8.6, seed: 801 },
    { x: -2.6, z: -7.8, radiusX: 3.8, radiusZ: 1.5, seed: 802 },
    { x: -8.7, z: 6.5, radiusX: 3.7, radiusZ: 2.1, seed: 803 },
  ];

  return definitions.map((definition, index) => {
    const patch = createTerrainConformingPatch(
      scene,
      `mixed-ground-zone-${index}`,
      definition,
    );
    patch.material = material;
    patch.receiveShadows = true;
    patch.isPickable = false;
    return patch;
  });
}

function createTerrainConformingPatch(scene, name, definition) {
  const segments = 52;
  const random = createSeededRandom(definition.seed);
  const positions = [
    definition.x,
    getTerrainHeight(definition.x, definition.z) + 0.018,
    definition.z,
  ];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const variation =
      1 +
      Math.sin(angle * 3 + definition.seed) * 0.13 +
      Math.sin(angle * 7 - definition.seed) * 0.06 +
      randomRange(random, -0.05, 0.05);
    const x = definition.x + Math.cos(angle) * definition.radiusX * variation;
    const z = definition.z + Math.sin(angle) * definition.radiusZ * variation;
    positions.push(x, getTerrainHeight(x, z) + 0.02, z);
    uvs.push((Math.cos(angle) + 1) * 0.5, (Math.sin(angle) + 1) * 0.5);
  }

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, index + 1, next + 1);
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

export function getTerrainHeight(x, z) {
  const distance = Math.hypot(x, z + 1.5);
  const broadMounds =
    Math.sin(x * 0.115 + z * 0.052) * 0.52 +
    Math.cos(z * 0.15 - x * 0.035) * 0.33 +
    Math.sin((x - z) * 0.075) * 0.23;
  const fineVariation = Math.sin(x * 0.39 - z * 0.25) * 0.09;
  const shallowBasin = -0.28 * Math.exp(-Math.pow((x + 5.6) / 7.3, 2));
  const outerRise = Math.max(0, distance - 24) * 0.16 + Math.max(0, distance - 34) * 0.13;
  const arrivalDistance = Math.hypot(x, z + 5.5);
  const arrivalBlend = Math.min(1, Math.max(0, (arrivalDistance - 2.8) / 7.2));

  return (broadMounds + fineVariation + shallowBasin) * arrivalBlend + outerRise;
}
