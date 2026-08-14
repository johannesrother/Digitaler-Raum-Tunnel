/**
 * A lightweight Golden Hour setup: local HDR for image-based lighting, one
 * low directional sun and a shader-driven sky dome for the visible atmosphere.
 */
export function createGoldenHourLighting(scene) {
  scene.clearColor = new BABYLON.Color4(0.58, 0.72, 0.82, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor = BABYLON.Color3.FromHexString("#c5d3da");
  scene.fogDensity = 0.011;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.06;
  scene.imageProcessingConfiguration.contrast = 1.02;

  // Used for PBR illumination and reflections only. It is not stretched into
  // the visible world as an image background.
  scene.environmentTexture = new BABYLON.HDRCubeTexture(
    "./assets/hdr/river_walk_1_1k.hdr",
    scene,
    128,
    false,
    true,
    false,
    true,
  );
  scene.environmentIntensity = 0.34;

  const skyFill = new BABYLON.HemisphericLight(
    "golden-hour-sky-fill",
    new BABYLON.Vector3(0, 1, 0),
    scene,
  );
  skyFill.intensity = 0.62;
  skyFill.diffuse = BABYLON.Color3.FromHexString("#dceaf1");
  skyFill.groundColor = BABYLON.Color3.FromHexString("#647a83");

  // A low sun keeps the light direction believable and gives vegetation depth
  // without an orange color cast across the entire scene.
  const sun = new BABYLON.DirectionalLight(
    "golden-hour-sun",
    new BABYLON.Vector3(-0.68, -0.42, 0.42),
    scene,
  );
  sun.position = new BABYLON.Vector3(34, 18, -22);
  sun.intensity = 1.52;
  sun.diffuse = BABYLON.Color3.FromHexString("#ffd6a6");
  sun.autoCalcShadowZBounds = true;

  const sky = createGoldenHourSky(scene, sun.direction.scale(-1));
  const shadows = new BABYLON.ShadowGenerator(1024, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 18;
  shadows.setDarkness(0.24);

  return {
    sky,
    sun,
    skyFill,
    addShadowCasters(meshes) {
      meshes.forEach((mesh) => shadows.addShadowCaster(mesh, true));
    },
    excludeFromTunnel(mesh) {
      sun.excludedMeshes.push(mesh);
      skyFill.excludedMeshes.push(mesh);
    },
    freeze() {
      shadows.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    },
  };
}

/**
 * A compact analytic sky: blue at the zenith, cream/gold at the horizon, a
 * restrained sun halo and barely visible cloud wisps. No panorama is used.
 */
function createGoldenHourSky(scene, sunDirection) {
  BABYLON.Effect.ShadersStore["idyllGoldenHourSkyVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vDirection;
    void main(void) {
      vDirection = normalize(position);
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;
  BABYLON.Effect.ShadersStore["idyllGoldenHourSkyFragmentShader"] = `
    precision highp float;
    varying vec3 vDirection;
    uniform vec3 sunDirection;

    float hazeBand(vec2 p) {
      float broad = sin(p.x * 2.1 + p.y * 1.3) * 0.5 + 0.5;
      float fine = sin(p.x * 7.3 - p.y * 3.7) * 0.5 + 0.5;
      return smoothstep(0.74, 0.92, broad * 0.72 + fine * 0.28);
    }

    void main(void) {
      vec3 direction = normalize(vDirection);
      // A direction on the physical horizon has y = 0. Offset that value so
      // the warm horizon palette remains at eye level instead of becoming a
      // second mid-blue band.
      float height = clamp(direction.y + 0.14, 0.0, 1.0);
      float skyBlend = smoothstep(0.36, 0.9, height);
      vec3 horizon = vec3(1.0, 0.86, 0.71);
      vec3 middle = vec3(0.58, 0.74, 0.86);
      vec3 zenith = vec3(0.22, 0.48, 0.74);
      vec3 color = mix(horizon, middle, smoothstep(0.1, 0.58, height));
      color = mix(color, zenith, skyBlend * 0.72);

      float cloudZone = smoothstep(0.32, 0.55, height) * (1.0 - smoothstep(0.7, 0.83, height));
      float wisps = hazeBand(direction.xz * 1.8 + direction.y * 0.75);
      color = mix(color, vec3(0.97, 0.95, 0.9), wisps * cloudZone * 0.13);

      float sunDot = max(dot(direction, normalize(sunDirection)), 0.0);
      float halo = pow(sunDot, 7.0) * 0.32;
      float core = smoothstep(0.9987, 0.9996, sunDot) * 0.48;
      color += vec3(1.0, 0.67, 0.34) * halo + vec3(1.0, 0.91, 0.72) * core;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new BABYLON.ShaderMaterial(
    "analytic-golden-hour-sky",
    scene,
    { vertex: "idyllGoldenHourSky", fragment: "idyllGoldenHourSky" },
    {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "sunDirection"],
      needAlphaBlending: false,
      needAlphaTesting: false,
    },
  );
  material.setVector3("sunDirection", sunDirection.normalize());
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.fogEnabled = false;

  const sky = BABYLON.MeshBuilder.CreateSphere(
    "open-golden-hour-sky",
    { segments: 32, diameter: 360, sideOrientation: BABYLON.Mesh.BACKSIDE },
    scene,
  );
  sky.material = material;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  return sky;
}
