'use client';

import React, { useState } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { X, Loader2, Zap, Users, Target, AlertTriangle, Link2, ClipboardCheck, Lightbulb } from 'lucide-react';

interface SignalAnalysis {
  contexto: string;
  actores: string[];
  intencionMedio: string;
  impacto: string;
  conexiones: string[];
  evaluacion: string;
  recomendacion: string;
}

interface SignalAnalysisResult {
  mencionId: string;
  medio: string | null;
  persona: string | null;
  titulo: string;
  analysis: SignalAnalysis;
}

interface SignalAnalysisModalProps {
  mencionId: string;
  titulo?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SignalAnalysisModal({ mencionId, titulo, isOpen, onClose }: SignalAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignalAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout('/api/analyze/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mencionId }),
        timeoutMs: 60000,
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Error al analizar');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(6,182,212,0.15)',
          boxShadow: '0 0 40px rgba(6,182,212,0.05), 0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
          style={{
            borderBottom: '1px solid rgba(6,182,212,0.1)',
            backgroundColor: 'rgba(10,10,10,0.95)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-300">
              Analisis de Senal
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {/* Target info */}
          <div className="mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.08)' }}>
            <p className="text-[10px] font-mono text-slate-600 uppercase mb-1">Objetivo</p>
            <p className="text-xs text-slate-300 font-mono">{titulo || `ID: ${mencionId}`}</p>
          </div>

          {/* Launch analysis */}
          {!result && !loading && (
            <button
              onClick={analyze}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.01]"
              style={{
                color: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.2)',
              }}
            >
              <Zap className="w-4 h-4" />
              Ejecutar Escaneo de Senal
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Escaneando senal...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono" style={{ color: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Source info */}
              <div className="flex items-center gap-4 text-[9px] font-mono text-slate-600">
                {result.medio && <span>Fuente: <span className="text-slate-400">{result.medio}</span></span>}
                {result.persona && <span>Persona: <span className="text-slate-400">{result.persona}</span></span>}
              </div>

              {/* Analysis sections */}
              <AnalysisSection icon={<Target className="w-3.5 h-3.5" />} label="Contexto" text={result.analysis.contexto} color="#06b6d4" />
              <AnalysisSection icon={<Users className="w-3.5 h-3.5" />} label="Actores Clave" items={result.analysis.actores} color="#10b981" />
              <AnalysisSection icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Intencion del Medio" text={result.analysis.intencionMedio} color="#f59e0b" />
              <AnalysisSection icon={<Zap className="w-3.5 h-3.5" />} label="Impacto Potencial" text={result.analysis.impacto} color="#a78bfa" />
              <AnalysisSection icon={<Link2 className="w-3.5 h-3.5" />} label="Conexiones Tematicas" items={result.analysis.conexiones} color="#ec4899" />
              <AnalysisSection icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Evaluacion" text={result.analysis.evaluacion} color="#06b6d4" />
              <AnalysisSection icon={<Lightbulb className="w-3.5 h-3.5" />} label="Recomendacion" text={result.analysis.recomendacion} color="#10b981" />

              {/* Re-analyze button */}
              <button
                onClick={() => { setResult(null); analyze(); }}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all hover:bg-white/[0.02]"
                style={{ color: '#475569', border: '1px solid rgba(100,116,139,0.15)' }}
              >
                Re-escanear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisSection({
  icon,
  label,
  text,
  items,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  text?: string;
  items?: string[];
  color: string;
}) {
  return (
    <div
      className="px-3 py-2.5 rounded-lg"
      style={{
        backgroundColor: `${color}04`,
        border: `1px solid ${color}10`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: `${color}80` }}>{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider font-mono" style={{ color: `${color}90` }}>
          {label}
        </span>
      </div>
      {text && (
        <p className="text-[11px] text-slate-300 leading-relaxed">{text}</p>
      )}
      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{
                color: color,
                backgroundColor: `${color}08`,
                border: `1px solid ${color}15`,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
