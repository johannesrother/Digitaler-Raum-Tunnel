/** Shared PBR materials use local, CC0 texture maps rather than painted placeholders. */
export function createIdyllMaterials(scene) {
  const terrain = createPbrMaterial(scene, "forest-ground-pbr", {
    base: "./assets/textures/ground/forest_ground_05/forest_ground_05_diff_1k.jpg",
    normal: "./assets/textures/ground/forest_ground_05/forest_ground_05_nor_gl_1k.jpg",
    roughness: "./assets/textures/ground/forest_ground_05/forest_ground_05_rough_1k.jpg",
    ambient: "./assets/textures/ground/forest_ground_05/forest_ground_05_ao_1k.jpg",
    color: "#bac290",
    roughnessValue: 0.91,
    tiling: 7.5,
    environmentIntensity: 0.3,
  });

  const mineral = createPbrMaterial(scene, "mossy-stone-pbr", {
    base: "./assets/textures/stone/white_plaster_rough_01/white_plaster_rough_01_diff_1k.jpg",
    normal: "./assets/textures/stone/white_plaster_rough_01/white_plaster_rough_01_nor_gl_1k.jpg",
    roughness: "./assets/textures/stone/white_plaster_rough_01/white_plaster_rough_01_rough_1k.jpg",
    ambient: "./assets/textures/stone/white_plaster_rough_01/white_plaster_rough_01_ao_1k.jpg",
    color: "#e8d8bb",
    roughnessValue: 0.9,
    tiling: 1.25,
    environmentIntensity: 0.38,
  });
  mineral.backFaceCulling = false;

  const mineralWeathered = mineral.clone("mossy-stone-weathered");
  mineralWeathered.albedoColor = BABYLON.Color3.FromHexString("#cfc3a7");
  mineralWeathered.roughness = 0.94;

  const mineralInterior = mineral.clone("warm-mineral-interior");
  mineralInterior.albedoColor = BABYLON.Color3.FromHexString("#776d5d");
  mineralInterior.environmentIntensity = 0.13;
  mineralInterior.roughness = 0.98;
  mineralInterior.backFaceCulling = false;

  return { terrain, mineral, mineralWeathered, mineralInterior };
}

function createPbrMaterial(scene, name, options) {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoTexture = createTexture(scene, options.base, options.tiling, true);
  material.bumpTexture = createTexture(scene, options.normal, options.tiling, false);
  material.metallicTexture = createTexture(scene, options.roughness, options.tiling, false);
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.ambientTexture = createTexture(scene, options.ambient, options.tiling, false);
  material.useAmbientInGrayScale = true;
  material.albedoColor = BABYLON.Color3.FromHexString(options.color);
  material.metallic = 0;
  material.roughness = options.roughnessValue;
  material.environmentIntensity = options.environmentIntensity;
  material.specularIntensity = 0.26;
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
