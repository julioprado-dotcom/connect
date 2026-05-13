'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronDown, ChevronUp, MessageSquare,
  FileCode, FileText, Send, Loader2, Check, AlertCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface KeywordTag {
  label: string;
  type: 'eje' | 'keyword' | 'persona';
}

interface AutocompleteResult {
  label: string;
  type: 'eje' | 'keyword' | 'persona';
}

interface Filtros {
  ejeId: string;
  lenteId: string;
  personaId: string;
}

interface DropdownOption {
  id: string;
  nombre: string;
}

type Formato = 'texto' | 'html' | 'pdf';
type Periodo = '24h' | '7d' | '14d' | '30d' | 'custom';

interface BoletinResult {
  menciones: Array<{
    id: string;
    titulo: string;
    medioNombre: string;
    personaNombre: string | null;
    fechaPublicacion: string | null;
    url: string;
    sentimiento: string;
  }>;
  resumen: string;
  contenido: string;
  formato: string;
  timestamp: string;
}

// ─── Constants ──────────────────────────────────────────────

const PERIODOS: { value: Periodo; label: string; dias: number }[] = [
  { value: '24h', label: 'Últimas 24h', dias: 1 },
  { value: '7d', label: '7 días', dias: 7 },
  { value: '14d', label: '14 días', dias: 14 },
  { value: '30d', label: '30 días', dias: 30 },
];

const FORMATOS: { value: Formato; label: string; icon: React.ReactNode }[] = [
  { value: 'texto', label: 'Texto breve', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'html', label: 'HTML', icon: <FileCode className="w-4 h-4" /> },
  { value: 'pdf', label: 'PDF completo', icon: <FileText className="w-4 h-4" /> },
];

const MAX_KEYWORDS = 5;

// ─── Styles ─────────────────────────────────────────────────

const S = {
  container: 'flex flex-col gap-3',
  section: 'flex flex-col gap-1.5',
  label: 'text-[11px] font-medium tracking-wide uppercase',
  labelColor: '#6b7280',
  input: {
    base: 'w-full rounded-md px-3 py-2 text-xs outline-none transition-all',
    bg: '#0a0a0f',
    border: '1px solid #1a1a2e',
    text: '#ffffff',
    placeholder: '#4b5563',
    focusBorder: '#00ff88',
  },
  tag: {
    container: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium',
    bg: '#12121a',
    border: '1px solid #1a1a2e',
    text: '#00ff88',
  },
  radioGroup: 'flex flex-wrap gap-2',
  radio: (active: boolean) => ({
    container: 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all select-none',
    bg: active ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)',
    border: active ? '1px solid rgba(0,255,136,0.4)' : '1px solid #1a1a2e',
    color: active ? '#00ff88' : '#6b7280',
  }),
  submit: {
    base: 'w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold transition-all',
    bg: '#00ff88',
    color: '#0a0a0f',
    hoverBg: 'rgba(0,255,136,0.85)',
    disabled: 'rgba(0,255,136,0.3)',
  },
};

// ─── Component ──────────────────────────────────────────────

export function BoletinExpress() {
  // ── State ──
  const [keywords, setKeywords] = useState<KeywordTag[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);

  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ ejeId: '', lenteId: '', personaId: '' });

  const [ejes, setEjes] = useState<DropdownOption[]>([]);
  const [lentes, setLentes] = useState<DropdownOption[]>([]);
  const [personas, setPersonas] = useState<DropdownOption[]>([]);

  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [formato, setFormato] = useState<Formato>('texto');

  const [destinatario, setDestinatario] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BoletinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load dropdown data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [ejesRes, personasRes] = await Promise.all([
          fetch('/api/ejes'),
          fetch('/api/personas'),
        ]);
        if (ejesRes.ok) {
          const ejesData = await ejesRes.json();
          setEjes(Array.isArray(ejesData) ? ejesData.map((e: { id: string; nombre: string }) => ({ id: e.id, nombre: e.nombre })) : []);
        }
        if (personasRes.ok) {
          const personasData = await personasRes.json();
          setPersonas(Array.isArray(personasData) ? personasData.map((p: { id: string; nombre: string }) => ({ id: p.id, nombre: p.nombre })) : []);
        }
      } catch {
        // silent
      }

      // Lentes may not exist — try/catch
      try {
        const lentesRes = await fetch('/api/marco-conceptual');
        if (lentesRes.ok) {
          const data = await lentesRes.json();
          // Lentes are part of the marco-conceptual data — try to extract
          if (Array.isArray(data?.lentes)) {
            setLentes(data.lentes.map((l: { id: string; nombre: string }) => ({ id: l.id, nombre: l.nombre })));
          }
        }
      } catch {
        setLentes([]);
      }
    })();
  }, []);

  // ── Close autocomplete on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Autocomplete search ──
  const fetchAutocomplete = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }
    setAutocompleteLoading(true);
    try {
      const res = await fetch(`/api/dashboard/boletin-keywords?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setAutocompleteResults(data.results ?? []);
        setShowAutocomplete(data.results?.length > 0);
      }
    } catch {
      // silent
    } finally {
      setAutocompleteLoading(false);
    }
  }, []);

  function handleKeywordInputChange(value: string) {
    setKeywordInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAutocomplete(value), 200);
  }

  function addKeyword(result: AutocompleteResult) {
    if (keywords.length >= MAX_KEYWORDS) return;
    if (keywords.some((k) => k.label === result.label)) return;
    setKeywords((prev) => [...prev, result]);
    setKeywordInput('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      addKeyword({ label: keywordInput.trim(), type: 'keyword' });
    }
    if (e.key === 'Backspace' && keywordInput === '' && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  }

  function removeKeyword(index: number) {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Period helpers ──
  function getPeriodoValue(): number | { from: string; to: string } {
    if (periodo === 'custom') {
      return { from: customFrom, to: customTo };
    }
    const found = PERIODOS.find((p) => p.value === periodo);
    return found ? found.dias : 7;
  }

  // ── Submit ──
  async function handleSubmit() {
    if (keywords.length === 0) {
      setError('Agrega al menos un keyword');
      return;
    }
    if (periodo === 'custom' && (!customFrom || !customTo)) {
      setError('Define el rango de fechas');
      return;
    }
    if (!destinatario.trim()) {
      setError('Ingresa un destinatario');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        keywords: keywords.map((k) => k.label),
        filtros: {
          ...(filtros.ejeId ? { ejeId: filtros.ejeId } : {}),
          ...(filtros.lenteId ? { lenteId: filtros.lenteId } : {}),
          ...(filtros.personaId ? { personaId: filtros.personaId } : {}),
        },
        periodo: getPeriodoValue(),
        formato,
        destinatario: destinatario.trim(),
      };

      const res = await fetch('/api/dashboard/boletin-express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al generar el boletín');
        return;
      }
      setResult(data);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── Custom select styling ──
  function selectStyle() {
    return `${S.input.base} ${S.input.bg} ${S.input.text} ${S.input.border} appearance-none cursor-pointer`;
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className={S.container} style={{ maxWidth: 400 }}>
      {/* ── Campo 1: Buscador de keywords ── */}
      <div className={S.section}>
        <label className={S.label} style={{ color: S.labelColor }}>
          Keywords
        </label>

        <div ref={searchRef} className="relative">
          <div
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 flex-wrap min-h-[34px]"
            style={{ background: S.input.bg, border: S.input.border }}
          >
            {/* Tags */}
            <AnimatePresence>
              {keywords.map((kw, i) => (
                <motion.span
                  key={`${kw.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={S.tag.container}
                  style={{
                    background: S.tag.bg,
                    border: S.tag.border,
                    color: S.tag.text,
                  }}
                >
                  {kw.label}
                  <button
                    type="button"
                    onClick={() => removeKeyword(i)}
                    className="flex items-center justify-center rounded-sm hover:bg-white/10 transition-colors"
                    style={{ width: 14, height: 14 }}
                    aria-label={`Eliminar ${kw.label}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>

            {/* Input */}
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => handleKeywordInputChange(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onFocus={() => {
                if (autocompleteResults.length > 0) setShowAutocomplete(true);
              }}
              placeholder={keywords.length === 0 ? 'Buscar keywords...' : 'Agregar...'}
              className="bg-transparent border-none outline-none text-xs flex-1 min-w-[80px]"
              style={{ color: S.input.text }}
              disabled={keywords.length >= MAX_KEYWORDS}
            />

            {autocompleteLoading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: '#6b7280' }} />
            )}
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showAutocomplete && autocompleteResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md overflow-hidden"
                style={{
                  background: '#12121a',
                  border: '1px solid #1a1a2e',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {autocompleteResults.map((r, i) => (
                  <button
                    key={`${r.label}-${r.type}-${i}`}
                    type="button"
                    onClick={() => addKeyword(r)}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-white/5"
                    style={{ color: S.input.text }}
                  >
                    <Search className="w-3 h-3 shrink-0" style={{ color: '#6b7280' }} />
                    <span className="truncate flex-1">{r.label}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: r.type === 'eje' ? 'rgba(255,170,0,0.15)' : r.type === 'persona' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                        color: r.type === 'eje' ? '#ffaa00' : r.type === 'persona' ? '#818cf8' : '#6b7280',
                        border: `1px solid ${r.type === 'eje' ? 'rgba(255,170,0,0.3)' : r.type === 'persona' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {r.type}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {keywords.length >= MAX_KEYWORDS && (
          <p className="text-[10px]" style={{ color: '#ffaa00' }}>
            Máximo {MAX_KEYWORDS} keywords
          </p>
        )}
      </div>

      {/* ── Campo 2: Filtros adicionales ── */}
      <div className={S.section}>
        <button
          type="button"
          onClick={() => setFiltrosOpen(!filtrosOpen)}
          className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
          style={{ color: S.labelColor }}
        >
          {filtrosOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Filtros adicionales
          {(filtros.ejeId || filtros.lenteId || filtros.personaId) && (
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#00ff88' }}
            />
          )}
        </button>

        <AnimatePresence>
          {filtrosOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                {/* Eje */}
                <select
                  value={filtros.ejeId}
                  onChange={(e) => setFiltros((f) => ({ ...f, ejeId: e.target.value }))}
                  className={selectStyle()}
                  style={{ flex: 1, fontSize: 11 }}
                >
                  <option value="">Eje</option>
                  {ejes.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>

                {/* Lente */}
                <select
                  value={filtros.lenteId}
                  onChange={(e) => setFiltros((f) => ({ ...f, lenteId: e.target.value }))}
                  className={selectStyle()}
                  style={{ flex: 1, fontSize: 11 }}
                >
                  <option value="">Lente</option>
                  {lentes.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>

                {/* Persona */}
                <select
                  value={filtros.personaId}
                  onChange={(e) => setFiltros((f) => ({ ...f, personaId: e.target.value }))}
                  className={selectStyle()}
                  style={{ flex: 1, fontSize: 11 }}
                >
                  <option value="">Persona</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Campo 3: Periodo ── */}
      <div className={S.section}>
        <label className={S.label} style={{ color: S.labelColor }}>
          Periodo
        </label>
        <div className={S.radioGroup}>
          {PERIODOS.map((p) => {
            const active = periodo === p.value;
            const rs = S.radio(active);
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodo(p.value)}
                className={rs.container}
                style={{
                  background: rs.bg,
                  border: rs.border,
                  color: rs.color,
                }}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPeriodo('custom')}
            className={S.radio(periodo === 'custom').container}
            style={{
              background: periodo === 'custom' ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)',
              border: periodo === 'custom' ? '1px solid rgba(0,255,136,0.4)' : '1px solid #1a1a2e',
              color: periodo === 'custom' ? '#00ff88' : '#6b7280',
            }}
          >
            Personalizado
          </button>
        </div>

        <AnimatePresence>
          {periodo === 'custom' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className={selectStyle()}
                  style={{ flex: 1, fontSize: 11, colorScheme: 'dark' }}
                />
                <span className="self-center text-[10px]" style={{ color: '#6b7280' }}>→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className={selectStyle()}
                  style={{ flex: 1, fontSize: 11, colorScheme: 'dark' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Campo 4: Formato de salida ── */}
      <div className={S.section}>
        <label className={S.label} style={{ color: S.labelColor }}>
          Formato de salida
        </label>
        <div className={S.radioGroup}>
          {FORMATOS.map((f) => {
            const active = formato === f.value;
            const rs = S.radio(active);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormato(f.value)}
                className={rs.container}
                style={{
                  background: rs.bg,
                  border: rs.border,
                  color: rs.color,
                }}
              >
                {f.icon}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Campo 5: Destinatario ── */}
      <div className={S.section}>
        <label className={S.label} style={{ color: S.labelColor }}>
          Destinatario
        </label>
        <input
          type="text"
          value={destinatario}
          onChange={(e) => setDestinatario(e.target.value)}
          placeholder="Email, chat ID de Telegram, o WhatsApp"
          className={`${S.input.base}`}
          style={{
            background: S.input.bg,
            border: S.input.border,
            color: S.input.text,
            fontSize: 11,
          }}
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || keywords.length === 0}
        className={S.submit.base}
        style={{
          background: loading || keywords.length === 0 ? S.submit.disabled : S.submit.bg,
          color: loading ? '#6b7280' : S.submit.color,
          cursor: loading || keywords.length === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generando...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Generar y enviar
          </>
        )}
      </button>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px]"
            style={{ background: 'rgba(255,51,85,0.1)', border: '1px solid rgba(255,51,85,0.3)', color: '#ff3355' }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Result ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-2 pt-1"
          >
            {/* Success banner */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px]"
              style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88' }}
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              {result.resumen}
            </div>

            {/* Result preview */}
            <div
              className="rounded-md overflow-hidden"
              style={{
                background: '#0a0a0f',
                border: '1px solid #1a1a2e',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {result.formato === 'html' ? (
                <iframe
                  srcDoc={result.contenido}
                  className="w-full"
                  style={{ height: 280, border: 'none' }}
                  title="Vista previa del boletín"
                />
              ) : (
                <pre
                  className="p-3 text-[10px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    color: '#d1d5db',
                    fontFamily: 'Geist Mono, JetBrains Mono, monospace',
                  }}
                >
                  {result.contenido}
                </pre>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-[9px]" style={{ color: '#6b7280', fontFamily: 'Geist Mono, monospace' }}>
              <span>{result.menciones.length} menciones</span>
              <span>·</span>
              <span>{result.formato}</span>
              <span>·</span>
              <span>{new Date(result.timestamp).toLocaleTimeString('es-BO')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
