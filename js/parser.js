/* ============================================
   PARSER — CSV/Excel file reading using SheetJS
   ============================================ */
const Parser = (() => {

    /**
     * Parse a File object (CSV, XLSX, XLS) and return an array of objects.
     * CSV: Parsed manually to preserve European number formats (comma = decimal).
     * XLSX/XLS: Parsed via SheetJS with raw:false for string values.
     */
    async function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const isCSV = file.name.toLowerCase().endsWith('.csv');

            if (isCSV) {
                // ── CSV: read as text, parse manually ──
                reader.onload = (e) => {
                    try {
                        let text = e.target.result;
                        // Remove BOM
                        text = text.replace(/^\uFEFF/, '');

                        // Detect separator using ONLY the HEADER line
                        // (data rows have decimal commas like "14,81" that would confuse detection)
                        const firstLine = text.substring(0, text.indexOf('\n') || 2000);
                        const semicolons = (firstLine.match(/;/g) || []).length;
                        const commas = (firstLine.match(/,/g) || []).length;
                        const sep = semicolons > commas ? ';' : ',';
                        console.log(`[Parser] CSV separator: '${sep}' (header: semicolons=${semicolons}, commas=${commas})`);

                        // Split into lines (handle \r\n and \n)
                        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                        if (lines.length < 2) {
                            resolve([]);
                            return;
                        }

                        // First line = headers
                        const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));

                        // Remaining lines = data rows
                        const data = [];
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(sep);
                            if (values.length < 2) continue; // skip empty/invalid lines
                            const row = {};
                            headers.forEach((h, idx) => {
                                // Keep as raw string — parseNumber handles European format
                                row[h] = (values[idx] || '').trim().replace(/^["']|["']$/g, '');
                            });
                            data.push(row);
                        }

                        console.log(`[Parser] Parsed CSV "${file.name}": ${data.length} rows, ${headers.length} columns`);
                        if (data.length > 0) {
                            console.log('[Parser] Columns:', headers.join(' | '));
                            console.log('[Parser] First row sample:', JSON.stringify(data[0]).substring(0, 500));
                        }

                        resolve(data);
                    } catch (err) {
                        reject(new Error('Error al leer CSV: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('Error al leer el archivo'));
                reader.readAsText(file, 'UTF-8');
            } else {
                // ── XLSX/XLS: use SheetJS ──
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy' });
                        const firstSheet = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheet];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

                        // Clean column names
                        const cleaned = jsonData.map(row => {
                            const obj = {};
                            Object.keys(row).forEach(key => {
                                const cleanKey = key.replace(/^\uFEFF/, '').trim();
                                obj[cleanKey] = row[key];
                            });
                            return obj;
                        });

                        console.log(`[Parser] Parsed XLSX "${file.name}": ${cleaned.length} rows, ${cleaned.length > 0 ? Object.keys(cleaned[0]).length : 0} columns`);
                        if (cleaned.length > 0) {
                            console.log('[Parser] Columns:', Object.keys(cleaned[0]).join(' | '));
                        }

                        resolve(cleaned);
                    } catch (err) {
                        reject(new Error('Error al leer XLSX: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('Error al leer el archivo'));
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * Detect if the data is Stock or Proveedores based on columns
     * Check proveedores-specific columns FIRST (more specific), then stock
     */
    function detectDataType(data) {
        if (!data.length) return 'unknown';
        const cols = Object.keys(data[0]).map(c => c.toLowerCase().trim());

        // Proveedores-specific columns (check first — more specific)
        const provCols = ['nombre comercial', 'dnicif', 'fpago', 'fax'];
        const provMatches = cols.filter(c => provCols.some(pc => c.includes(pc))).length;
        if (provMatches >= 1) return 'proveedores';

        // Also detect by having Email + Telefono + Nombre but NOT Stock/Articulo
        const hasTelEmail = cols.some(c => c.includes('email')) && cols.some(c => c.includes('telefono'));
        const hasStockCols = cols.some(c => c.includes('stock') || c.includes('artículo') || c.includes('articulo') || c.includes('precioadq') || c.includes('precioinvent'));
        if (hasTelEmail && !hasStockCols) return 'proveedores';

        // Incidencias-specific columns
        const incidCols = ['numero', 'solución', 'solucion', 'incidencia'];
        if (cols.some(c => incidCols.some(ic => c.includes(ic)))) {
            return 'incidencias';
        }

        // Stock-specific columns
        if (hasStockCols || cols.some(c => c.includes('proveedor') || c.includes('dfamil') || c.includes('obsoleto'))) {
            return 'stock';
        }

        return 'unknown';
    }

    return { parseFile, detectDataType };
})();
