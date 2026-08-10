import { createEngine } from "./scripts/core/engine.js";
import { createIdyllScene } from "./scripts/core/createIdyllScene.js";
import { initializeWebXR } from "./scripts/core/initializeWebXR.js";
import { configureResizeHandling, setStatus } from "./scripts/utils/dom.js";

async function startExperience() {
  const canvas = document.getElementById("renderCanvas");
  const statusElement = document.getElementById("runtime-status");
  const enterVrButton = document.getElementById("enter-vr");

  const engine = createEngine(canvas);
  const scene = await createIdyllScene(engine, canvas);
  const removeResizeHandling = configureResizeHandling(engine);

  // Start desktop rendering immediately; WebXR initialisation is non-blocking.
  engine.runRenderLoop(() => scene.render());
  setStatus(statusElement, "Idylle bereit. WebXR wird geprüft …");

  await initializeWebXR({
    scene,
    enterVrButton,
    statusElement,
  });

  window.addEventListener(
    "beforeunload",
    () => {
      removeResizeHandling();
      scene.dispose();
      engine.dispose();
    },
    { once: true },
  );
}

startExperience().catch((error) => {
  console.error("Die Idylle konnte nicht gestartet werden.", error);
  setStatus(
    document.getElementById("runtime-status"),
    "Die Idylle konnte nicht gestartet werden. Details stehen in der Browser-Konsole.",
  );
});
