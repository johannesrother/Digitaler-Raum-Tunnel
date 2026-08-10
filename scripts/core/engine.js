/**
 * Creates the Babylon rendering engine used by both desktop and WebXR views.
 */
export function createEngine(canvas) {
  return new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
  });
}
