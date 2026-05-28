'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  Shield, Lock, Settings, BookOpen, Scale, Search, Edit3, GitBranch,
  AlertTriangle, CheckCircle2, Save, ChevronDown, ChevronUp, Eye,
  Loader2, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import { EjesClienteTab } from './_components/EjesClienteTab';
import { PreviewPanel } from './_components/PreviewPanel';

// ─── Types ──────────────────────────────────────────────────────

interface Principio {
  numero: number;
  nombre: string;
  definicion: string;
  que_es: string[];
  que_no_es: string[];
  errores_llm: string[];
  reglas_operativas: string[];
}

interface MarcoData {
  id: number;
  version: number;
  principios: { principios: Principio[] };
  contextoInstitucional: Record<string, unknown>;
  lineasEditoriales: Record<string, unknown>;
  ejesInstitucionales: Record<string, unknown>;
  escalaTratamiento: Record<string, unknown>;
  reglasDesambiguacion: Record<string, unknown>;
  criteriosRelevancia: Record<string, unknown>;
  exclusionesEtica: Record<string, unknown>;
  terminologiaPermitida: Record<string, unknown>;
  terminologiaProhibida: Record<string, unknown>;
  preguntasFundamentales: Record<string, unknown>;
  parametros: Record<string, unknown>;
  creadoEn: string;
  editadoEn: string | null;
}

interface CambioRecord {
  id: number;
  campo: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  razon: string | null;
  creadoPor: string | null;
  creadoEn: string;
}

// ─── TABS ───────────────────────────────────────────────────────

const TABS = [
  { id: 'principios', label: 'Principios Fundantes', icon: Lock, editable: false },
  { id: 'contexto', label: 'Contexto Institucional', icon: BookOpen, editable: true },
  { id: 'escala', label: 'Escala de Tratamiento', icon: Scale, editable: true },
  { id: 'relevancia', label: 'Criterios de Relevancia', icon: Search, editable: true },
  { id: 'editoriales', label: 'Lineas Editoriales', icon: Edit3, editable: true },
  { id: 'terminologia', label: 'Terminologia', icon: Settings, editable: true },
  { id: 'etica', label: 'Exclusiones Eticas', icon: Shield, editable: true },
  { id: 'preguntas', label: 'Preguntas Fundamentales', icon: BookOpen, editable: true },
  { id: 'parametros', label: 'Parametros Tecnicos', icon: Settings, editable: true },
  { id: 'ejes-cliente', label: 'Ejes por Cliente', icon: Shield, editable: false },
  { id: 'historial', label: 'Historial de Cambios', icon: GitBranch, editable: false },
] as const;

const CAMPO_MAP: Record<string, string> = {
  contexto: 'contextoInstitucional',
  escala: 'escalaTratamiento',
  relevancia: 'criteriosRelevancia',
  editoriales: 'lineasEditoriales',
  terminologia: 'terminologiaPermitida',
  etica: 'exclusionesEtica',
  preguntas: 'preguntasFundamentales',
  parametros: 'parametros',
};

// ─── Component ──────────────────────────────────────────────────

export default function MarcoConceptualPage() {
  const [marco, setMarco] = useState<MarcoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('principios');
  const [expandedPrincipio, setExpandedPrincipio] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [historial, setHistorial] = useState<CambioRecord[]>([]);

  // Edit states for each tab
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [razonChange, setRazonChange] = useState('');

  const fetchMarco = useCallback(async () => {
    try {
      const res = await fetch('/api/marco-conceptual');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMarco(data);
      // Initialize edit values as JSON strings
      const edits: Record<string, string> = {};
      for (const [key, campo] of Object.entries(CAMPO_MAP)) {
        edits[key] = JSON.stringify(data[campo as keyof MarcoData] || {}, null, 2);
      }
      setEditValues(edits);
    } catch {
      setMarco(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await fetch('/api/marco-conceptual/historial');
      if (res.ok) {
        const data = await res.json();
        setHistorial(data.cambios || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMarco(); fetchHistorial(); }, [fetchMarco, fetchHistorial]);

  const handleSave = async (tabId: string) => {
    const campo = CAMPO_MAP[tabId];
    if (!campo || !marco) return;

    let valor: unknown;
    try {
      valor = JSON.parse(editValues[tabId]);
    } catch {
      setSaveMessage({ type: 'error', text: 'JSON invalido' });
      return;
    }

    if (!razonChange.trim()) {
      setSaveMessage({ type: 'error', text: 'La razon del cambio es obligatoria' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/marco-conceptual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, valor, razon: razonChange.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage({ type: 'ok', text: 'Guardado correctamente' });
        setRazonChange('');
        fetchMarco();
        fetchHistorial();
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Error al guardar' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Error de conexion' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!marco) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg font-semibold">Marco conceptual no inicializado</p>
        <p className="text-sm text-muted-foreground">Ejecute el seed para crear la version inicial.</p>
      </div>
    );
  }

  const principios = (marco.principios?.principios || []) as Principio[];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button></Link>
              <div>
                <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Marco Conceptual
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Version {marco.version} · Creado {new Date(marco.creadoEn).toLocaleDateString('es-BO')}
                  {marco.editadoEn && ` · Editado ${new Date(marco.editadoEn).toLocaleDateString('es-BO')}`}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">v{marco.version}</Badge>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap
                    transition-colors border-b-2 -mb-[1px]
                    ${isActive
                      ? tab.editable
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-muted-foreground text-muted-foreground bg-muted/50'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }
                  `}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                  {!tab.editable && <Lock className="h-2.5 w-2.5 opacity-50" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* TAB 1: Principios Fundantes (READ-ONLY) */}
        {activeTab === 'principios' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                <Lock className="h-3 w-3 mr-1" /> INMUTABLE — No editable
              </Badge>
            </div>
            {principios.map(p => (
              <Card key={p.numero}>
                <CardContent className="p-4">
                  <button
                    className="w-full flex items-start gap-3 text-left"
                    onClick={() => setExpandedPrincipio(expandedPrincipio === p.numero ? null : p.numero)}
                  >
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                      {p.numero}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{p.nombre}</h3>
                        {expandedPrincipio === p.numero
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-1 leading-relaxed">{p.definicion}</p>
                    </div>
                  </button>
                  {expandedPrincipio === p.numero && (
                    <div className="mt-4 ml-11 space-y-4 text-xs">
                      {/* Que es */}
                      <div>
                        <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Que es</h4>
                        <ul className="space-y-1">
                          {p.que_es.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Que no es */}
                      <div>
                        <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1.5">Que NO es</h4>
                        <ul className="space-y-1">
                          {p.que_no_es.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <AlertTriangle className="h-3 w-3 mt-0.5 text-red-400 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Errores LLM */}
                      <div>
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1.5">Errores comunes del LLM</h4>
                        <ul className="space-y-1">
                          {p.errores_llm.map((item, i) => (
                            <li key={i} className="text-muted-foreground flex gap-1.5">
                              <span className="text-amber-500 shrink-0">&#9888;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Reglas operativas */}
                      <div>
                        <h4 className="font-semibold text-primary mb-1.5">Reglas operativas</h4>
                        <div className="space-y-1.5">
                          {p.reglas_operativas.map((item, i) => (
                            <div key={i} className="bg-muted/60 rounded-md p-2.5 font-mono text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2-9: Editable tabs */}
        {activeTab !== 'principios' && activeTab !== 'historial' && activeTab !== 'ejes-cliente' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 dark:text-blue-400">
                    <Edit3 className="h-3 w-3 mr-1" /> EDITABLE
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Campo: {CAMPO_MAP[activeTab]}
                  </span>
                </div>
                <textarea
                  className="w-full h-80 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  value={editValues[activeTab] || '{}'}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground shrink-0">
                      Razon del cambio (obligatorio):
                    </label>
                    <Input
                      className="flex-1 h-8 text-xs"
                      placeholder="Explique por que realiza este cambio..."
                      value={razonChange}
                      onChange={(e) => setRazonChange(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => handleSave(activeTab)}
                      disabled={saving || !razonChange.trim()}
                      className="text-xs gap-1.5"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const campo = CAMPO_MAP[activeTab];
                        setEditValues(prev => ({
                          ...prev,
                          [activeTab]: JSON.stringify(marco[campo as keyof MarcoData] || {}, null, 2),
                        }));
                        setSaveMessage(null);
                      }}
                      className="text-xs"
                    >
                      Restaurar original
                    </Button>
                    {saveMessage && (
                      <span className={`text-xs ${saveMessage.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {saveMessage.text}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  Vista previa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <PreviewPanel tabId={activeTab} value={editValues[activeTab] || '{}'} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB: Ejes por Cliente */}
        {activeTab === 'ejes-cliente' && <EjesClienteTab />}

        {/* TAB 10: Historial */}
        {activeTab === 'historial' && (
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground mb-3">
                Registro de cambios de la version {marco.version} ({historial.length} cambios)
              </p>
              {historial.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Campo</TableHead>
                      <TableHead className="text-xs">Razon</TableHead>
                      <TableHead className="text-xs">Editado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {new Date(c.creadoEn).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-[10px]">{c.campo}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-foreground max-w-[300px] truncate" title={c.razon || ''}>
                          {c.razon || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">{c.creadoPor || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sin cambios registrados</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
