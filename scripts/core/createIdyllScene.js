import { createDesktopCamera } from "../camera/createDesktopCamera.js";
import { createIdyllEnvironment } from "../environment/createIdyllEnvironment.js";
import { createOrganicTunnel } from "../tunnel/createOrganicTunnel.js";
import { createIdyllTunnelTransition } from "../tunnel/createIdyllTunnelTransition.js";

/** Creates the static, standing-height idyll scene. WebXR is added separately. */
export async function createIdyllScene(engine, canvas) {
  const scene = new BABYLON.Scene(engine);
  scene.skipPointerMovePicking = true;

  const environment = await createIdyllEnvironment(scene);
  const desktopCamera = createDesktopCamera(scene, canvas, environment.startPosition);
  const tunnel = createOrganicTunnel(scene, {
    entrance: environment.architecture.entrance,
    grassMaterial: environment.materials.terrain,
    getGroundHeight: environment.terrain.getGroundHeight,
  });
  environment.lighting.excludeFromTunnel(tunnel.mesh);
  environment.lighting.excludeFromTunnel(tunnel.floor);
  tunnel.grassPatches.forEach((patch) => environment.lighting.excludeFromTunnel(patch));
  const transition = createIdyllTunnelTransition(scene, {
    startPosition: environment.startPosition,
    entrance: environment.architecture.entrance,
    breeze: environment.breeze,
    desktopCamera,
    tunnel,
    entranceFade: environment.architecture.tunnel.fade,
    initialForward: desktopCamera.getForwardRay(1).direction.clone(),
  });
  scene.metadata = { environment, desktopCamera, tunnel, transition };

  return scene;
}
