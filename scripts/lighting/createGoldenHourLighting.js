/**
 * Restrained golden-hour lighting: one soft directional sun, ambient sky fill,
 * subtle fog and a single static shadow map for VR-friendly depth.
 */
export function createGoldenHourLighting(scene) {
  scene.clearColor = new BABYLON.Color4(0.72, 0.79, 0.78, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor = BABYLON.Color3.FromHexString("#b8c0a9");
  scene.fogDensity = 0.008;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.03;
  scene.imageProcessingConfiguration.contrast = 1.06;
  // This local HDR is used only for PBR reflections and ambient light. The
  // visible sky remains generated geometry, never a reference-image panorama.
  scene.environmentTexture = new BABYLON.HDRCubeTexture(
    "./assets/hdr/grasslands_sunset_1k.hdr",
    scene,
    128,
    false,
    true,
    false,
    true,
  );
  scene.environmentIntensity = 0.34;
  createProceduralSky(scene);

  const skyFill = new BABYLON.HemisphericLight(
    "golden-hour-sky-fill",
    new BABYLON.Vector3(0, 1, 0),
    scene,
  );
  skyFill.intensity = 0.72;
  skyFill.diffuse = BABYLON.Color3.FromHexString("#fff0d4");
  skyFill.groundColor = BABYLON.Color3.FromHexString("#6a765d");

  const sun = new BABYLON.DirectionalLight(
    "golden-hour-sun",
    new BABYLON.Vector3(-0.42, -0.72, 0.35),
    scene,
  );
  sun.position = new BABYLON.Vector3(18, 22, -16);
  sun.intensity = 1.72;
  sun.diffuse = BABYLON.Color3.FromHexString("#ffd29b");
  sun.autoCalcShadowZBounds = true;

  const shadows = new BABYLON.ShadowGenerator(1024, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 18;
  shadows.setDarkness(0.28);

  return {
    addShadowCasters(meshes) {
      meshes.forEach((mesh) => shadows.addShadowCaster(mesh, true));
    },
    freeze() {
      // The idyll is static, so the shadow texture only needs its initial render.
      shadows.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    },
  };
}

/** A plain generated gradient, not an image-based skybox or panorama. */
function createProceduralSky(scene) {
  const texture = new BABYLON.DynamicTexture(
    "golden-hour-procedural-sky",
    { width: 1024, height: 512 },
    scene,
    false,
  );
  const context = texture.getContext();
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#638bb1");
  gradient.addColorStop(0.46, "#b6ced3");
  gradient.addColorStop(0.7, "#f4d2a2");
  gradient.addColorStop(1, "#ffb56f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 512);
  texture.update(false);

  const material = new BABYLON.StandardMaterial("procedural-golden-hour-sky", scene);
  material.emissiveTexture = texture;
  material.emissiveColor = BABYLON.Color3.FromHexString("#ffe0bb");
  material.disableLighting = true;
  material.specularColor = BABYLON.Color3.Black();
  material.backFaceCulling = false;
  material.fogEnabled = false;

  const sky = BABYLON.MeshBuilder.CreateSphere(
    "open-golden-hour-sky",
    { segments: 32, diameter: 360, sideOrientation: BABYLON.Mesh.BACKSIDE },
    scene,
  );
  sky.material = material;
  sky.infiniteDistance = true;
  sky.isPickable = false;
}
