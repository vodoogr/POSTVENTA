/* ============================================
   RECLAMACIONES SCREEN
   ============================================ */
const ReclamacionesScreen = (() => {

  function render(container) {
    const s = Store.state;
    const claims = s.reclamaciones;

    const pendientes = claims.filter(c => c.estado === 'Pendiente');
    const enGestion = claims.filter(c => c.estado === 'En gestión');
    const resueltas = claims.filter(c => c.estado === 'Resuelta');

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Centro de Operaciones: Reclamaciones</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            ${claims.length > 0 ? `${claims.length} reclamaciones activas en el tablero` : 'Sin reclamaciones'}
          </p>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <button class="btn btn-primary" onclick="ReclamacionesScreen.openNewClaim()">
            <span class="material-symbols-rounded">add</span> Nueva Reclamación
          </button>
          ${claims.length > 0 ? `<button class="btn btn-outline btn-sm" onclick="ReclamacionesScreen.exportClaims()"><span class="material-symbols-rounded">download</span> Exportar</button>` : ''}
        </div>
      </div>

      <div class="kanban-board">
        ${renderColumn('PENDIENTE', pendientes, 'var(--warning)')}
        ${renderColumn('EN GESTIÓN', enGestion, 'var(--primary-400)')}
        ${renderColumn('RESUELTA', resueltas, 'var(--success)')}
      </div>
    `;
  }

  function renderColumn(title, list, color) {
    return `
      <div class="kanban-column">
        <div class="kanban-header">
          <h3 style="color:${color};">${title}</h3>
          <span class="count-badge">${list.length}</span>
        </div>
        <div class="kanban-cards">
          ${list.length > 0 ? list.map(c => renderClaimCard(c)).join('') : `
            <div style="text-align:center; padding:var(--space-xl) 0; opacity:0.3; font-size:var(--font-xs);">
              <span class="material-symbols-rounded" style="font-size:32px; display:block; margin-bottom:8px;">inbox</span>
              Sin reclamaciones
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderClaimCard(c) {
    const isDelayed = c.estado === 'En gestión' && (() => {
      const start = new Date(c.gestion_started_at || c.fecha);
      const diffDays = (new Date() - start) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    })();

    return `
      <div class="claim-card status-${c.estado.toLowerCase().replace(' ', '-')}" id="claim-${c.id}">
        <div class="claim-card-header">
          <span class="claim-id">#${c.id}</span>
          <span style="font-size:10px; color:var(--text-tertiary);">${Components.formatDate(c.fecha)}</span>
        </div>
        
        <div class="claim-prov">${c.proveedor}</div>
        
        <div style="font-size:var(--font-xs); color:var(--text-secondary); margin-bottom:8px;">
          ${c.articulos ? c.articulos.length : 0} artículos · <strong>${Components.formatCurrency(c.valorTotal)}</strong>
        </div>

        ${isDelayed ? `
          <div class="delay-alert">
            <span class="material-symbols-rounded" style="font-size:14px;">history</span>
            DEMORADA (+7 DÍAS)
          </div>
        ` : ''}

        <div class="claim-actions-mini">
          ${c.estado === 'Pendiente' ? `
            <button class="btn btn-primary btn-sm" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'En gestión')" title="Pasar a Gestión">
              <span class="material-symbols-rounded">play_arrow</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="ReclamacionesScreen.generateEmail('${c.id}')" title="Generar Email">
              <span class="material-symbols-rounded">mail</span>
            </button>
          ` : ''}
          
          ${c.estado === 'En gestión' ? `
            <button class="btn btn-success btn-sm" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'Resuelta')" title="Marcar como Resuelta">
              <span class="material-symbols-rounded">check</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'Pendiente')" title="Mover a Pendiente">
              <span class="material-symbols-rounded">undo</span>
            </button>
          ` : ''}

          ${c.estado === 'Resuelta' ? `
            <button class="btn btn-outline btn-sm" onclick="ReclamacionesScreen.changeStatus('${c.id}', 'En gestión')" title="Reabrir">
              <span class="material-symbols-rounded">history</span>
            </button>
          ` : ''}

          <button class="btn btn-ghost btn-sm" onclick="ReclamacionesScreen.deleteClaim('${c.id}')" style="margin-left:auto;">
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
        <div style="display:flex;gap:var(--space-xs);">
          <input class="form-input" id="emailSubject" value="Reclamación ${claim.id} — Artículos defectuosos — ${claim.proveedor}" style="flex:1;">
          <button class="btn btn-outline" onclick="navigator.clipboard.writeText(document.getElementById('emailSubject').value); Components.showToast('Asunto copiado', 'success')" title="Copiar Asunto">
            <span class="material-symbols-rounded">content_copy</span>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Mensaje</label>
        <textarea class="email-template" id="emailBody" rows="18">${template}</textarea>
      </div>
      <div style="padding:var(--space-sm) var(--space-md);background:rgba(19, 127, 236, 0.1); border:1px solid rgba(19, 127, 236, 0.2); border-radius:var(--radius-md); font-size:var(--font-xs); color:var(--primary-300); margin-top:var(--space-md); display:flex; align-items:center; gap:var(--space-sm);">
        <span class="material-symbols-rounded" style="font-size:20px;">info</span>
        <span><strong>Tip para Citrix:</strong> Copia el <strong>asunto</strong> y el <strong>cuerpo</strong> por separado y pégalos en tu Outlook remoto.</span>
      </div>
    `;

    Components.openModal('Email de Reclamación — ' + claim.id, body,
      `<button class="btn btn-ghost" onclick="Components.closeModal()">Cerrar</button>
       <button class="btn btn-primary" id="btnCopyEmail" style="background:var(--grad-primary);">
         <span class="material-symbols-rounded">content_copy</span> Copiar Cuerpo del Mensaje
       </button>
       <button class="btn btn-outline" id="btnOpenMailto" title="Intentar abrir en PC Local">
         <span class="material-symbols-rounded">open_in_new</span> Abrir en Cliente Local
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
