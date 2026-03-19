/* ============================================
   AUTH — Login / Registration / Session UI
   ============================================ */
const AuthScreen = (() => {

    /** Render the login/register screen */
    function render(container, onSuccess) {
        container.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:80vh;">
            <div class="card" style="max-width:420px;width:100%;padding:var(--space-xl);">
              <div style="text-align:center;margin-bottom:var(--space-lg);">
                <span class="material-symbols-rounded" style="font-size:48px;color:var(--primary);">lock_person</span>
                <h3 style="margin-top:var(--space-sm);">Acceso Supabase</h3>
                <p style="color:var(--text-secondary);font-size:var(--font-sm);">Inicia sesión para cargar datos desde la nube</p>
              </div>

              <div id="authTabs" style="display:flex;gap:0;margin-bottom:var(--space-md);border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;">
                <button id="tabLogin" class="auth-tab active" style="flex:1;padding:8px;border:none;cursor:pointer;font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--primary);color:#fff;">
                  Iniciar Sesión
                </button>
                <button id="tabRegister" class="auth-tab" style="flex:1;padding:8px;border:none;cursor:pointer;font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-tertiary);color:var(--text-secondary);">
                  Registrarse
                </button>
              </div>

              <form id="authForm" autocomplete="on">
                <div id="authNameField" style="display:none;margin-bottom:var(--space-sm);">
                  <label style="font-size:var(--font-sm);color:var(--text-secondary);display:block;margin-bottom:4px;">Nombre</label>
                  <input type="text" id="authName" placeholder="Tu nombre" autocomplete="name"
                    style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-tertiary);color:var(--text-primary);font-size:var(--font-sm);">
                </div>
                <div style="margin-bottom:var(--space-sm);">
                  <label style="font-size:var(--font-sm);color:var(--text-secondary);display:block;margin-bottom:4px;">Email</label>
                  <input type="email" id="authEmail" placeholder="tu.email@ejemplo.com" required autocomplete="email"
                    style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-tertiary);color:var(--text-primary);font-size:var(--font-sm);">
                </div>
                <div style="margin-bottom:var(--space-md);">
                  <label style="font-size:var(--font-sm);color:var(--text-secondary);display:block;margin-bottom:4px;">Contraseña</label>
                  <input type="password" id="authPassword" placeholder="••••••••" required minlength="6" autocomplete="current-password"
                    style="width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-tertiary);color:var(--text-primary);font-size:var(--font-sm);">
                </div>
                <div id="authError" style="display:none;color:var(--danger);font-size:var(--font-xs);margin-bottom:var(--space-sm);padding:8px;background:rgba(244,63,94,0.1);border-radius:var(--radius-sm);"></div>
                <button type="submit" id="authSubmitBtn" class="btn btn-primary" style="width:100%;padding:12px;font-size:var(--font-sm);">
                  Iniciar Sesión
                </button>
              </form>

              <div style="text-align:center;margin-top:var(--space-md);">
                <button id="btnSkipAuth" class="btn btn-ghost btn-sm" style="font-size:var(--font-xs);">
                  Continuar sin cuenta (modo CSV)
                </button>
              </div>
            </div>
          </div>
        `;

        let isLogin = true;
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const nameField = document.getElementById('authNameField');
        const submitBtn = document.getElementById('authSubmitBtn');
        const form = document.getElementById('authForm');
        const errorBox = document.getElementById('authError');
        const btnSkip = document.getElementById('btnSkipAuth');

        function setTab(login) {
            isLogin = login;
            tabLogin.style.background = login ? 'var(--primary)' : 'var(--bg-tertiary)';
            tabLogin.style.color = login ? '#fff' : 'var(--text-secondary)';
            tabRegister.style.background = login ? 'var(--bg-tertiary)' : 'var(--primary)';
            tabRegister.style.color = login ? 'var(--text-secondary)' : '#fff';
            nameField.style.display = login ? 'none' : 'block';
            submitBtn.textContent = login ? 'Iniciar Sesión' : 'Crear Cuenta';
            errorBox.style.display = 'none';
        }

        tabLogin.addEventListener('click', () => setTab(true));
        tabRegister.addEventListener('click', () => setTab(false));

        // Skip auth → CSV mode
        btnSkip.addEventListener('click', () => {
            if (onSuccess) onSuccess('csv');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            const nombre = document.getElementById('authName').value.trim();

            errorBox.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 auto;"></div>';

            try {
                if (isLogin) {
                    await SupabaseClient.signIn(email, password);
                } else {
                    await SupabaseClient.signUp(email, password, nombre);
                }
                Components.showToast(`✅ Bienvenido, ${email}`, 'success');
                if (onSuccess) onSuccess('supabase');
            } catch (err) {
                console.error('[Auth] Error:', err);
                let msg = err.message || 'Error desconocido';
                if (msg.includes('Invalid login')) msg = 'Email o contraseña incorrectos';
                if (msg.includes('already registered')) msg = 'Este email ya está registrado. Usa "Iniciar Sesión".';
                if (msg.includes('Password should be')) msg = 'La contraseña debe tener al menos 6 caracteres';
                errorBox.textContent = msg;
                errorBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
            }
        });
    }

    /** Render user info badge (for the header) */
    function renderUserBadge() {
        const user = SupabaseClient.getUser();
        if (!user) return '';
        const profile = user._profile || {};
        const name = profile.nombre || user.email;
        return `
          <div style="display:flex;align-items:center;gap:var(--space-xs);">
            <span class="material-symbols-rounded" style="font-size:18px;color:var(--success);">cloud_done</span>
            <span style="font-size:var(--font-xs);color:var(--text-secondary);">${name}</span>
            <button class="btn-icon" onclick="AuthScreen.logout()" title="Cerrar sesión" style="margin-left:4px;">
              <span class="material-symbols-rounded" style="font-size:16px;">logout</span>
            </button>
          </div>
        `;
    }

    async function logout() {
        await SupabaseClient.signOut();
        // Reload to show login
        location.reload();
    }

    return { render, renderUserBadge, logout };
})();
