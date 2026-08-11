import { createDesktopCamera } from "../camera/createDesktopCamera.js";
import { createIdyllEnvironment } from "../environment/createIdyllEnvironment.js";
import { createOrganicTunnel } from "../tunnel/createOrganicTunnel.js";
import { clearTunnelTerrain } from "../tunnel/clearTunnelTerrain.js";
import { createIdyllTunnelTransition } from "../tunnel/createIdyllTunnelTransition.js";
import { createSuctionDebris } from "../tunnel/createSuctionDebris.js";
import { createWhiteRoom } from "../whiteRoom/createWhiteRoom.js";
import { createWhiteRoomTone } from "../audio/createWhiteRoomTone.js";

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
  // Match the final tunnel travel position so the hand-off into the void has
  // no lateral jump before the controlled vertical fall begins.
  const whiteRoom = createWhiteRoom(scene, tunnel.route.positionAt(0.986));
  const whiteRoomTone = createWhiteRoomTone();
  const suctionDebris = createSuctionDebris(scene, environment.architecture.entrance);
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
    suctionDebris,
  });
  scene.metadata = { environment, desktopCamera, tunnel, transition, whiteRoom, whiteRoomTone, suctionDebris };

  return scene;
}
