'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FileDown, Image, FileText, Loader2, ChevronDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// ExportMenu — Botón desplegable Exportar PDF / PNG
// Usa html2canvas-pro + jsPDF (client-side, sin Edge Runtime issues)
// ═══════════════════════════════════════════════════════════════

interface ExportMenuProps {
  /** Ref del contenedor a capturar como imagen/PDF */
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Nombre base del archivo (sin extensión) */
  filename: string;
  /** Título que aparece en el encabezado del PDF */
  title?: string;
  /** Color primario del PDF (default: #06b6d4) */
  color?: string;
}

export function ExportMenu({ targetRef, filename, title, color = '#06b6d4' }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const exportPNG = useCallback(async () => {
    if (!targetRef.current) return;
    setExporting('png');
    setOpen(false);

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0e17',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 0.95);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[ExportMenu] Error exportando PNG:', err);
    } finally {
      setExporting(null);
    }
  }, [targetRef, filename]);

  const exportPDF = useCallback(async () => {
    if (!targetRef.current) return;
    setExporting('pdf');
    setOpen(false);

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0e17',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 landscape por defecto para dashboards
      const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;

      const pdfWidth = pageWidth - margin * 2;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

      let heightLeft = pdfHeight;
      let position = margin;

      // Primera página
      pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight);
      heightLeft -= (pageHeight - margin * 2);

      // Páginas adicionales si el contenido es largo
      while (heightLeft > 0) {
        position = margin - (pdfHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('[ExportMenu] Error exportando PDF:', err);
    } finally {
      setExporting(null);
    }
  }, [targetRef, filename]);

  const isBusy = exporting !== null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón principal */}
      <button
        onClick={() => !isBusy && setOpen(!open)}
        disabled={isBusy}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold uppercase font-mono tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: '#06b6d4',
          backgroundColor: open ? 'rgba(6,182,212,0.1)' : 'transparent',
          border: '1px solid rgba(6,182,212,0.2)',
          boxShadow: open ? '0 0 8px rgba(6,182,212,0.15)' : 'none',
        }}
        title="Exportar"
      >
        {isBusy ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {exporting === 'pdf' ? 'PDF...' : 'PNG...'}
          </>
        ) : (
          <>
            <FileDown className="w-3 h-3" />
            Exportar
            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-md overflow-hidden min-w-[140px]"
          style={{
            background: 'rgba(10, 14, 23, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(6, 182, 212, 0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* PDF */}
          <button
            onClick={exportPDF}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono transition-all duration-150"
            style={{
              color: '#e2e8f0',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.08)';
              e.currentTarget.style.color = '#06b6d4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#e2e8f0';
            }}
          >
            <FileText className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            <span className="flex-1 text-left">PDF</span>
            <span className="text-[8px] opacity-40">A4</span>
          </button>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: 'rgba(6,182,212,0.1)' }} />

          {/* PNG */}
          <button
            onClick={exportPNG}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono transition-all duration-150"
            style={{
              color: '#e2e8f0',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.08)';
              e.currentTarget.style.color = '#06b6d4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#e2e8f0';
            }}
          >
            <Image className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            <span className="flex-1 text-left">PNG</span>
            <span className="text-[8px] opacity-40">2x</span>
          </button>
        </div>
      )}
    </div>
  );
}
