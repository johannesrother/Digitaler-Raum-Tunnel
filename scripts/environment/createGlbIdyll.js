const TARGET_IDYLL_SPAN = 11;

/** Loads the supplied idyll as the visible starting world without replacing its materials. */
export async function createGlbIdyll(scene, preferredStart) {
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

  // The source asset uses its horizontal plane in a Z-up basis. Convert the
  // complete imported root once, preserving every child transform uniformly.
  root.rotation.x = Math.PI / 2;
  root.computeWorldMatrix(true);
  const meshes = root.getChildMeshes(false).filter((mesh) => mesh.getTotalVertices() > 0);
  const sourceBounds = getBounds(meshes);
  const horizontalSpan = Math.max(sourceBounds.size.x, sourceBounds.size.z, 0.001);
  const scale = TARGET_IDYLL_SPAN / horizontalSpan;
  root.scaling.setAll(scale);
  root.position.set(
    -sourceBounds.center.x * scale,
    0,
    -sourceBounds.center.z * scale,
  );
  root.computeWorldMatrix(true);

  const groundMesh = meshes.find((mesh) => mesh.name === "Plane");
  if (!groundMesh) {
    throw new Error("The idylle GLB does not contain its expected ground mesh.");
  }
  groundMesh.isPickable = true;
  const startSurface = findGroundSurface(scene, groundMesh, preferredStart, getBounds(meshes));
  groundMesh.isPickable = false;
  if (!startSurface) {
    throw new Error("No idylle ground surface was found for the visitor start.");
  }
  root.position.y -= startSurface.y;
  root.computeWorldMatrix(true);

  meshes.forEach((mesh) => {
    mesh.setEnabled(true);
    mesh.isPickable = false;
    mesh.receiveShadows = false;
  });

  return {
    root,
    meshes,
    bounds: getBounds(meshes),
    scale,
    startPosition: new BABYLON.Vector3(startSurface.x, 0, startSurface.z),
    groundY: 0,
  };
}

function findGroundSurface(scene, groundMesh, preferredStart, bounds) {
  const originY = bounds.maximum.y + Math.max(10, bounds.size.y + 10);
  const offsets = [
    [0, 0],
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5],
  ];

  for (const [offsetX, offsetZ] of offsets) {
    const x = preferredStart.x + offsetX;
    const z = preferredStart.z + offsetZ;
    const ray = new BABYLON.Ray(
      new BABYLON.Vector3(x, originY, z),
      BABYLON.Vector3.Down(),
      originY - bounds.minimum.y + 10,
    );
    const hit = scene.pickWithRay(ray, (mesh) => mesh === groundMesh, false);
    if (hit?.hit && hit.pickedPoint) {
      return { x, z, y: hit.pickedPoint.y };
    }
  }

  return null;
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
