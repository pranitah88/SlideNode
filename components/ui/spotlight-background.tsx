"use client";

import React, { useState, useEffect, useRef } from "react";

const SpotlightBackground: React.FC = () => {
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: -500, y: -500 });
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const moveTimeout = useRef<NodeJS.Timeout | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        typeof window !== "undefined" &&
        (window.matchMedia("(pointer: coarse)").matches ||
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0)
      );
    };
    checkMobile();

    const handleMouseMove = (e: MouseEvent) => {
      if (isMobile) return;

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
  }, [isMobile]);

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
              "radial-gradient(circle, rgba(0, 70, 190, 0.12) 0%, rgba(0, 70, 190, 0.05) 40%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
      </div>
    );
  }

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
            "radial-gradient(circle, rgba(0, 70, 190, 0.18) 0%, rgba(0, 70, 190, 0.08) 35%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
};

export default SpotlightBackground;
