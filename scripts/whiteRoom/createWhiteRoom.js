/**
 * A seamless, emissive void for the five-second release after the tunnel.
 * The visitor is enclosed by a very large inverted sphere, so no room edges,
 * corners, lights or horizon line become readable.
 */
export function createWhiteRoom(scene, tunnelExit, exitDirection) {
  const finalPosition = tunnelExit.add(exitDirection.scale(3.2));
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
  const voidMaterial = voidMesh.material;
  let enabled = false;

  const preview = (amount) => {
    const blend = BABYLON.Scalar.Clamp(amount, 0, 1);
    if (!enabled) {
      voidMesh.setEnabled(true);
      enabled = true;
    }
    voidMaterial.alpha = blend;
    scene.clearColor = new BABYLON.Color4(
      BABYLON.Scalar.Lerp(originalClearColor.r, 1, blend),
      BABYLON.Scalar.Lerp(originalClearColor.g, 1, blend),
      BABYLON.Scalar.Lerp(originalClearColor.b, 1, blend),
      1,
    );
    scene.fogDensity = BABYLON.Scalar.Lerp(originalFogDensity, 0, blend);
  };

  return {
    finalPosition,
    preview,
    activate() {
      preview(1);
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
