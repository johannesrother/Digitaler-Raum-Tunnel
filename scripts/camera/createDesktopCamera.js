const STANDING_EYE_HEIGHT = 1.65;

/**
 * Provides familiar mouse/keyboard controls for desktop testing.
 * Babylon switches to its WebXR camera while an immersive session is active.
 */
export function createDesktopCamera(scene, canvas, standingPosition = BABYLON.Vector3.Zero()) {
  const camera = new BABYLON.UniversalCamera(
    "idyll-standing-camera",
    new BABYLON.Vector3(standingPosition.x, STANDING_EYE_HEIGHT, standingPosition.z),
    scene,
  );

  // The visitor begins still and can only look around at this stage.
  // The forward view remains a landscape, while the tunnel mouth is already
  // legible at the right edge instead of requiring a full 90-degree turn.
  camera.setTarget(new BABYLON.Vector3(5, STANDING_EYE_HEIGHT, 2));
  camera.minZ = 0.1;
  camera.angularSensibility = 4000;
  camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
  camera.attachControl(canvas, true);

  return camera;
}
