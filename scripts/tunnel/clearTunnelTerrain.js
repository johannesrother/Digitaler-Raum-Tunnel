import { TUNNEL_DURATION, getTunnelDiameter } from "./tunnelConfig.js";

/**
 * Sinks only the part of the idyll terrain that occupies the tunnel volume.
 * The terrain remains intact around the entrance, while its grass material can
 * no longer intersect the tunnel walls or appear as a floating ground plane.
 */
export function clearTunnelTerrain(terrainMeshes, route) {
  const routeSamples = Array.from({ length: 189 }, (_, index) => {
    const progress = index / 188;
    return {
      point: route.positionAt(progress),
      diameter: getTunnelDiameter(progress * TUNNEL_DURATION),
    };
  });

  terrainMeshes.filter(Boolean).forEach((terrain) => {
    const positions = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = terrain.getIndices();
    if (!positions || !indices) {
      return;
    }

    for (let index = 0; index < positions.length; index += 3) {
      const nearest = findNearestRouteSample(positions[index], positions[index + 2], routeSamples);
      const clearanceRadius = nearest.diameter * 0.5 + 0.65;
      if (nearest.distance >= clearanceRadius) {
        continue;
      }

      const edgeBlend = smoothstep((clearanceRadius - nearest.distance) / (clearanceRadius * 0.34));
      const tunnelUnderlay = nearest.point.y + 1.65 - nearest.diameter * 0.56 - 1.05;
      positions[index + 1] = BABYLON.Scalar.Lerp(positions[index + 1], tunnelUnderlay, edgeBlend);
    }

    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  });
}

function findNearestRouteSample(x, z, samples) {
  let nearest = samples[0];
  let closestSquaredDistance = Number.POSITIVE_INFINITY;

  samples.forEach((sample) => {
    const distanceX = x - sample.point.x;
    const distanceZ = z - sample.point.z;
    const squaredDistance = distanceX * distanceX + distanceZ * distanceZ;
    if (squaredDistance < closestSquaredDistance) {
      nearest = sample;
      closestSquaredDistance = squaredDistance;
    }
  });

  return { ...nearest, distance: Math.sqrt(closestSquaredDistance) };
}

function smoothstep(value) {
  const clamped = BABYLON.Scalar.Clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
