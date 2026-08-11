import { createDesktopCamera } from "../camera/createDesktopCamera.js";
import { createIdyllEnvironment } from "../environment/createIdyllEnvironment.js";
import { createOrganicTunnel } from "../tunnel/createOrganicTunnel.js";
import { clearTunnelTerrain } from "../tunnel/clearTunnelTerrain.js";
import { createIdyllTunnelTransition } from "../tunnel/createIdyllTunnelTransition.js";
import { createWhiteRoom } from "../whiteRoom/createWhiteRoom.js";
import { createWhiteRoomTone } from "../audio/createWhiteRoomTone.js";
import { createTunnelAmbience } from "../audio/createTunnelAmbience.js";

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
  clearTunnelTerrain(
    [environment.terrain.terrain, environment.terrain.distantHorizon],
    tunnel.route,
  );
  environment.lighting.excludeFromTunnel(tunnel.mesh);
  environment.lighting.excludeFromTunnel(tunnel.floor);
  tunnel.grassPatches.forEach((patch) => environment.lighting.excludeFromTunnel(patch));
  const tunnelExit = tunnel.route.positionAt(0.986);
  const exitDirection = tunnel.route.tangentAt(0.986);
  exitDirection.y = 0;
  exitDirection.normalize();
  const whiteRoom = createWhiteRoom(scene, tunnelExit, exitDirection);
  const whiteRoomTone = createWhiteRoomTone();
  const tunnelAmbience = createTunnelAmbience();
  const transition = createIdyllTunnelTransition(scene, {
    startPosition: environment.startPosition,
    entrance: environment.architecture.entrance,
    breeze: environment.breeze,
    desktopCamera,
    tunnel,
    entranceFade: environment.architecture.tunnel.fade,
    outsideGroundMeshes: [environment.terrain.terrain, environment.terrain.distantHorizon],
    initialForward: desktopCamera.getForwardRay(1).direction.clone(),
    whiteRoom,
    whiteRoomTone,
    tunnelAmbience,
  });
  scene.metadata = { environment, desktopCamera, tunnel, transition, whiteRoom, whiteRoomTone, tunnelAmbience };

  return scene;
}
