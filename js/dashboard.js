/* ============================================
   DASHBOARD SCREEN
   ============================================ */
const DashboardScreen = (() => {
  let supplierChart = null;
  let familyChart = null;
  let supplierDetailChart = null;

  function render(container) {
    const s = Store.state;
    const defective = s.defectiveData;
    const joined = s.joinedData;
    const metrics = s.supplierMetrics;
    const hasData = joined.length > 0;

    // KPIs — total stock value (all items) and defective subset
    const totalValorStock = joined.reduce((sum, r) => sum + (r._valorStock || 0), 0);
    const totalValorDefectuoso = defective.reduce((sum, r) => sum + (r._valorStock || 0), 0);
    const totalRefs = joined.length;
    const totalRefsDefectuosas = defective.length;
    const numProvCriticos = Math.max(1, Math.ceil(metrics.length * 0.1));
    const avgAge = totalRefsDefectuosas > 0 ? Math.round(defective.reduce((s, r) => s + (r._antiguedadDias || 0), 0) / totalRefsDefectuosas) : 0;

    // Get suppliers with defective stock, sorted by defective value
    const defectiveBySupplier = {};
    defective.forEach(r => {
      const prov = r['Proveedor'] || 'Desconocido';
      if (!defectiveBySupplier[prov]) defectiveBySupplier[prov] = { count: 0, valor: 0 };
      defectiveBySupplier[prov].count++;
      defectiveBySupplier[prov].valor += (r._valorStock || 0);
    });
    const suppliersWithDefective = Object.entries(defectiveBySupplier)
      .sort((a, b) => b[1].valor - a[1].valor)
      .map(([name, info]) => ({ name, count: info.count, valor: info.valor }));

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Resumen Operacional</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            Última actualización: ${new Date().toLocaleString('es-ES')}
          </p>
        </div>
        ${hasData ? `<button class="btn btn-outline btn-sm" onclick="DashboardScreen.exportData()">
          <span class="material-symbols-rounded">download</span> Exportar
        </button>` : ''}
      </div>

      ${!hasData ? renderEmptyState() : `
        <!-- KPI Cards -->
        <div class="dashboard-grid">
          <div class="kpi-card kpi-danger">
            <div class="kpi-header">
              <span class="kpi-label">Valor Total Stock</span>
              <div class="kpi-icon icon-danger">
                <span class="material-symbols-rounded">inventory</span>
              </div>
            </div>
            <div class="kpi-value">${Components.formatCurrency(totalValorStock)}</div>
            <div class="kpi-sub">${Components.formatNumber(totalRefs)} referencias · Defectuoso: ${Components.formatCurrency(totalValorDefectuoso)}</div>
          </div>

          <div class="kpi-card kpi-warning">
            <div class="kpi-header">
              <span class="kpi-label">Proveedores</span>
              <div class="kpi-icon icon-warning">
                <span class="material-symbols-rounded">groups</span>
              </div>
            </div>
            <div class="kpi-value">${metrics.length}</div>
            <div class="kpi-sub">${numProvCriticos} críticos (top 10%)</div>
          </div>

          <div class="kpi-card kpi-info">
            <div class="kpi-header">
              <span class="kpi-label">Refs. Defectuosas</span>
              <div class="kpi-icon icon-info">
                <span class="material-symbols-rounded">inventory_2</span>
              </div>
            </div>
            <div class="kpi-value">${Components.formatNumber(totalRefsDefectuosas)}</div>
            <div class="kpi-sub">De ${Components.formatNumber(totalRefs)} totales</div>
          </div>

          <div class="kpi-card kpi-success">
            <div class="kpi-header">
              <span class="kpi-label">Antigüedad Media</span>
              <div class="kpi-icon icon-success">
                <span class="material-symbols-rounded">schedule</span>
              </div>
            </div>
            <div class="kpi-value">${Components.formatNumber(avgAge)} <span style="font-size:var(--font-sm);font-weight:400;">días</span></div>
            <div class="kpi-sub">Del stock defectuoso</div>
          </div>
        </div>

        <!-- Charts -->
        <div class="charts-grid">
          <div class="chart-card">
            <div class="card-header">
              <h4 class="card-title">Top 10 Proveedores por Valor Stock</h4>
            </div>
            <canvas id="supplierChart"></canvas>
          </div>
          <div class="chart-card">
            <div class="card-header">
              <h4 class="card-title">Distribución por Familia</h4>
            </div>
            <canvas id="familyChart"></canvas>
          </div>
        </div>

        <!-- Supplier Detail Filter -->
        <div class="card" style="margin-top:var(--space-lg);padding:var(--space-md) var(--space-lg);">
          <div class="card-header" style="display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap;">
            <h4 class="card-title" style="margin:0;">
              <span class="material-symbols-rounded" style="vertical-align:middle;margin-right:4px;">filter_list</span>
              Detalle por Proveedor — Stock Defectuoso
            </h4>
            <select id="supplierFilterSelect" style="padding:6px 12px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:var(--font-sm);min-width:280px;cursor:pointer;">
              <option value="">— Selecciona un proveedor —</option>
              ${suppliersWithDefective.map(s =>
      `<option value="${s.name}">${s.name} (${s.count} arts · ${Components.formatCurrency(s.valor)})</option>`
    ).join('')}
            </select>
          </div>
          <div id="supplierDetailChartWrap" style="display:none;margin-top:var(--space-md);">
            <div style="height:350px;position:relative;">
              <canvas id="supplierDetailChart"></canvas>
            </div>
            <p style="text-align:center;font-size:var(--font-xs);color:var(--text-tertiary);margin-top:var(--space-xs);">Haz clic en una barra para ver detalle y crear reclamación</p>
          </div>
          <div id="supplierDetailEmpty" style="text-align:center;padding:var(--space-lg);color:var(--text-tertiary);font-size:var(--font-sm);">
            Selecciona un proveedor del desplegable para ver sus artículos defectuosos
          </div>
        </div>

        <!-- Alerts Table -->
        <div class="card alerts-section">
          <div class="card-header">
            <h4 class="card-title">Proveedores por Valor de Stock</h4>
            <span class="badge badge-danger">${metrics.length} proveedores</span>
          </div>
          ${metrics.slice(0, 15).map(m => `
            <div class="alert-row">
              <div class="alert-priority ${m.totalValorStock > 5000 ? 'high' : m.totalValorStock > 1000 ? 'medium' : 'low'}"></div>
              <div class="alert-text">
                <strong>${m.nombre}</strong> — ${m.numReferencias} refs (${m.numDefectuosos} defectuosas), antigüedad media ${m.antiguedadMedia} días
              </div>
              <div class="alert-value">${Components.formatCurrency(m.totalValorStock)}</div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    if (hasData) {
      renderCharts(metrics, joined);
      setupSupplierFilter(defective, joined);
    }
  }

  function renderEmptyState() {
    const hasStock = Store.state.stockRaw.length > 0;
    const hasProv = Store.state.proveedoresRaw.length > 0;
    return `
      <div class="empty-state">
        <span class="material-symbols-rounded">cloud_upload</span>
        <h3>Sin datos completos</h3>
        <p>Carga <strong>ambos archivos</strong> para comenzar el análisis:</p>
        <div style="display:flex;gap:var(--space-lg);justify-content:center;margin:var(--space-md) 0;">
          <span style="font-size:var(--font-sm);color:${hasStock ? 'var(--success)' : 'var(--text-tertiary)'};">${hasStock ? '✅' : '❌'} Stock (CSV)</span>
          <span style="font-size:var(--font-sm);color:${hasProv ? 'var(--success)' : 'var(--text-tertiary)'};">${hasProv ? '✅' : '❌'} Proveedores (XLSX)</span>
        </div>
        <button class="btn btn-primary btn-lg" onclick="document.getElementById('uploadDialog').classList.remove('hidden')">
          <span class="material-symbols-rounded">upload_file</span>
          Cargar Archivos
        </button>
      </div>
    `;
  }

  function renderCharts(metrics, allData) {
    // Supplier bar chart with click drill-down
    const top10 = metrics.slice(0, 10);
    const ctx1 = document.getElementById('supplierChart');
    if (ctx1) {
      if (supplierChart) supplierChart.destroy();
      supplierChart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: top10.map(m => m.nombre.length > 20 ? m.nombre.substring(0, 20) + '…' : m.nombre),
          datasets: [{
            label: 'Valor Stock Inventario (€)',
            data: top10.map(m => m.totalValorStock),
            backgroundColor: 'rgba(19, 127, 236, 0.6)',
            borderColor: 'rgba(19, 127, 236, 1)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const supplier = top10[idx];
              showSupplierDrillDown(supplier.nombre, allData);
            }
          },
          onHover: (evt, elements) => {
            evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => Components.formatCurrency(ctx.parsed.y),
                afterLabel: () => '(Haz clic para ver artículos)'
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#94a3b8', callback: v => Components.formatCurrency(v) }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', maxRotation: 45 }
            }
          }
        }
      });
    }

    // Family distribution doughnut
    const familyMap = {};
    allData.forEach(r => {
      const fam = r['DFamil_N1'] || r['DFamil_N2'] || 'Sin Clasificar';
      familyMap[fam] = (familyMap[fam] || 0) + (r._valorStock || 0);
    });
    const families = Object.entries(familyMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const colors = ['#137fec', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#06b6d4'];

    const ctx2 = document.getElementById('familyChart');
    if (ctx2) {
      if (familyChart) familyChart.destroy();
      familyChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: families.map(f => f[0]),
          datasets: [{
            data: families.map(f => f[1]),
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', padding: 12, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${Components.formatCurrency(ctx.parsed)}`
              }
            }
          }
        }
      });
    }
  }

  /** Setup supplier filter dropdown and per-supplier chart */
  function setupSupplierFilter(defectiveData, allData) {
    const select = document.getElementById('supplierFilterSelect');
    const chartWrap = document.getElementById('supplierDetailChartWrap');
    const emptyMsg = document.getElementById('supplierDetailEmpty');
    if (!select) return;

    select.addEventListener('change', () => {
      const supplierName = select.value;
      if (!supplierName) {
        chartWrap.style.display = 'none';
        emptyMsg.style.display = 'block';
        if (supplierDetailChart) { supplierDetailChart.destroy(); supplierDetailChart = null; }
        return;
      }

      // Get defective articles for this supplier
      const articles = defectiveData
        .filter(r => r['Proveedor'] === supplierName)
        .sort((a, b) => (b._valorStock || 0) - (a._valorStock || 0))
        .slice(0, 20); // max 20 bars

      if (articles.length === 0) {
        chartWrap.style.display = 'none';
        emptyMsg.style.display = 'block';
        emptyMsg.textContent = 'Sin artículos defectuosos para este proveedor';
        return;
      }

      chartWrap.style.display = 'block';
      emptyMsg.style.display = 'none';

      const labels = articles.map(r => {
        const cod = r._codArticulo || '';
        const art = r._articulo || cod;
        const short = art.length > 30 ? art.substring(0, 30) + '…' : art;
        return cod ? `[${cod}] ${short}` : short;
      });

      const ctx = document.getElementById('supplierDetailChart');
      if (supplierDetailChart) supplierDetailChart.destroy();

      supplierDetailChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Valor Stock Defectuoso (€)',
            data: articles.map(r => r._valorStock || 0),
            backgroundColor: 'rgba(244, 63, 94, 0.6)',
            borderColor: 'rgba(244, 63, 94, 1)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: articles.length > 8 ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elements) => {
            if (elements.length > 0) {
              // Open drill-down for this supplier (same as Top 10 click)
              showSupplierDrillDown(supplierName, allData);
            }
          },
          onHover: (evt, elements) => {
            evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => Components.formatCurrency(ctx.parsed[articles.length > 8 ? 'x' : 'y']),
                afterLabel: () => '(Clic para ver detalle / reclamar)'
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#94a3b8',
                callback: articles.length > 8 ? v => Components.formatCurrency(v) : undefined,
                maxRotation: articles.length > 8 ? 0 : 45
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: articles.length > 8 ? 'transparent' : 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#94a3b8',
                callback: articles.length > 8 ? undefined : v => Components.formatCurrency(v),
                font: { size: 11 }
              }
            }
          }
        }
      });
    });
  }

  /** Show drill-down modal when clicking a supplier bar */
  function showSupplierDrillDown(supplierName, allData) {
    // Get all articles for this supplier
    const articles = allData
      .filter(r => (r['Proveedor'] || r._proveedor) === supplierName)
      .sort((a, b) => (b._valorStock || 0) - (a._valorStock || 0));

    if (articles.length === 0) {
      Components.showToast('Sin artículos para este proveedor', 'warning');
      return;
    }

    const totalValor = articles.reduce((s, r) => s + (r._valorStock || 0), 0);
    const totalStock = articles.reduce((s, r) => s + (r._stock || 0), 0);

    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <div>
          <span style="color:var(--text-secondary);font-size:var(--font-sm);">${articles.length} artículos · ${totalStock} uds · Valor total: ${Components.formatCurrency(totalValor)}</span>
        </div>
        <div style="display:flex;gap:var(--space-xs);">
          <button class="btn btn-sm btn-ghost" id="btnDrillSelectAll" style="font-size:var(--font-xs);">✓ Todos</button>
          <button class="btn btn-sm btn-ghost" id="btnDrillSelectNone" style="font-size:var(--font-xs);">✗ Ninguno</button>
        </div>
      </div>
      <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <table style="width:100%;border-collapse:collapse;font-size:var(--font-sm);">
          <thead style="position:sticky;top:0;background:var(--bg-secondary);z-index:1;">
            <tr>
              <th style="padding:8px 6px;text-align:left;border-bottom:1px solid var(--border-color);width:30px;"></th>
              <th style="padding:8px 6px;text-align:left;border-bottom:1px solid var(--border-color);">Código</th>
              <th style="padding:8px 6px;text-align:left;border-bottom:1px solid var(--border-color);">Artículo</th>
              <th style="padding:8px 6px;text-align:right;border-bottom:1px solid var(--border-color);">Stock</th>
              <th style="padding:8px 6px;text-align:right;border-bottom:1px solid var(--border-color);">Valor</th>
              <th style="padding:8px 6px;text-align:left;border-bottom:1px solid var(--border-color);">Incidencia</th>
            </tr>
          </thead>
          <tbody>
            ${articles.map((r, i) => {
      const cod = r._codArticulo || '';
      const art = r._articulo || '—';
      const stock = r._stock || 0;
      const valor = r._valorStock || 0;
      const incid = r._incidencia || Store.getIncidencia(cod) || '';
      return `
                <tr style="border-bottom:1px solid var(--border-color);transition:background 0.1s;"
                    onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:6px;text-align:center;">
                    <input type="checkbox" class="drill-art-cb" value="${art.replace(/"/g, '&quot;')}" data-cod="${cod}" data-valor="${valor}">
                  </td>
                  <td style="padding:6px;color:var(--primary);font-family:monospace;font-size:var(--font-xs);">${cod}</td>
                  <td style="padding:6px;">${art.length > 70 ? art.substring(0, 70) + '…' : art}</td>
                  <td style="padding:6px;text-align:right;">${stock}</td>
                  <td style="padding:6px;text-align:right;color:var(--danger);font-weight:600;">${Components.formatCurrency(valor)}</td>
                  <td style="padding:6px;font-size:var(--font-xs);color:${incid ? '#f59e0b' : 'var(--text-tertiary)'};">${incid || '—'}</td>
                </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    Components.openModal(`${supplierName} — Detalle de Artículos`, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cerrar</button>
       <button class="btn btn-primary" id="btnDrillClaim">
         <span class="material-symbols-rounded">mail</span> Reclamar seleccionados
       </button>`, 'lg'
    );

    setTimeout(() => {
      document.getElementById('btnDrillSelectAll')?.addEventListener('click', () => {
        document.querySelectorAll('.drill-art-cb').forEach(cb => cb.checked = true);
      });
      document.getElementById('btnDrillSelectNone')?.addEventListener('click', () => {
        document.querySelectorAll('.drill-art-cb').forEach(cb => cb.checked = false);
      });

      document.getElementById('btnDrillClaim')?.addEventListener('click', () => {
        const selected = [...document.querySelectorAll('.drill-art-cb:checked')];
        if (selected.length === 0) {
          Components.showToast('Selecciona al menos un artículo', 'error');
          return;
        }
        const arts = selected.map(cb => cb.value);
        const valorTotal = selected.reduce((s, cb) => s + parseFloat(cb.dataset.valor || 0), 0);

        // Create reclamación and go to email flow
        const rec = Store.addReclamacion({
          proveedor: supplierName,
          articulos: arts,
          valorTotal,
          notas: `Creada desde gráfico Top 10 — ${arts.length} artículos seleccionados`,
          emailEnviado: false
        });

        Components.closeModal();
        Components.showToast(`Reclamación ${rec.id} creada con ${arts.length} artículos`, 'success');

        // Open email generation directly
        setTimeout(() => ReclamacionesScreen.generateEmail(rec.id), 300);
      });
    }, 100);
  }

  function exportData() {
    Components.exportToExcel(
      Store.state.defectiveData.map(r => ({
        'Proveedor': r['Proveedor'],
        'Artículo': r['Artículo'] || r['Articulo'],
        'Stock': r._stock,
        'Valor Stock': r._valorStock,
        'Antigüedad (días)': r._antiguedadDias
      })),
      'dashboard_resumen.xlsx'
    );
  }

  return { render, exportData, showSupplierDrillDown };
})();
