'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { BinaryRainCanvas } from './BinaryRainCanvas';

/**
 * DECODEX Bolivia — Splash screen con secuencia animada de ~4 segundos.
 *
 * Etapas:
 *   0-1s   → Lluvia binaria cubre toda la pantalla
 *   1-2s   → Puntos animados aparecen en el centro
 *   2-3s   → "Cargando inteligencia..." emerge
 *   3-4s   → Logo aparece sin texto, luego "Bienvenido"
 *
 * Despues de la etapa 4, el componente indica que la secuencia termino
 * (onComplete). El padre decide cuando desmontarlo.
 */

const STAGE_DURATIONS = [1000, 1000, 1000, 1000]; // ms por etapa
const TOTAL_DURATION = STAGE_DURATIONS.reduce((a, b) => a + b, 0);

interface LoadingScreenProps {
  /** Callback cuando la secuencia visual termina (stage 4 completada) */
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [stage, setStage] = useState(0); // 0=binary, 1=dots, 2=text, 3=logo

  // Avanzar etapas automaticamente
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let accumulated = 0;
    for (let i = 1; i <= 3; i++) {
      accumulated += STAGE_DURATIONS[i - 1];
      timers.push(
        setTimeout(() => setStage(i), accumulated)
      );
    }
    // onComplete al final
    timers.push(
      setTimeout(() => onComplete?.(), TOTAL_DURATION)
    );
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ backgroundColor: '#0A1628' }}
    >
      {/* Lluvia binaria — siempre visible como fondo */}
      <BinaryRainCanvas />

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center px-4">

        {/* ─── Etapa 0-1: Solo lluvia binaria cayendo ─── */}

        {/* ─── Etapa 1: Puntos animados ─── */}
        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
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

        {/* ─── Etapa 2: "Cargando inteligencia..." ─── */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="flex flex-col items-center mb-8"
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

        {/* ─── Etapa 3: Logo + "Bienvenido" ─── */}
        <AnimatePresence>
          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              {/* Logo */}
              <div className="mb-4 flex items-center justify-center">
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

              {/* Brand — DECODEX BOLIVIA */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                className="text-lg sm:text-xl font-bold tracking-[0.15em] uppercase"
                style={{ color: 'rgba(0, 255, 136, 0.7)' }}
              >
                DECODEX BOLIVIA
              </motion.p>

              {/* "Bienvenido" */}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.6, ease: 'easeOut' }}
                className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2"
                style={{ color: '#E2E8F0' }}
              >
                Bienvenido
              </motion.h1>

              {/* Subtitulo sutil */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="mt-2 text-xs font-medium tracking-[0.2em] uppercase"
                style={{ color: 'rgba(226, 232, 240, 0.35)' }}
              >
                Inteligencia de Senales
              </motion.p>
            </motion.div>
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
