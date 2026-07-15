import * as XLSX from 'xlsx';

export function downloadReportRows(
  rows: Record<string, unknown>[],
  baseName: string,
  format: 'xlsx' | 'csv' = 'xlsx',
) {
  if (!rows.length) {
    throw new Error('No hay filas para descargar en el rango elegido');
  }

  const safe = baseName.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, '').trim() || 'informe';
  const stamp = new Date().toISOString().slice(0, 10);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Informe');

  if (format === 'csv') {
    XLSX.writeFile(wb, `${safe}-${stamp}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `${safe}-${stamp}.xlsx`);
  }
}
