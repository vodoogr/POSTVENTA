/* ============================================
   APP — Main router & initialization
   ============================================ */
const App = (() => {
    const pages = {
        dashboard: { title: 'Dashboard', render: (c) => DashboardScreen.render(c) },
        stock: { title: 'Stock Defectuoso', render: (c) => StockScreen.render(c) },
        proveedores: { title: 'Proveedores', render: (c) => ProveedoresScreen.render(c) },
        reclamaciones: { title: 'Reclamaciones', render: (c) => ReclamacionesScreen.render(c) },
        recomendaciones: { title: 'Recomendaciones', render: (c) => RecomendacionesScreen.render(c) },
        configuracion: { title: 'Configuración', render: (c) => ConfiguracionScreen.render(c) }
    };

    let currentPage = 'dashboard';
    let dataSource = 'csv'; // 'csv' or 'supabase'

    function init() {
        // Init Supabase client
        try { SupabaseClient.init(); } catch (e) { console.warn('[App] Supabase SDK not available:', e); }

        setupNavigation();
        setupUpload();
        setupSupabaseLoad();
        setupModalClose();

        // Listen for data changes
        Store.on('data-recalculated', () => {
            updateDataStatus();
            navigateTo(currentPage);
        });

        // Check for existing session
        checkSession();

        // Route from hash
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        navigateTo(hash);
    }

    /** Check for existing Supabase session and auto-load */
    async function checkSession() {
        try {
            const session = await SupabaseClient.getSession();
            if (session) {
                dataSource = 'supabase';
                updateUserBadge();
                Components.showToast(`Sesión restaurada: ${session.user.email}`, 'info');
                // Check connection & table status
                await SupabaseClient.checkConnection();
                // Auto-load data from Supabase
                await loadFromSupabase();
            }
        } catch (e) {
            console.log('[App] No session found or Supabase unavailable');
        }
    }

    /** Setup the "Cargar desde Supabase" button */
    function setupSupabaseLoad() {
        const btn = document.getElementById('supabaseLoadZone');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            if (SupabaseClient.isAuthenticated()) {
                // Already logged in → load directly
                await loadFromSupabase();
            } else {
                // Show login screen in a modal
                const container = document.getElementById('pageContainer');
                AuthScreen.render(container, async (mode) => {
                    if (mode === 'supabase') {
                        dataSource = 'supabase';
                        updateUserBadge();
                        await SupabaseClient.checkConnection();
                        await loadFromSupabase();
                    } else {
                        // CSV mode — just navigate back
                        dataSource = 'csv';
                        navigateTo(currentPage);
                    }
                });
            }
        });
    }

    /** Load all data from Supabase */
    async function loadFromSupabase() {
        try {
            Components.showToast('⏳ Cargando datos desde Supabase...', 'info');

            const [stockData, provData, incidData, reclamData] = await Promise.all([
                SupabaseClient.fetchStock(),
                SupabaseClient.fetchProveedores(),
                SupabaseClient.fetchIncidencias(),
                SupabaseClient.fetchReclamaciones()
            ]);

            if (stockData.length > 0) Store.setStockData(stockData);
            if (provData.length > 0) Store.setProveedoresData(provData);
            if (incidData.length > 0) Store.setIncidenciasData(incidData);

            // Load reclamaciones from Supabase (overrides localStorage)
            if (reclamData.length > 0) {
                Store.state.reclamaciones = reclamData;
                Store.emit('reclamaciones-changed', reclamData);
            }

            const total = stockData.length + provData.length;
            if (total > 0) {
                Components.showToast(`✅ Datos cargados desde Supabase: ${stockData.length} stock, ${provData.length} proveedores`, 'success');
            } else {
                Components.showToast('📭 No hay datos en Supabase para este centro. Sube datos primero con el CSV.', 'warning');
            }
        } catch (err) {
            console.error('[App] Supabase load error:', err);
            Components.showToast('Error cargando desde Supabase: ' + err.message, 'error');
        }
        // Refresh table status
        SupabaseClient.checkConnection();
    }

    /** Sync uploaded CSV data to Supabase (called after local processing) */
    async function syncToSupabase(stockData, provData, incidData) {
        if (!SupabaseClient.isAuthenticated()) return;
        try {
            Components.openProgressModal('Guardando en Supabase...');

            // Calculate steps
            const totalSteps = (stockData ? 1 : 0) + (provData ? 1 : 0) + (incidData ? 1 : 0);
            let currentStep = 0;

            if (stockData) {
                const pct = Math.round((currentStep / totalSteps) * 100);
                Components.updateProgress(pct + 5, `Subiendo ${stockData.length} artículos de stock...`);
                await SupabaseClient.uploadStock(stockData);
                currentStep++;
                Components.updateProgress(Math.round((currentStep / totalSteps) * 100), 'Stock completado');
            }

            if (provData) {
                const pct = Math.round((currentStep / totalSteps) * 100);
                Components.updateProgress(pct > 90 ? 90 : pct, `Subiendo ${provData.length} proveedores...`);
                await SupabaseClient.uploadProveedores(provData);
                currentStep++;
                Components.updateProgress(Math.round((currentStep / totalSteps) * 100), 'Proveedores completados');
            }

            if (incidData) {
                const pct = Math.round((currentStep / totalSteps) * 100);
                Components.updateProgress(pct > 90 ? 90 : pct, `Subiendo ${incidData.length} incidencias...`);
                await SupabaseClient.uploadIncidencias(incidData);
                currentStep++;
                Components.updateProgress(100, 'Finalizando...');
            }

            // Short delay to show 100%
            setTimeout(() => {
                Components.closeProgressModal();
                Components.showToast('✅ Datos sincronizados con Supabase', 'success');
                // Update last upload date
                SupabaseClient.setLastUploadDate(new Date());
                // Refresh table status
                SupabaseClient.checkConnection();
            }, 800);

        } catch (err) {
            Components.closeProgressModal();
            console.error('[App] Supabase sync error:', err);
            Components.showToast('⚠️ Error sincronizando con Supabase: ' + err.message, 'warning');
        }
    }

    function updateUserBadge() {
        const badge = document.getElementById('userBadge');
        if (badge && SupabaseClient.isAuthenticated()) {
            badge.innerHTML = AuthScreen.renderUserBadge();
        }
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigateTo(page);
            });
        });

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            navigateTo(hash);
        });

        // Sidebar toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });
    }

    function navigateTo(page) {
        if (!pages[page]) page = 'dashboard';
        currentPage = page;
        window.location.hash = '#' + page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page title
        document.getElementById('pageTitle').textContent = pages[page].title;

        // Render page
        const container = document.getElementById('pageContainer');
        container.scrollTop = 0;
        pages[page].render(container);

        // Close sidebar on mobile
        document.getElementById('sidebar')?.classList.remove('open');
    }

    function updateDataStatus() {
        const status = document.getElementById('dataStatus');
        const hasStock = Store.state.stockRaw.length > 0;
        const hasProv = Store.state.proveedoresRaw.length > 0;
        const sourceIcon = dataSource === 'supabase' ? '☁️' : '📁';

        if (hasStock && hasProv) {
            const totalRaw = Store.state.stockRaw.length;
            const joined = Store.state.joinedData.length;
            const defective = Store.state.defectiveData.length;
            status.innerHTML = `
        <span class="status-dot online"></span>
        <span>${sourceIcon} ${totalRaw} registros · ${joined} con stock · ${defective} defectuosos</span>
      `;
        } else if (hasStock) {
            status.innerHTML = `
        <span class="status-dot" style="background:var(--warning);"></span>
        <span>${sourceIcon} Stock cargado (${Store.state.stockRaw.length}) — Falta proveedores</span>
      `;
        } else if (hasProv) {
            status.innerHTML = `
        <span class="status-dot" style="background:var(--warning);"></span>
        <span>${sourceIcon} Proveedores cargados (${Store.state.proveedoresRaw.length}) — Falta stock</span>
      `;
        }

        // Show export button
        const btnExport = document.getElementById('btnExport');
        if (btnExport) btnExport.style.display = (hasStock || hasProv) ? '' : 'none';

        // Update user badge
        updateUserBadge();
    }

    function setupUpload() {
        const uploadZone = document.getElementById('uploadZone');
        const uploadDialog = document.getElementById('uploadDialog');
        const btnProcess = document.getElementById('btnProcessUpload');

        // Elements for Step 1 (Stock)
        const areaStock = document.getElementById('uploadAreaStock');
        const inputStock = document.getElementById('fileInputStock');
        const stockLoaded = document.getElementById('stockFileLoaded');
        const stockName = document.getElementById('stockFileName');
        const stockRows = document.getElementById('stockFileRows');
        const btnRemoveStock = document.getElementById('btnRemoveStock');
        const step1Icon = document.getElementById('step1Icon');

        // Elements for Step 2 (Proveedores)
        const areaProv = document.getElementById('uploadAreaProv');
        const inputProv = document.getElementById('fileInputProv');
        const provLoaded = document.getElementById('provFileLoaded');
        const provName = document.getElementById('provFileName');
        const provRows = document.getElementById('provFileRows');
        const btnRemoveProv = document.getElementById('btnRemoveProv');
        const step2Icon = document.getElementById('step2Icon');

        // Elements for Step 3 (Incidencias — optional)
        const areaIncid = document.getElementById('uploadAreaIncid');
        const inputIncid = document.getElementById('fileInputIncid');
        const incidLoaded = document.getElementById('incidFileLoaded');
        const incidName = document.getElementById('incidFileName');
        const incidRows = document.getElementById('incidFileRows');
        const btnRemoveIncid = document.getElementById('btnRemoveIncid');
        const step3Icon = document.getElementById('step3Icon');

        let stockData = null;
        let provData = null;
        let incidData = null;

        function updateProcessButton() {
            // Incidencias is optional — only stock + prov required
            btnProcess.disabled = !(stockData && provData);
        }

        // Open upload dialog
        uploadZone?.addEventListener('click', () => {
            uploadDialog?.classList.remove('hidden');
        });

        // ---- Drop zone setup ----
        function setupDropZone(area, input, type) {
            area?.addEventListener('click', () => input?.click());
            area?.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
            area?.addEventListener('dragleave', () => area.classList.remove('dragover'));
            area?.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0], type);
            });
            input?.addEventListener('change', (e) => {
                if (e.target.files.length > 0) processFile(e.target.files[0], type);
                e.target.value = ''; // reset so same file can be re-selected
            });
        }

        async function processFile(file, type) {
            console.log(`[Upload] Processing ${type} file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
            try {
                const data = await Parser.parseFile(file);
                console.log(`[Upload] Parsed ${type}: ${data.length} rows`);
                if (data.length > 0) {
                    const cols = Object.keys(data[0]);
                    console.log(`[Upload] ${type} columns (${cols.length}):`, cols.join(', '));
                    // Log first row for debugging
                    console.log(`[Upload] ${type} sample row:`, JSON.stringify(data[0]).substring(0, 500));
                }

                if (type === 'stock') {
                    stockData = data;
                    areaStock.classList.add('hidden');
                    stockLoaded.classList.remove('hidden');
                    stockName.textContent = file.name;
                    stockRows.textContent = `(${data.length} filas)`;
                    step1Icon.textContent = '✓';
                    step1Icon.classList.add('done');
                    Components.showToast(`Stock cargado: ${file.name}`, 'success');
                } else if (type === 'proveedores') {
                    provData = data;
                    areaProv.classList.add('hidden');
                    provLoaded.classList.remove('hidden');
                    provName.textContent = file.name;
                    provRows.textContent = `(${data.length} filas)`;
                    step2Icon.textContent = '✓';
                    step2Icon.classList.add('done');
                    Components.showToast(`Proveedores cargado: ${file.name}`, 'success');
                } else if (type === 'incidencias') {
                    incidData = data;
                    areaIncid.classList.add('hidden');
                    incidLoaded.classList.remove('hidden');
                    incidName.textContent = file.name;
                    incidRows.textContent = `(${data.length} filas)`;
                    step3Icon.textContent = '✓';
                    step3Icon.classList.add('done');
                    Components.showToast(`Incidencias cargado: ${file.name}`, 'success');
                }
                updateProcessButton();
            } catch (err) {
                console.error(`[Upload] Error parsing ${type}:`, err);
                Components.showToast(`Error leyendo ${file.name}: ${err.message}`, 'error');
            }
        }

        setupDropZone(areaStock, inputStock, 'stock');
        setupDropZone(areaProv, inputProv, 'proveedores');
        setupDropZone(areaIncid, inputIncid, 'incidencias');

        // Remove buttons
        btnRemoveStock?.addEventListener('click', () => {
            stockData = null;
            stockLoaded.classList.add('hidden');
            areaStock.classList.remove('hidden');
            step1Icon.textContent = '1';
            step1Icon.classList.remove('done');
            updateProcessButton();
        });
        btnRemoveProv?.addEventListener('click', () => {
            provData = null;
            provLoaded.classList.add('hidden');
            areaProv.classList.remove('hidden');
            step2Icon.textContent = '2';
            step2Icon.classList.remove('done');
            updateProcessButton();
        });
        btnRemoveIncid?.addEventListener('click', () => {
            incidData = null;
            incidLoaded.classList.add('hidden');
            areaIncid.classList.remove('hidden');
            step3Icon.textContent = '3';
            step3Icon.classList.remove('done');
        });

        // Process button: send datasets to Store
        btnProcess?.addEventListener('click', () => {
            if (!stockData || !provData) return;
            btnProcess.disabled = true;
            btnProcess.innerHTML = '<div class="spinner"></div> Procesando...';

            // Use setTimeout to let the spinner render
            setTimeout(() => {
                try {
                    // Normalize column names from CSV (handles BOM, accent variations, etc.)
                    const normalizedStock = ColumnResolver.normalizeDataset(stockData, 'stock');
                    const normalizedProv = ColumnResolver.normalizeDataset(provData, 'proveedores');
                    
                    Store.setStockData(normalizedStock);
                    Store.setProveedoresData(normalizedProv);
                    // Set incidencias if loaded (optional)
                    if (incidData) {
                        Store.setIncidenciasData(incidData);
                    }

                    console.log(`[Upload] Store state → stock: ${Store.state.stockRaw.length}, prov: ${Store.state.proveedoresRaw.length}, incid: ${Store.state.incidenciasRaw.length}, joined: ${Store.state.joinedData.length}, defective: ${Store.state.defectiveData.length}`);

                    uploadDialog?.classList.add('hidden');
                    const incidMsg = incidData ? ` · ${incidData.length} incidencias` : '';
                    Components.showToast(`✅ Datos procesados: ${Store.state.joinedData.length} artículos con stock${incidMsg}`, 'success');

                    // Sync to Supabase if authenticated
                    syncToSupabase(stockData, provData, incidData);

                    // Reset upload dialog state for next time
                    stockData = null;
                    provData = null;
                    incidData = null;
                    stockLoaded.classList.add('hidden');
                    areaStock.classList.remove('hidden');
                    step1Icon.textContent = '1';
                    step1Icon.classList.remove('done');
                    provLoaded.classList.add('hidden');
                    areaProv.classList.remove('hidden');
                    step2Icon.textContent = '2';
                    step2Icon.classList.remove('done');
                    incidLoaded.classList.add('hidden');
                    areaIncid.classList.remove('hidden');
                    step3Icon.textContent = '3';
                    step3Icon.classList.remove('done');
                    btnProcess.disabled = true;
                    btnProcess.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;margin-right:4px;">play_arrow</span> Procesar Datos';
                } catch (err) {
                    console.error('[Upload] Processing error:', err);
                    Components.showToast('Error procesando datos: ' + err.message, 'error');
                    btnProcess.disabled = false;
                    btnProcess.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;margin-right:4px;">play_arrow</span> Procesar Datos';
                }
            }, 50);
        });
    }

    function setupModalClose() {
        document.getElementById('modalClose')?.addEventListener('click', Components.closeModal);
        document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) Components.closeModal();
        });
    }

    /** Load sample data for demonstration */
    function loadSampleData() {
        const sampleStock = generateSampleStock();
        const sampleProveedores = generateSampleProveedores();
        Store.setStockData(sampleStock);
        Store.setProveedoresData(sampleProveedores);
        Components.showToast('Datos de ejemplo cargados', 'success');
    }

    function generateSampleProveedores() {
        return [
            { Código: '001', Nombre: 'RECAMBIOS MARTINEZ SL', 'Nombre Comercial': 'RECAMBIOS MARTINEZ', DniCif: 'B12345678', Telefono: '912345678', Email: 'info@recambiosmartinez.es', 'Dirección': 'C/ Industrial 23', 'C.P.': '28001', Poblacion: 'Madrid', Provincia: 'Madrid', Fpago1: 'Transferencia', Vto1: '30', IVA: '21', 'Dto Com.': '5', 'Margen Venta': '35' },
            { Código: '002', Nombre: 'AUTOPARTES GARCIA SA', 'Nombre Comercial': 'AUTOPARTES GARCIA', DniCif: 'A87654321', Telefono: '934567890', Email: 'pedidos@autopartesgarcia.com', 'Dirección': 'Av. Comercio 45', 'C.P.': '08001', Poblacion: 'Barcelona', Provincia: 'Barcelona', Fpago1: 'Pagaré', Vto1: '60', IVA: '21', 'Dto Com.': '8', 'Margen Venta': '30' },
            { Código: '003', Nombre: 'DISTRIBUCIONES LOPEZ', 'Nombre Comercial': 'DIST. LOPEZ', DniCif: 'B55566677', Telefono: '963456789', Email: 'comercial@distlopez.es', 'Dirección': 'Pol. Ind. Norte 12', 'C.P.': '46001', Poblacion: 'Valencia', Provincia: 'Valencia', Fpago1: 'Transferencia', Vto1: '45', IVA: '21', 'Dto Com.': '3', 'Margen Venta': '40' },
            { Código: '004', Nombre: 'SUMINISTROS INDUSTRIALES PEREZ', 'Nombre Comercial': 'SUM. PEREZ', DniCif: 'B11122233', Telefono: '955678901', Email: 'ventas@sumperez.es', 'Dirección': 'C/ Fábrica 8', 'C.P.': '41001', Poblacion: 'Sevilla', Provincia: 'Sevilla', Fpago1: 'Cheque', Vto1: '30', IVA: '21', 'Dto Com.': '10', 'Margen Venta': '25' },
            { Código: '005', Nombre: 'COMPONENTES ELECTRICOS RUIZ', 'Nombre Comercial': 'COMP. RUIZ', DniCif: 'B99988877', Telefono: '948901234', Email: 'info@compruiz.com', 'Dirección': 'Av. Tecnología 90', 'C.P.': '31001', Poblacion: 'Pamplona', Provincia: 'Navarra', Fpago1: 'Transferencia', Vto1: '30', IVA: '21', 'Dto Com.': '6', 'Margen Venta': '38' },
            { Código: '006', Nombre: 'FERRETERIA INDUSTRIAL SANCHEZ', 'Nombre Comercial': 'FERRET. SANCHEZ', DniCif: 'B44455566', Telefono: '976234567', Email: 'pedidos@ferretsanchez.es', 'Dirección': 'C/ Hierro 15', 'C.P.': '50001', Poblacion: 'Zaragoza', Provincia: 'Zaragoza', Fpago1: 'Pagaré', Vto1: '90', IVA: '21', 'Dto Com.': '12', 'Margen Venta': '28' },
            { Código: '007', Nombre: 'PINTURAS Y ACABADOS DEL NORTE', 'Nombre Comercial': 'PINTURAS NORTE', DniCif: 'B77788899', Telefono: '944567890', Email: 'comercial@pinturasnorte.com', 'Dirección': 'Pol. Ind. Arantzazu 4', 'C.P.': '48001', Poblacion: 'Bilbao', Provincia: 'Vizcaya', Fpago1: 'Transferencia', Vto1: '60', IVA: '21', 'Dto Com.': '7', 'Margen Venta': '45' },
            { Código: '008', Nombre: 'HIDRAULICA FERNANDEZ', 'Nombre Comercial': 'HIDR. FERNANDEZ', DniCif: 'B22233344', Telefono: '981234567', Email: 'info@hidrfernandez.es', 'Dirección': 'C/ Agua 33', 'C.P.': '15001', Poblacion: 'A Coruña', Provincia: 'A Coruña', Fpago1: 'Transferencia', Vto1: '30', IVA: '21', 'Dto Com.': '4', 'Margen Venta': '32' },
            { Código: '009', Nombre: 'NEUMATICOS PREMIUM SA', 'Nombre Comercial': 'NEUM. PREMIUM', DniCif: 'A66677788', Telefono: '952345678', Email: 'ventas@neumpremium.com', 'Dirección': 'Av. Circunvalación 78', 'C.P.': '29001', Poblacion: 'Málaga', Provincia: 'Málaga', Fpago1: 'Confirming', Vto1: '60', IVA: '21', 'Dto Com.': '9', 'Margen Venta': '22' },
            { Código: '010', Nombre: 'ACCESORIOS AUTO JIMENEZ', 'Nombre Comercial': 'ACC. JIMENEZ', DniCif: 'B33344455', Telefono: '968456789', Email: 'info@accjimenez.es', 'Dirección': 'C/ Motor 21', 'C.P.': '30001', Poblacion: 'Murcia', Provincia: 'Murcia', Fpago1: 'Transferencia', Vto1: '45', IVA: '21', 'Dto Com.': '5', 'Margen Venta': '33' }
        ];
    }

    function generateSampleStock() {
        const proveedores = ['RECAMBIOS MARTINEZ SL', 'AUTOPARTES GARCIA SA', 'DISTRIBUCIONES LOPEZ', 'SUMINISTROS INDUSTRIALES PEREZ', 'COMPONENTES ELECTRICOS RUIZ', 'FERRETERIA INDUSTRIAL SANCHEZ', 'PINTURAS Y ACABADOS DEL NORTE', 'HIDRAULICA FERNANDEZ', 'NEUMATICOS PREMIUM SA', 'ACCESORIOS AUTO JIMENEZ'];
        const familias = ['RECAMBIOS', 'ACCESORIOS', 'ELECTRICIDAD', 'CARROCERIA', 'PINTURA', 'NEUMATICOS', 'LUBRICANTES', 'FILTROS'];
        const items = [];

        const today = new Date();
        for (let i = 0; i < 60; i++) {
            const isObsolete = i < 8;
            const isDefective = i >= 8 && i < 16;
            const isOld = i >= 16 && i < 28;
            const prov = proveedores[i % proveedores.length];
            const fam = familias[i % familias.length];
            const stock = Math.floor(Math.random() * 200) + 1;
            const precioAdq = Math.round((Math.random() * 150 + 5) * 100) / 100;
            const precioInv = Math.round(precioAdq * 1.1 * 100) / 100;
            const pvp = Math.round(precioAdq * 1.5 * 100) / 100;
            const daysAgoCompra = isOld ? Math.floor(Math.random() * 500 + 400) : Math.floor(Math.random() * 300 + 30);
            const daysAgoVenta = isOld ? Math.floor(Math.random() * 400 + 200) : Math.floor(Math.random() * 180);
            const fechaCompra = new Date(today); fechaCompra.setDate(fechaCompra.getDate() - daysAgoCompra);
            const fechaVenta = new Date(today); fechaVenta.setDate(fechaVenta.getDate() - daysAgoVenta);

            items.push({
                'Cod.Artículo': `ART-${String(i + 1).padStart(5, '0')}`,
                'Artículo': `${fam} Artículo ${i + 1} ${isObsolete ? '(Descontinuado)' : ''}`,
                'RefProv': `REF-${prov.substring(0, 3)}-${i + 1}`,
                'Ean13': `84${String(Math.floor(Math.random() * 1e10)).padStart(11, '0')}`,
                'DMarca': `Marca ${String.fromCharCode(65 + (i % 8))}`,
                'DFamil_N1': fam,
                'DFamil_N2': `Sub-${fam.substring(0, 4)}`,
                'Clasificación': isDefective ? 'DEFECTUOSO' : (isObsolete ? 'OBSOLETO' : 'NORMAL'),
                'DescAlmacenStock': `Almacén ${(i % 3) + 1}`,
                'LVenta': `L${(i % 5) + 1}`,
                'Stock': stock,
                'StockDisp': Math.floor(stock * 0.8),
                'PrecioAdq_Artic': precioAdq,
                'PrecioInvent': precioInv,
                'PVP_artic': pvp,
                '%MB-Stock': Math.round((pvp - precioAdq) / pvp * 100),
                'UltFechaAlbCompra': fechaCompra.toISOString().split('T')[0],
                'UltFechaAlbVenta': fechaVenta.toISOString().split('T')[0],
                'ArticActivo': isObsolete ? 'No' : 'Sí',
                'Obsoleto': isObsolete ? 'Sí' : 'No',
                'Proveedor': prov,
                'Comprar_Stock': isObsolete ? 'No' : 'Sí'
            });
        }
        return items;
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return { navigateTo, loadSampleData };
})();
