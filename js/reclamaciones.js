/* ============================================
   RECLAMACIONES SCREEN
   ============================================ */
const ReclamacionesScreen = (() => {

  function render(container) {
    const claims = Store.state.reclamaciones;

    // Stats
    const pendientes = claims.filter(c => c.estado === 'Pendiente').length;
    const enGestion = claims.filter(c => c.estado === 'En gestión').length;
    const valorTotal = claims.reduce((s, c) => s + (c.valorTotal || 0), 0);

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Centro de Reclamaciones</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            ${claims.length > 0 ? `${claims.length} reclamaciones registradas` : 'Sin reclamaciones'}
          </p>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <button class="btn btn-primary" onclick="ReclamacionesScreen.openNewClaim()">
            <span class="material-symbols-rounded">add</span> Nueva Reclamación
          </button>
          ${claims.length > 0 ? `
            <button class="btn btn-outline btn-sm" onclick="ReclamacionesScreen.exportClaims()">
              <span class="material-symbols-rounded">download</span> Exportar
            </button>
          ` : ''}
        </div>
      </div>

      ${claims.length > 0 ? `
        <!-- Stats -->
        <div class="dashboard-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--space-lg);">
          <div class="kpi-card kpi-warning" style="padding:var(--space-md);">
            <div class="kpi-label">Pendientes</div>
            <div class="kpi-value" style="font-size:var(--font-xl);">${pendientes}</div>
          </div>
          <div class="kpi-card kpi-info" style="padding:var(--space-md);">
            <div class="kpi-label">En Gestión</div>
            <div class="kpi-value" style="font-size:var(--font-xl);">${enGestion}</div>
          </div>
          <div class="kpi-card kpi-danger" style="padding:var(--space-md);">
            <div class="kpi-label">Valor Total</div>
            <div class="kpi-value" style="font-size:var(--font-xl);">${Components.formatCurrency(valorTotal)}</div>
          </div>
        </div>

        <!-- Claims list -->
        <div id="claimsList">
          ${claims.map(c => renderClaimCard(c)).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <span class="material-symbols-rounded">description</span>
          <h3>Sin reclamaciones</h3>
          <p>Crea una nueva reclamación desde aquí o desde la pantalla de Stock Defectuoso o Proveedores.</p>
          <button class="btn btn-primary" onclick="ReclamacionesScreen.openNewClaim()">
            <span class="material-symbols-rounded">add</span> Nueva Reclamación
          </button>
        </div>
      `}
    `;
  }

  function renderClaimCard(c) {
    return `
      <div class="claim-card" id="claim-${c.id}">
        <div class="claim-card-header">
          <div>
            <span class="claim-id">#${c.id}</span>
            <span style="color:var(--text-tertiary);font-size:var(--font-xs);margin-left:var(--space-sm);">${Components.formatDate(c.fecha)}</span>
          </div>
          ${Components.statusBadge(c.estado)}
        </div>
        <div class="claim-meta">
          <div class="claim-meta-item">
            <span class="claim-meta-label">Proveedor</span>
            <span class="claim-meta-value">${c.proveedor}</span>
          </div>
          <div class="claim-meta-item">
            <span class="claim-meta-label">Nº Artículos</span>
            <span class="claim-meta-value">${c.articulos ? c.articulos.length : 0}</span>
          </div>
          <div class="claim-meta-item">
            <span class="claim-meta-label">Valor Total</span>
            <span class="claim-meta-value cell-danger">${Components.formatCurrency(c.valorTotal)}</span>
          </div>
          ${c.emailEnviado ? `
            <div class="claim-meta-item">
              <span class="claim-meta-label">Email</span>
              <span class="claim-meta-value" style="color:var(--success);">Enviado</span>
            </div>
          ` : ''}
        </div>
        ${c.articulos && c.articulos.length > 0 ? `
          <div class="claim-articles">
            <strong style="font-size:var(--font-xs);color:var(--text-tertiary);">ARTÍCULOS:</strong>
            <div style="margin-top:var(--space-xs);display:flex;flex-wrap:wrap;gap:4px;">
              ${c.articulos.map(a => {
      const name = typeof a === 'string' ? a : a.name;
      const code = typeof a === 'object' ? a.code : '';
      return `<div style="padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:var(--font-xs);">
                <div style="font-weight:600;">${name}</div>
                ${code ? `<div style="color:var(--text-tertiary);font-size:10px;">${code}</div>` : ''}
              </div>`;
    }).join('')}
            </div>
          </div>
        ` : ''}
        <div style="display:flex;gap:var(--space-xs);margin-top:var(--space-md);justify-content:flex-end;">
          ${c.estado === 'Pendiente' ? `
            <button class="btn btn-sm btn-outline" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'En gestión')">
              <span class="material-symbols-rounded">play_arrow</span> Iniciar Gestión
            </button>
          ` : ''}
          ${c.estado === 'En gestión' ? `
            <button class="btn btn-sm btn-success" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'Resuelta')">
              <span class="material-symbols-rounded">check</span> Resolver
            </button>
          ` : ''}
          <button class="btn btn-sm btn-outline" onclick="ReclamacionesScreen.generateEmail('${c.id}')">
            <span class="material-symbols-rounded">mail</span> Generar Email
          </button>
          <button class="btn btn-sm btn-ghost" onclick="ReclamacionesScreen.deleteClaim('${c.id}')" style="color:var(--danger);">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `;
  }

  function openNewClaim(proveedor, articulo) {
    const proveedores = [...new Set([
      ...Store.state.proveedoresRaw.map(p => p['Nombre'] || p['Nombre Comercial']),
      ...Store.state.defectiveData.map(d => d['Proveedor'])
    ].filter(Boolean))].sort();

    // Get articles for selected supplier (returns objects with metadata)
    const getArticles = (prov) => {
      const normProv = Engine.normalizeForJoin(prov);
      return Store.state.defectiveData
        .filter(d => Engine.normalizeForJoin(d._proveedor || d['Proveedor']) === normProv)
        .map(d => ({
          name: d['Artículo'] || d['Articulo'] || '',
          code: d['Cod.Artículo'] || d['Cod.Articulo'] || d['Código'] || d['Codigo'] || '',
          incidencias: d._incidencias || []
        }))
        .filter(a => a.name || a.code);
    };

    const normTargetProv = Engine.normalizeForJoin(proveedor);

    const body = `
      <div class="form-group">
        <label class="form-label">Proveedor <span class="required">*</span></label>
        <select class="form-select" id="claimProveedor">
          <option value="">Seleccionar proveedor...</option>
          ${proveedores.map(p => {
        const isSelected = p === proveedor || Engine.normalizeForJoin(p) === normTargetProv;
        return `<option value="${p}" ${isSelected ? 'selected' : ''}>${p}</option>`;
      }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Artículos afectados</label>
        <div id="claimArticlesContainer" style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--space-sm);">
          ${normTargetProv ? getArticles(normTargetProv).map(a => {
        const isSelected = a.name === articulo || a.code === articulo;
        const incLabel = a.incidencias.length > 0 ? ` <span style="color:var(--warning);font-weight:600;">[Incid: ${a.incidencias.map(i => i.numero).join(',')}]</span>` : '';
        return `<label style="display:flex;align-items:flex-start;gap:var(--space-xs);padding:6px 0;font-size:var(--font-sm);cursor:pointer;border-bottom:1px solid var(--bg-secondary);">
                  <input type="checkbox" class="claim-article-cb" value="${a.code}" data-name="${a.name}" ${isSelected ? 'checked' : ''} style="margin-top:2px;">
                  <div>
                    <div style="font-weight:500;">${a.name}</div>
                    <div style="font-size:var(--font-xs);color:var(--text-tertiary);">Cód: ${a.code}${incLabel}</div>
                  </div>
                </label>`;
      }).join('') : '<p style="color:var(--text-tertiary);font-size:var(--font-sm);text-align:center;">Selecciona un proveedor</p>'}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas adicionales</label>
        <textarea class="form-textarea" id="claimNotas" placeholder="Detalles de la reclamación..."></textarea>
      </div>
      <div style="margin-top:var(--space-md);padding:var(--space-sm) var(--space-md);background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-color);">
        <div style="display:flex;align-items:center;gap:var(--space-xs);margin-bottom:var(--space-xs);">
          <span class="material-symbols-rounded" style="font-size:16px;color:var(--primary);">mail</span>
          <strong style="font-size:var(--font-xs);color:var(--text-secondary);">Variables disponibles para el email</strong>
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px var(--space-md);font-size:var(--font-xs);">
          <code style="color:var(--primary);background:var(--bg-secondary);padding:1px 6px;border-radius:3px;">{proveedor}</code>
          <span style="color:var(--text-tertiary);">Nombre del proveedor seleccionado</span>
          <code style="color:var(--primary);background:var(--bg-secondary);padding:1px 6px;border-radius:3px;">{articulos}</code>
          <span style="color:var(--text-tertiary);">Lista de artículos afectados</span>
          <code style="color:var(--primary);background:var(--bg-secondary);padding:1px 6px;border-radius:3px;">{valor}</code>
          <span style="color:var(--text-tertiary);">Valor total de la reclamación (€)</span>
          <code style="color:var(--primary);background:var(--bg-secondary);padding:1px 6px;border-radius:3px;">{emailRemitente}</code>
          <span style="color:var(--text-tertiary);">Email del remitente (configuración)</span>
        </div>
      </div>
    `;

    Components.openModal('Nueva Reclamación', body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cancelar</button>
       <button class="btn btn-primary" id="btnSaveClaim">
         <span class="material-symbols-rounded">save</span> Crear Reclamación
       </button>`
    );

    // Update articles when proveedor changes
    setTimeout(() => {
      document.getElementById('claimProveedor')?.addEventListener('change', (e) => {
        const cont = document.getElementById('claimArticlesContainer');
        const arts = getArticles(e.target.value);
        cont.innerHTML = arts.length > 0 ? arts.map(a => {
          const incLabel = a.incidencias.length > 0 ? ` <span style="color:var(--warning);font-weight:600;">[Incid: ${a.incidencias.map(i => i.numero).join(',')}]</span>` : '';
          return `<label style="display:flex;align-items:flex-start;gap:var(--space-xs);padding:6px 0;font-size:var(--font-sm);cursor:pointer;border-bottom:1px solid var(--bg-secondary);">
                    <input type="checkbox" class="claim-article-cb" value="${a.code}" data-name="${a.name}" style="margin-top:2px;">
                    <div>
                      <div style="font-weight:500;">${a.name}</div>
                      <div style="font-size:var(--font-xs);color:var(--text-tertiary);">Cód: ${a.code}${incLabel}</div>
                    </div>
                  </label>`;
        }).join('') : '<p style="color:var(--text-tertiary);font-size:var(--font-sm);text-align:center;">Sin artículos defectuosos para este proveedor</p>';
      });

      document.getElementById('btnSaveClaim')?.addEventListener('click', () => {
        const prov = document.getElementById('claimProveedor')?.value;
        if (!prov) {
          Components.showToast('Selecciona un proveedor', 'error');
          return;
        }
        const arts = [...document.querySelectorAll('.claim-article-cb:checked')].map(cb => ({
          code: cb.value,
          name: cb.dataset.name
        }));
        const notas = document.getElementById('claimNotas')?.value || '';

        // Calculate total value
        let valorTotal = 0;
        const selectedCodes = arts.map(a => a.code);
        const normProv = Engine.normalizeForJoin(prov);
        Store.state.defectiveData.forEach(d => {
          const code = d['Cod.Artículo'] || d['Cod.Articulo'] || d['Código'] || d['Codigo'] || '';
          if (Engine.normalizeForJoin(d._proveedor || d['Proveedor']) === normProv && selectedCodes.includes(code)) {
            valorTotal += d._valorStock || 0;
          }
        });

        const rec = Store.addReclamacion({
          proveedor: prov,
          articulos: arts,
          valorTotal,
          notas,
          emailEnviado: false
        });

        Components.closeModal();
        Components.showToast(`Reclamación ${rec.id} creada`, 'success');
        App.navigateTo('reclamaciones');
      });
    }, 100);
  }

  function changeStatus(id, newStatus) {
    Store.updateReclamacion(id, { estado: newStatus });
    Components.showToast(`Reclamación ${id} → ${newStatus}`, 'success');
    App.navigateTo('reclamaciones');
  }

  function deleteClaim(id) {
    if (confirm('¿Seguro que deseas eliminar esta reclamación?')) {
      Store.deleteReclamacion(id);
      Components.showToast('Reclamación eliminada', 'warning');
      App.navigateTo('reclamaciones');
    }
  }

  function generateEmail(id) {
    const claim = Store.state.reclamaciones.find(c => c.id === id);
    if (!claim) return;

    // Available stock columns for email (label → CSV column name)
    const availableColumns = [
      { key: 'DescAlmacenStock', label: 'Almacén', checked: true },
      { key: 'DMarca', label: 'Marca', checked: true },
      { key: 'LVenta', label: 'Línea de Venta', checked: true },
      { key: 'Codigo_Anterior', label: 'Código Anterior', checked: true },
      { key: 'Cod.Artículo', label: 'Cód. Artículo', checked: true },
      { key: 'Artículo', label: 'Artículo (nombre)', checked: true },
      { key: 'RefProv', label: 'Ref. Proveedor', checked: false },
      { key: 'Stock', label: 'Unidades en Stock', checked: true },
      { key: 'PrecioAdq_Artic', label: 'Precio Adquisición', checked: false },
      { key: 'PrecioInvent', label: 'Precio Inventario', checked: false },
      { key: 'PVP_artic', label: 'PVP', checked: false },
      { key: 'Val Stock x PrecioInvent', label: 'Valor Stock (€)', checked: true },
      { key: 'UltFechaAlbCompra', label: 'Últ. Compra', checked: false },
      { key: 'UltFechaAlbVenta', label: 'Últ. Venta', checked: false },
      { key: 'Clasificación', label: 'Clasificación', checked: false },
      { key: 'Obsoleto', label: 'Obsoleto', checked: false },
    ];

    // Centro 63 sender emails
    const senderEmails = [
      'maria@centrohogarsanchez.es',
      'esteban@centrohogarsanchez.es',
      'rico@centrohogarsanchez.es'
    ];

    // Step 1: Column selection + sender email dialog
    const body = `
      <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-bottom:var(--space-md);">
        Configura el email para <strong>${claim.proveedor}</strong>
        (${claim.articulos ? claim.articulos.length : 0} artículos).
      </p>

      <div class="form-group" style="margin-bottom:var(--space-md);">
        <label class="form-label" style="font-weight:600;">Remitente / Responder a <span class="required">*</span></label>
        <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--space-sm);">
          ${senderEmails.map(em => `
            <label style="display:flex;align-items:center;gap:var(--space-xs);padding:5px var(--space-xs);font-size:var(--font-sm);cursor:pointer;">
              <input type="checkbox" class="sender-email-cb" value="${em}" checked>
              <span style="color:var(--text-primary);">${em}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" style="font-weight:600;">Campos a incluir en el email</label>
        <div style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-xs);">
          <button class="btn btn-sm btn-ghost" id="btnSelectAll" style="font-size:var(--font-xs);">✓ Todos</button>
          <button class="btn btn-sm btn-ghost" id="btnSelectNone" style="font-size:var(--font-xs);">✗ Ninguno</button>
        </div>
        <div style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--space-sm);">
          ${availableColumns.map(col => `
            <label style="display:flex;align-items:center;gap:var(--space-xs);padding:5px var(--space-xs);font-size:var(--font-sm);cursor:pointer;border-radius:var(--radius-sm);transition:background 0.15s;"
                   onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" class="email-col-cb" value="${col.key}" ${col.checked ? 'checked' : ''}>
              <code style="color:var(--primary);background:var(--bg-secondary);padding:1px 6px;border-radius:3px;font-size:var(--font-xs);min-width:140px;display:inline-block;">${col.key}</code>
              <span style="color:var(--text-tertiary);font-weight:600;">${col.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    Components.openModal('Generar Email — Configuración', body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cancelar</button>
       <button class="btn btn-primary" id="btnGenerateWithCols">
         <span class="material-symbols-rounded">mail</span> Redactar Email
       </button>`, 'lg'
    );

    setTimeout(() => {
      // Select All / None
      document.getElementById('btnSelectAll')?.addEventListener('click', () => {
        document.querySelectorAll('.email-col-cb').forEach(cb => cb.checked = true);
      });
      document.getElementById('btnSelectNone')?.addEventListener('click', () => {
        document.querySelectorAll('.email-col-cb').forEach(cb => cb.checked = false);
      });

      // Generate email with selected columns
      document.getElementById('btnGenerateWithCols')?.addEventListener('click', () => {
        const selectedKeys = [...document.querySelectorAll('.email-col-cb:checked')].map(cb => cb.value);
        const selectedSenders = [...document.querySelectorAll('.sender-email-cb:checked')].map(cb => cb.value);
        if (selectedKeys.length === 0) {
          Components.showToast('Selecciona al menos un campo', 'error');
          return;
        }
        if (selectedSenders.length === 0) {
          Components.showToast('Selecciona al menos un email remitente', 'error');
          return;
        }
        Components.closeModal();
        setTimeout(() => composeEmail(claim, selectedKeys, availableColumns, selectedSenders), 200);
      });
    }, 100);
  }

  /** Step 2: Compose the email with selected columns */
  function composeEmail(claim, selectedKeys, availableColumns, selectedSenders) {
    const config = Store.state.config;
    const senderEmailsStr = selectedSenders.join(' / ');

    // Build article detail lines from stock data
    const articleLines = [];
    (claim.articulos || []).forEach(art => {
      const artName = typeof art === 'string' ? art : art.name;
      const artCode = typeof art === 'object' ? art.code : art;

      const row = Store.state.joinedData.find(d => {
        const dCode = d['Cod.Artículo'] || d['Cod.Articulo'] || d['Código'] || d['Codigo'] || '';
        return (dCode === artCode || (d['Artículo'] || d['Articulo']) === artName) &&
               (d._proveedor || d['Proveedor']) === claim.proveedor;
      });

      if (row) {
        const fields = selectedKeys.map(key => {
          const colDef = availableColumns.find(c => c.key === key);
          const label = colDef ? colDef.label : key;
          const val = Engine.findCol(row, key) || row[key] || '';
          return `    ${label}: ${val}`;
        });
        // Add incidencias (faults) with their incident numbers
        const incidencias = row._incidencias || Store.getIncidencias(artCode || artName);
        if (incidencias && incidencias.length > 0) {
          incidencias.forEach(inc => {
            const numLabel = inc.numero ? `Nº ${inc.numero}` : 'S/N';
            fields.push(`    Incidencia ${numLabel}: ${inc.solucion || 'Sin detalle'}`);
          });
        }
        articleLines.push(`  - ${artName}\n${fields.join('\n')}`);
      } else {
        articleLines.push(`  - ${artName} (Cód: ${artCode})`);
      }
    });

    // Build email body using template
    const articulosDetalle = articleLines.join('\n\n');
    const template = config.plantillaEmail
      .replace('{proveedor}', claim.proveedor)
      .replace('{articulos}', articulosDetalle)
      .replace('{valor}', Components.formatCurrency(claim.valorTotal))
      .replace('{emailRemitente}', senderEmailsStr);

    // Find supplier email
    const sup = Store.state.proveedoresRaw.find(p =>
      Engine.normalizeForJoin(p['Nombre'] || p['Nombre Comercial'] || '') === Engine.normalizeForJoin(claim.proveedor)
    );
    const emailTo = sup ? sup['Email'] : '';

    const body = `
      <div class="form-group">
        <label class="form-label">Para (proveedor)</label>
        <input class="form-input" id="emailTo" value="${emailTo}" placeholder="email@proveedor.com">
      </div>
      <div class="form-group">
        <label class="form-label">CC / Responder a (Centro 63)</label>
        <input class="form-input" id="emailCC" value="${selectedSenders.join('; ')}" readonly
               style="background:var(--bg-tertiary);color:var(--text-secondary);">
      </div>
      <div class="form-group">
        <label class="form-label">Asunto</label>
        <input class="form-input" id="emailSubject" value="Reclamación ${claim.id} — Artículos defectuosos — ${claim.proveedor}">
      </div>
      <div class="form-group">
        <label class="form-label">Mensaje</label>
        <textarea class="email-template" id="emailBody" rows="18">${template}</textarea>
      </div>
      <div style="padding:var(--space-xs) var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:var(--font-xs);color:var(--text-tertiary);">
        Campos: ${selectedKeys.join(', ')} · Remitentes: ${selectedSenders.join(', ')}
      </div>
    `;

    Components.openModal('Email de Reclamación — ' + claim.id, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cancelar</button>
       <button class="btn btn-outline btn-sm" id="btnCopyEmail" title="Copiar al portapapeles">
         <span class="material-symbols-rounded">content_copy</span> Copiar
       </button>
       <button class="btn btn-primary" id="btnOpenMailto">
         <span class="material-symbols-rounded">mail</span> Enviar Email
       </button>`, 'lg'
    );

    setTimeout(() => {
      document.getElementById('btnCopyEmail')?.addEventListener('click', () => {
        const text = document.getElementById('emailBody')?.value || '';
        navigator.clipboard.writeText(text).then(() => {
          Components.showToast('Email copiado al portapapeles', 'success');
        });
      });

      document.getElementById('btnOpenMailto')?.addEventListener('click', () => {
        const to = document.getElementById('emailTo')?.value || '';
        const cc = document.getElementById('emailCC')?.value || '';
        const subject = document.getElementById('emailSubject')?.value || '';
        const bodyText = document.getElementById('emailBody')?.value || '';
        const ccParam = cc ? `&cc=${encodeURIComponent(cc.replace(/;\s*/g, ','))}` : '';
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}${ccParam}`;
        Store.updateReclamacion(claim.id, { emailEnviado: true });
        Components.showToast('Abriendo cliente de correo...', 'success');
      });
    }, 100);
  }

  function exportClaims() {
    Components.exportToExcel(
      Store.state.reclamaciones.map(c => ({
        'ID': c.id,
        'Fecha': Components.formatDate(c.fecha),
        'Proveedor': c.proveedor,
        'Nº Artículos': c.articulos ? c.articulos.length : 0,
        'Valor Total': c.valorTotal,
        'Estado': c.estado,
        'Notas': c.notas
      })),
      'reclamaciones.xlsx'
    );
  }

  return { render, openNewClaim, changeStatus, deleteClaim, generateEmail, exportClaims };
})();
