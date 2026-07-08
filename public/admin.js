const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('login-btn');
    const setupBtn = document.getElementById('setup-btn');
    const authError = document.getElementById('auth-error');
    
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const logsTab = document.getElementById('logs-tab');
    const settingsTab = document.getElementById('settings-tab');

    const togglePasswordLogin = document.getElementById('toggle-password-login');
    const passwordLoginForm = document.getElementById('password-login-form');
    const passwordInput = document.getElementById('password-input');
    const passwordLoginBtn = document.getElementById('password-login-btn');
    const usernameInput = document.getElementById('username-input');

    // Auto-login si ya existe una sesión activa
    try {
        const sessionResp = await fetch('/api/auth/session');
        const sessionData = await sessionResp.json();
        if (sessionData.authenticated) {
            showDashboard();
        }
    } catch (e) {
        console.error('Error in auto-login check:', e);
    }

    // Toggle de formulario de contraseña de respaldo
    togglePasswordLogin.addEventListener('click', (e) => {
        e.preventDefault();
        if (passwordLoginForm.classList.contains('hidden')) {
            passwordLoginForm.classList.remove('hidden');
            passwordLoginForm.style.display = 'flex';
        } else {
            passwordLoginForm.classList.add('hidden');
            passwordLoginForm.style.display = 'none';
        }
    });

    // Login por contraseña
    passwordLoginBtn.addEventListener('click', async () => {
        authError.style.display = 'none';
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username) {
            authError.innerText = 'Por favor, ingresa tu correo o usuario autorizado';
            authError.style.display = 'block';
            return;
        }
        if (!password) {
            authError.innerText = 'Por favor, introduce la contraseña';
            authError.style.display = 'block';
            return;
        }

        passwordLoginBtn.disabled = true;
        passwordLoginBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Verificando...';
        lucide.createIcons();

        try {
            const resp = await fetch('/api/auth/login-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await resp.json();
            if (resp.ok && data.verified) {
                showDashboard(usernameInput.value.trim().toLowerCase());
            } else {
                throw new Error(data.error || 'Contraseña incorrecta');
            }
        } catch (error) {
            console.error(error);
            authError.innerText = error.message;
            authError.style.display = 'block';
        } finally {
            passwordLoginBtn.disabled = false;
            passwordLoginBtn.innerText = 'Iniciar Sesión';
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/auth/logout', { method: 'POST' });
            if (resp.ok) {
                window.location.reload();
            } else {
                alert('Error al cerrar sesión');
            }
        } catch (e) {
            console.error('Error logging out:', e);
        }
    });

    // SETUP - Registro del primer (y único) administrador
    setupBtn.addEventListener('click', async () => {
        authError.style.display = 'none';
        setupBtn.disabled = true;
        
        try {
            const username = usernameInput.value.trim();
            if (!username) {
                throw new Error('Por favor, ingresa tu correo o usuario autorizado.');
            }

            // 1. Obtener opciones de registro del servidor
            const resp = await fetch('/api/auth/register-generate?username=' + encodeURIComponent(username));
            if (!resp.ok) {
                const textErr = await resp.text();
                let errMsg = 'Setup unavailable';
                try {
                    const err = JSON.parse(textErr);
                    errMsg = err.error || errMsg;
                } catch (e) {
                    errMsg = textErr.substring(0, 100) || errMsg;
                }
                throw new Error(errMsg);
            }
            const options = await resp.json();
            console.log('WebAuthn Register Options:', options);

            // 2. Invocar WebAuthn en el navegador
            const attResp = await startRegistration(options);

            // 3. Enviar verificación al servidor
            const verificationResp = await fetch('/api/auth/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...attResp, username }),
            });

            const verificationJSON = await verificationResp.json();
            if (verificationJSON && verificationJSON.verified) {
                alert('¡Administrador registrado exitosamente con Passkey!');
            } else {
                throw new Error(verificationJSON.error || 'Verification failed');
            }
        } catch (error) {
            console.error(error);
            authError.innerText = error.message;
            authError.style.display = 'block';
        } finally {
            setupBtn.disabled = false;
        }
    });

    // LOGIN - Autenticación del administrador
    loginBtn.addEventListener('click', async () => {
        authError.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Verificando...';
        lucide.createIcons();

        try {
            const username = usernameInput.value.trim();
            if (!username) {
                throw new Error('Por favor, ingresa tu correo o usuario autorizado.');
            }

            // 1. Obtener opciones de autenticación
            const resp = await fetch('/api/auth/login-generate?username=' + encodeURIComponent(username));
            if (!resp.ok) {
                const textErr = await resp.text();
                let errMsg = 'Login unavailable';
                try {
                    const err = JSON.parse(textErr);
                    errMsg = err.error || errMsg;
                } catch (e) {
                    errMsg = textErr.substring(0, 100) || errMsg;
                }
                throw new Error(errMsg);
            }
            const options = await resp.json();
            console.log('WebAuthn Login Options:', options);

            // 2. Invocar WebAuthn
            const asseResp = await startAuthentication(options);

            // 3. Verificar en el servidor
            const verificationResp = await fetch('/api/auth/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(asseResp),
            });

            const verificationJSON = await verificationResp.json();
            if (verificationJSON && verificationJSON.verified) {
                // Éxito - Mostrar Dashboard
                showDashboard(usernameInput.value.trim().toLowerCase());
            } else {
                throw new Error(verificationJSON.error || 'Login failed');
            }
        } catch (error) {
            console.error(error);
            authError.innerText = error.message;
            authError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i data-lucide="scan-face"></i> Iniciar Sesión Segura';
            lucide.createIcons();
        }
    });

    refreshLogsBtn.addEventListener('click', loadLogs);

    function showDashboard(userId) {
        // Guardar el usuario activo para proteger su eliminación
        if (userId) window._activeUserId = userId;

        loginView.classList.remove('active');
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadLogs();

        // Navegación de pestañas del sidebar
        document.querySelectorAll('.side-nav .nav-btn[data-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;

                // Actualizar estado activo del botón
                document.querySelectorAll('.side-nav .nav-btn[data-target]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Mostrar la pestaña correcta
                if (target === 'logs-tab') {
                    logsTab.classList.remove('hidden');
                    settingsTab.classList.add('hidden');
                    loadLogs();
                } else if (target === 'settings-tab') {
                    logsTab.classList.add('hidden');
                    settingsTab.classList.remove('hidden');
                    loadSecuritySettings();
                }
            });
        });
    }

    async function loadLogs() {
        const tbody = document.querySelector('#logs-table tbody');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i data-lucide="loader-2" class="spin"></i> Cargando...</td></tr>';
        lucide.createIcons();

        try {
            const resp = await fetch('/api/admin/logs');
            if (resp.status === 401) {
                alert('Sesión expirada. Por favor inicia sesión nuevamente.');
                window.location.reload();
                return;
            }
            
            const logs = await resp.json();
            
            if (!logs || logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No hay registros de consentimiento aún.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            logs.forEach(log => {
                const tr = document.createElement('tr');
                const date = new Date(log.created_at).toLocaleString('es-CL');
                
                let userLabel = 'Histórico (Pre-Login)';
                let userStyle = 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.08);';
                
                if (log.user_id) {
                    if (log.user_id === 'admin-password') {
                        userLabel = 'Admin (Contraseña)';
                        userStyle = 'background: rgba(249, 115, 22, 0.08); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.15);';
                    } else if (log.user_id.startsWith('admin')) {
                        userLabel = 'Admin (Biométrico)';
                        userStyle = 'background: rgba(6, 182, 212, 0.08); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.15);';
                    } else {
                        userLabel = log.user_id;
                        userStyle = 'background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.15);';
                    }
                }

                tr.innerHTML = `
                    <td>${date}</td>
                    <td><span class="action-badge"><i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> ${log.action}</span></td>
                    <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.url_scanned}">
                        ${log.url_scanned}
                    </td>
                    <td><span class="ip-badge">${log.ip_anonymized}</span></td>
                    <td><span class="ip-badge" style="${userStyle}">${userLabel}</span></td>
                    <td><span class="ip-badge" style="background: rgba(255, 255, 255, 0.03); color: var(--text-muted);">${log.policy_version || 'v1.0'}</span></td>
                    <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.user_agent}">
                        ${log.user_agent}
                    </td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        } catch (error) {
            console.error('Error fetching logs:', error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-danger);">Error al cargar los registros.</td></tr>';
        }
    }

    // ================================================================
    // SEGURIDAD: Cargar y gestionar usuarios autorizados y passkeys
    // ================================================================
    async function loadSecuritySettings() {
        const usersTbody = document.querySelector('#users-table tbody');
        const passkeysTbody = document.querySelector('#passkeys-table tbody');

        usersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i data-lucide="loader-2" class="spin"></i> Cargando...</td></tr>';
        passkeysTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i data-lucide="loader-2" class="spin"></i> Cargando...</td></tr>';
        lucide.createIcons();

        try {
            const resp = await fetch('/api/admin/security');
            if (resp.status === 401) {
                alert('Sesión expirada.');
                window.location.reload();
                return;
            }
            const data = await resp.json();
            const { authorized_users, passkeys } = data;

            // -- Renderizar tabla de usuarios autorizados --
            if (!authorized_users || authorized_users.length === 0) {
                usersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No hay usuarios autorizados.</td></tr>';
            } else {
                usersTbody.innerHTML = '';
                authorized_users.forEach(user => {
                    const userPasskeys = passkeys.filter(p => p.user_id === user.user_id);
                    const isActive = user.user_id === window._activeUserId;
                    const date = new Date(user.created_at).toLocaleString('es-CL');
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <span class="ip-badge" style="background:rgba(16,185,129,0.08);color:#10b981;border:1px solid rgba(16,185,129,0.15);">${user.user_id}</span>
                            ${isActive ? '<span style="margin-left:8px;font-size:0.7rem;color:var(--color-primary);">(tú)</span>' : ''}
                        </td>
                        <td><span class="ip-badge" style="text-transform:uppercase;letter-spacing:0.5px;font-size:0.7rem;">${user.role}</span></td>
                        <td style="color:var(--text-muted);font-size:0.85rem;">${date}</td>
                        <td style="text-align:center;">
                            <span style="background:rgba(6,182,212,0.1);color:#06b6d4;border:1px solid rgba(6,182,212,0.2);border-radius:6px;padding:3px 10px;font-size:0.8rem;font-weight:700;">
                                ${userPasskeys.length}
                            </span>
                        </td>
                        <td>
                            ${isActive 
                                ? '<span style="color:var(--text-muted);font-size:0.8rem;">Sesión activa</span>'
                                : `<button class="btn btn-outline btn-sm delete-user-btn" data-id="${user.user_id}" style="color:#ef4444;border-color:rgba(239,68,68,0.3);font-size:0.8rem;padding:6px 12px;">
                                    <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Revocar Acceso
                                  </button>`
                            }
                        </td>
                    `;
                    usersTbody.appendChild(tr);
                });
            }

            // -- Renderizar tabla de passkeys --
            if (!passkeys || passkeys.length === 0) {
                passkeysTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No hay llaves registradas.</td></tr>';
            } else {
                passkeysTbody.innerHTML = '';
                passkeys.forEach(pk => {
                    const date = new Date(pk.created_at).toLocaleString('es-CL');
                    const transports = (pk.transports || ['desconocido']).join(', ');
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span class="ip-badge" style="background:rgba(16,185,129,0.08);color:#10b981;border:1px solid rgba(16,185,129,0.15);">${pk.user_id}</span></td>
                        <td style="color:var(--text-muted);font-size:0.85rem;">${date}</td>
                        <td><span class="ip-badge" style="font-size:0.75rem;">${transports}</span></td>
                        <td>
                            <button class="btn btn-outline btn-sm delete-passkey-btn" data-id="${pk.id}" style="color:#f59e0b;border-color:rgba(245,158,11,0.3);font-size:0.8rem;padding:6px 12px;">
                                <i data-lucide="key" style="width:13px;height:13px;"></i> Revocar Llave
                            </button>
                        </td>
                    `;
                    passkeysTbody.appendChild(tr);
                });
            }

            lucide.createIcons();

            // -- Eventos de borrado de usuarios --
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.id;
                    if (!confirm(`¿Confirmas revocar el acceso completo de "${userId}"? Se eliminarán también todas sus llaves biométricas.`)) return;
                    btn.disabled = true;
                    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
                    lucide.createIcons();
                    try {
                        const r = await fetch('/api/admin/security', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'user', id: userId })
                        });
                        const result = await r.json();
                        if (!r.ok) throw new Error(result.error);
                        alert(result.message);
                        loadSecuritySettings();
                    } catch (e) {
                        alert('Error: ' + e.message);
                        btn.disabled = false;
                    }
                });
            });

            // -- Eventos de revocación de passkeys --
            document.querySelectorAll('.delete-passkey-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const passkeyId = btn.dataset.id;
                    if (!confirm('¿Confirmas revocar esta llave biométrica? El usuario deberá registrar una nueva llave en su próximo acceso.')) return;
                    btn.disabled = true;
                    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
                    lucide.createIcons();
                    try {
                        const r = await fetch('/api/admin/security', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'passkey', id: passkeyId })
                        });
                        const result = await r.json();
                        if (!r.ok) throw new Error(result.error);
                        alert(result.message);
                        loadSecuritySettings();
                    } catch (e) {
                        alert('Error: ' + e.message);
                        btn.disabled = false;
                    }
                });
            });

        } catch (error) {
            console.error('Error loading security settings:', error);
            usersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-danger);">Error al cargar configuración.</td></tr>';
            passkeysTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-danger);">Error al cargar llaves.</td></tr>';
        }
    }

    // Botón Actualizar de Configuración de Seguridad
    document.getElementById('refresh-security-btn')?.addEventListener('click', loadSecuritySettings);

    // Botón Agregar Usuario
    document.getElementById('add-user-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('new-user-input');
        const newUserId = input.value.trim().toLowerCase();
        if (!newUserId || !newUserId.includes('@')) {
            alert('Por favor ingresa un correo electrónico válido.');
            return;
        }
        const addBtn = document.getElementById('add-user-btn');
        addBtn.disabled = true;
        addBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Autorizando...';
        lucide.createIcons();
        try {
            const r = await fetch('/api/admin/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: newUserId, role: 'admin' })
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error);
            alert(result.message);
            input.value = '';
            loadSecuritySettings();
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i data-lucide="user-plus"></i> Autorizar Usuario';
            lucide.createIcons();
        }
    });
});
