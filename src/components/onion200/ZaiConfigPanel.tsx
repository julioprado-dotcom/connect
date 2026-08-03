'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Key, CheckCircle, XCircle, Loader2, RefreshCw, Save, AlertTriangle } from 'lucide-react';
import { PanelShell } from './PanelShell';

// ── Tipos ────────────────────────────────────────────────────────────────

interface ZaiConfigStatus {
  configurado: boolean;
  ruta?: string;
  baseUrl?: string;
  apiKeyMasked?: string;
  keyValida?: boolean;
  keyError?: string | null;
  respuestaTimeMs?: number | null;
  error?: string;
  timestamp?: string;
}

type ViewState = 'loading' | 'idle' | 'editing' | 'saving' | 'success' | 'error';

// ── ZaiConfigPanel ────────────────────────────────────────────────────────

export function ZaiConfigPanel() {
  const [status, setStatus] = useState<ZaiConfigStatus | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [newApiKey, setNewApiKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zai-config');
      if (res.ok) {
        const data: ZaiConfigStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // silent
    } finally {
      setViewState('idle');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 300000); // cada 5 min
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const handleSave = async () => {
    if (!newApiKey.trim() || newApiKey.trim().length < 10) {
      setMessage('La API key debe tener al menos 10 caracteres');
      setViewState('error');
      return;
    }

    setViewState('saving');
    setMessage(null);

    try {
      const res = await fetch('/api/admin/zai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newApiKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.exito) {
        setMessage(data.mensaje || 'API key actualizada correctamente');
        setViewState('success');
        setNewApiKey('');
        setTimeout(fetchStatus, 2000);
        setTimeout(() => setViewState('idle'), 4000);
      } else {
        setMessage(data.error || 'Error al guardar la API key');
        setViewState('error');
        setTimeout(() => setViewState('idle'), 5000);
      }
    } catch {
      setMessage('Error de conexion al guardar');
      setViewState('error');
      setTimeout(() => setViewState('idle'), 5000);
    }
  };

  const isEditing = viewState === 'editing';
  const isSaving = viewState === 'saving';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PanelShell
      title="API Key Z.ai"
      icon={<Key className="w-4 h-4" />}
      extra={
        viewState === 'idle' && (
          <button
            onClick={() => { setViewState('editing'); setMessage(null); }}
            className="text-[9px] font-mono text-cyan-500/70 hover:text-cyan-400 transition-colors px-1"
          >
            EDITAR
          </button>
        )
      }
    >
      {/* Loading */}
      {viewState === 'loading' && !status && (
        <div className="flex items-center justify-center gap-2 py-6 text-cyan-500/50">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-mono">Consultando...</span>
        </div>
      )}

      {/* No configurado */}
      {status && !status.configurado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400/80">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">{status.error}</span>
          </div>
          <div className="text-[9px] font-mono text-slate-500 space-y-1">
            <p>Rutas buscadas:</p>
            {status.ruta?.map((r: string, i: number) => (
              <p key={i} className="text-slate-600 pl-2">{r}</p>
            ))}
          </div>
          {/* Formulario para nueva config */}
          <button
            onClick={() => { setViewState('editing'); setMessage(null); }}
            className="w-full mt-2 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
            style={{
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: 'rgba(6, 182, 212, 0.8)',
            }}
          >
            Configurar API Key
          </button>
        </div>
      )}

      {/* Estado configurado — Vista normal */}
      {status && status.configurado && !isEditing && !isSaving && (
        <div className="space-y-2.5">
          {/* Indicador de estado */}
          <div className="flex items-center gap-2">
            {status.keyValida ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400/80">Key valida y operativa</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-mono text-red-400/80">Key invalida o con error</span>
              </>
            )}
          </div>

          {/* Key enmascarada */}
          <div className="rounded px-3 py-2" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
            <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1">API Key</p>
            <p className="text-[11px] font-mono text-cyan-300/80 tracking-wide">
              {status.apiKeyMasked}
            </p>
          </div>

          {/* Endpoint + latencia */}
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500 truncate mr-2" style={{ maxWidth: '70%' }}>
              {status.baseUrl}
            </span>
            {status.respuestaTimeMs !== null && status.respuestaTimeMs !== undefined && (
              <span className={status.respuestaTimeMs < 1000 ? 'text-emerald-400/70' : 'text-amber-400/70'}>
                {status.respuestaTimeMs}ms
              </span>
            )}
          </div>

          {/* Error de key */}
          {status.keyError && (
            <div className="rounded px-2 py-1.5 text-[9px] font-mono text-red-400/70" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
              {status.keyError.slice(0, 120)}
            </div>
          )}

          {/* Mensaje de resultado */}
          {(viewState === 'success' || viewState === 'error') && message && (
            <div
              className={`rounded px-2 py-1.5 text-[9px] font-mono ${
                viewState === 'success' ? 'text-emerald-400/80' : 'text-red-400/80'
              }`}
              style={{ background: viewState === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)' }}
            >
              {message}
            </div>
          )}
        </div>
      )}

      {/* Modo edición */}
      {isEditing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-cyan-400/70">
            <Key className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              Nueva API Key
            </span>
          </div>

          <input
            type="text"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="dd63bdb9... (pegar key completa)"
            className="w-full rounded px-3 py-2 text-[11px] font-mono text-cyan-100 placeholder-slate-600 outline-none transition-colors"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(6, 182, 212, 0.6)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(6, 182, 212, 0.3)')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !newApiKey.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                color: 'rgba(6, 182, 212, 0.9)',
              }}
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setViewState('idle'); setNewApiKey(); setMessage(null); }}
              className="px-3 py-1.5 rounded text-[10px] font-mono transition-colors"
              style={{
                background: 'rgba(100, 116, 139, 0.1)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: 'rgba(100, 116, 139, 0.8)',
              }}
            >
              Cancelar
            </button>
          </div>

          {/* Mensaje */}
          {message && (
            <div className="rounded px-2 py-1.5 text-[9px] font-mono text-amber-400/80" style={{ background: 'rgba(245, 158, 11, 0.08)' }}>
              {message}
            </div>
          )}

          <p className="text-[8px] font-mono text-slate-600">
            La key se guarda en .z-ai-config. Los procesos la leen en el siguiente request.
          </p>
        </div>
      )}

      {/* Saving overlay */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 py-4 text-cyan-400/60">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-mono">Validando y guardando...</span>
        </div>
      )}

      {/* Botón refresh */}
      {viewState === 'idle' && status?.configurado && (
        <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(6, 182, 212, 0.08)' }}>
          <button
            onClick={fetchStatus}
            className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 hover:text-cyan-400/70 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Verificar estado
          </button>
        </div>
      )}
    </PanelShell>
  );
}
