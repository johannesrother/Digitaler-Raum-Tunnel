import { createOrganicSurface } from "./geometry.js";

/** Calm shallow pools reinforce depth without introducing dramatic movement. */
export function createWater(scene, materials, getGroundHeight) {
  const waterMaterial = createWaterMaterial(scene);
  const pools = [
    { x: -10.5, z: -2.8, radiusX: 4.2, radiusZ: 2.2, seed: 401 },
    { x: -5.4, z: 8.4, radiusX: 3.3, radiusZ: 1.55, seed: 402 },
    { x: 4.6, z: 11.9, radiusX: 3.8, radiusZ: 1.8, seed: 403 },
    { x: 11.6, z: -3.4, radiusX: 3.15, radiusZ: 1.65, seed: 404 },
    { x: -10.2, z: -12.5, radiusX: 3.7, radiusZ: 1.9, seed: 405 },
    { x: 15.2, z: 6.3, radiusX: 2.9, radiusZ: 1.45, seed: 406 },
  ].map((definition, index) => {
    const pool = createOrganicSurface(scene, `still-pool-${index}`, {
      center: new BABYLON.Vector3(
        definition.x,
        getGroundHeight(definition.x, definition.z) + 0.045,
        definition.z,
      ),
      radiusX: definition.radiusX,
      radiusZ: definition.radiusZ,
      segments: 56,
      irregularity: 0.16,
      seed: definition.seed,
    });
    pool.material = waterMaterial;
    pool.isPickable = false;
    return pool;
  });

  const stream = createQuietStream(scene, waterMaterial, getGroundHeight);
  return {
    pools,
    stream,
    configureReflections(meshes) {
      meshes.forEach((mesh) => waterMaterial.addToRenderList(mesh));
    },
  };
}

function createWaterMaterial(scene) {
  const material = new BABYLON.WaterMaterial(
    "quiet-reflective-water",
    scene,
    new BABYLON.Vector2(256, 256),
  );
  material.bumpTexture = createRippleNormal(scene);
  material.windForce = 0.22;
  material.waveHeight = 0.012;
  material.bumpHeight = 0.05;
  material.waveLength = 0.42;
  material.windDirection = new BABYLON.Vector2(0.25, 0.68);
  material.waterColor = BABYLON.Color3.FromHexString("#708e89");
  material.colorBlendFactor = 0.32;
  material.fresnelLevel = 0.52;
  material.specularPower = 128;
  material.backFaceCulling = false;
  return material;
}

function createRippleNormal(scene) {
  const texture = new BABYLON.DynamicTexture("water-ripple-normal", { width: 128, height: 128 }, scene, false);
  const context = texture.getContext();
  context.fillStyle = "#8080ff";
  context.fillRect(0, 0, 128, 128);
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 37) % 128;
    const y = (index * 61) % 128;
    const radius = 3 + ((index * 11) % 12);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, "rgba(180, 110, 255, 0.52)");
    gradient.addColorStop(0.5, "rgba(80, 160, 255, 0.22)");
    gradient.addColorStop(1, "rgba(128, 128, 255, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  texture.update(false);
  return texture;
}

function createQuietStream(scene, material, getGroundHeight) {
  const route = [
    { x: -7.4, z: -7.2, width: 0.7 },
    { x: -7, z: -4.7, width: 0.92 },
    { x: -6.4, z: -2.2, width: 0.8 },
    { x: -6.8, z: 0.3, width: 1.05 },
    { x: -6.1, z: 2.8, width: 0.82 },
    { x: -5.4, z: 5.4, width: 0.68 },
    { x: -5.7, z: 8.4, width: 0.88 },
  ];
  const leftBank = [];
  const rightBank = [];

  route.forEach((point, index) => {
    const before = route[Math.max(0, index - 1)];
    const after = route[Math.min(route.length - 1, index + 1)];
    const direction = new BABYLON.Vector3(after.x - before.x, 0, after.z - before.z).normalize();
    const perpendicular = new BABYLON.Vector3(-direction.z, 0, direction.x);
    const y = getGroundHeight(point.x, point.z) + 0.052;
    leftBank.push(new BABYLON.Vector3(point.x + perpendicular.x * point.width, y, point.z + perpendicular.z * point.width));
    rightBank.push(new BABYLON.Vector3(point.x - perpendicular.x * point.width, y, point.z - perpendicular.z * point.width));
  });

  const stream = BABYLON.MeshBuilder.CreateRibbon(
    "shallow-winding-stream",
    { pathArray: [leftBank, rightBank], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  stream.material = material;
  stream.isPickable = false;
  return stream;
}
