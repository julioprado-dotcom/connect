'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ExternalLink, Radio, Plus, ToggleLeft, ToggleRight,
  Landmark, Building2, MapPin, Newspaper, Share2, Trash2, X,
  ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle2,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/KPICard';
import {
  CATEGORIA_LABELS, CATEGORIA_COLORS, CATEGORIAS,
  TIPO_MEDIO_LABELS, NIVEL_LABELS, NIVEL_COLORS,
} from '@/constants/ui';
import type { MedioItem } from '@/types/dashboard';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  oficial: <Landmark className="h-3.5 w-3.5" />,
  corporativo: <Building2 className="h-3.5 w-3.5" />,
  regional: <MapPin className="h-3.5 w-3.5" />,
  alternativo: <Newspaper className="h-3.5 w-3.5" />,
  red_social: <Share2 className="h-3.5 w-3.5" />,
};

// ─── Tipo Medio options para el formulario ─────────────────────
const TIPO_OPTIONS = [
  { value: 'agencia_noticias', label: 'Agencia de Noticias' },
  { value: 'diario', label: 'Diario' },
  { value: 'portal_web', label: 'Portal Web' },
  { value: 'television', label: 'Televisión' },
  { value: 'radio', label: 'Radio' },
  { value: 'revista', label: 'Revista' },
  { value: 'institucional', label: 'Sitio Institucional' },
  { value: 'ente_regulador', label: 'Ente Regulador' },
  { value: 'tribunal', label: 'Tribunal' },
  { value: 'red_social', label: 'Red Social' },
  { value: 'otro', label: 'Otro' },
];

const CATEGORIA_OPTIONS = CATEGORIAS.map((c) => ({
  value: c,
  label: CATEGORIA_LABELS[c],
}));

export function MediosView() {
  const [medios, setMedios] = useState<MedioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTipo, setFormTipo] = useState('diario');
  const [formCategoria, setFormCategoria] = useState('corporativo');
  const [formNivel, setFormNivel] = useState('1');
  const [formDepartamento, setFormDepartamento] = useState('');
  const [formPlataformas, setFormPlataformas] = useState('');
  const [formNotas, setFormNotas] = useState('');

  // Resumen
  const [resumen, setResumen] = useState<Array<{
    categoria: string;
    etiqueta: string;
    totalMedios: number;
    mencionesCount: number;
  }>>([]);

  const fetchMedios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'todos') params.set('categoria', activeCategory);
      const res = await fetch(`/api/medios?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setMedios(json.medios || []);
      setResumen(json.resumenPorCategoria || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchMedios();
  }, [fetchMedios]);

  // ─── Toggle activo/inactivo ───────────────────────────────────
  const toggleActivo = async (medio: MedioItem) => {
    setTogglingId(medio.id);
    try {
      const res = await fetch(`/api/medios/${medio.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !medio.activo }),
      });
      if (res.ok) {
        setMedios((prev) =>
          prev.map((m) => (m.id === medio.id ? { ...m, activo: !m.activo } : m)),
        );
      }
    } catch {
      // silent
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Eliminar medio ───────────────────────────────────────────
  const deleteMedio = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/medios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMedios((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Agregar medio ────────────────────────────────────────────
  const handleAddMedio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/medios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          url: formUrl.trim(),
          tipo: formTipo,
          categoria: formCategoria,
          nivel: formNivel,
          departamento: formDepartamento.trim() || undefined,
          plataformas: formPlataformas.trim(),
          notas: formNotas.trim(),
        }),
      });
      if (res.ok) {
        setFormNombre('');
        setFormUrl('');
        setFormTipo('diario');
        setFormCategoria('corporativo');
        setFormNivel('1');
        setFormDepartamento('');
        setFormPlataformas('');
        setFormNotas('');
        setShowAddForm(false);
        fetchMedios();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────
  const getCategoryIcon = (cat: string) => CATEGORY_ICONS[cat] || <Radio className="h-3.5 w-3.5" />;

  const filteredMedios = medios;

  // Count active by category for summary cards
  const totalActivos = medios.filter((m) => m.activo).length;
  const totalInactivos = medios.filter((m) => !m.activo).length;

  return (
    <div className="space-y-4">
      {/* ─── Resumen KPIs por categoría ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{medios.length}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">{totalActivos} activos</span>
          </div>
        </Card>
        {resumen.map((r) => (
          <Card key={r.categoria} className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {getCategoryIcon(r.categoria)}
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                {r.etiqueta}
              </p>
            </div>
            <p className="text-lg font-bold">{r.totalMedios}</p>
            <p className="text-[10px] text-muted-foreground">{r.mencionesCount} menciones</p>
          </Card>
        ))}
      </div>

      {/* ─── Categorías tabs + Add button ────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'todos'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Todos
          </button>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? CATEGORIA_COLORS[cat]
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {getCategoryIcon(cat)}
              {CATEGORIA_LABELS[cat]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAddForm ? 'Cancelar' : 'Agregar Medio'}
        </button>
      </div>

      {/* ─── Formulario agregar medio ───────────────────────── */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Agregar nuevo medio</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleAddMedio} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Nombre */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej: ABI - Agencia Boliviana de Información"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                {/* URL */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://www.abi.bo"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {/* Tipo */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Tipo
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {/* Categoría */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIA_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {/* Nivel */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Prioridad
                  </label>
                  <select
                    value={formNivel}
                    onChange={(e) => setFormNivel(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="1">Alta</option>
                    <option value="2">Media</option>
                    <option value="3">Baja</option>
                  </select>
                </div>
                {/* Departamento */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={formDepartamento}
                    onChange={(e) => setFormDepartamento(e.target.value)}
                    placeholder="La Paz, Santa Cruz..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Plataformas */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Plataformas
                  </label>
                  <input
                    type="text"
                    value={formPlataformas}
                    onChange={(e) => setFormPlataformas(e.target.value)}
                    placeholder="web, facebook, youtube, x"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {/* Notas */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Notas
                  </label>
                  <input
                    type="text"
                    value={formNotas}
                    onChange={(e) => setFormNotas(e.target.value)}
                    placeholder="Observaciones adicionales"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !formNombre.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {saving ? 'Guardando...' : 'Guardar Medio'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Sección Redes Sociales — Info Banner ───────────── */}
      {activeCategory === 'todos' || activeCategory === 'red_social' ? (
        <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-800 dark:text-purple-300 space-y-1">
                <p className="font-semibold">Protocolo de Monitoreo — Redes Sociales</p>
                <ul className="list-disc list-inside space-y-0.5 text-purple-700 dark:text-purple-400">
                  <li><strong>No seguimos personas ni medios.</strong> Monitoreamos secciones de comentarios en noticias relevantes.</li>
                  <li>Top 10 publicaciones relevantes por ejes temáticos y subtemas para indicadores.</li>
                  <li>Analizamos y clasificamos por tema y clima — <strong>no almacenamos</strong> datos de redes.</li>
                  <li>Seguimiento mínimo en <strong>X (Twitter)</strong> y <strong>Facebook</strong>.</li>
                  <li>Sugerencias adicionales: <strong>Telegram</strong> (canales de noticias), <strong>YouTube</strong> (comentarios de noticias), <strong>TikTok</strong> (tendencias políticas).</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Lista de medios ────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMedios.length > 0 ? (
            <div className="space-y-1">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
                <div className="col-span-1">Estado</div>
                <div className="col-span-3">Medio</div>
                <div className="col-span-2">Categoría</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-1 text-center">Prioridad</div>
                <div className="col-span-1 text-center">Menciones</div>
                <div className="col-span-2 text-right">Acciones</div>
              </div>
              {/* Table body */}
              {filteredMedios.map((m) => (
                <div
                  key={m.id}
                  className={`group grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg transition-colors ${
                    m.activo
                      ? 'hover:bg-muted/50'
                      : 'opacity-50 bg-muted/30'
                  } ${expandedId === m.id ? 'bg-muted/30 ring-1 ring-primary/20' : ''}`}
                >
                  {/* Toggle activo/inactivo */}
                  <div className="col-span-1">
                    <button
                      onClick={() => toggleActivo(m)}
                      disabled={togglingId === m.id}
                      className="transition-colors"
                      title={m.activo ? 'Desactivar' : 'Activar'}
                    >
                      {togglingId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : m.activo ? (
                        <ToggleRight className="h-5 w-5 text-emerald-500 hover:text-emerald-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      )}
                    </button>
                  </div>
                  {/* Nombre + depto */}
                  <div className="col-span-3 min-w-0">
                    <button
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      className="flex items-center gap-1 w-full text-left"
                    >
                      {expandedId === m.id ? (
                        <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <p className={`text-sm font-medium truncate ${m.activo ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                        {m.nombre}
                      </p>
                    </button>
                    {m.departamento && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">{m.departamento}</p>
                    )}
                  </div>
                  {/* Categoría */}
                  <div className="col-span-2">
                    <Badge variant="secondary" className={`text-[10px] ${CATEGORIA_COLORS[m.categoria] || ''}`}>
                      {CATEGORIA_LABELS[m.categoria] || m.categoria}
                    </Badge>
                  </div>
                  {/* Tipo */}
                  <div className="col-span-2">
                    <span className="text-[11px] text-muted-foreground">
                      {TIPO_MEDIO_LABELS[m.tipo] || m.tipo}
                    </span>
                  </div>
                  {/* Nivel */}
                  <div className="col-span-1 text-center">
                    <Badge variant="secondary" className={`text-[10px] ${NIVEL_COLORS[m.nivel] || ''}`}>
                      {NIVEL_LABELS[m.nivel] || `N${m.nivel}`}
                    </Badge>
                  </div>
                  {/* Menciones */}
                  <div className="col-span-1 text-center">
                    <span className="text-xs font-medium">{m.mencionesCount}</span>
                  </div>
                  {/* Acciones */}
                  <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Visitar sitio"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => deleteMedio(m.id)}
                      disabled={deletingId === m.id}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      {deletingId === m.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* ─── Expanded detail panels ─────────────────────── */}
              {filteredMedios.filter((m) => expandedId === m.id).map((m) => (
                <div key={`detail-${m.id}`} className="mx-3 mb-2 p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">URL</p>
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{m.url}</a>
                      ) : (
                        <span className="text-muted-foreground">Sin URL</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Plataformas</p>
                      <p>{m.plataformas || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">País</p>
                      <p>{m.pais || 'Bolivia'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Notas</p>
                      <p>{m.notas || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Radio className="h-10 w-10" />}
              text={
                activeCategory === 'todos'
                  ? 'No hay medios registrados'
                  : `No hay medios en "${CATEGORIA_LABELS[activeCategory] || activeCategory}"`
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
