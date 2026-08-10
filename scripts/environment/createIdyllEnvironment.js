import { createGoldenHourLighting } from "../lighting/createGoldenHourLighting.js";
import { createNaturalFoundationAssets } from "./createAssetLandscape.js";
import { createBreeze } from "./createBreeze.js";
import { createIvoryArchitecture } from "./createOrganicArchitecture.js";
import { createIdyllMaterials } from "./createIdyllMaterials.js";
import { createTerrain } from "./createTerrain.js";
import { createWater } from "./createWater.js";

/** Coordinates independent environment layers without coupling them to WebXR. */
export async function createIdyllEnvironment(scene) {
  const materials = createIdyllMaterials(scene);
  const lighting = createGoldenHourLighting(scene);
  const terrain = createTerrain(scene, materials);
  const water = createWater(scene, materials, terrain.getGroundHeight);
  const assets = await createNaturalFoundationAssets(
    scene,
    terrain.getGroundHeight,
  );
  const architecture = createIvoryArchitecture(scene, materials, terrain.getGroundHeight);
  const breeze = createBreeze(scene, assets.placed, architecture.entrance.center);
  water.configureReflections([
    lighting.sky,
    terrain.terrain,
    terrain.distantHorizon,
    ...terrain.groundCoverZones,
    ...assets.reflectors,
    ...architecture.reflectors,
  ]);

  lighting.addShadowCasters([
    ...terrain.shadowCasters,
    ...assets.shadowCasters,
    ...architecture.shadowCasters,
  ]);
  lighting.freeze();

  return {
    startPosition: terrain.startPosition,
    materials,
    lighting,
    terrain,
    water,
    assets,
    architecture,
    breeze,
  };
}
