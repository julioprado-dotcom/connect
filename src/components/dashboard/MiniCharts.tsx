"use client";
import React from "react";

interface BarItem { label: string; total: number; color: string }

const LABELS: Record<string, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  neutro: "Neutro",
  no_clasificado: "Sin clasificar",
  mencion_pasiva: "Pasiva",
  mencion_activa: "Activa",
  menciona: "Menciona",
  mencion_tematica: "Tematica",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positivo: "#10b981",
  negativo: "#f43f5e",
  neutro: "#64748b",
  no_clasificado: "#334155",
};

const TIPO_COLORS: Record<string, string> = {
  mencion_pasiva: "#06b6d4",
  mencion_activa: "#f59e0b",
  menciona: "#a78bfa",
  mencion_tematica: "#64748b",
};

function BarChart({ title, items, fallback, colorMap }: {
  title: string; items: BarItem[]; fallback: string; colorMap: Record<string, string>
}) {
  const max = Math.max(...items.map(i => i.total), 1);
  return (
    <div style={{
      background: "rgba(255,255,255,0.01)",
      border: "1px solid rgba(255,255,255,0.03)",
      borderRadius: 8, padding: "10px 12px", minWidth: 0
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
        {title}
      </p>
      {items.length === 0 ? (
        <p style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>{fallback}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", width: 72, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                {LABELS[item.label] || item.label}
              </span>
              <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.03)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                <div style={{
                  width: `${Math.max((item.total / max) * 100, 2)}%`,
                  height: "100%",
                  background: colorMap[item.label] || "#06b6d4",
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                  minWidth: item.total > 0 ? 4 : 0,
                }} />
              </div>
              <span style={{ fontSize: 9, color: "#e2e8f0", fontFamily: "monospace", width: 32, flexShrink: 0 }}>
                {item.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MiniCharts({ captura }: {
  captura: {
    porNivel?: Array<{ nivel: number; total: number }>;
    porSentimiento?: Array<{ sentimiento: string; total: number }>;
    porTipoMencion?: Array<{ tipo: string; total: number }>;
  };
}) {
  const nivelItems: BarItem[] = (captura.porNivel || []).map(r => ({
    label: `Nivel ${r.nivel}`, total: r.total, color: "#06b6d4"
  }));
  const sentItems: BarItem[] = (captura.porSentimiento || []).map(r => ({
    label: r.sentimiento, total: r.total, color: "#06b6d4"
  }));
  const tipoItems: BarItem[] = (captura.porTipoMencion || []).map(r => ({
    label: r.tipo, total: r.total, color: "#06b6d4"
  }));

  const hasData = nivelItems.length > 0 || sentItems.length > 0 || tipoItems.length > 0;

  if (!hasData) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 10,
      marginBottom: 16,
    }}>
      {nivelItems.length > 0 && <BarChart title="Menciones por Nivel" items={nivelItems} fallback="Sin datos" colorMap={Object.fromEntries(nivelItems.map((_, i) => [nivelItems[i].label, ["#06b6d4","#f59e0b","#10b981","#a78bfa","#f43f5e"][i % 5]]))} />}
      {sentItems.length > 0 && <BarChart title="Sentimiento" items={sentItems} fallback="Sin datos" colorMap={SENTIMENT_COLORS} />}
      {tipoItems.length > 0 && <BarChart title="Tipo de Mencion" items={tipoItems} fallback="Sin datos" colorMap={TIPO_COLORS} />}
    </div>
  );
}
