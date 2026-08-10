/**
 * A deliberately tiny set of leaf and petal fragments for the suction phase.
 * These are simple, unlit quads rather than a particle system: predictable,
 * low-cost and easy to remove before the tunnel sequence starts.
 */
export function createSuctionDebris(scene, entrance) {
  const fragments = Array.from({ length: 14 }, (_, index) => createFragment(scene, entrance, index));

  return {
    update(experienceTime) {
      const amount = BABYLON.Scalar.Clamp((experienceTime - 14) / 6, 0, 1);
      const visible = amount > 0 && amount < 1;
      fragments.forEach((fragment) => {
        fragment.mesh.setEnabled(visible);
        if (!visible) {
          return;
        }
        const pull = Math.pow(amount, 2.35);
        fragment.mesh.position.copyFrom(BABYLON.Vector3.Lerp(fragment.start, fragment.end, pull));
        fragment.mesh.rotation.x = fragment.rotation.x + amount * (2.4 + fragment.phase);
        fragment.mesh.rotation.y = fragment.rotation.y + amount * (3.2 + fragment.phase * 0.7);
        fragment.mesh.rotation.z = fragment.rotation.z + amount * 1.6;
      });
    },
    dispose() {
      fragments.forEach((fragment) => {
        fragment.mesh.material.dispose();
        fragment.mesh.dispose();
      });
    },
  };
}

function createFragment(scene, entrance, index) {
  const phase = index * 1.618;
  const side = Math.sin(phase * 2.3) * (1.2 + (index % 3) * 0.32);
  const distance = 3.1 + (index % 5) * 0.78;
  const start = entrance.center
    .subtract(entrance.forward.scale(distance))
    .add(entrance.lateral.scale(side));
  start.y = 0.25 + (index % 4) * 0.2;
  const end = entrance.center
    .add(entrance.forward.scale(2.1 + (index % 3) * 0.35))
    .add(entrance.lateral.scale(Math.sin(phase) * 0.38));
  end.y = 1.05 + (index % 3) * 0.24;

  const mesh = BABYLON.MeshBuilder.CreatePlane(
    `suction-leaf-fragment-${index}`,
    { width: 0.055 + (index % 3) * 0.018, height: 0.13 + (index % 4) * 0.024, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  mesh.position.copyFrom(start);
  mesh.rotation.set(phase * 0.31, phase * 0.63, phase * 0.22);
  mesh.material = createFragmentMaterial(scene, index);
  mesh.isPickable = false;
  mesh.setEnabled(false);

  return { mesh, start, end, rotation: mesh.rotation.clone(), phase };
}

function createFragmentMaterial(scene, index) {
  const material = new BABYLON.StandardMaterial(`suction-fragment-material-${index}`, scene);
  const colors = ["#68764a", "#8c985d", "#9b6d73", "#b58a87"];
  material.diffuseColor = BABYLON.Color3.FromHexString(colors[index % colors.length]);
  material.emissiveColor = BABYLON.Color3.Black();
  material.specularColor = BABYLON.Color3.Black();
  material.backFaceCulling = false;
  return material;
}
