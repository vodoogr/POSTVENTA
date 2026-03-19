/* ============================================
   SUPABASE CLIENT — Connection & CRUD
   ============================================ */
const SupabaseClient = (() => {
    // ── Config ──
    const SUPABASE_URL = 'https://pykngekenrvvgogykcur.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5a25nZWtlbnJ2dmdvZ3lrY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjY1NDksImV4cCI6MjA4NjkwMjU0OX0.Rq0aF36o0QgifLdHkhhTGdRX_Z0Jl2WCcSBfS_y2C9E';

    let client = null;
    let currentUser = null;
    let centroId = '63'; // Default
    let connectionStatus = 'offline'; // 'online' | 'offline' | 'error'
    let tableStatus = {}; // { stock: {ok, count}, proveedores: {...}, ... }

    /** Init the Supabase client (call once) */
    function init() {
        if (client) return client;

        // The Supabase JS v2 CDN exposes window.supabase with createClient
        // Try multiple ways to find it
        let createFn = null;
        if (typeof supabase !== 'undefined') {
            if (typeof supabase.createClient === 'function') {
                createFn = supabase.createClient;
            } else if (typeof supabase === 'function') {
                createFn = supabase;
            }
        }
        // Also check window.supabase (CDN default)
        if (!createFn && typeof window !== 'undefined' && window.supabase) {
            if (typeof window.supabase.createClient === 'function') {
                createFn = window.supabase.createClient;
            }
        }

        if (!createFn) {
            console.error('[Supabase] SDK not loaded. Available globals:',
                Object.keys(window).filter(k => k.toLowerCase().includes('supa')));
            connectionStatus = 'error';
            updateStatusUI();
            return null;
        }

        try {
            client = createFn(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Supabase] Client initialized:', SUPABASE_URL);
            connectionStatus = 'offline'; // Will be set to online after first successful query
            return client;
        } catch (e) {
            console.error('[Supabase] Failed to create client:', e);
            connectionStatus = 'error';
            updateStatusUI();
            return null;
        }
    }

    function getClient() {
        if (!client) init();
        return client;
    }

    // ═══════════════════════════════════════
    // CONNECTION STATUS & DIAGNOSTICS
    // ═══════════════════════════════════════

    /** Check connection and probe all tables */
    async function checkConnection() {
        const sb = getClient();
        if (!sb) {
            connectionStatus = 'error';
            tableStatus = {};
            updateStatusUI();
            return { status: 'error', tables: {} };
        }

        const tables = ['stock', 'proveedores', 'incidencias', 'reclamaciones', 'user_profiles'];
        const results = {};

        for (const table of tables) {
            try {
                const { count, error } = await sb
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                if (error) {
                    results[table] = { ok: false, error: error.message, count: 0 };
                } else {
                    results[table] = { ok: true, count: count || 0 };
                }
            } catch (e) {
                results[table] = { ok: false, error: e.message, count: 0 };
            }
        }

        const anyOk = Object.values(results).some(r => r.ok);
        connectionStatus = anyOk ? 'online' : 'error';
        tableStatus = results;
        updateStatusUI();

        console.log('[Supabase] Connection check:', connectionStatus, results);
        return { status: connectionStatus, tables: results };
    }

    let lastUploadDate = localStorage.getItem('cs63_last_upload') || null;

    /** Update the sidebar status indicator */
    function updateStatusUI() {
        const indicator = document.getElementById('supabaseStatusIndicator');
        if (!indicator) return;

        const colors = { online: '#10b981', offline: '#6b7280', error: '#ef4444' };
        const labels = { online: 'Conectado', offline: 'Desconectado', error: 'Error' };
        const icons = { online: 'cloud_done', offline: 'cloud_off', error: 'cloud_off' };

        let tablesHTML = '';
        if (Object.keys(tableStatus).length > 0) {
            tablesHTML = '<div style="margin-top:6px;font-size:11px;line-height:1.6;">';
            for (const [table, info] of Object.entries(tableStatus)) {
                const dot = info.ok ? '🟢' : '🔴';
                const label = table === 'user_profiles' ? 'usuarios' : table;
                const countStr = info.ok ? ` (${info.count})` : ` — ${info.error || 'Error'}`;
                tablesHTML += `<div>${dot} ${label}${countStr}</div>`;
            }
            tablesHTML += '</div>';
        }

        const lastUploadHTML = lastUploadDate 
            ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);font-size:10px;color:var(--text-tertiary);">
                <span class="material-symbols-rounded" style="font-size:12px;vertical-align:middle;margin-right:2px;">history</span>
                Última carga: ${new Date(lastUploadDate).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
               </div>`
            : '';

        indicator.innerHTML = `
            <div style="padding:10px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span class="material-symbols-rounded" style="font-size:18px;color:${colors[connectionStatus]};">${icons[connectionStatus]}</span>
                    <span style="font-size:12px;font-weight:600;color:${colors[connectionStatus]};">${labels[connectionStatus]}</span>
                    ${connectionStatus === 'online' && currentUser ? `<span style="font-size:11px;color:var(--text-secondary);margin-left:auto;">C${centroId}</span>` : ''}
                </div>
                ${tablesHTML}
                ${lastUploadHTML}
            </div>
        `;
    }

    function setLastUploadDate(date) {
        lastUploadDate = date.toISOString();
        localStorage.setItem('cs63_last_upload', lastUploadDate);
        updateStatusUI();
    }

    function getConnectionStatus() {
        return connectionStatus;
    }

    function getTableStatus() {
        return tableStatus;
    }

    // ═══════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════

    /** Sign in with email + password */
    async function signIn(email, password) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase SDK no cargado. Recarga la página.');
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        await loadUserProfile();
        connectionStatus = 'online';
        updateStatusUI();
        console.log(`[Supabase] Signed in: ${email}, centro: ${centroId}`);
        return data;
    }

    /** Sign up (register) */
    async function signUp(email, password, nombre) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase SDK no cargado. Recarga la página.');
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: { centro_id: centroId, nombre: nombre || email }
            }
        });
        if (error) throw error;
        currentUser = data.user;
        connectionStatus = 'online';
        updateStatusUI();
        console.log(`[Supabase] Signed up: ${email}`);
        return data;
    }

    /** Sign out */
    async function signOut() {
        const sb = getClient();
        if (sb) await sb.auth.signOut();
        currentUser = null;
        connectionStatus = 'offline';
        tableStatus = {};
        updateStatusUI();
        console.log('[Supabase] Signed out');
    }

    /** Check existing session */
    async function getSession() {
        const sb = getClient();
        if (!sb) return null;
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) {
            currentUser = data.session.user;
            await loadUserProfile();
            connectionStatus = 'online';
            updateStatusUI();
            console.log(`[Supabase] Session restored: ${currentUser.email}, centro: ${centroId}`);
        }
        return data?.session || null;
    }

    /** Load user profile (centro_id) */
    async function loadUserProfile() {
        if (!currentUser) return;
        const sb = getClient();
        if (!sb) return;
        try {
            const { data } = await sb
                .from('user_profiles')
                .select('centro_id, nombre, rol')
                .eq('id', currentUser.id)
                .single();
            if (data) {
                centroId = data.centro_id || '63';
                currentUser._profile = data;
            }
        } catch (e) {
            console.warn('[Supabase] Could not load user profile:', e.message);
        }
    }

    function isAuthenticated() {
        return !!currentUser;
    }

    function getUser() {
        return currentUser;
    }

    function getCentroId() {
        return centroId;
    }

    // ═══════════════════════════════════════
    // STOCK — Read & Write
    // ═══════════════════════════════════════

    /** Fetch all stock rows for this centro.
     *  Returns array of raw_data objects (same shape as CSV rows) */
    async function fetchStock() {
        const sb = getClient();
        const { data, error } = await sb
            .from('stock')
            .select('raw_data')
            .eq('centro_id', centroId);
        if (error) throw error;
        console.log(`[Supabase] Fetched ${data.length} stock rows`);
        return data.map(r => r.raw_data);
    }

    /** Upload stock data (replaces existing) */
    async function uploadStock(rows) {
        const sb = getClient();
        const mapped = rows.map(row => ({
            cod_articulo: Engine.findCol(row, 'Cod.Artículo') || Engine.findCol(row, 'Cod.Articulo') || '',
            articulo: Engine.findCol(row, 'Artículo') || Engine.findCol(row, 'Articulo') || '',
            proveedor: Engine.findCol(row, 'Proveedor') || '',
            almacen: Engine.findCol(row, 'DescAlmacenStock') || '',
            familia_n1: Engine.findCol(row, 'DFamil_N1') || '',
            familia_n2: Engine.findCol(row, 'DFamil_N2') || '',
            stock_uds: Engine.parseNumber(Engine.findCol(row, 'Stock')) || 0,
            precio_inv: Engine.parseNumber(Engine.findCol(row, 'PrecioInvent')) || 0,
            valor_stock: Engine.parseNumber(Engine.findCol(row, 'Val Stock x PrecioInvent')) || 0,
            fecha_compra: formatDateForDB(Engine.findCol(row, 'UltFechaAlbCompra')),
            fecha_venta: formatDateForDB(Engine.findCol(row, 'UltFechaAlbVenta')),
            raw_data: row
        }));

        const { data, error } = await sb.rpc('bulk_replace_stock', {
            p_centro_id: centroId,
            p_rows: mapped
        });
        if (error) throw error;
        console.log(`[Supabase] Uploaded ${rows.length} stock rows`);
        return data;
    }

    // ═══════════════════════════════════════
    // PROVEEDORES — Read & Write
    // ═══════════════════════════════════════

    async function fetchProveedores() {
        const sb = getClient();
        const { data, error } = await sb
            .from('proveedores')
            .select('raw_data')
            .eq('centro_id', centroId);
        if (error) throw error;
        console.log(`[Supabase] Fetched ${data.length} proveedores`);
        return data.map(r => r.raw_data);
    }

    async function uploadProveedores(rows) {
        const sb = getClient();
        const mapped = rows.map(row => ({
            codigo: Engine.findCol(row, 'Código') || Engine.findCol(row, 'Codigo') || '',
            nombre: Engine.findCol(row, 'Nombre') || '',
            nombre_comercial: Engine.findCol(row, 'Nombre Comercial') || '',
            email: Engine.findCol(row, 'Email') || '',
            telefono: Engine.findCol(row, 'Telefono') || Engine.findCol(row, 'Teléfono') || '',
            direccion: Engine.findCol(row, 'Dirección') || Engine.findCol(row, 'Direccion') || '',
            cp: Engine.findCol(row, 'C.P.') || '',
            poblacion: Engine.findCol(row, 'Poblacion') || Engine.findCol(row, 'Población') || '',
            provincia: Engine.findCol(row, 'Provincia') || '',
            raw_data: row
        }));

        const { data, error } = await sb.rpc('bulk_replace_proveedores', {
            p_centro_id: centroId,
            p_rows: mapped
        });
        if (error) throw error;
        console.log(`[Supabase] Uploaded ${rows.length} proveedores`);
        return data;
    }

    // ═══════════════════════════════════════
    // INCIDENCIAS — Read & Write
    // ═══════════════════════════════════════

    async function fetchIncidencias() {
        const sb = getClient();
        const { data, error } = await sb
            .from('incidencias')
            .select('raw_data')
            .eq('centro_id', centroId);
        if (error) throw error;
        console.log(`[Supabase] Fetched ${data.length} incidencias`);
        return data.map(r => r.raw_data);
    }

    async function uploadIncidencias(rows) {
        const sb = getClient();
        const mapped = rows.map(row => ({
            numero: (row['Numero'] || row['Número'] || row['numero'] || '').toString().trim(),
            articulo: (row['Artículo'] || row['Articulo'] || '').toString().trim(),
            solucion: (row['Solución'] || row['Solucion'] || '').toString().trim(),
            raw_data: row
        }));

        const { data, error } = await sb.rpc('bulk_replace_incidencias', {
            p_centro_id: centroId,
            p_rows: mapped
        });
        if (error) throw error;
        console.log(`[Supabase] Uploaded ${rows.length} incidencias`);
        return data;
    }

    // ═══════════════════════════════════════
    // RECLAMACIONES — CRUD
    // ═══════════════════════════════════════

    async function fetchReclamaciones() {
        const sb = getClient();
        const { data, error } = await sb
            .from('reclamaciones')
            .select('*')
            .eq('centro_id', centroId)
            .order('fecha', { ascending: false });
        if (error) throw error;
        console.log(`[Supabase] Fetched ${data.length} reclamaciones`);
        // Transform to match local format
        return data.map(r => ({
            id: r.claim_id,
            _dbId: r.id,
            proveedor: r.proveedor,
            articulos: r.articulos || [],
            estado: r.estado,
            valorTotal: r.valor_total,
            emailEnviado: r.email_enviado,
            fecha: r.fecha,
            notas: r.notas
        }));
    }

    async function saveReclamacion(rec) {
        const sb = getClient();
        const row = {
            centro_id: centroId,
            claim_id: rec.id,
            user_id: currentUser?.id || null,
            proveedor: rec.proveedor,
            articulos: rec.articulos || [],
            estado: rec.estado || 'Pendiente',
            valor_total: rec.valorTotal || 0,
            email_enviado: rec.emailEnviado || false,
            fecha: rec.fecha || new Date().toISOString(),
            notas: rec.notas || ''
        };

        const { data, error } = await sb
            .from('reclamaciones')
            .upsert(row, { onConflict: 'claim_id,centro_id' })
            .select();
        if (error) throw error;
        console.log(`[Supabase] Saved reclamación: ${rec.id}`);
        return data;
    }

    async function updateReclamacionDB(claimId, updates) {
        const sb = getClient();
        const dbUpdates = {};
        if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
        if (updates.emailEnviado !== undefined) dbUpdates.email_enviado = updates.emailEnviado;
        if (updates.notas !== undefined) dbUpdates.notas = updates.notas;
        if (updates.valorTotal !== undefined) dbUpdates.valor_total = updates.valorTotal;
        dbUpdates.updated_at = new Date().toISOString();

        const { error } = await sb
            .from('reclamaciones')
            .update(dbUpdates)
            .eq('claim_id', claimId)
            .eq('centro_id', centroId);
        if (error) throw error;
        console.log(`[Supabase] Updated reclamación: ${claimId}`);
    }

    async function deleteReclamacionDB(claimId) {
        const sb = getClient();
        const { error } = await sb
            .from('reclamaciones')
            .delete()
            .eq('claim_id', claimId)
            .eq('centro_id', centroId);
        if (error) throw error;
        console.log(`[Supabase] Deleted reclamación: ${claimId}`);
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    function formatDateForDB(val) {
        if (!val) return null;
        const d = Engine.parseDate(val);
        return d ? d.toISOString() : null;
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════
    return {
        init,
        getClient,
        // Connection
        checkConnection,
        getConnectionStatus,
        getTableStatus,
        updateStatusUI,
        // Auth
        signIn,
        signUp,
        signOut,
        getSession,
        isAuthenticated,
        getUser,
        getCentroId,
        setLastUploadDate,
        // Stock
        fetchStock,
        uploadStock,
        // Proveedores
        fetchProveedores,
        uploadProveedores,
        // Incidencias
        fetchIncidencias,
        uploadIncidencias,
        // Reclamaciones
        fetchReclamaciones,
        saveReclamacion,
        updateReclamacionDB,
        deleteReclamacionDB
    };
})();
