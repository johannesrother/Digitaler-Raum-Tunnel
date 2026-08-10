import { createDesktopCamera } from "../camera/createDesktopCamera.js";
import { createIdyllEnvironment } from "../environment/createIdyllEnvironment.js";
import { createIdyllTunnelTransition } from "../tunnel/createIdyllTunnelTransition.js";

/** Creates the static, standing-height idyll scene. WebXR is added separately. */
export async function createIdyllScene(engine, canvas) {
  const scene = new BABYLON.Scene(engine);
  scene.skipPointerMovePicking = true;

  const environment = await createIdyllEnvironment(scene);
  const desktopCamera = createDesktopCamera(scene, canvas, environment.startPosition);
  const transition = createIdyllTunnelTransition(scene, {
    startPosition: environment.startPosition,
    entrance: environment.architecture.entrance,
    breeze: environment.breeze,
    desktopCamera,
    initialForward: desktopCamera.getForwardRay(1).direction.clone(),
  });
  scene.metadata = { environment, desktopCamera, transition };

  return scene;
}
