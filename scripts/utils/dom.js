/** Keeps Babylon's render size aligned with the browser viewport. */
export function configureResizeHandling(engine) {
  const handleResize = () => engine.resize();
  window.addEventListener("resize", handleResize);

  return () => window.removeEventListener("resize", handleResize);
}

/** Updates the small technical status panel without mixing UI logic into scene code. */
export function setStatus(element, message) {
  if (element) {
    element.textContent = message;
  }
}
