/* ============================================
   RECOMENDACIONES SCREEN
   ============================================ */
const RecomendacionesScreen = (() => {
    let doneSet = new Set();

    function render(container) {
        const recs = Store.state.recommendations;

        // Load done status
        try {
            const saved = localStorage.getItem('cs63_recs_done');
            if (saved) doneSet = new Set(JSON.parse(saved));
        } catch (e) { }

        const pending = recs.filter(r => !doneSet.has(r.id));
        const done = recs.filter(r => doneSet.has(r.id));
        const totalImpact = pending.reduce((s, r) => s + (r.valorImpacto || 0), 0);

        container.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Motor de Recomendaciones</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-sm);margin-top:4px;">
            ${recs.length > 0 ? `${pending.length} acciones pendientes — Impacto potencial: ${Components.formatCurrency(totalImpact)}` : 'Sin recomendaciones disponibles'}
          </p>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <button class="btn btn-outline btn-sm" onclick="RecomendacionesScreen.toggleDone()">
            <span class="material-symbols-rounded">visibility</span>
            <span id="toggleDoneText">${done.length > 0 ? 'Mostrar completadas' : 'Ocultar completadas'}</span>
          </button>
        </div>
      </div>

      ${recs.length === 0 ? `
        <div class="empty-state">
          <span class="material-symbols-rounded">lightbulb</span>
          <h3>Sin recomendaciones</h3>
          <p>Carga datos de Stock y Proveedores para generar recomendaciones automáticas de gestión de stock defectuoso.</p>
        </div>
      ` : `
        <!-- Filter chips -->
        <div class="filter-bar">
          <span style="font-size:var(--font-sm);color:var(--text-tertiary);margin-right:var(--space-xs);">Filtrar:</span>
          <button class="filter-chip active" data-filter="all" onclick="RecomendacionesScreen.filterByType('all', this)">Todas</button>
          <button class="filter-chip" data-filter="reclamar" onclick="RecomendacionesScreen.filterByType('reclamar', this)">🔔 Reclamar</button>
          <button class="filter-chip" data-filter="bloquear" onclick="RecomendacionesScreen.filterByType('bloquear', this)">🚫 Bloquear</button>
          <button class="filter-chip" data-filter="devolucion" onclick="RecomendacionesScreen.filterByType('devolucion', this)">↩️ Devolución</button>
          <button class="filter-chip" data-filter="liquidar" onclick="RecomendacionesScreen.filterByType('liquidar', this)">💰 Liquidar</button>
          <button class="filter-chip" data-filter="reubicar" onclick="RecomendacionesScreen.filterByType('reubicar', this)">📦 Reubicar</button>
        </div>

        <!-- Recommendations -->
        <div id="recsContainer">
          ${pending.map(r => renderRecCard(r, false)).join('')}
        </div>

        <div id="recsDoneContainer" style="display:none;">
          ${done.length > 0 ? `
            <h4 style="margin:var(--space-lg) 0 var(--space-md);color:var(--text-tertiary);">Completadas (${done.length})</h4>
            ${done.map(r => renderRecCard(r, true)).join('')}
          ` : ''}
        </div>
      `}
    `;
    }

    function renderRecCard(rec, isDone) {
        const iconMap = {
            reclamar: '📋', bloquear: '🚫', devolucion: '↩️', liquidar: '💰', reubicar: '📦'
        };
        const priorityIcon = rec.priority === 'alta' ? '🔴' : rec.priority === 'media' ? '🟡' : '🟢';

        return `
      <div class="recommendation-card ${isDone ? 'done' : ''}" data-type="${rec.type}" data-id="${rec.id}">
        <div class="rec-priority">${priorityIcon}</div>
        <div class="rec-content">
          <div class="rec-title">${iconMap[rec.type] || '📋'} ${rec.title}</div>
          <div class="rec-description">${rec.description}</div>
          <div class="rec-meta">
            ${rec.proveedor ? `<span>🏭 ${rec.proveedor}</span>` : ''}
            <span>💶 ${Components.formatCurrency(rec.valorImpacto)}</span>
            <span>${Components.priorityBadge(rec.priority)}</span>
          </div>
        </div>
        <div class="rec-actions">
          ${!isDone ? `
            ${rec.actionType === 'claim' ? `
              <button class="btn btn-sm btn-primary" onclick="RecomendacionesScreen.executeAction('${rec.id}', '${rec.proveedor}')">
                <span class="material-symbols-rounded">play_arrow</span> Ejecutar
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline" onclick="RecomendacionesScreen.markDone('${rec.id}')">
              <span class="material-symbols-rounded">check</span> Hecho
            </button>
          ` : `
            <button class="btn btn-sm btn-ghost" onclick="RecomendacionesScreen.markUndone('${rec.id}')">
              <span class="material-symbols-rounded">undo</span> Reabrir
            </button>
          `}
        </div>
      </div>
    `;
    }

    function markDone(id) {
        doneSet.add(id);
        saveDone();
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateX(50px)';
            setTimeout(() => App.navigateTo('recomendaciones'), 300);
        }
        Components.showToast('Acción marcada como completada', 'success');
    }

    function markUndone(id) {
        doneSet.delete(id);
        saveDone();
        App.navigateTo('recomendaciones');
    }

    function saveDone() {
        localStorage.setItem('cs63_recs_done', JSON.stringify([...doneSet]));
    }

    function executeAction(id, proveedor) {
        markDone(id);
        window.location.hash = '#reclamaciones';
        setTimeout(() => {
            ReclamacionesScreen.openNewClaim(proveedor);
        }, 150);
    }

    function filterByType(type, btn) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.recommendation-card').forEach(card => {
            if (type === 'all' || card.dataset.type === type) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    let showDone = false;
    function toggleDone() {
        showDone = !showDone;
        const cont = document.getElementById('recsDoneContainer');
        const txt = document.getElementById('toggleDoneText');
        if (cont) cont.style.display = showDone ? '' : 'none';
        if (txt) txt.textContent = showDone ? 'Ocultar completadas' : 'Mostrar completadas';
    }

    return { render, markDone, markUndone, executeAction, filterByType, toggleDone };
})();
