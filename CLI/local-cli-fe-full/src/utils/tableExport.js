/**
 * Shared export utilities for table data (CSV and PDF)
 * Used by Client Dashboard, SQL Query Generator, and UNS plugin
 */
import { jsPDF } from 'jspdf';

/**
 * Export table data to CSV file
 * @param {Array<Object>} data - Array of row objects
 * @param {string} [filename] - Optional filename (without extension)
 */
export function exportToCSV(data, filename) {
  if (!data || !Array.isArray(data) || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const escape = (val) => {
    const str = val != null ? String(val) : '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const csvRows = [
    headers.map(escape).join(','),
    ...data.map(row => headers.map(h => escape(row[h])).join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename || 'query-results'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export table data and optional chart image to PDF
 * @param {Array<Object>} data - Table data
 * @param {string} [chartImageDataUrl] - Chart as PNG data URL (optional)
 * @param {Object} [options] - { title, tableTitle, filename, description, command, name, type, dbms, table }
 */
export function exportToPDF(data, chartImageDataUrl, options = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const title = options.title || 'Query Results Report';
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 10;

  // Command section (e.g. for Client Dashboard)
  if (options.command != null && String(options.command).trim() !== '') {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Command', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const cmdStr = String(options.command).trim();
    const lines = doc.splitTextToSize(cmdStr, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 8;
  }

  // Description section at the top (if present)
  if (options.description != null && String(options.description).trim() !== '') {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Description', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const descStr = String(options.description).trim();
    const lines = doc.splitTextToSize(descStr, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;
  }

  doc.setFontSize(10);
  if (options.name != null && options.name !== '') {
    doc.text(`Name: ${options.name}`, margin, y);
    y += 5;
  }
  if (options.type != null && options.type !== '') {
    doc.text(`Type: ${options.type}`, margin, y);
    y += 5;
  }
  if (options.dbms != null && options.dbms !== '') {
    doc.text(`DBMS: ${options.dbms}`, margin, y);
    y += 5;
  }
  if (options.table != null && options.table !== '') {
    doc.text(`Table: ${options.table}`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 8;

  // Table
  if (data && Array.isArray(data) && data.length > 0) {
    const tableTitle = options.tableTitle || 'Table Data';
    doc.setFontSize(12);
    doc.text(tableTitle, margin, y);
    y += 8;

    const headers = Object.keys(data[0]);
    const colCount = headers.length;
    const colW = Math.min((pageW - 2 * margin) / colCount, 40);
    const rowH = 7;
    const fontSize = 8;
    doc.setFontSize(fontSize);

    // Header row
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, colW * colCount, rowH, 'F');
    headers.forEach((h, i) => {
      doc.text(String(h).slice(0, 15), margin + i * colW + 2, y + 5);
    });
    y += rowH;

    const maxRowsPerPage = Math.floor((doc.internal.pageSize.getHeight() - y - margin - 60) / rowH);
    let rowsAdded = 0;

    for (const row of data) {
      if (rowsAdded >= maxRowsPerPage) {
        doc.addPage();
        y = margin;
        rowsAdded = 0;
      }
      const rowY = y;
      headers.forEach((h, i) => {
        const val = row[h];
        const str = val != null ? String(val).slice(0, 20) : '';
        doc.text(str, margin + i * colW + 2, rowY + 5);
      });
      y += rowH;
      rowsAdded++;
    }
    y += 10;
  }

  // Chart image (optional)
  if (chartImageDataUrl) {
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Line Chart', margin, y);
    y += 8;
    try {
      const imgW = pageW - 2 * margin;
      const imgH = 60;
      doc.addImage(chartImageDataUrl, 'PNG', margin, y, imgW, imgH);
      y += imgH + 10;
    } catch (e) {
      doc.text('(Chart could not be embedded)', margin, y);
      y += 10;
    }
  }

  const filename = `${options.filename || 'query-results'}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
