/* ============================================
   UI COMPONENTS — Reusable helpers
   ============================================ */
const Components = (() => {

  /** Format currency in EUR */
  function formatCurrency(n) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
  }

  /** Format number with locale */
  function formatNumber(n) {
    return new Intl.NumberFormat('es-ES').format(n || 0);
  }

  /** Format date */
  function formatDate(d) {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** Show toast notification */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="material-symbols-rounded" style="font-size:18px;">${type === 'success' ? 'check_circle' :
        type === 'error' ? 'error' :
          type === 'warning' ? 'warning' : 'info'
      }</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /** Open modal */
  function openModal(title, bodyHTML, footerHTML, size) {
    const overlay = document.getElementById('modalOverlay');
    const content = overlay.querySelector('.modal-content');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML || '';
    content.className = 'modal-content' + (size ? ` modal-${size}` : '');
    overlay.classList.remove('hidden');
  }

  /** Close modal */
  function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
  }

  /** Create sortable table */
  function createTable(columns, data, options = {}) {
    const pageSize = options.pageSize || 25;
    let currentPage = 0;
    let sortCol = null;
    let sortDir = 'asc';
    let currentData = [...data];

    const wrapper = document.createElement('div');

    function render() {
      const totalPages = Math.ceil(currentData.length / pageSize);
      const pageData = currentData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

      wrapper.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                ${columns.map(col => `
                  <th data-col="${col.key}" class="${sortCol === col.key ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}">
                    ${col.label}
                    <span class="material-symbols-rounded sort-icon" style="font-size:14px;">
                      ${sortCol === col.key ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                    </span>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${pageData.length === 0 ? `
                <tr><td colspan="${columns.length}" style="text-align:center;padding:40px;color:var(--text-tertiary);">
                  Sin datos disponibles
                </td></tr>
              ` : pageData.map(row => `
                <tr>
                  ${columns.map(col => `<td>${col.render ? col.render(row) : (row[col.key] ?? '—')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
          <div class="pagination">
            <span>Mostrando ${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, currentData.length)} de ${currentData.length}</span>
            <div class="pagination-controls">
              <button ${currentPage === 0 ? 'disabled' : ''} data-action="prev">
                <span class="material-symbols-rounded" style="font-size:16px;">chevron_left</span>
              </button>
              ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        const page = totalPages <= 7 ? i : (currentPage < 3 ? i : currentPage > totalPages - 4 ? totalPages - 7 + i : currentPage - 3 + i);
        return `<button class="${page === currentPage ? 'active' : ''}" data-action="page" data-page="${page}">${page + 1}</button>`;
      }).join('')}
              <button ${currentPage >= totalPages - 1 ? 'disabled' : ''} data-action="next">
                <span class="material-symbols-rounded" style="font-size:16px;">chevron_right</span>
              </button>
            </div>
          </div>
        ` : ''}
      `;

      // Sort handlers
      wrapper.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (sortCol === col) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            sortCol = col;
            sortDir = 'asc';
          }
          currentData.sort((a, b) => {
            let va = a[col] ?? a['_' + col] ?? '';
            let vb = b[col] ?? b['_' + col] ?? '';
            if (typeof va === 'number' && typeof vb === 'number') {
              return sortDir === 'asc' ? va - vb : vb - va;
            }
            va = String(va).toLowerCase();
            vb = String(vb).toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });
          currentPage = 0;
          render();
        });
      });

      // Pagination handlers
      wrapper.querySelectorAll('.pagination-controls button').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'prev') currentPage = Math.max(0, currentPage - 1);
          else if (action === 'next') currentPage++;
          else if (action === 'page') currentPage = parseInt(btn.dataset.page);
          render();
        });
      });
    }

    // Public method to update data
    wrapper.updateData = (newData) => {
      currentData = [...newData];
      currentPage = 0;
      render();
    };

    render();
    return wrapper;
  }

  /** Export data to CSV */
  function exportToCSV(data, filename) {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, filename);
    showToast(`Archivo ${filename} descargado`, 'success');
  }

  /** Export to Excel */
  function exportToExcel(data, filename) {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, filename.replace('.csv', '.xlsx'));
    showToast(`Archivo ${filename} descargado`, 'success');
  }

  /** Priority badge */
  function priorityBadge(priority) {
    const map = {
      alta: { icon: '🔴', cls: 'badge-danger', text: 'Alta' },
      media: { icon: '🟡', cls: 'badge-warning', text: 'Media' },
      baja: { icon: '🟢', cls: 'badge-success', text: 'Baja' }
    };
    const p = map[priority] || map.baja;
    return `<span class="badge ${p.cls}">${p.icon} ${p.text}</span>`;
  }

  /** Status badge */
  function statusBadge(status) {
    const map = {
      'Pendiente': 'badge-warning',
      'En gestión': 'badge-info',
      'Resuelta': 'badge-success',
      'Cerrada': 'badge-neutral'
    };
    return `<span class="badge ${map[status] || 'badge-neutral'}">${status}</span>`;
  }

  return {
    formatCurrency,
    formatNumber,
    formatDate,
    showToast,
    openModal,
    closeModal,
    openProgressModal: (title) => {
      document.getElementById('progressModal').classList.remove('hidden');
      document.getElementById('progressTitle').textContent = title || 'Procesando...';
      document.getElementById('progressBar').style.width = '0%';
      document.getElementById('progressText').textContent = 'Iniciando...';
    },
    updateProgress: (percent, text) => {
      document.getElementById('progressBar').style.width = `${percent}%`;
      if (text) document.getElementById('progressText').textContent = text;
    },
    closeProgressModal: () => {
      document.getElementById('progressModal').classList.add('hidden');
    },
    createTable,
    exportToCSV,
    exportToExcel,
    priorityBadge,
    statusBadge
  };
})();
