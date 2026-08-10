/**
 * Shared PBR ground materials from the approved Idyll Asset Kit V1.
 * The large terrain uses grass; small irregular bank zones use mixed ground.
 */
export function createIdyllMaterials(scene) {
  const terrain = createPbrMaterial(scene, "kit-grass-ground-pbr", {
    base: "./assets/textures/ground/grass001/Grass001_1K-JPG_Color.jpg",
    normal: "./assets/textures/ground/grass001/Grass001_1K-JPG_NormalGL.jpg",
    roughness: "./assets/textures/ground/grass001/Grass001_1K-JPG_Roughness.jpg",
    ambient: "./assets/textures/ground/grass001/Grass001_1K-JPG_AmbientOcclusion.jpg",
    color: "#d4e0b8",
    roughnessValue: 0.92,
    tiling: 8,
    environmentIntensity: 0.22,
  });

  const mixedGround = createPbrMaterial(scene, "kit-mixed-ground-pbr", {
    base: "./assets/textures/ground/ground003/Ground003_1K-JPG_Color.jpg",
    normal: "./assets/textures/ground/ground003/Ground003_1K-JPG_NormalGL.jpg",
    roughness: "./assets/textures/ground/ground003/Ground003_1K-JPG_Roughness.jpg",
    color: "#d8cfab",
    roughnessValue: 0.95,
    tiling: 1.9,
    environmentIntensity: 0.18,
  });

  const ivoryArchitecture = createIvoryArchitectureMaterial(scene, "ivory-sculptural-architecture", {
    color: "#fff8ea",
    tiling: 3.6,
    environmentIntensity: 0.26,
    roughness: 0.82,
    normalStrength: 0.16,
  });
  ivoryArchitecture.backFaceCulling = false;

  const ivoryInterior = ivoryArchitecture.clone("ivory-sculptural-interior");
  ivoryInterior.albedoColor = BABYLON.Color3.FromHexString("#f5e1c3");
  ivoryInterior.environmentIntensity = 0.28;
  ivoryInterior.roughness = 0.87;
  ivoryInterior.emissiveColor = BABYLON.Color3.FromHexString("#3a2009");

  const ivoryInteriorFade = ivoryInterior.clone("ivory-threshold-light-fade");
  ivoryInteriorFade.albedoColor = BABYLON.Color3.FromHexString("#ead0a8");
  ivoryInteriorFade.environmentIntensity = 0.14;
  ivoryInteriorFade.emissiveColor = BABYLON.Color3.FromHexString("#211104");

  return { terrain, mixedGround, ivoryArchitecture, ivoryInterior, ivoryInteriorFade };
}

/**
 * Fine CC0 mineral maps add tactile detail while the warm albedo tint keeps
 * the architecture in the ivory/cream range under the approved sunset light.
 */
function createIvoryArchitectureMaterial(scene, name, options) {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoTexture = createTexture(
    scene,
    "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_color.jpg",
    options.tiling,
    true,
  );
  material.bumpTexture = createTexture(
    scene,
    "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_normalgl.jpg",
    options.tiling,
    false,
  );
  material.bumpTexture.level = options.normalStrength;
  material.metallicTexture = createTexture(
    scene,
    "./assets/textures/architecture/ivory-mineral/ivory_mineral_1k_roughness.jpg",
    options.tiling,
    false,
  );
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.albedoColor = BABYLON.Color3.FromHexString(options.color);
  material.metallic = 0;
  material.roughness = options.roughness;
  material.environmentIntensity = options.environmentIntensity;
  material.specularIntensity = 0.14;
  material.emissiveColor = BABYLON.Color3.FromHexString("#120802");
  material.backFaceCulling = false;
  return material;
}

function createPbrMaterial(scene, name, options) {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoTexture = createTexture(scene, options.base, options.tiling, true);
  material.bumpTexture = createTexture(scene, options.normal, options.tiling, false);
  material.metallicTexture = createTexture(scene, options.roughness, options.tiling, false);
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.albedoColor = BABYLON.Color3.FromHexString(options.color);
  material.metallic = 0;
  material.roughness = options.roughnessValue;
  material.environmentIntensity = options.environmentIntensity;
  material.specularIntensity = 0.2;

  if (options.ambient) {
    material.ambientTexture = createTexture(scene, options.ambient, options.tiling, false);
    material.useAmbientInGrayScale = true;
  }

  return material;
}

function createTexture(scene, url, tiling, gammaSpace) {
  const texture = new BABYLON.Texture(url, scene, true, false);
  texture.uScale = tiling;
  texture.vScale = tiling;
  texture.gammaSpace = gammaSpace;
  texture.anisotropicFilteringLevel = 4;
  return texture;
}
