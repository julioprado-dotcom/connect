'use client';

import React from 'react';
import { Radio, Save, Brain, AlertTriangle, CheckCircle2, Loader2, X, Newspaper } from 'lucide-react';
import { sentimentColor } from '@/constants/colors';
import { PanelShell } from './PanelShell';
import { StatusBadge, FormInput, FormSelect } from './FuentesView.helpers';
import type { Medio, EditForm, AIAnalysis, MedioMencion } from './FuentesView.types';
import {
  NATURALEZA_OPTS,
  AMBITO_OPTS,
  ENFOQUE_OPTS,
} from './FuentesView.types';

// ═══════════════════════════════════════════════════════════════
// MedioDetailPanel — detail/edit panel for a selected medio
// ═══════════════════════════════════════════════════════════════

interface MedioDetailPanelProps {
  selectedMedio: Medio;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm | null>>;
  saving: boolean;
  saveResult: { ok: boolean; msg: string } | null;
  aiAnalyzing: boolean;
  aiResult: AIAnalysis | null;
  medioMenciones: MedioMencion[];
  medioMencionesLoading: boolean;
  medioMencionesTotal: number;
  onSave: () => void;
  onAiAnalyze: () => void;
  onClose: () => void;
}

export function MedioDetailPanel({
  selectedMedio,
  editForm,
  setEditForm,
  saving,
  saveResult,
  aiAnalyzing,
  aiResult,
  medioMenciones,
  medioMencionesLoading,
  medioMencionesTotal,
  onSave,
  onAiAnalyze,
  onClose,
}: MedioDetailPanelProps) {
  return (
    <PanelShell
      title={selectedMedio.nombre}
      icon={<Radio className="w-4 h-4" />}
    >
      {/* Close button */}
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-slate-500 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
          CERRAR
        </button>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4 py-3 border-y border-slate-800/60">
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Menciones</p>
          <p className="text-sm font-mono text-cyan-400 tabular-nums">
            {medioMencionesLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : medioMencionesTotal}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Estado</p>
          <StatusBadge activo={selectedMedio.activo} ultimoError={selectedMedio.ultimoError} />
        </div>
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Tipo</p>
          <p className="text-[10px] font-mono text-slate-400">{selectedMedio.tipo || '---'}</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Depto.</p>
          <p className="text-[10px] font-mono text-slate-400">{selectedMedio.departamento || '---'}</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Nivel</p>
          <p className="text-[10px] font-mono text-slate-400">{selectedMedio.nivel || '---'}</p>
        </div>
      </div>

      {/* Recent Mentions from this medio */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="w-3.5 h-3.5 text-amber-400/60" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
            Ultimas menciones capturadas
          </span>
          {medioMencionesTotal > 5 && (
            <span className="text-[8px] font-mono text-slate-700">({medioMencionesTotal} total, mostrando 5)</span>
          )}
        </div>
        {medioMencionesLoading ? (
          <div className="flex items-center gap-2 py-4 text-slate-600 text-xs font-mono justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Cargando menciones...
          </div>
        ) : medioMenciones.length === 0 ? (
          <div className="px-3 py-3 rounded-md text-[10px] font-mono text-slate-600" style={{
            backgroundColor: 'rgba(100,116,139,0.03)',
            border: '1px solid rgba(100,116,139,0.06)',
          }}>
            Sin menciones capturadas de esta fuente aun.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar">
            {medioMenciones.map((m) => {
              const sentColor = sentimentColor(m.sentimiento || 'no_clasificado');
              return (
                <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-md" style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(6,182,212,0.04)',
                }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: sentColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono text-slate-300 leading-snug line-clamp-2">{m.titulo || 'Sin titulo'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {m.Persona?.nombre && (
                        <span className="text-[8px] font-mono text-cyan-500/70">{m.Persona.nombre}</span>
                      )}
                      <span className="text-[8px] font-mono text-slate-700">
                        {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Form header */}
      <div className="flex items-center gap-2 mb-3">
        <Save className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
          Editor de Fuente
        </span>
        <span className="text-[9px] font-mono text-slate-700 ml-auto">ID: {selectedMedio.id.slice(0, 8)}...</span>
      </div>

      {/* Form grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Nombre */}
        <FormInput
          label="Nombre"
          value={editForm.nombre}
          onChange={(v) => setEditForm((f) => f && { ...f, nombre: v })}
        />

        {/* URL */}
        <FormInput
          label="URL"
          value={editForm.url}
          onChange={(v) => setEditForm((f) => f && { ...f, url: v })}
        />

        {/* Naturaleza */}
        <FormSelect
          label="Naturaleza"
          value={editForm.naturaleza}
          options={[...NATURALEZA_OPTS]}
          placeholder="Sin clasificar"
          onChange={(v) => setEditForm((f) => f && { ...f, naturaleza: v })}
        />

        {/* Ambito */}
        <FormSelect
          label="Ambito"
          value={editForm.ambito}
          options={[...AMBITO_OPTS]}
          placeholder="Sin clasificar"
          onChange={(v) => setEditForm((f) => f && { ...f, ambito: v })}
        />

        {/* Enfoque */}
        <FormSelect
          label="Enfoque"
          value={editForm.enfoque}
          options={[...ENFOQUE_OPTS]}
          placeholder="Sin clasificar"
          onChange={(v) => setEditForm((f) => f && { ...f, enfoque: v })}
        />

        {/* Credibilidad */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
            Credibilidad
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={100}
              value={editForm.credibilidad}
              onChange={(e) =>
                setEditForm((f) => f && { ...f, credibilidad: parseInt(e.target.value, 10) })
              }
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, rgba(139,92,246,0.6) 0%, rgba(245,158,11,0.6) 50%, rgba(6,182,212,0.6) 100%)',
                accentColor: '#06b6d4',
              }}
            />
            <span
              className="text-sm font-bold font-mono tabular-nums min-w-[32px] text-right"
              style={{
                color:
                  editForm.credibilidad >= 70
                    ? '#06b6d4'
                    : editForm.credibilidad >= 40
                      ? '#f59e0b'
                      : '#8b5cf6',
              }}
            >
              {editForm.credibilidad}
            </span>
          </div>
        </div>
      </div>

      {/* AI Analysis result */}
      {aiResult && (
        <div
          className="mb-4 px-3 py-3 rounded-md"
          style={{
            backgroundColor: 'rgba(167,139,250,0.04)',
            border: '1px solid rgba(167,139,250,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-purple-400/70" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400/70 font-mono">
              Sugerencia IA
            </span>
          </div>
          <div className="space-y-1">
            {aiResult.naturaleza && (
              <p className="text-[9px] font-mono text-slate-400">
                <span className="text-slate-600">Naturaleza:</span> {aiResult.naturaleza}
              </p>
            )}
            {aiResult.ambito && (
              <p className="text-[9px] font-mono text-slate-400">
                <span className="text-slate-600">Ambito:</span> {aiResult.ambito}
              </p>
            )}
            {aiResult.enfoque && (
              <p className="text-[9px] font-mono text-slate-400">
                <span className="text-slate-600">Enfoque:</span> {aiResult.enfoque}
              </p>
            )}
            {aiResult.credibilidad > 0 && (
              <p className="text-[9px] font-mono text-slate-400">
                <span className="text-slate-600">Credibilidad sugerida:</span>{' '}
                <span style={{
                  color: aiResult.credibilidad >= 70 ? '#06b6d4' : aiResult.credibilidad >= 40 ? '#f59e0b' : '#8b5cf6',
                }}>
                  {aiResult.credibilidad}/100
                </span>
              </p>
            )}
            {aiResult.razon && (
              <p className="text-[9px] font-mono text-slate-500 mt-1 italic">
                {aiResult.razon}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Save result */}
      {saveResult && (
        <div
          className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-mono"
          style={{
            color: saveResult.ok ? '#06b6d4' : '#8b5cf6',
            backgroundColor: saveResult.ok ? 'rgba(6,182,212,0.06)' : 'rgba(139,92,246,0.06)',
            border: saveResult.ok ? '1px solid rgba(6,182,212,0.15)' : '1px solid rgba(139,92,246,0.15)',
          }}
        >
          {saveResult.ok ? (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          {saveResult.msg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            color: saving ? '#64748b' : '#06b6d4',
            backgroundColor: saving ? 'rgba(100,116,139,0.05)' : 'rgba(6,182,212,0.06)',
            border: saving ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(6,182,212,0.2)',
            boxShadow: saving ? 'none' : '0 0 12px rgba(6,182,212,0.06)',
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>

        <button
          onClick={onAiAnalyze}
          disabled={aiAnalyzing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            color: aiAnalyzing ? '#64748b' : '#a78bfa',
            backgroundColor: aiAnalyzing ? 'rgba(100,116,139,0.05)' : 'rgba(167,139,250,0.06)',
            border: aiAnalyzing ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(167,139,250,0.2)',
            boxShadow: aiAnalyzing ? 'none' : '0 0 12px rgba(167,139,250,0.06)',
          }}
        >
          {aiAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Brain className="w-3.5 h-3.5" />
          )}
          {aiAnalyzing ? 'Analizando...' : 'Analizar IA'}
        </button>
      </div>
    </PanelShell>
  );
}
