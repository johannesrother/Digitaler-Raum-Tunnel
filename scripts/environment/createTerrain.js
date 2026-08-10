import { createOrganicBoulder, createOrganicSurface } from "./geometry.js";

const TERRAIN_SIZE = 92;
const START_POSITION = new BABYLON.Vector3(0, 0, -5.5);

/**
 * One continuous landscape sits under every view direction. The calm arrival
 * area remains at y = 0 while a quiet outer rise hides the mesh edge.
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

  const mossPatches = createMossTransitions(scene, materials);
  const boulders = createLandscapeBoulders(scene, materials);
  const distantLandscape = createDistantLandscapeRing(scene, materials);

  return {
    terrain,
    startPosition: START_POSITION.clone(),
    getGroundHeight: getLandscapeHeight,
    shadowCasters: boulders.close,
    mossPatches,
    distantLandscape,
  };
}

/**
 * An irregular, fully geometric outer rise closes the horizon in every direction.
 * It joins the terrain at ground level instead of acting as a circular backdrop.
 */
function createDistantLandscapeRing(scene, materials) {
  const angularSegments = 88;
  const radialSegments = 5;
  const profile = [0, 0.32, 0.84, 1, 0.72, 0.28];
  const crest = Array.from({ length: angularSegments }, (_, index) => {
    const angle = (index / angularSegments) * Math.PI * 2;
    return 4.3 + Math.sin(angle * 3.2 + 0.5) * 1.05 + Math.sin(angle * 7.1 - 0.8) * 0.55;
  });
  const positions = [];
  const indices = [];
  const uvs = [];

  for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex += 1) {
    const radialProgress = radialIndex / radialSegments;
    for (let sector = 0; sector < angularSegments; sector += 1) {
      const angle = (sector / angularSegments) * Math.PI * 2;
      const asymmetricRadius = 20 + radialProgress * 17 + Math.sin(angle * 4 + radialIndex) * 0.7;
      const x = Math.cos(angle) * asymmetricRadius;
      const z = Math.sin(angle) * asymmetricRadius - 1.5;
      const neighbour = crest[(sector + 1) % angularSegments];
      const ridgeHeight = (crest[sector] * 0.72 + neighbour * 0.28) * profile[radialIndex];
      const shoulderDetail = Math.sin(angle * 11 + radialProgress * 4.6) * 0.22 * profile[radialIndex];
      positions.push(x, getTerrainHeight(x, z) + ridgeHeight + shoulderDetail, z);
      uvs.push((sector / angularSegments) * 5, radialProgress * 2);
    }
  }

  for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
    for (let sector = 0; sector < angularSegments; sector += 1) {
      const nextSector = (sector + 1) % angularSegments;
      const current = radialIndex * angularSegments + sector;
      const nextRow = current + angularSegments;
      const currentNext = radialIndex * angularSegments + nextSector;
      const nextRowNext = nextRow - sector + nextSector;
      indices.push(current, nextRow, nextRowNext, current, nextRowNext, currentNext);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const landscape = new BABYLON.Mesh("continuous-distant-landscape", scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(landscape);
  landscape.material = materials.terrain;
  landscape.receiveShadows = true;
  landscape.isPickable = false;
  return landscape;
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

function getLandscapeHeight(x, z) {
  return getTerrainHeight(x, z);
}

function createMossTransitions(scene, materials) {
  const definitions = [
    [-7.8, -4.6, 3.8, 2.1, 121],
    [4.8, -4.1, 3.6, 1.85, 122],
    [-8.8, 3.7, 4.2, 2.7, 123],
    [3.4, 5.4, 4.8, 2.55, 124],
    [10.1, 9.6, 3.6, 2.3, 125],
    [-2.4, 11.4, 4.1, 2.2, 126],
    [-14.6, 8.2, 4.9, 2.8, 127],
    [10.4, -10.4, 4.6, 2.6, 128],
    [-11.8, -12.3, 5, 2.85, 129],
  ];

  return definitions.map(([x, z, radiusX, radiusZ, seed], index) => {
    const patch = createOrganicSurface(scene, `moss-transition-${index}`, {
      center: new BABYLON.Vector3(x, getLandscapeHeight(x, z) + 0.018, z),
      radiusX,
      radiusZ,
      segments: 38,
      irregularity: 0.24,
      seed,
    });
    patch.material = materials.moss;
    patch.isPickable = false;
    return patch;
  });
}

function createLandscapeBoulders(scene, materials) {
  const definitions = [
    [-4.4, -8.7, 1.1, 0.74, 0.98, 131],
    [5.2, -7.7, 1.45, 0.86, 1.1, 132],
    [-10.4, -1.6, 1.25, 0.95, 1.25, 133],
    [8.1, 2.5, 1.32, 0.78, 1.08, 134],
    [-12.6, 5.2, 1.72, 1.2, 1.52, 135],
    [5.8, 8.6, 1.6, 0.96, 1.28, 136],
    [13.1, 7.7, 1.85, 1.35, 1.55, 137],
    [-4.4, 13.7, 1.55, 0.92, 1.22, 138],
    [-12.2, -10.8, 1.7, 1.12, 1.42, 139],
    [13.8, -10.4, 1.8, 1.1, 1.55, 140],
  ];

  const close = definitions.map(([x, z, scaleX, scaleY, scaleZ, seed], index) =>
    createOrganicBoulder(scene, `landscape-boulder-${index}`, {
      position: new BABYLON.Vector3(x, getLandscapeHeight(x, z) + scaleY * 0.38, z),
      scaling: new BABYLON.Vector3(scaleX, scaleY, scaleZ),
      seed,
      material: index % 3 === 0 ? materials.mineralWeathered : materials.mineral,
      subdivisions: 5,
    }),
  );
  return { close };
}
