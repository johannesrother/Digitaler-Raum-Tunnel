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

  const ivoryArchitecture = createIvoryMaterial(scene, "ivory-sculptural-architecture", "#eadcc5");
  ivoryArchitecture.backFaceCulling = false;

  const ivoryInterior = ivoryArchitecture.clone("ivory-sculptural-interior");
  ivoryInterior.albedoColor = BABYLON.Color3.FromHexString("#d9cbb8");
  ivoryInterior.environmentIntensity = 0.24;
  ivoryInterior.roughness = 0.9;

  return { terrain, mixedGround, ivoryArchitecture, ivoryInterior };
}

/** Matte warm mineral response, deliberately free of a noisy rock texture. */
function createIvoryMaterial(scene, name, color) {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoColor = BABYLON.Color3.FromHexString(color);
  material.metallic = 0;
  material.roughness = 0.83;
  material.environmentIntensity = 0.4;
  material.specularIntensity = 0.22;
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
