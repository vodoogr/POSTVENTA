/* ============================================
   CONFIGURACIÓN SCREEN
   ============================================ */
const ConfiguracionScreen = (() => {

    function render(container) {
        const config = Store.state.config;

        container.innerHTML = `
      <!-- Umbrales -->
      <div class="config-section">
        <h3><span class="material-symbols-rounded">tune</span> Umbrales de Análisis</h3>

        <div class="form-group">
          <label class="form-label">Antigüedad para stock defectuoso (días)</label>
          <div class="range-slider">
            <input type="range" id="cfgAntiguedad" min="30" max="730" value="${config.umbralAntiguedad}">
            <span class="range-value" id="cfgAntiguedadVal">${config.umbralAntiguedad} días</span>
          </div>
          <p style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px;">
            Productos con stock más antiguo que este umbral se marcan como defectuosos.
          </p>
        </div>

        <div class="form-group">
          <label class="form-label">Valor mínimo para priorizar reclamaciones (€)</label>
          <div class="range-slider">
            <input type="range" id="cfgValorReclamacion" min="50" max="10000" step="50" value="${config.umbralValorReclamacion}">
            <span class="range-value" id="cfgValorReclamacionVal">${config.umbralValorReclamacion}€</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Periodo sin rotación (días)</label>
          <div class="range-slider">
            <input type="range" id="cfgPeriodoRotacion" min="30" max="365" value="${config.periodoSinRotacion}">
            <span class="range-value" id="cfgPeriodoRotacionVal">${config.periodoSinRotacion} días</span>
          </div>
          <p style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px;">
            Productos sin ventas durante este periodo se identifican como sin rotación.
          </p>
        </div>
      </div>

      <!-- Email -->
      <div class="config-section">
        <h3><span class="material-symbols-rounded">mail</span> Configuración de Email</h3>

        <div class="form-group">
          <label class="form-label">Email remitente</label>
          <input class="form-input" id="cfgEmailRemitente" type="email" value="${config.emailRemitente}" placeholder="reclamaciones@empresa.com">
        </div>

        <div class="form-group">
          <label class="form-label">Plantilla de Email</label>
          <textarea class="email-template" id="cfgPlantillaEmail" rows="18">${config.plantillaEmail}</textarea>
          <p style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px;">
            Variables disponibles: <code>{proveedor}</code>, <code>{articulos}</code>, <code>{valor}</code>, <code>{emailRemitente}</code>
          </p>
        </div>
      </div>

      <!-- Data Management -->
      <div class="config-section">
        <h3><span class="material-symbols-rounded">database</span> Gestión de Datos</h3>

        <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="document.getElementById('uploadDialog').classList.remove('hidden')">
            <span class="material-symbols-rounded">upload_file</span> Cargar Archivos
          </button>
          <button class="btn btn-outline" onclick="App.loadSampleData()">
            <span class="material-symbols-rounded">science</span> Cargar Datos de Ejemplo
          </button>
          <button class="btn btn-danger" onclick="ConfiguracionScreen.clearAllData()">
            <span class="material-symbols-rounded">delete_forever</span> Borrar Todos los Datos
          </button>
        </div>

        <div style="margin-top:var(--space-md);padding:var(--space-md);background:var(--bg-tertiary);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px;">
            <span>Registros de Stock:</span>
            <strong>${Components.formatNumber(Store.state.stockRaw.length)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px;">
            <span>Proveedores:</span>
            <strong>${Components.formatNumber(Store.state.proveedoresRaw.length)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px;">
            <span>Datos cruzados:</span>
            <strong>${Components.formatNumber(Store.state.joinedData.length)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px;">
            <span>Stock defectuoso:</span>
            <strong>${Components.formatNumber(Store.state.defectiveData.length)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:var(--font-sm);">
            <span>Reclamaciones:</span>
            <strong>${Components.formatNumber(Store.state.reclamaciones.length)}</strong>
          </div>
        </div>
      </div>

      <!-- Supabase preparation info -->
      <div class="config-section" style="border-color:var(--primary-500);border-style:dashed;">
        <h3><span class="material-symbols-rounded">cloud</span> Preparado para Supabase</h3>
        <p style="color:var(--text-secondary);font-size:var(--font-sm);">
          La estructura de datos está diseñada para migración futura a Supabase con las siguientes tablas:
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-sm);margin-top:var(--space-md);">
          <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:var(--font-sm);">
            <strong>proveedores</strong><br><span style="color:var(--text-tertiary);font-size:var(--font-xs);">Datos de contacto, condiciones</span>
          </div>
          <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:var(--font-sm);">
            <strong>reclamaciones</strong><br><span style="color:var(--text-tertiary);font-size:var(--font-xs);">Histórico de reclamaciones</span>
          </div>
          <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:var(--font-sm);">
            <strong>acciones_recomendadas</strong><br><span style="color:var(--text-tertiary);font-size:var(--font-xs);">Log de recomendaciones</span>
          </div>
          <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:var(--font-sm);">
            <strong>auditoria</strong><br><span style="color:var(--text-tertiary);font-size:var(--font-xs);">Cambios en datos</span>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div style="display:flex;justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-primary btn-lg" id="btnSaveConfig">
          <span class="material-symbols-rounded">save</span> Guardar Configuración
        </button>
      </div>
    `;

        setupHandlers();
    }

    function setupHandlers() {
        // Range sliders live update
        const ranges = [
            { input: 'cfgAntiguedad', display: 'cfgAntiguedadVal', suffix: ' días' },
            { input: 'cfgValorReclamacion', display: 'cfgValorReclamacionVal', suffix: '€' },
            { input: 'cfgPeriodoRotacion', display: 'cfgPeriodoRotacionVal', suffix: ' días' }
        ];

        ranges.forEach(({ input, display, suffix }) => {
            const el = document.getElementById(input);
            const disp = document.getElementById(display);
            el?.addEventListener('input', () => {
                if (disp) disp.textContent = el.value + suffix;
            });
        });

        // Save button
        document.getElementById('btnSaveConfig')?.addEventListener('click', () => {
            Store.saveConfig({
                umbralAntiguedad: parseInt(document.getElementById('cfgAntiguedad')?.value || 365),
                umbralValorReclamacion: parseInt(document.getElementById('cfgValorReclamacion')?.value || 500),
                periodoSinRotacion: parseInt(document.getElementById('cfgPeriodoRotacion')?.value || 180),
                emailRemitente: document.getElementById('cfgEmailRemitente')?.value || '',
                plantillaEmail: document.getElementById('cfgPlantillaEmail')?.value || ''
            });

            // Recalculate if data exists
            if (Store.state.stockRaw.length && Store.state.proveedoresRaw.length) {
                Store.recalculate();
            }

            Components.showToast('Configuración guardada', 'success');
        });
    }

    function clearAllData() {
        if (confirm('¿Estás seguro? Se borrarán todos los datos cargados, reclamaciones y configuración.')) {
            localStorage.clear();
            Store.state.stockRaw = [];
            Store.state.proveedoresRaw = [];
            Store.state.joinedData = [];
            Store.state.defectiveData = [];
            Store.state.supplierMetrics = [];
            Store.state.productMetrics = [];
            Store.state.recommendations = [];
            Store.state.reclamaciones = [];
            Store.emit('data-recalculated', Store.state);
            Components.showToast('Todos los datos han sido borrados', 'warning');
            App.navigateTo('dashboard');
        }
    }

    return { render, clearAllData };
})();
