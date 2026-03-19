/* ============================================
   STOCK DEFECTUOSO SCREEN
   ============================================ */
const StockScreen = (() => {
  let tableEl = null;
  let currentFilters = {};

  function render(container) {
    const s = Store.state;
    const hasData = s.defectiveData.length > 0;

    // Build proveedor options
    const proveedores = [...new Set(s.defectiveData.map(r => r['Proveedor']).filter(Boolean))].sort();

    container.innerHTML = `
      <div class="stock-header">
        <div>
          <h3>Stock Defectuoso</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            ${hasData ? `${Components.formatNumber(s.defectiveData.length)} productos identificados` : 'Sin datos cargados'}
          </p>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          ${hasData ? `
            <button class="btn btn-outline btn-sm" id="btnExportStock">
              <span class="material-symbols-rounded">download</span> Exportar
            </button>
          ` : ''}
        </div>
      </div>

      ${!hasData ? `
        <div class="empty-state">
          <span class="material-symbols-rounded">inventory_2</span>
          <h3>Sin datos de stock</h3>
          <p>Carga un archivo CSV/Excel con datos de stock para ver los productos defectuosos.</p>
          <button class="btn btn-primary" onclick="document.getElementById('uploadDialog').classList.remove('hidden')">
            <span class="material-symbols-rounded">upload_file</span> Cargar Stock
          </button>
        </div>
      ` : `
        <!-- Filters -->
        <div class="filter-bar">
          <div class="search-bar" style="min-width:250px;">
            <span class="material-symbols-rounded" style="font-size:18px;color:var(--text-tertiary);">search</span>
            <input type="text" id="stockSearch" placeholder="Buscar artículo, código, proveedor...">
          </div>
          <select class="form-select" id="filterProveedor" style="width:auto;min-width:180px;">
            <option value="">Todos los proveedores</option>
            ${proveedores.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
          <select class="form-select" id="filterAntiguedad" style="width:auto;">
            <option value="">Toda antigüedad</option>
            <option value="0-90">0-90 días</option>
            <option value="91-180">91-180 días</option>
            <option value="181-365">181-365 días</option>
            <option value="366-9999">&gt; 365 días</option>
          </select>
          <input type="number" class="form-input" id="filterValorMin" placeholder="Valor mín. (€)" style="width:auto;max-width:140px;">
        </div>

        <div id="stockTableContainer"></div>
      `}
    `;

    if (hasData) {
      renderTable(container, s.defectiveData);
      setupFilters();
    }
  }

  function renderTable(container, data) {
    const columns = [
      { key: 'Cod.Artículo', label: 'Código', render: r => r['Cod.Artículo'] || r['Cod.Articulo'] || '—' },
      { key: 'Artículo', label: 'Artículo', render: r => `<span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;display:inline-block;">${r['Artículo'] || r['Articulo'] || '—'}</span>` },
      { key: 'Proveedor', label: 'Proveedor', render: r => r['Proveedor'] || '—' },
      { key: '_stock', label: 'Stock', render: r => `<span class="cell-value">${Components.formatNumber(r._stock)}</span>` },
      { key: '_valorStock', label: 'Valor Stock', render: r => `<span class="cell-value ${r._valorStock > 1000 ? 'cell-danger' : ''}">${Components.formatCurrency(r._valorStock)}</span>` },
      { key: '_valorAdquisicion', label: 'Valor Adq.', render: r => `<span class="cell-value">${Components.formatCurrency(r._valorAdquisicion)}</span>` },
      {
        key: '_antiguedadDias', label: 'Antigüedad', render: r => {
          const d = r._antiguedadDias;
          const cls = d > 365 ? 'cell-danger' : d > 180 ? 'cell-warning' : '';
          return `<span class="cell-value ${cls}">${d === 9999 ? '—' : d + ' días'}</span>`;
        }
      },
      { key: 'Clasificación', label: 'Clasif.', render: r => r['Clasificación'] || r['Clasificacion'] || '—' },
      {
        key: '_actions', label: 'Acciones', render: r => `
        <div class="table-actions">
          <button class="btn-icon" data-tooltip="Ver detalle" onclick="StockScreen.showDetail('${encodeURIComponent(JSON.stringify({ cod: r['Cod.Artículo'] || r['Cod.Articulo'], art: r['Artículo'] || r['Articulo'] }))}')">
            <span class="material-symbols-rounded" style="font-size:18px;">visibility</span>
          </button>
          <button class="btn-icon" data-tooltip="Reclamar" onclick="StockScreen.claimProduct('${r['Proveedor']}', '${r['Artículo'] || r['Articulo']}')">
            <span class="material-symbols-rounded" style="font-size:18px;">report_problem</span>
          </button>
        </div>
      `}
    ];

    tableEl = Components.createTable(columns, data);
    const tableContainer = container.querySelector('#stockTableContainer');
    if (tableContainer) {
      tableContainer.innerHTML = '';
      tableContainer.appendChild(tableEl);
    }
  }

  function setupFilters() {
    const search = document.getElementById('stockSearch');
    const prov = document.getElementById('filterProveedor');
    const antig = document.getElementById('filterAntiguedad');
    const valorMin = document.getElementById('filterValorMin');
    const btnExport = document.getElementById('btnExportStock');

    let debounceTimer;
    function applyFilters() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilters = {
          search: search?.value || '',
          proveedor: prov?.value || '',
          valorMin: valorMin?.value ? parseFloat(valorMin.value) : null
        };
        if (antig?.value) {
          const [min, max] = antig.value.split('-').map(Number);
          currentFilters.antiguedadMin = min;
          currentFilters.antiguedadMax = max;
        }
        const filtered = Engine.filterData(Store.state.defectiveData, currentFilters);
        if (tableEl) tableEl.updateData(filtered);
      }, 300);
    }

    search?.addEventListener('input', applyFilters);
    prov?.addEventListener('change', applyFilters);
    antig?.addEventListener('change', applyFilters);
    valorMin?.addEventListener('input', applyFilters);

    btnExport?.addEventListener('click', () => {
      const filtered = Engine.filterData(Store.state.defectiveData, currentFilters);
      Components.exportToExcel(
        filtered.map(r => ({
          'Código': r['Cod.Artículo'] || r['Cod.Articulo'],
          'Artículo': r['Artículo'] || r['Articulo'],
          'Proveedor': r['Proveedor'],
          'Stock': r._stock,
          'Valor Stock': r._valorStock,
          'Valor Adquisición': r._valorAdquisicion,
          'Antigüedad (días)': r._antiguedadDias,
          'Clasificación': r['Clasificación'] || r['Clasificacion'],
          'Obsoleto': r['Obsoleto']
        })),
        'stock_defectuoso.xlsx'
      );
    });
  }

  function showDetail(encoded) {
    const data = JSON.parse(decodeURIComponent(encoded));
    const row = Store.state.defectiveData.find(r =>
      (r['Cod.Artículo'] || r['Cod.Articulo']) === data.cod
    );
    if (!row) return;

    const body = `
      <div class="info-grid" style="grid-template-columns:1fr;">
        ${infoItem('Código', row['Cod.Artículo'] || row['Cod.Articulo'])}
        ${infoItem('Artículo', row['Artículo'] || row['Articulo'])}
        ${infoItem('Referencia Proveedor', row['RefProv'])}
        ${infoItem('EAN13', row['Ean13'])}
      </div>
      <hr style="border-color:var(--border-color);margin:var(--space-md) 0;">
      <div class="info-grid">
        ${infoItem('Proveedor', row['Proveedor'])}
        ${infoItem('Marca', row['DMarca'])}
        ${infoItem('Familia', row['DFamil_N1'])}
        ${infoItem('Subfamilia', row['DFamil_N2'])}
        ${infoItem('Clasificación', row['Clasificación'] || row['Clasificacion'])}
        ${infoItem('Obsoleto', row['Obsoleto'])}
      </div>
      <hr style="border-color:var(--border-color);margin:var(--space-md) 0;">
      <div class="info-grid">
        ${infoItem('Stock', Components.formatNumber(row._stock))}
        ${infoItem('Precio Adquisición', Components.formatCurrency(row._precioAdq))}
        ${infoItem('Valor Stock (Inventario)', Components.formatCurrency(row._valorStock))}
        ${infoItem('Valor Adquisición', Components.formatCurrency(row._valorAdquisicion))}
        ${infoItem('PVP', Components.formatCurrency(row._pvp))}
        ${infoItem('Margen Bruto', (row._margenBruto || 0) + '%')}
      </div>
      <hr style="border-color:var(--border-color);margin:var(--space-md) 0;">
      <div class="info-grid">
        ${infoItem('Últ. Compra', Components.formatDate(row._ultCompra))}
        ${infoItem('Últ. Venta', Components.formatDate(row._ultVenta))}
        ${infoItem('Antigüedad', row._antiguedadDias === 9999 ? 'Desconocida' : row._antiguedadDias + ' días')}
        ${infoItem('Días sin venta', row._diasSinVenta === 9999 ? 'Desconocido' : row._diasSinVenta + ' días')}
      </div>
    `;

    Components.openModal(`Detalle: ${row['Artículo'] || row['Articulo']}`, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cerrar</button>
       <button class="btn btn-primary" onclick="StockScreen.claimProduct('${row['Proveedor']}', '${row['Artículo'] || row['Articulo']}');Components.closeModal();">
         <span class="material-symbols-rounded">report_problem</span> Reclamar
       </button>`, 'lg'
    );
  }

  function infoItem(label, value) {
    return `<div class="info-item"><div class="info-item-label">${label}</div><div class="info-item-value">${value || '—'}</div></div>`;
  }

  function claimProduct(proveedor, articulo) {
    // Navigate to claims and pre-fill
    window.location.hash = '#reclamaciones';
    setTimeout(() => {
      ReclamacionesScreen.openNewClaim(proveedor, articulo);
    }, 100);
  }

  return { render, showDetail, claimProduct };
})();
