const TARGET_IDYLL_SPAN = 22;

/** Loads the supplied idyll as the visible starting world without replacing its materials. */
export async function createGlbIdyll(scene) {
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
    "./assets/idylle/",
    "idylle.glb",
    scene,
  );
  container.addAllToScene();

  const root = new BABYLON.TransformNode("idylle-glb-world", scene);
  container.rootNodes.forEach((node) => {
    node.parent = root;
  });

  root.computeWorldMatrix(true);
  const meshes = root.getChildMeshes(false).filter((mesh) => mesh.getTotalVertices() > 0);
  const bounds = getBounds(meshes);
  const horizontalSpan = Math.max(bounds.size.x, bounds.size.z, 0.001);
  const scale = TARGET_IDYLL_SPAN / horizontalSpan;
  root.scaling.setAll(scale);
  root.position.set(
    -bounds.center.x * scale,
    -bounds.minimum.y * scale,
    -bounds.center.z * scale,
  );
  meshes.forEach((mesh) => {
    mesh.setEnabled(true);
    mesh.isPickable = false;
    mesh.receiveShadows = false;
  });

  return { root, meshes, bounds, scale };
}

function getBounds(meshes) {
  const minimum = new BABYLON.Vector3(Infinity, Infinity, Infinity);
  const maximum = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

  meshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minimum.minimizeInPlace(box.minimumWorld);
    maximum.maximizeInPlace(box.maximumWorld);
  });

  return {
    minimum,
    maximum,
    center: minimum.add(maximum).scale(0.5),
    size: maximum.subtract(minimum),
  };
}
