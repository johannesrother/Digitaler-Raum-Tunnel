import { createSeededRandom, randomRange } from "./random.js";

/**
 * Vegetation is composed from small, reusable leaf and blade meshes. This keeps
 * the scene spatial at close range while instances keep the Quest draw cost low.
 */
export function createVegetation(scene, materials, getGroundHeight, vineAnchors) {
  const leafSources = createLeafClusterSources(scene, materials.foliage);
  const tuftSources = createTuftSources(scene, materials);
  const flowerSources = createFlowerSources(scene, materials.flowers);
  const shadowCasters = [];

  const treeDefinitions = [
    { x: -15.4, z: -2.3, height: 6.3, seed: 601 },
    { x: -14.1, z: 11.3, height: 7.4, seed: 602 },
    { x: -5.8, z: 18.4, height: 6.8, seed: 603 },
    { x: 4.9, z: 18.6, height: 7.3, seed: 604 },
    { x: 17.2, z: 4.1, height: 6.8, seed: 605 },
    { x: 18.4, z: 15.1, height: 8.2, seed: 606 },
    { x: -14.8, z: -16.6, height: 7.2, seed: 607 },
    { x: 6.7, z: -19.3, height: 6.7, seed: 608 },
    { x: 20.4, z: -10.2, height: 7.7, seed: 609 },
  ];

  treeDefinitions.forEach((definition, index) => {
    shadowCasters.push(
      ...createElegantTree(scene, `tree-${index}`, {
        ...definition,
        baseY: getGroundHeight(definition.x, definition.z),
        materials,
        leafSources,
      }),
    );
  });

  createShrubBanks(leafSources, getGroundHeight);
  createGroundTufts(tuftSources, getGroundHeight);
  createFlowerPockets(flowerSources, getGroundHeight);
  shadowCasters.push(...createHangingVines(scene, materials, leafSources, vineAnchors));

  return { shadowCasters };
}

function createLeafClusterSources(scene, foliageMaterials) {
  return foliageMaterials.map((material, index) => {
    const random = createSeededRandom(710 + index);
    const positions = [];
    const indices = [];
    const uvs = [];

    for (let leafIndex = 0; leafIndex < 36; leafIndex += 1) {
      const angle = randomRange(random, 0, Math.PI * 2);
      const radius = randomRange(random, 0.04, 0.47);
      const base = new BABYLON.Vector3(
        Math.cos(angle) * radius,
        randomRange(random, -0.34, 0.38),
        Math.sin(angle) * radius,
      );
      addCurvedLeaf({
        positions,
        indices,
        uvs,
        base,
        angle: angle + randomRange(random, -0.65, 0.65),
        length: randomRange(random, 0.26, 0.54),
        width: randomRange(random, 0.055, 0.13),
        lift: randomRange(random, -0.1, 0.3),
      });
    }

    return makeMesh(scene, `leaf-cluster-source-${index}`, positions, indices, uvs, material, false);
  });
}

function createTuftSources(scene, materials) {
  return [materials.grass, materials.grassLight].map((material, materialIndex) => {
    const random = createSeededRandom(730 + materialIndex);
    const positions = [];
    const indices = [];
    const uvs = [];
    for (let blade = 0; blade < 20; blade += 1) {
      addBentBlade({
        positions,
        indices,
        uvs,
        x: randomRange(random, -0.28, 0.28),
        z: randomRange(random, -0.28, 0.28),
        height: randomRange(random, 0.35, 0.85),
        width: randomRange(random, 0.012, 0.03),
        angle: randomRange(random, 0, Math.PI * 2),
        lean: randomRange(random, 0.08, 0.3),
      });
    }
    return makeMesh(scene, `ground-tuft-source-${materialIndex}`, positions, indices, uvs, material, false);
  });
}

function createFlowerSources(scene, flowerMaterials) {
  return flowerMaterials.map((material, index) => {
    const random = createSeededRandom(750 + index);
    const positions = [];
    const indices = [];
    const uvs = [];
    for (let flower = 0; flower < 7; flower += 1) {
      const x = randomRange(random, -0.32, 0.32);
      const z = randomRange(random, -0.32, 0.32);
      const y = randomRange(random, 0.13, 0.38);
      const petalSize = randomRange(random, 0.055, 0.1);
      for (let petal = 0; petal < 5; petal += 1) {
        addPetal(positions, indices, uvs, x, y, z, petalSize, (petal / 5) * Math.PI * 2);
      }
    }
    return makeMesh(scene, `flower-spray-source-${index}`, positions, indices, uvs, material, false);
  });
}

function createElegantTree(scene, name, options) {
  const { x, z, baseY, height, seed, materials, leafSources } = options;
  const random = createSeededRandom(seed);
  const trunkPath = [];

  for (let index = 0; index <= 15; index += 1) {
    const progress = index / 15;
    trunkPath.push(
      new BABYLON.Vector3(
        x + Math.sin(progress * Math.PI * 1.32 + seed) * 0.24 * progress,
        baseY + progress * height,
        z + Math.cos(progress * Math.PI * 1.03 + seed) * 0.2 * progress,
      ),
    );
  }

  const trunk = BABYLON.MeshBuilder.CreateTube(
    `${name}-grown-trunk`,
    {
      path: trunkPath,
      tessellation: 7,
      cap: BABYLON.Mesh.CAP_ALL,
      radiusFunction: (index) => 0.21 - (index / 15) * 0.115,
    },
    scene,
  );
  trunk.material = materials.bark;
  trunk.receiveShadows = true;
  trunk.isPickable = false;
  const treeMeshes = [trunk];

  [0.44, 0.59, 0.72, 0.82].forEach((branchStart, branchIndex) => {
    const start = trunkPath[Math.round(branchStart * 15)];
    const direction = randomRange(random, -Math.PI, Math.PI) + branchIndex * 1.35;
    const length = randomRange(random, 1.45, 2.4);
    const branchPath = [];
    for (let index = 0; index <= 8; index += 1) {
      const progress = index / 8;
      branchPath.push(
        new BABYLON.Vector3(
          start.x + Math.cos(direction) * length * progress,
          start.y + progress * length * randomRange(random, 0.24, 0.42),
          start.z + Math.sin(direction) * length * progress,
        ),
      );
    }
    const branch = BABYLON.MeshBuilder.CreateTube(
      `${name}-grown-branch-${branchIndex}`,
      {
        path: branchPath,
        tessellation: 6,
        cap: BABYLON.Mesh.CAP_ALL,
        radiusFunction: (index) => 0.09 - (index / 8) * 0.055,
      },
      scene,
    );
    branch.material = materials.bark;
    branch.receiveShadows = true;
    branch.isPickable = false;
    treeMeshes.push(branch);
  });

  for (let index = 0; index < 30; index += 1) {
    const angle = randomRange(random, 0, Math.PI * 2);
    const radialDistance = randomRange(random, 0.28, 2.08);
    const source = leafSources[index % leafSources.length];
    const cluster = source.createInstance(`${name}-leaf-cluster-${index}`);
    const size = randomRange(random, 0.68, 1.08);
    cluster.position.set(
      x + Math.cos(angle) * radialDistance,
      baseY + height * randomRange(random, 0.58, 0.98),
      z + Math.sin(angle) * radialDistance * 0.82,
    );
    cluster.scaling.set(size * randomRange(random, 0.8, 1.18), size, size * randomRange(random, 0.82, 1.2));
    cluster.rotation.set(randomRange(random, -0.28, 0.28), angle, randomRange(random, -0.28, 0.28));
    cluster.isPickable = false;
  }

  return treeMeshes;
}

function createShrubBanks(leafSources, getGroundHeight) {
  const definitions = [
    [-4.1, -3.5, 7, 0.52, 771], [3.8, -3.2, 8, 0.58, 772], [-8.5, -1.2, 8, 0.66, 773],
    [-9.4, 4.5, 10, 0.68, 774], [1.2, 4.6, 8, 0.56, 775], [6.8, 5.7, 10, 0.72, 776],
    [10.3, 9.9, 11, 0.75, 777], [-4.2, 10.2, 10, 0.7, 778], [-13.8, 8.3, 9, 0.76, 779],
    [-8.3, -12.1, 10, 0.7, 780], [11.8, -8.4, 14, 0.86, 781], [21.2, -8.7, 15, 0.92, 782],
    [18.2, -3.2, 12, 0.78, 783],
  ];
  definitions.forEach(([centerX, centerZ, count, size, seed], groupIndex) => {
    const random = createSeededRandom(seed);
    for (let index = 0; index < count; index += 1) {
      const x = centerX + randomRange(random, -1.8, 1.8);
      const z = centerZ + randomRange(random, -1.35, 1.35);
      const source = leafSources[(groupIndex + index) % leafSources.length];
      const shrub = source.createInstance(`shrub-${groupIndex}-${index}`);
      const scale = size * randomRange(random, 0.72, 1.24);
      shrub.position.set(x, getGroundHeight(x, z) + scale * 0.3, z);
      shrub.scaling.set(scale * randomRange(random, 0.82, 1.22), scale * randomRange(random, 0.66, 0.98), scale);
      shrub.rotation.y = randomRange(random, 0, Math.PI * 2);
      shrub.isPickable = false;
    }
  });
}

function createGroundTufts(tuftSources, getGroundHeight) {
  const clusters = [
    [-2.8, -4.4, 18, 791], [2.8, -4.4, 18, 792], [-7.1, 1.9, 22, 793], [2, 4.7, 20, 794],
    [6.8, 4.1, 20, 795], [-5.6, 9.3, 23, 796], [5.6, 10.6, 23, 797], [12.1, 8, 20, 798],
    [-12.2, 3.2, 18, 799], [-10.7, -9.6, 16, 800], [12.5, -7.2, 24, 801], [20.8, -6.9, 24, 802],
    [17.2, -2.2, 20, 803],
  ];
  clusters.forEach(([centerX, centerZ, count, seed], clusterIndex) => {
    const random = createSeededRandom(seed);
    for (let index = 0; index < count; index += 1) {
      const x = centerX + randomRange(random, -2.05, 2.05);
      const z = centerZ + randomRange(random, -1.55, 1.55);
      const tuft = tuftSources[(clusterIndex + index) % tuftSources.length].createInstance(
        `ground-tuft-${clusterIndex}-${index}`,
      );
      const scale = randomRange(random, 0.48, 0.92);
      tuft.position.set(x, getGroundHeight(x, z) + 0.018, z);
      tuft.scaling.set(scale, scale, scale);
      tuft.rotation.y = randomRange(random, 0, Math.PI * 2);
      tuft.isPickable = false;
    }
  });
}

function createFlowerPockets(flowerSources, getGroundHeight) {
  const pockets = [
    [-3.8, -4.7, 10, 811], [2.7, -4.1, 8, 812], [-8.2, 2.8, 11, 813], [3.5, 4.1, 9, 814],
    [-1.2, 8.1, 10, 815], [7.9, 7.4, 10, 816], [-12.4, 5.7, 10, 817], [11.8, -6.8, 9, 818],
    [20.3, -6.2, 10, 819],
  ];
  pockets.forEach(([centerX, centerZ, count, seed], pocketIndex) => {
    const random = createSeededRandom(seed);
    for (let index = 0; index < count; index += 1) {
      const x = centerX + randomRange(random, -1.25, 1.25);
      const z = centerZ + randomRange(random, -0.9, 0.9);
      const source = flowerSources[(pocketIndex + index) % flowerSources.length];
      const flowers = source.createInstance(`flower-pocket-${pocketIndex}-${index}`);
      const scale = randomRange(random, 0.45, 0.85);
      flowers.position.set(x, getGroundHeight(x, z) + 0.024, z);
      flowers.scaling.set(scale, scale, scale);
      flowers.rotation.y = randomRange(random, 0, Math.PI * 2);
      flowers.isPickable = false;
    }
  });
}

function createHangingVines(scene, materials, leafSources, anchors) {
  const vineMeshes = [];
  anchors.forEach((anchor, vineIndex) => {
    const random = createSeededRandom(830 + vineIndex);
    const length = randomRange(random, 1.4, 2.7);
    const path = [];
    for (let index = 0; index <= 12; index += 1) {
      const progress = index / 12;
      path.push(
        new BABYLON.Vector3(
          anchor.x + Math.sin(progress * Math.PI * 1.35 + vineIndex) * 0.16,
          anchor.y - length * progress,
          anchor.z + Math.cos(progress * Math.PI * 1.1 + vineIndex) * 0.13,
        ),
      );
    }
    const vine = BABYLON.MeshBuilder.CreateTube(
      `hanging-vine-${vineIndex}`,
      { path, radius: 0.022, tessellation: 5, cap: BABYLON.Mesh.CAP_ALL },
      scene,
    );
    vine.material = materials.vine;
    vine.isPickable = false;
    vineMeshes.push(vine);

    for (let leafIndex = 2; leafIndex < 12; leafIndex += 3) {
      const source = leafSources[(vineIndex + leafIndex) % leafSources.length];
      const leaves = source.createInstance(`vine-leaves-${vineIndex}-${leafIndex}`);
      leaves.position.copyFrom(path[leafIndex]);
      leaves.scaling.set(0.18, 0.12, 0.18);
      leaves.rotation.set(0, randomRange(random, 0, Math.PI), randomRange(random, -0.42, 0.42));
      leaves.isPickable = false;
    }
  });
  return vineMeshes;
}

function addCurvedLeaf(options) {
  const { positions, indices, uvs, base, angle, length, width, lift } = options;
  const side = new BABYLON.Vector3(Math.cos(angle + Math.PI * 0.5), 0, Math.sin(angle + Math.PI * 0.5));
  const forward = new BABYLON.Vector3(Math.cos(angle), lift, Math.sin(angle));
  const mid = base.add(forward.scale(length * 0.52));
  const tip = base.add(forward.scale(length));
  const ridge = mid.add(new BABYLON.Vector3(0, width * 0.42, 0));
  const start = positions.length / 3;
  [base, mid.add(side.scale(width)), tip, mid.subtract(side.scale(width)), ridge].forEach((point) => {
    positions.push(point.x, point.y, point.z);
  });
  uvs.push(0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5, 0.5, 0.5);
  indices.push(start, start + 1, start + 4, start + 1, start + 2, start + 4, start + 2, start + 3, start + 4, start + 3, start, start + 4);
}

function addBentBlade(options) {
  const { positions, indices, uvs, x, z, height, width, angle, lean } = options;
  const side = new BABYLON.Vector3(Math.cos(angle) * width, 0, Math.sin(angle) * width);
  const bend = new BABYLON.Vector3(Math.cos(angle + Math.PI * 0.5) * lean, height * 0.48, Math.sin(angle + Math.PI * 0.5) * lean);
  const base = new BABYLON.Vector3(x, 0, z);
  const mid = base.add(bend);
  const tip = new BABYLON.Vector3(x + bend.x * 1.85, height, z + bend.z * 1.85);
  const start = positions.length / 3;
  [base.subtract(side), base.add(side), mid.subtract(side.scale(0.64)), mid.add(side.scale(0.64)), tip].forEach((point) => {
    positions.push(point.x, point.y, point.z);
  });
  uvs.push(0, 0, 1, 0, 0.12, 0.5, 0.88, 0.5, 0.5, 1);
  indices.push(start, start + 1, start + 3, start, start + 3, start + 2, start + 2, start + 3, start + 4);
}

function addPetal(positions, indices, uvs, x, y, z, size, angle) {
  const side = new BABYLON.Vector3(Math.cos(angle + Math.PI * 0.5) * size * 0.48, 0, Math.sin(angle + Math.PI * 0.5) * size * 0.48);
  const direction = new BABYLON.Vector3(Math.cos(angle) * size, size * 0.15, Math.sin(angle) * size);
  const center = new BABYLON.Vector3(x, y, z);
  const tip = center.add(direction);
  const start = positions.length / 3;
  [center, center.add(side), tip, center.subtract(side)].forEach((point) => positions.push(point.x, point.y, point.z));
  uvs.push(0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5);
  indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function makeMesh(scene, name, positions, indices, uvs, material, visible) {
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
  mesh.isVisible = visible;
  mesh.isPickable = false;
  return mesh;
}
