import { TUNNEL_DURATION, getTunnelDiameter } from "./tunnelConfig.js";

/**
 * Removes only the terrain triangles that occupy the tunnel volume. Moving
 * terrain vertices down alone leaves broad grid triangles spanning the opening,
 * which is why the grass could still read as an interior floor.
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
      const clearanceRadius = nearest.diameter * 0.5 + 0.8;
      if (nearest.distance >= clearanceRadius) {
        continue;
      }

      const edgeBlend = smoothstep((clearanceRadius - nearest.distance) / (clearanceRadius * 0.34));
      const tunnelUnderlay = nearest.point.y + 1.65 - nearest.diameter * 0.56 - 1.05;
      positions[index + 1] = BABYLON.Scalar.Lerp(positions[index + 1], tunnelUnderlay, edgeBlend);
    }

    const remainingIndices = [];
    for (let index = 0; index < indices.length; index += 3) {
      const triangleTouchesTunnel = [indices[index], indices[index + 1], indices[index + 2]]
        .some((vertexIndex) => {
          const vertex = vertexIndex * 3;
          const nearest = findNearestRouteSample(positions[vertex], positions[vertex + 2], routeSamples);
          return nearest.distance < nearest.diameter * 0.5 + 0.8;
        });
      if (!triangleTouchesTunnel) {
        remainingIndices.push(indices[index], indices[index + 1], indices[index + 2]);
      }
    }

    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, remainingIndices, normals);
    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    terrain.setIndices(remainingIndices);
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
