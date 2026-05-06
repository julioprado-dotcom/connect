'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { BinaryRainCanvas } from './BinaryRainCanvas';

/**
 * DECODEX Bolivia — Splash screen con secuencia animada de ~4.5 segundos.
 *
 * Orden de APARICION (de arriba hacia abajo):
 *   Etapa 0 → Lluvia binaria cubre la pantalla (fondo)
 *   Etapa 1 → Logo + "DECODEX BOLIVIA"
 *   Etapa 2 → Puntos animados
 *   Etapa 3 → "Cargando inteligencia..."
 *   Etapa 4 → "Bienvenido"
 *
 * Cada elemento permanece visible; los nuevos se agregan debajo.
 * Despues de la etapa 4, el padre desmonta con fade-out.
 */

const STAGE_DURATIONS = [800, 800, 700, 1000, 800]; // ms por etapa
const TOTAL_DURATION = STAGE_DURATIONS.reduce((a, b) => a + b, 0);

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [stage, setStage] = useState(0);

  // Avanzar etapas automaticamente
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
      {/* Lluvia binaria — siempre visible como fondo */}
      <BinaryRainCanvas />

      {/* Contenido central — todo apilado verticalmente */}
      <div className="relative z-10 flex flex-col items-center px-4">

        {/* ─── Etapa 1: Logo + DECODEX BOLIVIA ─── */}
        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center mb-6"
            >
              {/* Logo con glow */}
              <div className="flex items-center justify-center">
                <motion.div
                  initial={{ boxShadow: '0 0 0px rgba(0, 255, 136, 0)' }}
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
              </div>

              {/* Brand */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                className="mt-3 text-lg sm:text-xl font-bold tracking-[0.15em] uppercase"
                style={{ color: 'rgba(0, 255, 136, 0.7)' }}
              >
                DECODEX BOLIVIA
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Etapa 2: Puntos animados ─── */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex items-center gap-2 mb-6"
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
                    delay: i * 0.12,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    repeatDelay: 0.5,
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
          )}
        </AnimatePresence>

        {/* ─── Etapa 3: "Cargando inteligencia..." ─── */}
        <AnimatePresence>
          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex flex-col items-center mb-6"
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
          )}
        </AnimatePresence>

        {/* ─── Etapa 4: "Bienvenido" ─── */}
        <AnimatePresence>
          {stage >= 4 && (
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: '#E2E8F0' }}
            >
              Bienvenido
            </motion.h1>
          )}
        </AnimatePresence>
      </div>

      {/* Barra de progreso inferior */}
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
