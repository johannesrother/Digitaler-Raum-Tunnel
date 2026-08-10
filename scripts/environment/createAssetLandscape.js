/**
 * The Step-1 nature layer uses only models from the approved Idyll Asset Kit.
 * A deliberately small count keeps the first review legible and Quest-safe.
 */
export async function createNaturalFoundationAssets(scene, getGroundHeight) {
  const libraries = await loadKitLibraries(scene);
  const placed = [];

  placeAll(scene, libraries.rockMoss, mossRockPlacements, "kit-moss-rock", placed, getGroundHeight);
  placeAll(scene, libraries.fern, fernPlacements, "kit-fern", placed, getGroundHeight);
  placeAll(scene, libraries.shrub, shrubPlacements, "kit-shrub", placed, getGroundHeight);
  placeAll(scene, libraries.pinkFlowers, pinkFlowerPlacements, "kit-pink-flower", placed, getGroundHeight);
  placeAll(scene, libraries.whiteFlowers, whiteFlowerPlacements, "kit-white-flower", placed, getGroundHeight);

  return {
    placed,
    shadowCasters: placed
      .filter((entry) => !entry.prefix.includes("flower"))
      .flatMap((entry) => entry.meshes),
    // Reflections deliberately include only the nearby opaque silhouettes.
    reflectors: placed
      .filter((entry) => entry.prefix.includes("moss-rock") || entry.prefix.includes("shrub"))
      .flatMap((entry) => entry.meshes),
  };
}

async function loadKitLibraries(scene) {
  const [rockMoss, fern, shrub, pinkFlowers, whiteFlowers] = await Promise.all([
    loadLibrary(scene, "./assets/models/rocks/rock_moss_set_01/", "rock_moss_set_01_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/fern_02/", "fern_02_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/shrub_01/", "shrub_01_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/periwinkle_plant/", "periwinkle_plant_1k.gltf"),
    loadLibrary(scene, "./assets/models/vegetation/flower_heliophila/", "flower_heliophila_1k.gltf"),
  ]);
  return { rockMoss, fern, shrub, pinkFlowers, whiteFlowers };
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
    anchor.rotation.set(0, placement.rotation, 0);
    anchor.scaling.set(placement.scale[0], placement.scale[1], placement.scale[2]);

    const meshes = instance.rootNodes.flatMap((root) => {
      root.parent = anchor;
      return root.getChildMeshes(false);
    });
    meshes.forEach((mesh) => {
      mesh.isPickable = false;
      mesh.receiveShadows = !prefix.includes("flower");
      mesh.alwaysSelectAsActiveMesh = true;
    });
    placed.push({ anchor, roots: instance.rootNodes, meshes, prefix });
  });
}

// The positive-x foreground stays intentionally clear for the later tunnel.
const mossRockPlacements = [
  { x: -6.2, z: -7.7, scale: [1.8, 1.55, 1.7], rotation: 0.55 },
  { x: -10.5, z: -0.6, scale: [2.15, 1.8, 2.0], rotation: 2.9 },
  { x: -13.2, z: 7.0, scale: [2.55, 2.1, 2.35], rotation: 5.1 },
  { x: -3.5, z: 12.8, scale: [1.95, 1.65, 1.85], rotation: 3.7 },
];

const fernPlacements = [
  { x: -4.7, z: -7.2, scale: [3.25, 3.25, 3.25], rotation: 0.5 },
  { x: -7.3, z: -5.3, scale: [2.7, 2.7, 2.7], rotation: 2.1 },
  { x: -9.1, z: -1.8, scale: [3.45, 3.45, 3.45], rotation: 4.6 },
  { x: -11.8, z: 1.2, scale: [2.9, 2.9, 2.9], rotation: 1.4 },
  { x: -12.5, z: 5.4, scale: [3.6, 3.6, 3.6], rotation: 3.2 },
  { x: -8.4, z: 9.8, scale: [3.05, 3.05, 3.05], rotation: 5.8 },
  { x: -2.8, z: 11.5, scale: [3.3, 3.3, 3.3], rotation: 0.9 },
  { x: 1.6, z: 14.5, scale: [3.55, 3.55, 3.55], rotation: 2.7 },
  { x: -14.5, z: -7.4, scale: [3.15, 3.15, 3.15], rotation: 4.1 },
  { x: -16.2, z: 3.7, scale: [3.8, 3.8, 3.8], rotation: 5.3 },
];

const shrubPlacements = [
  { x: -17.5, z: 1.8, scale: [1.45, 1.45, 1.45], rotation: 0.9 },
  { x: -12.0, z: 13.6, scale: [1.3, 1.3, 1.3], rotation: 3.6 },
  { x: 0.2, z: 19.0, scale: [1.45, 1.45, 1.45], rotation: 5.0 },
];

const pinkFlowerPlacements = [
  { x: -5.3, z: -6.4, scale: [2.0, 2.0, 2.0], rotation: 0.3 },
  { x: -9.4, z: 1.1, scale: [2.2, 2.2, 2.2], rotation: 2.5 },
  { x: -7.0, z: 8.4, scale: [1.9, 1.9, 1.9], rotation: 4.4 },
];

const whiteFlowerPlacements = [
  { x: -4.1, z: -8.2, scale: [1.15, 1.15, 1.15], rotation: 1.6 },
  { x: -11.8, z: 4.1, scale: [1.0, 1.0, 1.0], rotation: 5.2 },
];
