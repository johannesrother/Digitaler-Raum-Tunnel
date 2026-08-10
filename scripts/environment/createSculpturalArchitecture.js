/**
 * A few broad, non-repeating mineral ribbons establish the world-scale
 * biomorphic silhouette. They are lofted along irregular 3D paths instead of
 * being assembled from torus, cylinder or box primitives.
 */
export function createSculpturalArchitecture(scene, materials, getGroundHeight) {
  const ribbons = [
    createMineralRibbon(scene, "left-sculptural-ribbon", [
      point(-18, -8, 0),
      point(-18.8, -3.5, 4.3),
      point(-15.2, 2.4, 8.9),
      point(-8.7, 7.1, 10.8),
      point(-2.8, 8.8, 8.2),
    ], 1.02, 271, materials.mineral, getGroundHeight),
    createMineralRibbon(scene, "far-sculptural-ribbon", [
      point(-8.4, 14.5, 0),
      point(-5.2, 13.6, 5.1),
      point(0.6, 13.1, 8.6),
      point(7.8, 11.8, 7.4),
      point(12.5, 8.4, 3.2),
    ], 0.86, 417, materials.mineralWeathered, getGroundHeight),
    createMineralRibbon(scene, "right-sculptural-ribbon", [
      point(17.8, -9.4, 0),
      point(18.9, -5.1, 5.2),
      point(16.6, -0.5, 9.8),
      point(12.7, 3.8, 11.7),
      point(8.9, 6.6, 10.1),
    ], 0.94, 609, materials.mineral, getGroundHeight),
  ];

  return { ribbons, shadowCasters: ribbons };
}

function point(x, z, height) {
  return { x, z, height };
}

function createMineralRibbon(scene, name, controls, thickness, seed, material, getGroundHeight) {
  const path = sampleSpline(controls, getGroundHeight, 38);
  const sides = 10;
  const positions = [];
  const indices = [];
  const uvs = [];

  path.forEach((center, index) => {
    const before = path[Math.max(0, index - 1)];
    const after = path[Math.min(path.length - 1, index + 1)];
    const tangent = after.subtract(before).normalize();
    const horizontal = BABYLON.Vector3.Cross(tangent, BABYLON.Axis.Y).normalize();
    const normal = BABYLON.Vector3.Cross(horizontal, tangent).normalize();
    const progress = index / (path.length - 1);
    const taper = 0.68 + Math.sin(progress * Math.PI) * 0.58;

    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const undulation = 1 + Math.sin(progress * 13.2 + angle * 3.4 + seed) * 0.12;
      const broad = thickness * taper * undulation;
      const lateral = Math.cos(angle) * broad * 0.76;
      const vertical = Math.sin(angle) * broad * 1.38;
      positions.push(
        center.x + horizontal.x * lateral + normal.x * vertical,
        center.y + horizontal.y * lateral + normal.y * vertical,
        center.z + horizontal.z * lateral + normal.z * vertical,
      );
      uvs.push(progress * 2.4, side / sides);
    }
  });

  for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const current = pathIndex * sides + side;
      const nextPath = (pathIndex + 1) * sides + side;
      const currentNext = pathIndex * sides + next;
      const nextPathNext = (pathIndex + 1) * sides + next;
      indices.push(current, nextPath, nextPathNext, current, nextPathNext, currentNext);
    }
  }

  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new BABYLON.Mesh(name, scene);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}

function sampleSpline(controls, getGroundHeight, samples) {
  const path = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const segmentProgress = progress * (controls.length - 1);
    const segment = Math.min(controls.length - 2, Math.floor(segmentProgress));
    const local = segmentProgress - segment;
    const a = controls[Math.max(0, segment - 1)];
    const b = controls[segment];
    const c = controls[segment + 1];
    const d = controls[Math.min(controls.length - 1, segment + 2)];
    const x = catmull(a.x, b.x, c.x, d.x, local);
    const z = catmull(a.z, b.z, c.z, d.z, local);
    const height = catmull(a.height, b.height, c.height, d.height, local);
    path.push(new BABYLON.Vector3(x, getGroundHeight(x, z) + height, z));
  }
  return path;
}

function catmull(a, b, c, d, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}
