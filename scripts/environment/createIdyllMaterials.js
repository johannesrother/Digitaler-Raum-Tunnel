import { createSeededRandom, randomRange } from "./random.js";

/**
 * Small material palette shared by all spatial layers. The only raster asset is
 * a neutral mineral surface; sky, terrain, water and vegetation stay procedural.
 */
export function createIdyllMaterials(scene) {
  const mineralTexture = new BABYLON.Texture(
    "./assets/textures/warm-mineral-v1.png",
    scene,
    true,
    false,
  );
  mineralTexture.uScale = 1.7;
  mineralTexture.vScale = 1.7;
  mineralTexture.anisotropicFilteringLevel = 4;

  const terrainTexture = createGranularTexture(scene, "terrain-grain", {
    baseColor: "#5e6b50",
    flecks: ["#3c4d3b", "#78845e", "#928065", "#b0a17a"],
    density: 980,
    seed: 8,
  });
  terrainTexture.uScale = 12;
  terrainTexture.vScale = 12;

  const mossTexture = createGranularTexture(scene, "moss-grain", {
    baseColor: "#667851",
    flecks: ["#40563c", "#819466", "#a1a879"],
    density: 850,
    seed: 77,
  });
  mossTexture.uScale = 5;
  mossTexture.vScale = 5;

  const waterTexture = createWaterTexture(scene);
  waterTexture.uScale = 2.4;
  waterTexture.vScale = 2.4;

  const mineral = createMineralMaterial(scene, "warm-mineral", mineralTexture, "#f0e4ca", 0.86);
  const mineralWeathered = createMineralMaterial(
    scene,
    "weathered-mineral",
    mineralTexture,
    "#d5c7ae",
    0.94,
  );
  const mineralInterior = createMineralMaterial(
    scene,
    "quiet-mineral-interior",
    mineralTexture,
    "#8c806f",
    0.97,
  );
  mineralInterior.environmentIntensity = 0.12;
  mineralInterior.backFaceCulling = false;

  const terrain = createTexturedMatteMaterial(scene, "soft-terrain", terrainTexture, "#a4ad82");
  const moss = createTexturedMatteMaterial(scene, "moss", mossTexture, "#9bab76");

  const water = new BABYLON.StandardMaterial("still-water", scene);
  water.diffuseTexture = waterTexture;
  water.diffuseColor = BABYLON.Color3.FromHexString("#91b5a8");
  water.emissiveColor = BABYLON.Color3.FromHexString("#55796f").scale(0.04);
  water.specularColor = BABYLON.Color3.FromHexString("#f5deb4");
  water.specularPower = 110;
  water.alpha = 0.68;
  water.backFaceCulling = false;
  water.needDepthPrePass = true;

  const bark = createMatteMaterial(scene, "soft-bark", "#65513b");
  const vine = createMatteMaterial(scene, "hanging-vine", "#36583b");
  const grass = createMatteMaterial(scene, "fine-grass", "#486b43");
  const grassLight = createMatteMaterial(scene, "sunlit-grass", "#78935b");
  const foliage = [
    createMatteMaterial(scene, "foliage-deep", "#294d36"),
    createMatteMaterial(scene, "foliage-natural", "#426b42"),
    createMatteMaterial(scene, "foliage-lit", "#6f9259"),
  ];
  const flowers = [
    createMatteMaterial(scene, "flower-petal-pink", "#dca7ad"),
    createMatteMaterial(scene, "flower-petal-cream", "#f0dfa9"),
  ];

  [grass, grassLight, vine, ...foliage, ...flowers].forEach((material) => {
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
  });

  // Only a subtle water drift keeps the pools readable; all scene objects stay static.
  scene.onBeforeRenderObservable.add(() => {
    waterTexture.uOffset = (waterTexture.uOffset + scene.getEngine().getDeltaTime() * 0.000012) % 1;
    waterTexture.vOffset = (waterTexture.vOffset + scene.getEngine().getDeltaTime() * 0.000006) % 1;
  });

  return {
    mineral,
    mineralWeathered,
    mineralInterior,
    terrain,
    moss,
    water,
    bark,
    vine,
    grass,
    grassLight,
    foliage,
    flowers,
  };
}

function createMineralMaterial(scene, name, texture, color, roughness) {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoTexture = texture;
  material.albedoColor = BABYLON.Color3.FromHexString(color);
  material.metallic = 0;
  material.roughness = roughness;
  material.environmentIntensity = 0.25;
  material.specularIntensity = 0.22;
  // Sculpted plates contain deliberately irregular radial topology; render both
  // sides so no terrain wedges disappear when looking directly down in VR.
  material.backFaceCulling = false;
  return material;
}

function createTexturedMatteMaterial(scene, name, texture, color) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.specularColor = BABYLON.Color3.Black();
  return material;
}

function createMatteMaterial(scene, name, color) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.specularColor = BABYLON.Color3.Black();
  return material;
}

function createGranularTexture(scene, name, options) {
  const texture = new BABYLON.DynamicTexture(name, { width: 256, height: 256 }, scene, false);
  const context = texture.getContext();
  const random = createSeededRandom(options.seed);

  context.fillStyle = options.baseColor;
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < options.density; index += 1) {
    const size = randomRange(random, 0.35, 2.1);
    context.globalAlpha = randomRange(random, 0.08, 0.3);
    context.fillStyle = options.flecks[Math.floor(random() * options.flecks.length)];
    context.beginPath();
    context.arc(randomRange(random, 0, 256), randomRange(random, 0, 256), size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  texture.update(false);
  return texture;
}

function createWaterTexture(scene) {
  const texture = new BABYLON.DynamicTexture("water-ripples", { width: 256, height: 256 }, scene, false);
  const context = texture.getContext();
  const random = createSeededRandom(314);

  context.fillStyle = "#719b96";
  context.fillRect(0, 0, 256, 256);
  context.lineWidth = 1;
  for (let index = 0; index < 58; index += 1) {
    const radius = randomRange(random, 3, 14);
    context.strokeStyle = index % 2 === 0 ? "rgba(255, 238, 202, 0.14)" : "rgba(34, 79, 74, 0.13)";
    context.beginPath();
    context.ellipse(
      randomRange(random, 0, 256),
      randomRange(random, 0, 256),
      radius,
      radius * randomRange(random, 0.35, 0.6),
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }
  texture.update(false);
  return texture;
}
