/* ============================================
   PROVEEDORES SCREEN
   ============================================ */
const ProveedoresScreen = (() => {

  function render(container) {
    const s = Store.state;
    const proveedores = s.proveedoresRaw;
    const metrics = s.supplierMetrics;
    const hasData = proveedores.length > 0;

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Gestión de Proveedores</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            ${hasData ? `${Components.formatNumber(proveedores.length)} proveedores registrados` : 'Sin datos de proveedores'}
          </p>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <button class="btn btn-primary" onclick="ProveedoresScreen.openNewForm()">
            <span class="material-symbols-rounded">person_add</span> Nuevo Proveedor
          </button>
          ${hasData ? `
            <button class="btn btn-outline btn-sm" id="btnExportProv">
              <span class="material-symbols-rounded">download</span> Exportar
            </button>
          ` : ''}
        </div>
      </div>

      ${!hasData ? `
        <div class="empty-state">
          <span class="material-symbols-rounded">groups</span>
          <h3>Sin datos de proveedores</h3>
          <p>Carga un archivo CSV/Excel con datos de proveedores o añade uno manualmente.</p>
          <button class="btn btn-primary" onclick="document.getElementById('uploadDialog').classList.remove('hidden')">
            <span class="material-symbols-rounded">upload_file</span> Cargar Proveedores
          </button>
        </div>
      ` : `
        <!-- Search & Filters -->
        <div class="filter-bar">
          <div class="search-bar" style="min-width:300px;">
            <span class="material-symbols-rounded" style="font-size:18px;color:var(--text-tertiary);">search</span>
            <input type="text" id="provSearch" placeholder="Buscar por nombre, CIF, email, teléfono, ciudad...">
          </div>
        </div>
        <div id="provTableContainer"></div>
      `}
    `;

    if (hasData) {
      renderTable(container, proveedores, metrics);
      setupSearch();

      document.getElementById('btnExportProv')?.addEventListener('click', () => {
        Components.exportToExcel(proveedores, 'proveedores.xlsx');
      });
    }
  }

  function renderTable(container, proveedores, metrics) {
    // Create a lookup for metrics
    const metricsMap = {};
    metrics.forEach(m => { metricsMap[Engine.normalizeForJoin(m.nombre)] = m; });

    const enriched = proveedores.map(p => {
      const key = Engine.normalizeForJoin(p['Nombre'] || p['Nombre Comercial'] || '');
      const m = metricsMap[key];
      return { ...p, _defectivoValor: m ? m.totalValorStock : 0, _defectivoRefs: m ? m.numReferencias : 0 };
    });

    const columns = [
      { key: 'Nombre', label: 'Nombre', render: r => `<strong>${r['Nombre'] || r['Nombre Comercial'] || '—'}</strong>` },
      { key: 'DniCif', label: 'CIF', render: r => r['DniCif'] || '—' },
      { key: 'Email', label: 'Email', render: r => r['Email'] ? `<a href="mailto:${r['Email']}">${r['Email']}</a>` : '—' },
      { key: 'Telefono', label: 'Teléfono', render: r => r['Telefono'] || '—' },
      { key: 'Poblacion', label: 'Población', render: r => r['Poblacion'] || '—' },
      {
        key: '_defectivoValor', label: 'Stock Defectuoso', render: r => {
          if (!r._defectivoValor) return '<span style="color:var(--text-tertiary);">—</span>';
          return `<span class="cell-value cell-danger">${Components.formatCurrency(r._defectivoValor)}</span>`;
        }
      },
      {
        key: '_defectivoRefs', label: 'Nº Refs.', render: r => r._defectivoRefs > 0 ?
          `<span class="badge badge-danger">${r._defectivoRefs}</span>` :
          '<span style="color:var(--text-tertiary);">0</span>'
      },
      {
        key: '_actions', label: 'Acciones', render: r => `
        <div class="table-actions">
          <button class="btn-icon" data-tooltip="Ver ficha" onclick="ProveedoresScreen.showDetail('${encodeURIComponent(r['Nombre'] || r['Nombre Comercial'])}')">
            <span class="material-symbols-rounded" style="font-size:18px;">visibility</span>
          </button>
          <button class="btn-icon" data-tooltip="Editar" onclick="ProveedoresScreen.openEditForm('${encodeURIComponent(r['Nombre'] || r['Nombre Comercial'])}')">
            <span class="material-symbols-rounded" style="font-size:18px;">edit</span>
          </button>
          <button class="btn-icon" data-tooltip="Reclamar" onclick="ProveedoresScreen.createClaim('${r['Nombre'] || r['Nombre Comercial']}')">
            <span class="material-symbols-rounded" style="font-size:18px;">report_problem</span>
          </button>
        </div>
      `}
    ];

    const tableEl = Components.createTable(columns, enriched);
    const tableContainer = container.querySelector('#provTableContainer');
    if (tableContainer) {
      tableContainer.innerHTML = '';
      tableContainer.appendChild(tableEl);
    }

    // Store ref for search
    container._tableEl = tableEl;
    container._enriched = enriched;
  }

  function setupSearch() {
    const search = document.getElementById('provSearch');
    const container = document.getElementById('pageContainer');
    let timer;

    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = search.value.toLowerCase();
        if (!container._enriched) return;
        const filtered = container._enriched.filter(p => {
          return (p['Nombre'] || '').toLowerCase().includes(q)
            || (p['Nombre Comercial'] || '').toLowerCase().includes(q)
            || (p['DniCif'] || '').toLowerCase().includes(q)
            || (p['Email'] || '').toLowerCase().includes(q)
            || (p['Telefono'] || '').toLowerCase().includes(q)
            || (p['Poblacion'] || '').toLowerCase().includes(q)
            || (p['Provincia'] || '').toLowerCase().includes(q);
        });
        if (container._tableEl) container._tableEl.updateData(filtered);
      }, 300);
    });
  }

  function showDetail(encodedName) {
    const name = decodeURIComponent(encodedName);
    const prov = Store.state.proveedoresRaw.find(p =>
      (p['Nombre'] || p['Nombre Comercial']) === name
    );
    if (!prov) return;

    // Find metrics
    const key = Engine.normalizeForJoin(name);
    const m = Store.state.supplierMetrics.find(sm => Engine.normalizeForJoin(sm.nombre) === key);

    // Find claims
    const claims = Store.state.reclamaciones.filter(r =>
      Engine.normalizeForJoin(r.proveedor) === key
    );

    const ii = (label, value) => `<div class="info-item"><div class="info-item-label">${label}</div><div class="info-item-value">${value || '—'}</div></div>`;

    const body = `
      <div class="proveedor-info-section">
        <h4><span class="material-symbols-rounded" style="font-size:18px;">business</span> Información de Contacto</h4>
        <div class="info-grid">
          ${ii('Nombre', prov['Nombre'])}
          ${ii('Nombre Comercial', prov['Nombre Comercial'])}
          ${ii('CIF/NIF', prov['DniCif'])}
          ${ii('Teléfono', prov['Telefono'])}
          ${ii('Fax', prov['Fax'])}
          ${ii('Email', prov['Email'])}
          ${ii('Dirección', prov['Dirección'] || prov['Direccion'])}
          ${ii('C.P.', prov['C.P.'])}
          ${ii('Población', prov['Poblacion'])}
          ${ii('Provincia', prov['Provincia'])}
        </div>
      </div>
      <div class="proveedor-info-section">
        <h4><span class="material-symbols-rounded" style="font-size:18px;">payments</span> Condiciones Comerciales</h4>
        <div class="info-grid">
          ${ii('F. Pago 1', prov['Fpago1'])}
          ${ii('Vto 1', prov['Vto1'])}
          ${ii('IVA', prov['IVA'])}
          ${ii('Dto Com.', prov['Dto Com.'])}
          ${ii('Dto P.P.', prov['Dto. P.P.'])}
          ${ii('Margen Venta', prov['Margen Venta'])}
        </div>
      </div>
      ${m ? `
        <div class="proveedor-info-section">
          <h4><span class="material-symbols-rounded" style="font-size:18px;">warning</span> Impacto Stock Defectuoso</h4>
          <div class="dashboard-grid" style="grid-template-columns:repeat(3,1fr);">
            <div class="kpi-card kpi-danger" style="padding:var(--space-md);">
              <div class="kpi-label">Valor Total</div>
              <div class="kpi-value" style="font-size:var(--font-lg);">${Components.formatCurrency(m.totalValorStock)}</div>
            </div>
            <div class="kpi-card kpi-warning" style="padding:var(--space-md);">
              <div class="kpi-label">Referencias</div>
              <div class="kpi-value" style="font-size:var(--font-lg);">${m.numReferencias}</div>
            </div>
            <div class="kpi-card kpi-info" style="padding:var(--space-md);">
              <div class="kpi-label">Antigüedad Media</div>
              <div class="kpi-value" style="font-size:var(--font-lg);">${m.antiguedadMedia} días</div>
            </div>
          </div>
        </div>
      ` : ''}
      ${claims.length > 0 ? `
        <div class="proveedor-info-section">
          <h4><span class="material-symbols-rounded" style="font-size:18px;">description</span> Histórico de Reclamaciones</h4>
          ${claims.map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm);border-bottom:1px solid var(--border-color);">
              <div>
                <strong>${c.id}</strong>
                <span style="color:var(--text-tertiary);font-size:var(--font-xs);margin-left:var(--space-xs);">${Components.formatDate(c.fecha)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:var(--space-sm);">
                <span class="cell-value">${Components.formatCurrency(c.valorTotal)}</span>
                ${Components.statusBadge(c.estado)}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    Components.openModal(`Ficha: ${name}`, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cerrar</button>
       <button class="btn btn-primary" onclick="ProveedoresScreen.createClaim('${name}');Components.closeModal();">
         <span class="material-symbols-rounded">report_problem</span> Nueva Reclamación
       </button>`, 'xl'
    );
  }

  function openNewForm() {
    const body = proveedorFormHTML({});
    Components.openModal('Nuevo Proveedor', body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cancelar</button>
       <button class="btn btn-primary" id="btnSaveNewProv">
         <span class="material-symbols-rounded">save</span> Guardar
       </button>`
    );

    setTimeout(() => {
      document.getElementById('btnSaveNewProv')?.addEventListener('click', () => {
        const data = getFormData();
        if (!data['Nombre']) {
          Components.showToast('El nombre es obligatorio', 'error');
          return;
        }
        Store.addProveedor(data);
        Components.closeModal();
        Components.showToast('Proveedor añadido correctamente', 'success');
        App.navigateTo('proveedores');
      });
    }, 100);
  }

  function openEditForm(encodedName) {
    const name = decodeURIComponent(encodedName);
    const prov = Store.state.proveedoresRaw.find(p =>
      (p['Nombre'] || p['Nombre Comercial']) === name
    );
    if (!prov) return;

    const body = proveedorFormHTML(prov);
    Components.openModal(`Editar: ${name}`, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cancelar</button>
       <button class="btn btn-primary" id="btnSaveEditProv">
         <span class="material-symbols-rounded">save</span> Guardar
       </button>`
    );

    setTimeout(() => {
      document.getElementById('btnSaveEditProv')?.addEventListener('click', () => {
        const data = getFormData();
        Store.updateProveedor(prov._id || prov['Código'], data);
        Components.closeModal();
        Components.showToast('Proveedor actualizado', 'success');
        App.navigateTo('proveedores');
      });
    }, 100);
  }

  function proveedorFormHTML(p) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nombre <span class="required">*</span></label>
          <input class="form-input" id="provNombre" value="${p['Nombre'] || ''}" placeholder="Nombre del proveedor" required>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre Comercial</label>
          <input class="form-input" id="provNombreComercial" value="${p['Nombre Comercial'] || ''}" placeholder="Nombre comercial">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CIF/NIF</label>
          <input class="form-input" id="provCif" value="${p['DniCif'] || ''}" placeholder="B12345678">
        </div>
        <div class="form-group">
          <label class="form-label">Email <span class="required">*</span></label>
          <input class="form-input" id="provEmail" type="email" value="${p['Email'] || ''}" placeholder="email@proveedor.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Teléfono <span class="required">*</span></label>
          <input class="form-input" id="provTelefono" value="${p['Telefono'] || ''}" placeholder="912345678">
        </div>
        <div class="form-group">
          <label class="form-label">Fax</label>
          <input class="form-input" id="provFax" value="${p['Fax'] || ''}" placeholder="Fax">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input class="form-input" id="provDireccion" value="${p['Dirección'] || p['Direccion'] || ''}" placeholder="Calle, número...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">C.P.</label>
          <input class="form-input" id="provCP" value="${p['C.P.'] || ''}" placeholder="28001">
        </div>
        <div class="form-group">
          <label class="form-label">Población</label>
          <input class="form-input" id="provPoblacion" value="${p['Poblacion'] || ''}" placeholder="Ciudad">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Provincia</label>
        <input class="form-input" id="provProvincia" value="${p['Provincia'] || ''}" placeholder="Provincia">
      </div>
      <hr style="border-color:var(--border-color);margin:var(--space-md) 0;">
      <h4 style="margin-bottom:var(--space-md);color:var(--primary-400);">Condiciones Comerciales</h4>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">IVA (%)</label>
          <input class="form-input" id="provIVA" type="number" value="${p['IVA'] || ''}" placeholder="21">
        </div>
        <div class="form-group">
          <label class="form-label">Dto. Comercial (%)</label>
          <input class="form-input" id="provDtoCom" type="number" value="${p['Dto Com.'] || ''}" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Margen Venta (%)</label>
          <input class="form-input" id="provMargen" type="number" value="${p['Margen Venta'] || ''}" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">F. Pago</label>
          <input class="form-input" id="provFPago" value="${p['Fpago1'] || ''}" placeholder="Forma de pago">
        </div>
      </div>
    `;
  }

  function getFormData() {
    return {
      'Nombre': document.getElementById('provNombre')?.value || '',
      'Nombre Comercial': document.getElementById('provNombreComercial')?.value || '',
      'DniCif': document.getElementById('provCif')?.value || '',
      'Email': document.getElementById('provEmail')?.value || '',
      'Telefono': document.getElementById('provTelefono')?.value || '',
      'Fax': document.getElementById('provFax')?.value || '',
      'Dirección': document.getElementById('provDireccion')?.value || '',
      'C.P.': document.getElementById('provCP')?.value || '',
      'Poblacion': document.getElementById('provPoblacion')?.value || '',
      'Provincia': document.getElementById('provProvincia')?.value || '',
      'IVA': document.getElementById('provIVA')?.value || '',
      'Dto Com.': document.getElementById('provDtoCom')?.value || '',
      'Margen Venta': document.getElementById('provMargen')?.value || '',
      'Fpago1': document.getElementById('provFPago')?.value || ''
    };
  }

  function createClaim(nombre) {
    window.location.hash = '#reclamaciones';
    setTimeout(() => {
      ReclamacionesScreen.openNewClaim(nombre);
    }, 100);
  }

  return { render, showDetail, openNewForm, openEditForm, createClaim };
})();
