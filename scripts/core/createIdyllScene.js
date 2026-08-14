import { createDesktopCamera } from "../camera/createDesktopCamera.js";
import { createIdyllEnvironment } from "../environment/createIdyllEnvironment.js";
import { createGlbIdyll } from "../environment/createGlbIdyll.js";
import { createOrganicTunnel } from "../tunnel/createOrganicTunnel.js";
import { clearTunnelTerrain, removeIdyllObjectsFromTunnel } from "../tunnel/clearTunnelTerrain.js";
import { createIdyllTunnelTransition } from "../tunnel/createIdyllTunnelTransition.js";
import { createWhiteRoom } from "../whiteRoom/createWhiteRoom.js";
import { createWhiteRoomTone } from "../audio/createWhiteRoomTone.js";

/** Creates the static, standing-height idyll scene. WebXR is added separately. */
export async function createIdyllScene(engine, canvas) {
  const scene = new BABYLON.Scene(engine);
  scene.skipPointerMovePicking = true;

  const environment = await createIdyllEnvironment(scene);
  const glbIdyll = await createGlbIdyll(scene, environment.startPosition);
  disableOldIdyllVisuals(environment);
  const desktopCamera = createDesktopCamera(scene, canvas, glbIdyll.startPosition);
  const tunnel = createOrganicTunnel(scene, {
    entrance: environment.architecture.entrance,
    grassMaterial: environment.materials.terrain,
    getGroundHeight: environment.terrain.getGroundHeight,
  });
  clearTunnelTerrain(
    [
      environment.terrain.terrain,
      environment.terrain.distantHorizon,
      ...environment.terrain.groundCoverZones,
    ],
    tunnel.route,
  );
  removeIdyllObjectsFromTunnel(environment.assets.placed, tunnel.route);
  environment.lighting.excludeFromTunnel(tunnel.mesh);
  const tunnelExit = tunnel.route.positionAt(0.986);
  const exitDirection = tunnel.route.tangentAt(0.986);
  exitDirection.y = 0;
  exitDirection.normalize();
  const whiteRoom = createWhiteRoom(scene, tunnelExit, exitDirection);
  const whiteRoomTone = createWhiteRoomTone();
  const transition = createIdyllTunnelTransition(scene, {
    startPosition: glbIdyll.startPosition,
    entrance: environment.architecture.entrance,
    desktopCamera,
    tunnel,
    tunnelEntrance: environment.architecture.tunnel,
    entranceFade: environment.architecture.tunnel.fade,
    initialForward: desktopCamera.getForwardRay(1).direction.clone(),
    whiteRoom,
    whiteRoomTone,
    idyllWorldMeshes: scene.meshes.filter((mesh) => (
      mesh !== tunnel.mesh && mesh.name !== "white-room-endless-void"
    )),
    previousWorldMeshes: scene.meshes.filter((mesh) => mesh.name !== "white-room-endless-void"),
    previousWorldLights: [...scene.lights],
  });
  scene.metadata = {
    environment,
    glbIdyll,
    desktopCamera,
    tunnel,
    transition,
    whiteRoom,
    whiteRoomTone,
  };

  return scene;
}

function disableOldIdyllVisuals(environment) {
  [
    environment.lighting.sky,
    environment.terrain.terrain,
    environment.terrain.distantHorizon,
    ...environment.terrain.groundCoverZones,
    ...environment.water.pools,
    environment.water.stream,
    ...environment.assets.placed.flatMap((entry) => entry.meshes),
  ].forEach((mesh) => mesh.setEnabled(false));
}
