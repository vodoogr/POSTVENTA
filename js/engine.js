/* ============================================
   ENGINE — Data processing & calculations
   ============================================ */
const Engine = (() => {

    /** Normalize string for join matching */
    function normalizeForJoin(str) {
        if (!str) return '';
        return String(str)
            .trim()
            .toUpperCase()
            .replace(/^\*+/, '') // Remove leading asterisks
            .replace(/[.\-\/\\,;:'"()]/g, '')
            .replace(/\s+/g, ' ');
    }

    /** Parse a date string in various formats */
    function parseDate(val) {
        if (!val) return null;
        if (val instanceof Date) return val;
        // Try ISO and common formats
        const d = new Date(val);
        if (!isNaN(d)) return d;
        // Try DD/MM/YYYY
        const parts = String(val).split(/[\/\-\.]/);
        if (parts.length === 3) {
            const [a, b, c] = parts.map(Number);
            if (a > 31) return new Date(a, b - 1, c); // YYYY-MM-DD
            if (c > 100) return new Date(c, b - 1, a); // DD/MM/YYYY
            return new Date(2000 + c, b - 1, a); // DD/MM/YY
        }
        return null;
    }

    /** Parse number from various formats */
    function parseNumber(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        // Remove thousands separators, handle comma as decimal
        let s = String(val).trim();
        // If has both . and , determine which is decimal
        if (s.includes('.') && s.includes(',')) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 → 1234.56
            } else {
                s = s.replace(/,/g, ''); // 1,234.56 → 1234.56
            }
        } else if (s.includes(',')) {
            s = s.replace(',', '.'); // 1234,56 → 1234.56
        }
        s = s.replace(/[^\d.\-]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    /** Join STOCK with PROVEEDORES */
    function joinDatasets(stock, proveedores) {
        // Build normalised lookup
        const provMap = {};
        proveedores.forEach(p => {
            const key = normalizeForJoin(p['Nombre'] || p['Nombre Comercial'] || '');
            if (key) provMap[key] = p;
        });

        // Try multiple possible column names for the supplier field
        const provColCandidates = ['Proveedor', 'NombreProveedor', 'Nombre Proveedor', 'PROVEEDOR', 'proveedor', 'Prov'];
        function getProveedor(row) {
            for (const col of provColCandidates) {
                if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
                    return String(row[col]).trim();
                }
            }
            // Fallback: try to find any key containing 'proveedor' (case insensitive)
            for (const key of Object.keys(row)) {
                if (key.toLowerCase().includes('proveedor') && String(row[key]).trim() !== '') {
                    return String(row[key]).trim();
                }
            }
            return '';
        }

        console.log('[Engine] Joining', stock.length, 'stock rows with', proveedores.length, 'proveedores (' + Object.keys(provMap).length + ' normalized keys)');
        if (stock.length > 0) {
            console.log('[Engine] Stock columns:', Object.keys(stock[0]).join(', '));
        }

        return stock.map(row => {
            const prov = getProveedor(row);
            const key = normalizeForJoin(prov);
            const provInfo = key ? (provMap[key] || null) : null;
            
            // ── CRITICAL FIX: we MUST call calculateDerived to set _articulo, _codArticulo, etc. ──
            const result = { ...row, _proveedor: prov, _proveedorInfo: provInfo, _matched: !!provInfo };
            return calculateDerived(result);
        });
    }

    /** Find a column by several name variants or common patterns. STRICT match only. */
    function findCol(row, name) {
        if (!row) return undefined;
        if (row[name] !== undefined) return row[name];

        const target = name.toLowerCase().normalize('NFC').replace(/[\s\u00a0\ufeff]/g, '').trim();
        const keys = Object.keys(row);

        for (const k of keys) {
            const kn = k.toLowerCase().normalize('NFC').replace(/[\s\u00a0\ufeff]/g, '').trim();
            // Try exact normalized match
            if (kn === target) return row[k];
            
            // Try without accents
            const knNoAccent = kn.replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m]));
            const targetNoAccent = target.replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m]));
            if (knNoAccent === targetNoAccent) return row[k];
        }
        return undefined;
    }

    /** Calculate derived columns.
     *  Uses pre-calculated CSV columns (Val Stock x PrecioInvent, etc.)
     *  as the authoritative stock values rather than multiplying.
     */
    /** Calculate derived columns using exact column names from the stock file. */
    function calculateDerived(row) {
        // 1. Exact Mapping using strict findCol
        // Column 11: Cod.Artículo | Column 12: Artículo
        row._codArticulo = (findCol(row, 'Cod.Artículo') || findCol(row, 'Cod.Articulo') || findCol(row, 'Cod_Articulo') || '').toString().trim();
        row._articulo = (findCol(row, 'Artículo') || findCol(row, 'Articulo') || '').toString().trim();
        
        // Stock values
        row._stock = parseNumber(findCol(row, 'Stock') || 0);
        row._precioAdq = parseNumber(findCol(row, 'PrecioAdq_Artic') || 0);
        row._precioInv = parseNumber(findCol(row, 'PrecioInvent') || 0);
        row._pvp = parseNumber(findCol(row, 'PVP_artic') || 0);

        // Pre-calculated values (User specifically wants "Val Stock x PrecioAdq_Artic")
        row._valorAdquisicion = parseNumber(findCol(row, 'Val Stock x PrecioAdq_Artic') || 0);
        row._valorStock = row._valorAdquisicion; // Using acquisition value as the primary stock value for the user
        row._valorInventario = parseNumber(findCol(row, 'Val Stock x PrecioInvent') || 0);
        row._valorPVP = parseNumber(findCol(row, 'Val Stock x PVP_Artic') || 0);

        // Dates and Meta
        const ultCompra = parseDate(findCol(row, 'UltFechaAlbCompra'));
        const ultVenta = parseDate(findCol(row, 'UltFechaAlbVenta'));
        const now = new Date();

        row._ultCompra = ultCompra;
        row._ultVenta = ultVenta;
        row._antiguedadDias = ultCompra ? Math.floor((now - ultCompra) / (1000 * 60 * 60 * 24)) : 9999;
        row._diasSinVenta = ultVenta ? Math.floor((now - ultVenta) / (1000 * 60 * 60 * 24)) : 9999;
        row._margenBruto = parseNumber(row['%MB-Stock'] || 0);

        return row;
    }

    /** Determine if a product is defective */
    function isDefective(row, config) {
        const obsoleto = String(findCol(row, 'Obsoleto') || '').trim().toUpperCase();
        if (['SÍ', 'SI', 'S', '1', 'TRUE', 'VERDADERO'].includes(obsoleto)) return true;

        const clasif = String(findCol(row, 'Clasificación') || findCol(row, 'Clasificacion') || '').toUpperCase();
        if (clasif.includes('DEFECT') || 
            clasif.includes('ROTO') || 
            clasif.includes('ROTURA') || 
            clasif.includes('AVERIA') || 
            clasif.includes('MALO')) return true;

        if (row._antiguedadDias > (config.umbralAntiguedad || 365)) return true;

        // NEW: If there are linked incidences, it's definitely affected/defective
        if (row._incidencias && row._incidencias.length > 0) return true;

        return false;
    }

    /** Compute supplier-level metrics from ALL stock data (not just defective) */
    function computeSupplierMetrics(allData, config) {
        const map = {};
        allData.forEach(row => {
            const prov = String(row._proveedor || row['Proveedor'] || 'Desconocido').trim();
            if (!map[prov]) {
                map[prov] = {
                    nombre: prov,
                    totalStock: 0,
                    totalValorStock: 0,
                    totalValorAdq: 0,
                    totalValorPVP: 0,
                    numReferencias: 0,
                    numDefectuosos: 0,
                    valorDefectuoso: 0,
                    antiguedadMedia: 0,
                    _sumAntiguedad: 0,
                    info: row._proveedorInfo,
                    articulos: [],
                    articulosDefectuosos: []
                };
            }
            const m = map[prov];
            m.totalStock += row._stock;
            m.totalValorStock += row._valorStock;
            m.totalValorAdq += row._valorAdquisicion;
            m.totalValorPVP += row._valorPVP;
            m.numReferencias += 1;
            m._sumAntiguedad += row._antiguedadDias;
            m.articulos.push(row);

            // Track defective items within this supplier
            if (isDefective(row, config)) {
                m.numDefectuosos += 1;
                m.valorDefectuoso += row._valorStock;
                m.articulosDefectuosos.push(row);
            }
        });

        // Sort by totalValorStock (total stock value, not just defective)
        const result = Object.values(map)
            .map(m => {
                m.antiguedadMedia = m.numReferencias > 0 ? Math.round(m._sumAntiguedad / m.numReferencias) : 0;
                delete m._sumAntiguedad;
                return m;
            })
            .sort((a, b) => b.totalValorStock - a.totalValorStock);

        // Diagnostic: log top 5 supplier totals
        console.log('[Engine] === Supplier Metrics (top 5 by total stock value) ===');
        result.slice(0, 5).forEach(m => {
            console.log(`[Engine] ${m.nombre}: total=${m.totalValorStock.toFixed(2)}€ (${m.numReferencias} refs), defectuoso=${m.valorDefectuoso.toFixed(2)}€ (${m.numDefectuosos} refs)`);
        });

        return result;
    }

    /** Compute product-level metrics */
    function computeProductMetrics(defectiveData) {
        return [...defectiveData]
            .sort((a, b) => b._valorStock - a._valorStock)
            .slice(0, 100);
    }

    /** Filter defective stock */
    function filterData(data, filters) {
        return data.filter(row => {
            if (filters.proveedor && normalizeForJoin(row['Proveedor']) !== normalizeForJoin(filters.proveedor)) return false;
            if (filters.antiguedadMin && row._antiguedadDias < filters.antiguedadMin) return false;
            if (filters.antiguedadMax && row._antiguedadDias > filters.antiguedadMax) return false;
            if (filters.valorMin && row._valorStock < filters.valorMin) return false;
            if (filters.clasificacion && !(row['Clasificación'] || '').toUpperCase().includes(filters.clasificacion.toUpperCase())) return false;
            if (filters.search) {
                const s = filters.search.toLowerCase();
                const match = (row['Artículo'] || row['Articulo'] || '').toLowerCase().includes(s)
                    || (row['Cod.Artículo'] || row['Cod.Articulo'] || '').toLowerCase().includes(s)
                    || (row['RefProv'] || '').toLowerCase().includes(s)
                    || (row['Proveedor'] || '').toLowerCase().includes(s);
                if (!match) return false;
            }
            return true;
        });
    }

    return {
        normalizeForJoin,
        parseDate,
        parseNumber,
        findCol,
        joinDatasets,
        calculateDerived,
        isDefective,
        computeSupplierMetrics,
        computeProductMetrics,
        filterData
    };
})();
