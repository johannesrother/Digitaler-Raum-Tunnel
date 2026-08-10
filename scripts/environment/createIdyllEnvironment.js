import { createGoldenHourLighting } from "../lighting/createGoldenHourLighting.js";
import { createAssetLandscape } from "./createAssetLandscape.js";
import { createOrganicArchitecture } from "./createOrganicArchitecture.js";
import { createIdyllMaterials } from "./createIdyllMaterials.js";
import { createTerrain } from "./createTerrain.js";
import { createWater } from "./createWater.js";

/** Coordinates independent environment layers without coupling them to WebXR. */
export async function createIdyllEnvironment(scene) {
  const materials = createIdyllMaterials(scene);
  const lighting = createGoldenHourLighting(scene);
  const terrain = createTerrain(scene, materials);
  const architecture = createOrganicArchitecture(scene, materials, terrain.getGroundHeight);
  const water = createWater(scene, materials, terrain.getGroundHeight);
  const assets = await createAssetLandscape(
    scene,
    terrain.getGroundHeight,
  );
  water.configureReflections([terrain.terrain, terrain.distantLandscape, ...architecture.shadowCasters, ...assets.reflectors]);

  lighting.addShadowCasters([
    ...terrain.shadowCasters,
    ...architecture.shadowCasters,
    ...assets.shadowCasters,
  ]);
  lighting.freeze();

  return {
    startPosition: terrain.startPosition,
    terrain,
    architecture,
    water,
    assets,
  };
}
