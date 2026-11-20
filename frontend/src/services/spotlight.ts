/**
 * SpotlightBackground — Pure vanilla TS cursor-following spotlight animation.
 * Renders a dark-blue radial glow that follows the mouse cursor on desktop,
 * and a static centered glow on mobile/touch devices.
 *
 * Colors: rgba(30, 64, 175, 0.30) primary, rgba(37, 99, 235, 0.14) secondary.
 * Fully non-interactive (pointer-events: none), z-index: 0 (behind all UI).
 */

let initialized = false;

export function initSpotlightBackground() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (initialized) return;
  initialized = true;

  // Respect prefers-reduced-motion
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motionQuery.matches) return;

  // Detect mobile/touch
  const isMobile =
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

  // Create the fixed container
  const container = document.createElement("div");
  container.id = "global-spotlight-root";
  container.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:0;overflow:hidden;";
  container.setAttribute("aria-hidden", "true");

  // Create the glow element
  const glow = document.createElement("div");
  glow.style.cssText =
    "position:absolute;border-radius:50%;pointer-events:none;transition:width 0.3s ease-out,height 0.3s ease-out,left 0.3s ease-out,top 0.3s ease-out;filter:blur(2px);";

  if (isMobile) {
    // Static centered glow for mobile
    glow.style.left = "50%";
    glow.style.top = "30%";
    glow.style.width = "300px";
    glow.style.height = "300px";
    glow.style.transform = "translate(-50%, -50%)";
    glow.style.background =
      "radial-gradient(circle, rgba(30, 64, 175, 0.12) 0%, rgba(37, 99, 235, 0.05) 40%, transparent 70%)";
    glow.style.filter = "blur(4px)";
  } else {
    // Desktop: start off-screen, will follow cursor
    glow.style.left = "-500px";
    glow.style.top = "-500px";
    glow.style.width = "280px";
    glow.style.height = "280px";
    glow.style.transform = "translate(-50%, -50%)";
    glow.style.background =
      "radial-gradient(circle, rgba(30, 64, 175, 0.30) 0%, rgba(37, 99, 235, 0.14) 35%, transparent 72%)";

    let moveTimeout: ReturnType<typeof setTimeout> | null = null;
    let animFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(() => {
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
        glow.style.width = "220px";
        glow.style.height = "220px";
      });

      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        glow.style.width = "280px";
        glow.style.height = "280px";
      }, 150);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
  }

  container.appendChild(glow);

  // Insert as the very first child of <body> so it's behind everything
  if (document.body.firstChild) {
    document.body.insertBefore(container, document.body.firstChild);
  } else {
    document.body.appendChild(container);
  }

  // Listen for reduced-motion changes
  motionQuery.addEventListener("change", (e) => {
    container.style.display = e.matches ? "none" : "";
  });

  console.log("[Spotlight] Cursor spotlight animation mounted (vanilla TS).");
}

// Auto-initialize on DOMContentLoaded if loaded in browser
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initSpotlightBackground());
  } else {
    initSpotlightBackground();
  }
}
