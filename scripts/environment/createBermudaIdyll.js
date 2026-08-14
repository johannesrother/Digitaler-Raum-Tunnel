const MEADOW_RADIUS = 22;
const BERMUDA_INSTANCE_COUNT = 220;

/**
 * Creates the single visible idyll world: a textured meadow with instanced
 * Bermuda grass in front of the supplied Vondelpark panorama.
 */
export async function createBermudaIdyll(scene, startPosition) {
  const previousEnvironmentTexture = scene.environmentTexture;
  const world = new BABYLON.TransformNode("bermuda-idyll-world", scene);
  const panorama = createVondelparkPanorama(scene);
  panorama.parent = world;
  const ground = createMeadowGround(scene, startPosition);
  ground.parent = world;
  const grass = await createBermudaGrass(scene, world, startPosition);
  const flowers = await createFlowerGroups(scene, world);

  return {
    world,
    panorama,
    ground,
    grass,
    flowers,
    startPosition: new BABYLON.Vector3(startPosition.x, 0, startPosition.z),
    groundY: 0,
    meadowRadius: MEADOW_RADIUS,
    hide() {
      world.setEnabled(false);
      panorama.setEnabled(false);
      // Tunnel materials return to the project's existing neutral HDR state;
      // the Vondelpark image no longer contributes after the portal closes.
      if (scene.environmentTexture === panorama.metadata.environmentTexture) {
        scene.environmentTexture = previousEnvironmentTexture;
      }
    },
  };
}

function createVondelparkPanorama(scene) {
  const texture = new BABYLON.HDRCubeTexture(
    "./assets/idylle/sunny_vondelpark_2k.hdr",
    scene,
    256,
    false,
    true,
    false,
    true,
  );
  texture.rotationY = Math.PI;
  scene.environmentTexture = texture;
  scene.environmentIntensity = 0.42;

  const material = new BABYLON.StandardMaterial("sunny-vondelpark-panorama-material", scene);
  material.reflectionTexture = texture;
  material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.fogEnabled = false;
  const panorama = BABYLON.MeshBuilder.CreateBox(
    "sunny-vondelpark-360-background",
    { size: 900 },
    scene,
  );
  panorama.material = material;
  panorama.infiniteDistance = true;
  panorama.isPickable = false;
  panorama.alwaysSelectAsActiveMesh = true;
  panorama.metadata = { environmentTexture: texture };
  return panorama;
}

function createMeadowGround(scene, startPosition) {
  const ground = BABYLON.MeshBuilder.CreateGround(
    "bermuda-meadow-ground",
    { width: MEADOW_RADIUS * 2, height: MEADOW_RADIUS * 2, subdivisions: 48 },
    scene,
  );
  const material = new BABYLON.PBRMaterial("bermuda-meadow-ground-material", scene);
  material.albedoTexture = new BABYLON.Texture(
    "./assets/textures/ground/grass001/Grass001_1K-JPG_Color.jpg",
    scene,
  );
  material.albedoTexture.uScale = 13;
  material.albedoTexture.vScale = 13;
  material.bumpTexture = new BABYLON.Texture(
    "./assets/textures/ground/grass001/Grass001_1K-JPG_NormalGL.jpg",
    scene,
  );
  material.bumpTexture.uScale = 13;
  material.bumpTexture.vScale = 13;
  material.metallic = 0;
  material.roughness = 0.9;
  material.environmentIntensity = 0.34;
  ground.material = material;
  ground.position.set(startPosition.x, 0, startPosition.z);
  ground.isPickable = false;
  ground.receiveShadows = true;
  return ground;
}

async function createBermudaGrass(scene, world, startPosition) {
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
    "./assets/models/vegetation/grass_bermuda_01/",
    "grass_bermuda_01_1k.gltf",
    scene,
  );
  container.lights.forEach((light) => light.dispose());
  container.cameras.forEach((camera) => camera.dispose());
  container.addAllToScene();
  const templates = container.meshes.filter((mesh) => (
    mesh.getTotalVertices() > 0 && mesh.name.includes("medium")
  ));
  templates.forEach((template) => {
    template.parent = world;
    template.position.setAll(0);
    template.isVisible = false;
    template.isPickable = false;
    template.receiveShadows = false;
  });

  const random = createRandom(1837);
  const instances = [];
  for (let index = 0; index < BERMUDA_INSTANCE_COUNT; index += 1) {
    const radius = 2 + Math.sqrt(random()) * (MEADOW_RADIUS - 2);
    const angle = random() * Math.PI * 2;
    const template = templates[Math.floor(random() * templates.length)];
    const instance = template.createInstance(`bermuda-grass-${index}`);
    instance.parent = world;
    instance.position.set(
      startPosition.x + Math.cos(angle) * radius,
      0,
      startPosition.z + Math.sin(angle) * radius,
    );
    instance.rotation.y = random() * Math.PI * 2;
    const scale = 1.15 + random() * 0.5;
    instance.scaling.set(scale, 1.2 + random() * 0.55, scale);
    instance.isPickable = false;
    instance.receiveShadows = false;
    instances.push(instance);
  }

  return { templates, instances };
}

async function createFlowerGroups(scene, world) {
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
    "./assets/models/vegetation/flower_heliophila/",
    "flower_heliophila_1k.gltf",
    scene,
  );
  container.lights.forEach((light) => light.dispose());
  container.cameras.forEach((camera) => camera.dispose());
  const clusters = [
    [-4.2, -1.8, 0.9], [-2.4, 3.4, 1.12], [3.6, 5.2, 0.84],
    [5.1, -2.3, 0.96], [1.4, -7.1, 0.78], [-6.7, 6.6, 1.03],
  ];
  const placed = [];
  clusters.forEach(([x, z, scale], index) => {
    const instance = container.instantiateModelsToScene(
      (name) => `bermuda-flower-${index}-${name}`,
      false,
    );
    const anchor = new BABYLON.TransformNode(`bermuda-flower-${index}-anchor`, scene);
    anchor.parent = world;
    anchor.position.set(x, 0, z);
    anchor.rotation.y = index * 1.31;
    anchor.scaling.setAll(scale);
    instance.rootNodes.forEach((root) => {
      root.parent = anchor;
    });
    instance.rootNodes.flatMap((root) => root.getChildMeshes(false)).forEach((mesh) => {
      mesh.isPickable = false;
      mesh.receiveShadows = false;
    });
    placed.push(anchor);
  });
  return placed;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
