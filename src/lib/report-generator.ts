/**
 * DECODEX — Report Generator Utility
 * Genera PDFs y PNGs a partir de elementos del DOM o datos estructurados.
 * Usa html2canvas-pro para capturas de pantalla y jspdf para PDFs.
 */

import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

/**
 * Captura un elemento del DOM como PNG (data URL).
 * Útil para snapshots de dashboards, tablas, gráficos.
 */
export async function captureElementAsPNG(
  element: HTMLElement,
  options?: {
    backgroundColor?: string;
    scale?: number;
    quality?: number;
  }
): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: options?.backgroundColor || '#ffffff',
    scale: options?.scale || 2,
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png', options?.quality || 0.95);
  return dataUrl;
}

/**
 * Captura un elemento del DOM y lo descarga como archivo PNG.
 */
export async function downloadElementAsPNG(
  element: HTMLElement,
  filename: string,
  options?: {
    backgroundColor?: string;
    scale?: number;
  }
): Promise<void> {
  const dataUrl = await captureElementAsPNG(element, options);
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Genera un PDF simple a partir de un elemento del DOM.
 * Captura el elemento como imagen y lo inserta en un PDF A4.
 */
export async function downloadElementAsPDF(
  element: HTMLElement,
  filename: string,
  options?: {
    title?: string;
    orientation?: 'portrait' | 'landscape';
    scale?: number;
  }
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: options?.scale || 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const orientation = options?.orientation || 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;
  let page = 0;

  // First page
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);
  position -= (pageHeight - margin * 2);

  // Additional pages if content overflows
  while (heightLeft > 0) {
    page++;
    pdf.addPage();
    position = margin;
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Genera un PDF con contenido HTML personalizado.
 * Útil para informes estructurados con título, fecha, secciones.
 */
export function generateReportPDF(
  content: {
    title: string;
    subtitle?: string;
    sections: Array<{
      title: string;
      content: string;
    }>;
    footer?: string;
  },
  options?: {
    filename?: string;
    orientation?: 'portrait' | 'landscape';
  }
): void {
  const orientation = options?.orientation || 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(content.title, margin, y, { maxWidth: usableWidth });
  y += 10;

  // Subtitle
  if (content.subtitle) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(content.subtitle, margin, y, { maxWidth: usableWidth });
    y += 5;
  }

  // Date
  pdf.setFontSize(8);
  pdf.text(new Date().toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }), margin, y);
  y += 3;
  pdf.setDrawColor(0, 150, 200);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Sections
  pdf.setTextColor(0, 0, 0);
  for (const section of content.sections) {
    if (y > pageHeight - 30) {
      pdf.addPage();
      y = margin;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.title, margin, y, { maxWidth: usableWidth });
    y += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(section.content, usableWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 4.5;
    }
    y += 6;
  }

  // Footer
  if (content.footer) {
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(content.footer, margin, pageHeight - 10, {
      align: 'center',
      maxWidth: usableWidth,
    });
  }

  const filename = options?.filename || `reporte-${Date.now()}.pdf`;
  pdf.save(filename);
}
