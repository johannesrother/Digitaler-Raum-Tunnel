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

  const distantLandscape = createDistantLandscapeRing(scene, materials);

  return {
    terrain,
    startPosition: START_POSITION.clone(),
    getGroundHeight: getLandscapeHeight,
    shadowCasters: [],
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
