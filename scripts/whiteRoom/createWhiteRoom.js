/**
 * A seamless, emissive void for the five-second release after the tunnel.
 * The visitor is enclosed by a very large inverted sphere, so no room edges,
 * corners, lights or horizon line become readable.
 */
export function createWhiteRoom(scene, tunnelEnd) {
  const finalPosition = tunnelEnd.add(new BABYLON.Vector3(0, -6.2, 0));
  const voidMesh = BABYLON.MeshBuilder.CreateSphere(
    "white-room-endless-void",
    {
      diameter: 180,
      segments: 16,
      sideOrientation: BABYLON.Mesh.BACKSIDE,
    },
    scene,
  );
  voidMesh.position.copyFrom(finalPosition);
  voidMesh.material = createVoidMaterial(scene);
  voidMesh.isPickable = false;
  voidMesh.setEnabled(false);

  const originalClearColor = scene.clearColor.clone();
  const originalFogDensity = scene.fogDensity;

  return {
    finalPosition,
    activate() {
      voidMesh.setEnabled(true);
      scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);
      scene.fogDensity = 0;
    },
    dispose() {
      scene.clearColor = originalClearColor;
      scene.fogDensity = originalFogDensity;
      voidMesh.material.dispose();
      voidMesh.dispose();
    },
  };
}

function createVoidMaterial(scene) {
  const material = new BABYLON.StandardMaterial("white-room-neutral-void", scene);
  material.diffuseColor = BABYLON.Color3.White();
  material.emissiveColor = BABYLON.Color3.White();
  material.specularColor = BABYLON.Color3.Black();
  material.disableLighting = true;
  material.backFaceCulling = false;
  return material;
}
