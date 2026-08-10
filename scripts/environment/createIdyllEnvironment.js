import { createGoldenHourLighting } from "../lighting/createGoldenHourLighting.js";
import { createOrganicArchitecture } from "./createOrganicArchitecture.js";
import { createIdyllMaterials } from "./createIdyllMaterials.js";
import { createTerrain } from "./createTerrain.js";
import { createVegetation } from "./createVegetation.js";
import { createWater } from "./createWater.js";

/** Coordinates independent environment layers without coupling them to WebXR. */
export function createIdyllEnvironment(scene) {
  const materials = createIdyllMaterials(scene);
  const lighting = createGoldenHourLighting(scene);
  const terrain = createTerrain(scene, materials);
  const architecture = createOrganicArchitecture(scene, materials, terrain.getGroundHeight);
  const water = createWater(scene, materials, terrain.getGroundHeight);
  const vegetation = createVegetation(
    scene,
    materials,
    terrain.getGroundHeight,
    architecture.vineAnchors,
  );

  lighting.addShadowCasters([
    ...terrain.shadowCasters,
    ...architecture.shadowCasters,
    ...vegetation.shadowCasters,
  ]);
  lighting.freeze();

  return {
    startPosition: terrain.startPosition,
    terrain,
    architecture,
    water,
    vegetation,
  };
}
