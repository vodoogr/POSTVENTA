/* ============================================
   STORE — Central state management
   ============================================ */
const Store = (() => {
    // State
    const state = {
        stockRaw: [],
        proveedoresRaw: [],
        incidenciasRaw: [],
        joinedData: [],
        defectiveData: [],
        supplierMetrics: [],
        productMetrics: [],
        recommendations: [],
        reclamaciones: [],
        config: {
            umbralAntiguedad: 365,
            umbralValorReclamacion: 500,
            periodoSinRotacion: 180,
            emailRemitente: 'reclamaciones@centro63.com',
            plantillaEmail: `Estimado/a {proveedor},

Le escribimos en relación con los siguientes artículos defectuosos que hemos identificado en nuestro inventario, suministrados por su empresa:

{articulos}

El valor total afectado asciende a {valor}€.

Solicitamos amablemente su revisión y propuesta de resolución en un plazo máximo de 15 días laborables.

Opciones sugeridas:
- Sustitución del material defectuoso
- Abono/nota de crédito por el importe afectado
- Recogida y devolución del material

Quedamos a la espera de su respuesta.

Atentamente,
Centro 63 — Departamento de Postventa
{emailRemitente}`
        }
    };

    // Event bus
    const listeners = {};

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function emit(event, data) {
        (listeners[event] || []).forEach(cb => cb(data));
    }

    // Config management
    function loadConfig() {
        try {
            const saved = localStorage.getItem('cs63_config');
            if (saved) Object.assign(state.config, JSON.parse(saved));
        } catch (e) { /* ignore */ }
    }

    function saveConfig(newConfig) {
        Object.assign(state.config, newConfig);
        localStorage.setItem('cs63_config', JSON.stringify(state.config));
        emit('config-changed', state.config);
    }

    // Stock data
    function setStockData(data) {
        state.stockRaw = data;
        emit('stock-loaded', data);
        console.log(`[Store] Stock loaded: ${data.length} rows`);
        // Only recalculate when BOTH datasets are present
        if (state.stockRaw.length > 0 && state.proveedoresRaw.length > 0) {
            recalculate();
        }
    }

    function setProveedoresData(data) {
        state.proveedoresRaw = data;
        emit('proveedores-loaded', data);
        console.log(`[Store] Proveedores loaded: ${data.length} rows`);
        // Only recalculate when BOTH datasets are present
        if (state.stockRaw.length > 0 && state.proveedoresRaw.length > 0) {
            recalculate();
        }
    }

    function setIncidenciasData(data) {
        state.incidenciasRaw = data;
        emit('incidencias-loaded', data);
        console.log(`[Store] Incidencias loaded: ${data.length} rows`);
        if (data.length > 0) {
            console.log('[Store] Incidencias columns:', Object.keys(data[0]).join(', '));
        }
        // Re-cross-reference if joined data exists
        if (state.joinedData.length > 0) {
            crossReferenceIncidencias();
            emit('data-recalculated', state);
        }
    }

    /** Helper: find a column value from incidencias row strictly neutralizing case and accents */
    function findIncCol(row, ...names) {
        if (!row) return '';
        for (const n of names) {
            if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n];
        }

        const keys = Object.keys(row);
        for (const n of names) {
            const normClean = n.toLowerCase().normalize('NFC').replace(/[\s\u00a0\ufeff]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m])).trim();
            for (const key of keys) {
                const knClean = key.toLowerCase().normalize('NFC').replace(/[\s\u00a0\ufeff]/g, '').replace(/[áéíóú]/g, (m) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[m])).trim();
                if (knClean === normClean) return row[key];
            }
        }
        return '';
    }

    /** Cross-reference joinedData with incidenciasRaw by article code */
    function crossReferenceIncidencias() {
        if (state.incidenciasRaw.length === 0) return;
        
        // Log incidencias columns for debugging
        if (state.incidenciasRaw.length > 0) {
            console.log('[Store] Incidencias sample row keys:', Object.keys(state.incidenciasRaw[0]).join(', '));
        }
        
        // Build lookup map: article code → [{numero, cliente, solucion}, ...]
        const incMap = {};
        state.incidenciasRaw.forEach(row => {
            const art = findIncCol(row, 'Artículo', 'Articulo').toString().trim().toUpperCase();
            const numero = findIncCol(row, 'Numero', 'Número', 'numero', 'número', 'Nº', 'N°').toString().trim();
            const cliente = findIncCol(row, 'Cliente', 'Nombre Cliente', 'NombreCliente', 'Nombre', 'cliente', 'nombre').toString().trim();
            const solucion = findIncCol(row, 'Solución', 'Solucion', 'solución', 'solucion', 'Fallo', 'fallo').toString().trim();
            
            if (art) {
                if (!incMap[art]) incMap[art] = [];
                incMap[art].push({ numero, cliente, solucion });
            }
        });
        console.log(`[Store] Incidencias map: ${Object.keys(incMap).length} unique articles with incidents`);
        if (Object.keys(incMap).length > 0) {
            const sampleKeys = Object.keys(incMap).slice(0, 5);
            console.log('[Store] Incidencias map sample keys:', sampleKeys.join(', '));
            // Log sample values to help debug
            const firstKey = sampleKeys[0];
            console.log('[Store] Incidencias sample entry:', JSON.stringify(incMap[firstKey][0]));
        }

        // Attach to joined data using _codArticulo (strictly extracted in engine.js)
        let matched = 0;
        state.joinedData.forEach(row => {
            const cod = (row._codArticulo || '').toString().trim().toUpperCase();
            const name = (row._articulo || '').toString().trim().toUpperCase();
            
            // Try matching by article code first (most reliable)
            const incs = incMap[cod] || incMap[name] || [];
            
            if (incs.length > 0) {
                row._incidencias = incs;
                // Format: Nº incidencia + Nombre Cliente + Fallo
                row._incidencia = incs.map(i => {
                    const parts = [];
                    if (i.numero) parts.push(`Nº ${i.numero}`);
                    if (i.cliente) parts.push(i.cliente);
                    if (i.solucion) parts.push(i.solucion);
                    return parts.join(' · ');
                }).join(' | ');
                matched++;
            } else {
                row._incidencias = [];
                row._incidencia = '';
            }
        });
        console.log(`[Store] Incidencias cross-referenced: ${matched} articles matched`);
    }

    /** Get all incidents for an article code — returns array of {numero, cliente, solucion} */
    function getIncidencias(articuloCod) {
        if (state.incidenciasRaw.length === 0) return [];
        const codUp = (articuloCod || '').toString().trim().toUpperCase();
        return state.incidenciasRaw
            .filter(row => {
                const art = findIncCol(row, 'Artículo', 'Articulo').toString().trim().toUpperCase();
                return art === codUp;
            })
            .map(row => ({
                numero: findIncCol(row, 'Numero', 'Número', 'numero', 'número', 'Nº', 'N°').toString().trim(),
                cliente: findIncCol(row, 'Cliente', 'Nombre Cliente', 'NombreCliente', 'Nombre', 'cliente', 'nombre').toString().trim(),
                solucion: findIncCol(row, 'Solución', 'Solucion', 'solución', 'solucion', 'Fallo', 'fallo').toString().trim()
            }));
    }

    function getIncidencia(articuloCod) {
        const incs = getIncidencias(articuloCod);
        if (incs.length === 0) return '';
        return incs.map(i => {
            const parts = [];
            if (i.numero) parts.push(`Nº${i.numero}`);
            if (i.cliente) parts.push(i.cliente);
            if (i.solucion) parts.push(i.solucion);
            return parts.join(' · ');
        }).join(' | ');
    }

    function recalculate() {
        // REQUIRE both datasets
        if (state.stockRaw.length === 0 || state.proveedoresRaw.length === 0) {
            state.joinedData = [];
            state.defectiveData = [];
            state.supplierMetrics = [];
            state.productMetrics = [];
            state.recommendations = [];
            emit('data-recalculated', state);
            return;
        }

        // Filter out rows where Stock = 0 (only real inventory)
        // Log diagnostic for first row
        if (state.stockRaw.length > 0) {
            const sample = state.stockRaw[0];
            const stockVal = Engine.findCol(sample, 'Stock');
            const valStockInv = Engine.findCol(sample, 'Val Stock x PrecioInvent');
            console.log(`[Store] Diagnostic — first row Stock raw='${stockVal}' parsed=${Engine.parseNumber(stockVal)}, Val Stock x PrecioInvent raw='${valStockInv}' parsed=${Engine.parseNumber(valStockInv)}`);
            console.log('[Store] All columns:', Object.keys(sample).join(' | '));
        }

        const stockWithInventory = state.stockRaw.filter(row => {
            const stock = Engine.parseNumber(Engine.findCol(row, 'Stock'));
            return stock !== 0;
        });
        const filtered = state.stockRaw.length - stockWithInventory.length;
        console.log(`[Store] Stock filter: ${state.stockRaw.length} total → ${stockWithInventory.length} with inventory (${filtered} with Stock=0 removed)`);

        state.joinedData = Engine.joinDatasets(stockWithInventory, state.proveedoresRaw);
        state.joinedData = state.joinedData.map(row => Engine.calculateDerived(row));

        // ──── DIAGNOSTIC: total stock value & per-supplier trace ────
        const totalStockValue = state.joinedData.reduce((s, r) => s + (r._valorStock || 0), 0);
        console.log(`[Store] ★ TOTAL STOCK VALUE (all ${state.joinedData.length} items): ${totalStockValue.toFixed(2)}€ (expected: ~168256.27€)`);

        // Trace DISTRIGAL specifically
        const distrigal = state.joinedData.filter(r => (r._proveedor || '').toUpperCase().includes('DISTRIGAL'));
        const distrigalSum = distrigal.reduce((s, r) => s + (r._valorStock || 0), 0);
        console.log(`[Store] ★ DISTRIGAL: ${distrigal.length} rows, totalValorStock=${distrigalSum.toFixed(2)}€ (expected: 13535.86€)`);
        distrigal.slice(0, 5).forEach((r, i) => {
            const raw = Engine.findCol(r, 'Val Stock x PrecioInvent');
            console.log(`[Store]   row${i}: raw='${raw}' parsed=${Engine.parseNumber(raw)} _valorStock=${r._valorStock} stock=${r._stock}`);
        });
        // ──── END DIAGNOSTIC ────

        state.defectiveData = state.joinedData.filter(row => Engine.isDefective(row, state.config));
        state.supplierMetrics = Engine.computeSupplierMetrics(state.joinedData, state.config);
        state.productMetrics = Engine.computeProductMetrics(state.defectiveData);
        state.recommendations = Recommendations.generate(
            state.defectiveData, state.supplierMetrics, state.config
        );
        // Cross-reference with incidencias if available
        crossReferenceIncidencias();
        console.log(`[Store] Recalculated: ${state.joinedData.length} joined, ${state.defectiveData.length} defective, ${state.supplierMetrics.length} suppliers`);
        emit('data-recalculated', state);
    }

    // Reclamaciones CRUD
    function addReclamacion(rec) {
        rec.id = 'CLM-' + String(state.reclamaciones.length + 1).padStart(4, '0');
        rec.fecha = new Date().toISOString();
        rec.estado = 'Pendiente';
        state.reclamaciones.push(rec);
        saveReclamaciones();
        // Sync to Supabase
        if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isAuthenticated()) {
            SupabaseClient.saveReclamacion(rec).catch(e => console.warn('[Store] Supabase sync error:', e));
        }
        emit('reclamaciones-changed', state.reclamaciones);
        return rec;
    }

    function updateReclamacion(id, updates) {
        const idx = state.reclamaciones.findIndex(r => r.id === id);
        if (idx >= 0) {
            Object.assign(state.reclamaciones[idx], updates);
            saveReclamaciones();
            // Sync to Supabase
            if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isAuthenticated()) {
                SupabaseClient.updateReclamacionDB(id, updates).catch(e => console.warn('[Store] Supabase sync error:', e));
            }
            emit('reclamaciones-changed', state.reclamaciones);
        }
    }

    function deleteReclamacion(id) {
        state.reclamaciones = state.reclamaciones.filter(r => r.id !== id);
        saveReclamaciones();
        // Sync to Supabase
        if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isAuthenticated()) {
            SupabaseClient.deleteReclamacionDB(id).catch(e => console.warn('[Store] Supabase sync error:', e));
        }
        emit('reclamaciones-changed', state.reclamaciones);
    }

    function saveReclamaciones() {
        try {
            localStorage.setItem('cs63_reclamaciones', JSON.stringify(state.reclamaciones));
        } catch (e) { /* ignore */ }
    }

    function loadReclamaciones() {
        try {
            const saved = localStorage.getItem('cs63_reclamaciones');
            if (saved) state.reclamaciones = JSON.parse(saved);
        } catch (e) { /* ignore */ }
    }

    // Proveedores CRUD
    function addProveedor(prov) {
        prov._id = 'PROV-' + Date.now();
        state.proveedoresRaw.push(prov);
        emit('proveedores-loaded', state.proveedoresRaw);
        if (state.stockRaw.length) recalculate();
        return prov;
    }

    function updateProveedor(id, updates) {
        const idx = state.proveedoresRaw.findIndex(p => (p._id || p['Código']) === id);
        if (idx >= 0) {
            Object.assign(state.proveedoresRaw[idx], updates);
            emit('proveedores-loaded', state.proveedoresRaw);
            if (state.stockRaw.length) recalculate();
        }
    }

    // Init
    loadConfig();
    loadReclamaciones();

    return {
        state,
        on,
        emit,
        setStockData,
        setProveedoresData,
        setIncidenciasData,
        getIncidencia,
        getIncidencias,
        recalculate,
        saveConfig,
        addReclamacion,
        updateReclamacion,
        deleteReclamacion,
        addProveedor,
        updateProveedor
    };
})();
