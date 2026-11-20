"use client";

import React, { useState, useEffect, useRef } from "react";

const SpotlightBackground: React.FC = () => {
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: -500, y: -500 });
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const moveTimeout = useRef<NodeJS.Timeout | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  useEffect(() => {
    // Detect mobile/touch devices
    const checkMobile = () => {
      setIsMobile(
        typeof window !== "undefined" &&
        (window.matchMedia("(pointer: coarse)").matches ||
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0)
      );
    };
    checkMobile();

    if (isMobile || prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      animFrameId.current = requestAnimationFrame(() => {
        setMouse({ x: clientX, y: clientY });
        setIsMoving(true);
      });

      if (moveTimeout.current) clearTimeout(moveTimeout.current);

      moveTimeout.current = setTimeout(() => {
        setIsMoving(false);
      }, 150);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (moveTimeout.current) clearTimeout(moveTimeout.current);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isMobile, prefersReducedMotion]);

  // Reduced motion: show nothing (fully accessible)
  if (prefersReducedMotion) {
    return null;
  }

  // Mobile / Touch devices: static subtle glow at center-top
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: "50%",
            top: "30%",
            width: "300px",
            height: "300px",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(30, 64, 175, 0.12) 0%, rgba(37, 99, 235, 0.05) 40%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
      </div>
    );
  }

  // Desktop: cursor-following dark blue spotlight
  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: mouse.x,
          top: mouse.y,
          width: isMoving ? "220px" : "280px",
          height: isMoving ? "220px" : "280px",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(30, 64, 175, 0.30) 0%, rgba(37, 99, 235, 0.14) 35%, transparent 72%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
};

export default SpotlightBackground;
