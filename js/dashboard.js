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
    const targetStock = s.objetivoStock || 0;
    const diffTarget = targetStock - totalValorStock;
    const isUnderTarget = diffTarget >= 0;
    const diffPercent = targetStock > 0 ? Math.abs((diffTarget / targetStock) * 100) : 0;
    const totalRefsDefectuosas = defective.length;
    const avgAge = totalRefsDefectuosas > 0 ? Math.round(defective.reduce((s, r) => s + (r._antiguedadDias || 0), 0) / totalRefsDefectuosas) : 0;

    // Get suppliers with defective stock, sorted by defective value (Required for dropdown)
    const defectiveBySupplier = {};
    defective.forEach(r => {
      const prov = r['Proveedor'] || r._proveedor || 'Desconocido';
      if (!defectiveBySupplier[prov]) defectiveBySupplier[prov] = { count: 0, valor: 0 };
      defectiveBySupplier[prov].count++;
      defectiveBySupplier[prov].valor += (r._valorStock || 0);
    });
    const suppliersWithDefective = Object.entries(defectiveBySupplier)
      .sort((a, b) => b[1].valor - a[1].valor)
      .map(([name, info]) => ({ name, count: info.count, valor: info.valor }));

    const progressPct = targetStock > 0 ? Math.min((totalValorStock / targetStock) * 100, 100) : 0;
    
    const targetStatusText = isUnderTarget 
      ? `Faltan <strong style="color:var(--success);">${Components.formatCurrency(diffTarget)}</strong> para alcanzar el límite`
      : `Exceso de <strong style="color:var(--danger);">${Components.formatCurrency(Math.abs(diffTarget))}</strong> sobre el límite`;

    const targetIndicator = `
      <div style="margin-top: 12px;">
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:4px; font-weight:700;">
          <span>Progreso Objetivo</span>
          <span>${Math.round((totalValorStock / targetStock) * 100)}%</span>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
          <div style="width:${progressPct}%; height:100%; background:${isUnderTarget ? 'var(--grad-primary)' : 'var(--danger)'}; box-shadow: 0 0 10px ${isUnderTarget ? 'var(--primary-400)' : 'var(--danger)'};"></div>
        </div>
        <div style="font-size:var(--font-xs); margin-top:8px; line-height:1.2; color:var(--text-secondary);">
          ${targetStatusText}
        </div>
      </div>
    `;

    // HEURISTIC AI: Simple Logic for "Where to focus"
    const aiTips = [];
    if (!isUnderTarget) {
      const topSupplier = metrics[0];
      if (topSupplier) {
        aiTips.push({
          icon: 'target',
          title: `Prioridad: ${topSupplier.nombre}`,
          text: `Resolver el stock de este proveedor reduciría el exceso en un ${Math.round((topSupplier.totalValorStock / Math.abs(diffTarget)) * 100)}% del objetivo.`
        });
      }
      const agingItems = defective.filter(d => d._antiguedadDias > 365).length;
      if (agingItems > 0) {
        aiTips.push({
          icon: 'history',
          title: 'Stock Obsoleto (>1 año)',
          text: `Tienes ${agingItems} artículos con más de un año. Liquidar estos ítems es la vía más rápida para sanear el balance.`
        });
      }
    } else {
      aiTips.push({
        icon: 'verified',
        title: 'Mantenimiento preventivo',
        text: '¡Buen trabajo! Estás dentro del objetivo. Enfócate en las nuevas incidencias para mantener este nivel.'
      });
    }

    container.innerHTML = `
      <div class="section-header" style="margin-bottom: var(--space-xl); align-items: flex-end;">
        <div style="display:flex; gap:var(--space-lg); align-items: flex-end;">
          <!-- Target Input Card (New) -->
          <div class="chart-card" style="padding: 12px 20px; min-width: 240px; margin-bottom: 0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom: 4px;">
              <span class="material-symbols-rounded" style="font-size:18px; color:var(--primary-400);">flag</span>
              <span class="kpi-label" style="letter-spacing:0.5px;">Objetivo de Stock</span>
            </div>
            <div style="display:flex; align-items:center;">
              <span style="font-size:var(--font-xl); font-weight:800; color:var(--text-tertiary); margin-right:4px;">€</span>
              <input type="number" id="inputTargetStock" value="${targetStock}" class="form-input" 
                style="border:none; padding:0; background:transparent; font-size:var(--font-xl); font-weight:800; color:var(--text-primary); max-width:140px; outline:none;"
                onchange="Store.setObjetivo(this.value)">
              <span class="material-symbols-rounded" style="font-size:18px; color:var(--text-tertiary); cursor:pointer;">edit</span>
            </div>
          </div>

          <div>
            <h2 style="font-size: var(--font-3xl); font-weight: 800; letter-spacing: -1.5px; line-height: 1;">Centro de Operaciones</h2>
            <p style="color:var(--text-tertiary); font-size:var(--font-sm); margin-top: 8px; font-weight: 500;">
              Estado del Stock Crítico y Gestión de Proveedores · ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        
        ${hasData ? `
        <div style="display:flex; gap: var(--space-sm);">
          <button class="btn btn-outline btn-sm" onclick="DashboardScreen.exportData()" style="padding: 10px 20px;">
            <span class="material-symbols-rounded">download</span> Exportar Reporte
          </button>
        </div>` : ''}
      </div>

      ${!hasData ? renderEmptyState() : `
        <!-- KPI Cards -->
        <div class="dashboard-grid">
          <div class="kpi-card" style="border-bottom: 3px solid ${isUnderTarget ? 'var(--success)' : 'var(--danger)'};">
            <div class="kpi-header">
              <span class="kpi-label">Exposición Total</span>
              <div class="kpi-icon" style="background:${isUnderTarget ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color:${isUnderTarget ? 'var(--success)' : 'var(--danger)'};">
                <span class="material-symbols-rounded">${isUnderTarget ? 'verified' : 'priority_high'}</span>
              </div>
            </div>
            <div class="kpi-value">${Components.formatCurrency(totalValorStock)}</div>
            ${targetIndicator}
          </div>

          <!-- AI INSIGHTS CARD (New) -->
          <div class="kpi-card" style="grid-column: span 2; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
            <div class="kpi-header" style="margin-bottom: var(--space-sm);">
              <span class="kpi-label" style="color:var(--primary-400);">
                <span class="material-symbols-rounded" style="font-size:16px; margin-right:4px; vertical-align:middle;">auto_awesome</span>
                Análisis Inteligente (AI Insights)
              </span>
            </div>
            <div style="display:flex; gap:var(--space-md);">
              ${aiTips.map(tip => `
                <div style="flex:1; background:rgba(255,255,255,0.03); border-radius:var(--radius-md); padding:12px; border:1px solid rgba(255,255,255,0.05);">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="material-symbols-rounded" style="font-size:20px; color:var(--primary-300);">${tip.icon}</span>
                    <strong style="font-size:var(--font-sm);">${tip.title}</strong>
                  </div>
                  <p style="font-size:var(--font-xs); color:var(--text-tertiary); line-height:1.4;">${tip.text}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Eficiencia Operativa</span>
              <div class="kpi-icon icon-success">
                <span class="material-symbols-rounded">shutter_speed</span>
              </div>
            </div>
            <div class="kpi-value">${Components.formatNumber(avgAge)} <span style="font-size:var(--font-sm); opacity:0.6; font-weight:400;">días</span></div>
            <div class="kpi-sub">
              <span class="material-symbols-rounded" style="font-size:16px; color:var(--success);">trending_down</span>
              Antigüedad media de stock
            </div>
          </div>
        </div>

        <div class="charts-grid">
          <!-- Main Area Chart -->
          <div class="chart-card">
            <h4 class="card-title">
              <span class="material-symbols-rounded" style="color:var(--primary-400);">analytics</span>
              Análisis Valoración por Proveedor
            </h4>
            <div style="height: 350px;">
              <canvas id="supplierChart"></canvas>
            </div>
          </div>

          <!-- Secondary List/Chart -->
          <div class="chart-card">
            <h4 class="card-title">
              <span class="material-symbols-rounded" style="color:var(--info);">pie_chart</span>
              Distribución por Familia
            </h4>
            <div style="height: 350px;">
              <canvas id="familyChart"></canvas>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-lg);">
          <!-- Detailed Drilling -->
          <div class="chart-card">
            <h4 class="card-title">
              <span class="material-symbols-rounded">manage_search</span>
              Inspección Detallada de Activos
            </h4>
            <div style="display:flex; align-items:center; gap: var(--space-md); margin-bottom: var(--space-lg); background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <span class="material-symbols-rounded" style="color: var(--text-tertiary);">search</span>
              <select id="supplierFilterSelect" style="flex:1; border:none; background:transparent; color:var(--text-primary); font-size:var(--font-sm); cursor:pointer; outline:none;">
                <option value="">Buscar proveedor para desglose...</option>
                ${suppliersWithDefective.map(s =>
                  `<option value="${s.name}">${s.name} (${s.count} arts · ${Components.formatCurrency(s.valor)})</option>`
                ).join('')}
              </select>
            </div>
            <div id="supplierDetailChartWrap" style="display:none;">
              <div style="height:350px;position:relative;">
                <canvas id="supplierDetailChart"></canvas>
              </div>
            </div>
            <div id="supplierDetailEmpty" style="text-align:center;padding: var(--space-3xl) 0; color:var(--text-tertiary); font-size:var(--font-sm); border: 2px dashed var(--border-color); border-radius: var(--radius-lg);">
              <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.3;">selection</span>
              Selecciona un proveedor para visualizar su inventario defectuoso
            </div>
          </div>

          <!-- Vertical Alerts List -->
          <div class="alerts-section">
            <div style="padding: var(--space-lg); border-bottom: 1px solid var(--border-color);">
              <h4 class="card-title" style="margin: 0;">Prioridades de Acción</h4>
            </div>
            <div style="max-height: 520px; overflow-y: auto;">
              ${metrics.slice(0, 10).map(m => `
                <div class="alert-item">
                  <div class="alert-status" style="color: ${m.totalValorStock > 5000 ? 'var(--danger)' : m.totalValorStock > 1000 ? 'var(--warning)' : 'var(--success)'};"></div>
                  <div class="alert-content">
                    <div class="alert-title">${m.nombre}</div>
                    <div class="alert-desc">${m.numDefectuosos} incidencias · ${m.antiguedadMedia}d media</div>
                  </div>
                  <div class="alert-value" style="color: ${m.totalValorStock > 5000 ? 'var(--danger)' : 'var(--text-primary)'};">
                    ${Components.formatCurrency(m.totalValorStock)}
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="padding: var(--space-md); text-align: center;">
              <button class="btn btn-ghost btn-sm" onclick="App.navigate('proveedores')">Ver todos los proveedores →</button>
            </div>
          </div>
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
    const top10 = metrics.slice(0, 10);
    const ctx1 = document.getElementById('supplierChart');
    
    if (ctx1) {
      if (supplierChart) supplierChart.destroy();
      
      const gradient = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(19, 127, 236, 0.4)');
      gradient.addColorStop(1, 'rgba(19, 127, 236, 0.05)');

      supplierChart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: top10.map(m => m.nombre.length > 20 ? m.nombre.substring(0, 20) + '…' : m.nombre),
          datasets: [{
            label: 'Valor Stock (€)',
            data: top10.map(m => m.totalValorStock),
            backgroundColor: gradient,
            borderColor: '#137fec',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#137fec',
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              showSupplierDrillDown(top10[idx].nombre, allData);
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1e293b',
              titleFont: { size: 14, weight: 'bold' },
              padding: 12,
              cornerRadius: 12,
              displayColors: false,
              callbacks: {
                label: (ctx) => `Valoración: ${Components.formatCurrency(ctx.parsed.y)}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
              ticks: { color: '#64748b', font: { size: 11 }, callback: v => Components.formatCurrency(v) }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 11 } }
            }
          }
        }
      });
    }

    const familyMap = {};
    allData.forEach(r => {
      const fam = r['DFamil_N1'] || r['DFamil_N2'] || 'Sin Clasificar';
      familyMap[fam] = (familyMap[fam] || 0) + (r._valorStock || 0);
    });
    const families = Object.entries(familyMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const colors = ['#137fec', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

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
            hoverOffset: 20,
            borderWidth: 4,
            borderColor: '#111827'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', padding: 20, font: { size: 12, weight: '500' }, usePointStyle: true }
            },
            tooltip: {
              backgroundColor: '#1e293b',
              padding: 12,
              cornerRadius: 12,
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
