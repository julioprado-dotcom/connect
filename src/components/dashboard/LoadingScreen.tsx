'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { BinaryRainCanvas } from './BinaryRainCanvas';

/**
 * DECODEX Bolivia — Splash screen con secuencia animada.
 *
 * Layout fijo (centrado, arriba → abajo):
 *   Logo → DECODEX BOLIVIA → Puntos → Cargando inteligencia...
 *
 * Orden de APARICION:
 *   Etapa 0 → Lluvia binaria (inmediata)
 *   Etapa 1 → Puntos animados
 *   Etapa 2 → "Cargando inteligencia..."
 *   Etapa 3 → Logo
 *   Etapa 4 → Branding "DECODEX BOLIVIA"
 */

const STAGE_DURATIONS = [500, 800, 1000, 900, 800]; // ~4s total
const TOTAL_DURATION = STAGE_DURATIONS.reduce((a, b) => a + b, 0);

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let accumulated = 0;
    for (let i = 1; i <= 4; i++) {
      accumulated += STAGE_DURATIONS[i - 1];
      timers.push(setTimeout(() => setStage(i), accumulated));
    }
    timers.push(setTimeout(() => onComplete?.(), TOTAL_DURATION));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: '#0A1628' }}
    >
      {/* Lluvia binaria — inmediata */}
      <BinaryRainCanvas />

      {/* Layout fijo: Logo → Branding → Puntos → Texto */}
      <div className="relative z-10 flex flex-col items-center px-4">

        {/* ── Logo (aparece en etapa 3) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={stage >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center mb-3"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0px rgba(0, 255, 136, 0)',
                '0 0 20px rgba(0, 255, 136, 0.3)',
                '0 0 8px rgba(0, 255, 136, 0.15)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="h-24 w-24 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(0, 255, 136, 0.2)',
            }}
          >
            <Image src="/logo.png" alt="DECODEX" width={88} height={88} className="object-cover" priority />
          </motion.div>
        </motion.div>

        {/* ── Branding "DECODEX BOLIVIA" (aparece en etapa 4) ── */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={stage >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-lg sm:text-xl font-bold tracking-[0.15em] uppercase mb-8"
          style={{ color: 'rgba(0, 255, 136, 0.7)' }}
        >
          DECODEX BOLIVIA
        </motion.p>

        {/* ── Puntos animados (aparecen en etapa 1) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-2 mb-8"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1.3, 1],
                opacity: [0, 0.8, 0.5],
              }}
              transition={{
                duration: 0.8,
                delay: i * 0.1,
                repeat: Infinity,
                repeatType: 'reverse',
                repeatDelay: 0.4,
              }}
              className="block rounded-full"
              style={{
                width: 5 + i,
                height: 5 + i,
                backgroundColor: `rgba(0, 255, 136, ${0.3 + i * 0.12})`,
              }}
            />
          ))}
        </motion.div>

        {/* ── "Cargando inteligencia..." (aparece en etapa 2) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={stage >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p
            className="text-base sm:text-lg font-semibold tracking-wide"
            style={{ color: 'rgba(0, 255, 136, 0.8)' }}
          >
            Cargando inteligencia
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >...</motion.span>
          </p>
        </motion.div>
      </div>

      {/* Barra de progreso */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{ backgroundColor: 'rgba(0, 255, 136, 0.5)' }}
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: TOTAL_DURATION / 1000, ease: 'linear' }}
      />
    </div>
  );
}
