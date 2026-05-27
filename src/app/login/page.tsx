'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Credenciales inválidas');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#080c14' }}
    >
      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.015) 3px, rgba(6,182,212,0.015) 4px)',
        }}
      />
      {/* Top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), transparent)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div
          className="rounded-xl p-8 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,136,0.04) 0%, rgba(13,19,33,0.95) 50%, rgba(6,182,212,0.04) 100%)',
            border: '1px solid rgba(0,255,136,0.15)',
            boxShadow: '0 0 30px rgba(0,255,136,0.06), 0 0 60px rgba(6,182,212,0.03)',
          }}
        >
          {/* Scan lines inside card */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.015) 3px, rgba(6,182,212,0.015) 4px)',
            }}
          />

          {/* Header */}
          <div className="relative z-10 text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 overflow-hidden"
              style={{
                backgroundColor: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.25)',
                boxShadow: '0 0 20px rgba(0,255,136,0.08)',
              }}
            >
              <Image src="/decodex-logo.png" alt="DECODEX" width={40} height={40} className="object-contain" />
            </div>
            <h1
              className="text-2xl font-bold tracking-[0.15em] uppercase"
              style={{ color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace" }}
            >
              DECODEX
            </h1>
            <p
              className="text-[11px] uppercase tracking-wider mt-1"
              style={{ color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Inteligencia de Señales — Bolivia
            </p>
            <div
              className="mt-3 h-[1px] mx-auto w-32"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), transparent)' }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(0,255,136,0.04)',
                  border: '1px solid #1a2744',
                  color: '#e2e8f0',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: '0 0 8px rgba(0,255,136,0.04)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,136,0.4)';
                  e.target.style.boxShadow = '0 0 15px rgba(0,255,136,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#1a2744';
                  e.target.style.boxShadow = '0 0 8px rgba(0,255,136,0.04)';
                }}
                placeholder="admin@decodex.bo"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(0,255,136,0.04)',
                  border: '1px solid #1a2744',
                  color: '#e2e8f0',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: '0 0 8px rgba(0,255,136,0.04)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(0,255,136,0.4)';
                  e.target.style.boxShadow = '0 0 15px rgba(0,255,136,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#1a2744';
                  e.target.style.boxShadow = '0 0 8px rgba(0,255,136,0.04)';
                }}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(255,51,85,0.08)',
                  border: '1px solid rgba(255,51,85,0.2)',
                  color: '#ff3355',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-bold uppercase tracking-wider text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? 'rgba(0,255,136,0.08)' : 'rgba(0,255,136,0.12)',
                border: '1px solid rgba(0,255,136,0.3)',
                color: '#00ff88',
                fontFamily: "'JetBrains Mono', monospace",
                boxShadow: loading ? '0 0 20px rgba(0,255,136,0.15)' : '0 0 8px rgba(0,255,136,0.08)',
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Autenticando...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="relative z-10 mt-6 text-center">
            <p
              className="text-[9px] uppercase tracking-wider"
              style={{ color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}
            >
              DECODEX v0.15.0 — Acceso restringido
            </p>
          </div>

          {/* Bottom glow */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
