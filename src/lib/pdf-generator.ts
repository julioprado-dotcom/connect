/**
 * @module pdf-generator
 * @description Utilidad ligera para generación de PDFs con jsPDF.
 * Complementa el módulo completo en services/pdf-generator.ts (Puppeteer-based).
 *
 * Este módulo usa jsPDF para generar PDFs simples del lado del cliente,
 * ideal para reportes rápidos, descargas de datos y exportaciones.
 *
 * Biblioteca: jspdf (instalada en package.json)
 */

import { jsPDF } from 'jspdf';

export interface ReportData {
  title: string;
  content: string;
  date: string;
  author?: string;
}

/**
 * Genera un PDF básico con jsPDF.
 * Retorna los bytes del documento generado.
 *
 * @param data - Datos del reporte (título, contenido, fecha, autor)
 * @returns Uint8Array con los bytes del PDF generado
 *
 * @example
 * ```typescript
 * const pdfBytes = await generateReportPDF({
 *   title: 'Informe Semanal',
 *   content: 'Contenido del informe...',
 *   date: '2025-01-15',
 *   author: 'DECODEX Bolivia',
 * });
 * // Para descargar en el navegador:
 * const blob = new Blob([pdfBytes], { type: 'application/pdf' });
 * const url = URL.createObjectURL(blob);
 * window.open(url);
 * ```
 */
export async function generateReportPDF(data: ReportData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Header: marca DECODEX ──
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('DECODEX Bolivia — Sistema de Inteligencia', margin, y);
  y += 6;

  // ── Título ──
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(data.title, margin, y);
  y += 10;

  // ── Metadatos ──
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const metaParts = ['Fecha: ' + data.date];
  if (data.author) metaParts.push('Autor: ' + data.author);
  metaParts.push('Generado: ' + new Date().toLocaleString('es-BO'));
  doc.text(metaParts.join('  |  '), margin, y);
  y += 4;

  // ── Línea separadora ──
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── Contenido ──
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const lines = doc.splitTextToSize(data.content, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines[i], margin, y);
    y += 5.5;
  }

  // ── Pie de página ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      'DECODEX Bolivia · Inteligencia de Señales · Confidencial',
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      'Página ' + p + ' de ' + totalPages,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  return doc.output('arraybuffer');
}
