/**
 * Loads a deliberately small local asset library once and places copies around
 * the arrival space. Source glTF packages are never requested from the web at
 * runtime, which keeps the scene suitable for GitHub Pages and Quest browsers.
 */
export async function createAssetLandscape(scene, getGroundHeight) {
  const libraries = await loadLocalLibraries(scene);
  const placed = [];

  placeAll(scene, libraries.rockMoss, rockMossPlacements, "moss-rock", placed, getGroundHeight);
  placeAll(scene, libraries.rockWeathered, weatheredRockPlacements, "weathered-rock", placed, getGroundHeight);
  placeAll(scene, libraries.fern, fernPlacements, "fern", placed, getGroundHeight);
  placeAll(scene, libraries.moss, mossPlacements, "moss", placed, getGroundHeight);
  placeAll(scene, libraries.grass, grassPlacements, "grass", placed, getGroundHeight);
  placeAll(scene, libraries.shrub, shrubPlacements, "shrub", placed, getGroundHeight);

  return {
    placed,
    shadowCasters: placed.flatMap((entry) => entry.meshes),
    // Water reflections keep only large rock silhouettes. Rendering every grass
    // and fern cluster again would be wasteful on standalone VR hardware.
    reflectors: placed
      .filter((entry) => entry.prefix.includes("rock"))
      .flatMap((entry) => entry.meshes),
  };
}

async function loadLocalLibraries(scene) {
  const [rockMoss, rockWeathered, fern, moss, grass, shrub] = await Promise.all([
    loadLibrary(scene, "./assets/models/rocks/rock_moss_set_01/", "rock_moss_set_01_1k.gltf"),
    loadLibrary(scene, "./assets/models/rocks/rock_07/", "rock_07_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/fern_02/", "fern_02_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/moss_01/", "moss_01_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/grass_bermuda_01/", "grass_bermuda_01_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/shrub_02/", "shrub_02_1k.gltf"),
  ]);
  return { rockMoss, rockWeathered, fern, moss, grass, shrub };
}

async function loadLibrary(scene, rootUrl, fileName) {
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene);
  container.lights.forEach((light) => light.dispose());
  container.cameras.forEach((camera) => camera.dispose());
  container.animationGroups.forEach((group) => group.stop());
  return container;
}

function placeAll(scene, library, placements, prefix, placed, getGroundHeight) {
  placements.forEach((placement, index) => {
    const instance = library.instantiateModelsToScene((name) => `${prefix}-${index}-${name}`, false);
    const anchor = new BABYLON.TransformNode(`${prefix}-${index}-anchor`, scene);
    anchor.position.set(
      placement.x,
      getGroundHeight(placement.x, placement.z) + (placement.yOffset ?? 0),
      placement.z,
    );
    anchor.rotation.y = placement.rotation ?? 0;
    anchor.scaling.set(placement.scale[0], placement.scale[1], placement.scale[2]);

    const meshes = instance.rootNodes.flatMap((root) => {
      root.parent = anchor;
      return root.getChildMeshes(false);
    });
    meshes.forEach((mesh) => {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.alwaysSelectAsActiveMesh = true;
    });
    placed.push({ anchor, meshes, prefix });
  });
}

const rockMossPlacements = [
  { x: -3.9, z: -8.3, scale: [2.9, 2.6, 2.8], rotation: 0.4 },
  { x: 4.7, z: -7.5, scale: [3.8, 3.2, 3.2], rotation: 2.2 },
  { x: -9.8, z: -1.3, scale: [3.4, 3.1, 3.5], rotation: 5.3 },
  { x: 8.6, z: 1.7, scale: [3.9, 3.2, 3.4], rotation: 1.1 },
  { x: -12.5, z: 5.4, scale: [4.1, 3.6, 3.8], rotation: 4.7 },
  { x: 12.8, z: -7.7, scale: [4.5, 3.9, 4.1], rotation: 2.5 },
  { x: 20.8, z: -7.8, scale: [5.2, 4.7, 4.8], rotation: 0.5 },
  { x: 13.4, z: -15.1, scale: [4.4, 4.1, 4.1], rotation: 4.2 },
];

const weatheredRockPlacements = [
  { x: -1.7, z: -8.7, scale: [7.8, 6.3, 7.4], rotation: 1.1 },
  { x: 6.3, z: -6.4, scale: [8.2, 6.7, 7.6], rotation: 4.5 },
  { x: -14.6, z: 0.6, scale: [9.1, 7.2, 8.2], rotation: 2.8 },
  { x: 14.0, z: 3.1, scale: [10.2, 8.5, 9.3], rotation: 0.8 },
  { x: -8.5, z: 13.5, scale: [8.7, 7.0, 8.1], rotation: 5.5 },
];

const fernPlacements = [
  { x: -2.8, z: -7.2, scale: [2.2, 2.2, 2.2], rotation: 0.4 },
  { x: -4.8, z: -6.7, scale: [1.8, 1.8, 1.8], rotation: 2.6 },
  { x: 3.8, z: -7.2, scale: [2.0, 2.0, 2.0], rotation: 4.5 },
  { x: 6.7, z: -6.3, scale: [2.3, 2.3, 2.3], rotation: 1.4 },
  { x: -9.1, z: -1.4, scale: [2.5, 2.5, 2.5], rotation: 3.3 },
  { x: -11.3, z: 0.2, scale: [2.1, 2.1, 2.1], rotation: 5.8 },
  { x: -13.1, z: 5.9, scale: [2.5, 2.5, 2.5], rotation: 2.2 },
  { x: 8.3, z: 2.3, scale: [2.6, 2.6, 2.6], rotation: 0.8 },
  { x: 12.6, z: -8.2, scale: [2.6, 2.6, 2.6], rotation: 2.7 },
  { x: 20.0, z: -8.1, scale: [3.0, 3.0, 3.0], rotation: 4.9 },
  { x: 10.5, z: -14.2, scale: [2.4, 2.4, 2.4], rotation: 1.3 },
  { x: -9.0, z: 12.5, scale: [2.5, 2.5, 2.5], rotation: 3.7 },
];

const mossPlacements = [
  { x: -3.8, z: -8.1, scale: [2.8, 2.0, 2.8], rotation: 0.2 },
  { x: 4.6, z: -7.2, scale: [3.3, 2.4, 3.3], rotation: 2.2 },
  { x: -10.3, z: -0.8, scale: [3.2, 2.3, 3.2], rotation: 4.8 },
  { x: 8.3, z: 1.9, scale: [3.5, 2.5, 3.5], rotation: 1.6 },
  { x: -12.7, z: 5.2, scale: [4.0, 2.8, 4.0], rotation: 5.3 },
  { x: 12.7, z: -7.5, scale: [4.0, 2.8, 4.0], rotation: 0.7 },
  { x: 20.8, z: -7.5, scale: [4.8, 3.2, 4.8], rotation: 3.6 },
];

const grassPlacements = [
  { x: -1.2, z: -8.0, scale: [1.7, 1.7, 1.7], rotation: 0.1 },
  { x: -5.7, z: -5.5, scale: [1.9, 1.9, 1.9], rotation: 2.1 },
  { x: 1.9, z: -8.5, scale: [1.7, 1.7, 1.7], rotation: 4.4 },
  { x: 7.5, z: -5.0, scale: [2.0, 2.0, 2.0], rotation: 0.8 },
  { x: -8.5, z: -2.6, scale: [2.1, 2.1, 2.1], rotation: 3.8 },
  { x: -11.2, z: 3.6, scale: [1.8, 1.8, 1.8], rotation: 1.9 },
  { x: -13.5, z: 6.8, scale: [2.2, 2.2, 2.2], rotation: 5.1 },
  { x: 7.3, z: 3.6, scale: [2.0, 2.0, 2.0], rotation: 3.0 },
  { x: 14.8, z: -7.2, scale: [2.2, 2.2, 2.2], rotation: 4.4 },
  { x: 19.0, z: -9.4, scale: [2.6, 2.6, 2.6], rotation: 0.9 },
  { x: 12.3, z: -14.1, scale: [2.1, 2.1, 2.1], rotation: 2.6 },
  { x: -6.3, z: 12.0, scale: [2.1, 2.1, 2.1], rotation: 5.2 },
];

const shrubPlacements = [
  { x: -16.8, z: 2.9, scale: [2.8, 2.8, 2.8], rotation: 1.2 },
  { x: -13.7, z: 8.4, scale: [3.2, 3.2, 3.2], rotation: 4.1 },
  { x: -7.9, z: 14.7, scale: [3.1, 3.1, 3.1], rotation: 0.5 },
  { x: 8.7, z: 12.0, scale: [3.3, 3.3, 3.3], rotation: 3.2 },
  { x: 14.9, z: 5.4, scale: [3.7, 3.7, 3.7], rotation: 5.6 },
  { x: 21.2, z: -4.8, scale: [4.0, 4.0, 4.0], rotation: 2.3 },
  { x: 17.5, z: -14.6, scale: [3.6, 3.6, 3.6], rotation: 1.7 },
  { x: -14.1, z: -10.4, scale: [3.0, 3.0, 3.0], rotation: 4.7 },
];
