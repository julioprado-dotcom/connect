'use client';

import { useRef, useEffect, useCallback } from 'react';

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  charCount: number;
  opacity: number;
}

/**
 * Minimalist binary rain canvas component.
 * Renders 3-5 columns of falling binary digits on a dark background.
 * Positioned on the left ~20% of the screen.
 * Respects prefers-reduced-motion. Uses ResizeObserver for responsiveness.
 */
export function BinaryRainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const columnsRef = useRef<RainColumn[]>([]);
  const observerRef = useRef<ResizeObserver | null>(null);

  const initColumns = useCallback((width: number, height: number) => {
    const colCount = 3 + Math.floor(Math.random() * 3); // 3-5 columns
    const sectionWidth = width * 0.2; // left 20% of screen
    const spacing = sectionWidth / (colCount + 1);

    const cols: RainColumn[] = [];
    for (let i = 0; i < colCount; i++) {
      const charCount = 8 + Math.floor(Math.random() * 12); // 8-20 chars per column
      const chars: string[] = [];
      for (let c = 0; c < charCount; c++) {
        chars.push(Math.random() > 0.5 ? '1' : '0');
      }
      cols.push({
        x: spacing + i * spacing,
        y: Math.random() * height * -1 - charCount * 14,
        speed: 0.4 + Math.random() * 0.8, // 0.4 - 1.2 px per frame
        chars,
        charCount,
        opacity: 0.08 + Math.random() * 0.18, // subtle: 8-26% opacity
      });
    }
    columnsRef.current = cols;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      // Draw a single static frame and stop
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      initColumns(rect.width, rect.height);
      // Draw once
      ctx.clearRect(0, 0, rect.width, rect.height);
      columnsRef.current.forEach((col) => {
        ctx.font = '11px monospace';
        ctx.fillStyle = `rgba(0, 255, 136, ${col.opacity})`;
        col.chars.forEach((char, idx) => {
          ctx.fillText(char, col.x, col.y + idx * 14);
        });
      });
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initColumns(rect.width, rect.height);
    };

    resize();

    // ResizeObserver for responsive canvas
    observerRef.current = new ResizeObserver(() => resize());
    observerRef.current.observe(parent);

    // Animation loop
    const animate = () => {
      const rect = parent.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      columnsRef.current.forEach((col) => {
        ctx.font = '11px monospace';
        col.chars.forEach((char, idx) => {
          const cy = col.y + idx * 14;
          // Only draw if visible
          if (cy >= -14 && cy <= h + 14) {
            // Lead character is brighter
            const isLead = idx === col.charCount - 1;
            const alpha = isLead
              ? Math.min(col.opacity * 2.5, 0.55)
              : col.opacity * (1 - idx / col.charCount * 0.7);
            ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
            ctx.fillText(char, col.x, cy);
          }
        });

        // Advance column
        col.y += col.speed;

        // Occasionally mutate a character for visual interest
        if (Math.random() < 0.02) {
          const randIdx = Math.floor(Math.random() * col.chars.length);
          col.chars[randIdx] = Math.random() > 0.5 ? '1' : '0';
        }

        // Reset when fully off screen
        if (col.y > h + 40) {
          col.y = -col.charCount * 14 - Math.random() * h * 0.5;
          col.speed = 0.4 + Math.random() * 0.8;
          col.opacity = 0.08 + Math.random() * 0.18;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      observerRef.current?.disconnect();
    };
  }, [initColumns]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
