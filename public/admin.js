const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('login-btn');
    const setupBtn = document.getElementById('setup-btn');
    const authError = document.getElementById('auth-error');
    
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const togglePasswordLogin = document.getElementById('toggle-password-login');
    const passwordLoginForm = document.getElementById('password-login-form');
    const passwordInput = document.getElementById('password-input');
    const passwordLoginBtn = document.getElementById('password-login-btn');

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
        const password = passwordInput.value;
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
                body: JSON.stringify({ password })
            });

            const data = await resp.json();
            if (resp.ok && data.verified) {
                showDashboard();
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
            // 1. Obtener opciones de registro del servidor
            const resp = await fetch('/api/auth/register-generate');
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

            // 2. Invocar WebAuthn en el navegador
            const attResp = await startRegistration(options);

            // 3. Enviar verificación al servidor
            const verificationResp = await fetch('/api/auth/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attResp),
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
            // 1. Obtener opciones de autenticación
            const resp = await fetch('/api/auth/login-generate');
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
                showDashboard();
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

    function showDashboard() {
        loginView.classList.remove('active');
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadLogs();
    }

    async function loadLogs() {
        const tbody = document.querySelector('#logs-table tbody');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i data-lucide="loader-2" class="spin"></i> Cargando...</td></tr>';
        lucide.createIcons();

        try {
            const resp = await fetch('/api/admin/logs');
            if (resp.status === 401) {
                // Sesión expirada
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
                
                // Tipificación inteligente del usuario para auditoría
                let userLabel = 'Histórico (Pre-Login)';
                let userStyle = 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.08);';
                
                if (log.user_id) {
                    if (log.user_id === 'admin-password') {
                        userLabel = 'Admin (Contraseña)';
                        userStyle = 'background: rgba(249, 115, 22, 0.08); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.15);'; // Naranja
                    } else if (log.user_id.startsWith('admin')) {
                        userLabel = 'Admin (Biométrico)';
                        userStyle = 'background: rgba(6, 182, 212, 0.08); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.15);'; // Cian
                    } else {
                        userLabel = log.user_id;
                        userStyle = 'background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.15);'; // Verde
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
});
