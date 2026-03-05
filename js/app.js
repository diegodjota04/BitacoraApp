/**
 * Aplicación principal - Punto de entrada del sistema
 */
class BitacoraApp {
    constructor() {
        this.initialized = false;
        this.components = new Map();

        this.checkDependencies();
        this.initializeComponents();
        this.setupApplication();
    }

    /**
     * Verifica dependencias críticas
     */
    checkDependencies() {
        const requiredDependencies = [
            { name: 'Bootstrap', check: () => typeof bootstrap !== 'undefined' },
            { name: 'jsPDF', check: () => typeof window.jspdf !== 'undefined' },
            { name: 'localStorage', check: () => StorageService.isAvailable() }
        ];

        const missingDeps = requiredDependencies.filter(dep => !dep.check());

        if (missingDeps.length > 0) {
            const errorMsg = `Dependencias faltantes: ${missingDeps.map(d => d.name).join(', ')}`;
            errorHandler.showGlobalError(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Inicializa componentes del sistema
     */
    initializeComponents() {
        try {
            const studentManager = new StudentManager();
            const sessionManager = new SessionManager(studentManager);
            const statisticsManager = new StatisticsManager();
            const pdfGenerator = new PDFGenerator(sessionManager);
            const uiManager = new UIManager(studentManager, sessionManager, statisticsManager, pdfGenerator);

            this.components.set('studentManager', studentManager);
            window.studentManager = studentManager; // Expuesto para MapaClase
            this.components.set('sessionManager', sessionManager);
            this.components.set('statisticsManager', statisticsManager);
            this.components.set('pdfGenerator', pdfGenerator);
            this.components.set('uiManager', uiManager);

        } catch (error) {
            errorHandler.handle(error, 'BitacoraApp.initializeComponents');
            throw error;
        }
    }

    /**
     * Configura la aplicación
     */
    setupApplication() {
        try {
            this.setupGlobalErrorHandlers();

            const uiManager = this.components.get('uiManager');
            uiManager.initialize();

            this.showVersionInfo();
            this.initialized = true;

            // Botón Mapa de Clase
            document.getElementById('btn-mapa-clase')?.addEventListener('click', () => {
                const groupSelect = document.getElementById('groupSelect');
                const group = groupSelect ? groupSelect.value : null;
                mapaClaseUI.open(group);
            });
            console.log(`Bitácora Escolar v${CONFIG.VERSION} inicializada correctamente`);

        } catch (error) {
            errorHandler.handle(error, 'BitacoraApp.setupApplication');
            throw error;
        }
    }

    /**
     * Configura manejadores globales de error
     */
    setupGlobalErrorHandlers() {
        window.addEventListener('error', (event) => {
            errorHandler.handle(
                new Error(event.message),
                `${event.filename}:${event.lineno}:${event.colno}`
            );
        });

        window.addEventListener('unhandledrejection', (event) => {
            errorHandler.handle(
                new Error(event.reason),
                'Promesa rechazada no capturada'
            );
        });
    }

    /**
     * Muestra información de versión
     */
    showVersionInfo() {
        // Inyectar versión dinámica en el header y el título de la página
        const versionSpan = document.getElementById('app-version');
        if (versionSpan) versionSpan.textContent = `v${CONFIG.VERSION}`;
        document.title = `Bitácora Escolar v${CONFIG.VERSION}`;

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`
╔══════════════════════════════════════╗
║     Bitácora Escolar v${CONFIG.VERSION}        ║
║                                      ║
║  Sistema refactorizado y seguro      ║
║  Arquitectura modular                ║
║  Prof. Diego Durán-Jiménez           ║
╚══════════════════════════════════════╝
            `);
        }
    }

    /**
     * Obtiene componente
     */
    getComponent(componentName) {
        return this.components.get(componentName) || null;
    }

    /**
     * Verifica inicialización
     */
    isInitialized() {
        return this.initialized;
    }
}

/**
 * Inicialización cuando el DOM está listo
 */
document.addEventListener('DOMContentLoaded', function () {

    // ─── Botón de ayuda — funciona antes y después del login ─────────────────
    document.getElementById('btn-help')?.addEventListener('click', () => {
        // Si UIManager ya está activo, usar su método completo
        if (window.bitacoraApp) {
            const uiManager = window.bitacoraApp.getComponent('uiManager');
            if (uiManager) { uiManager.showHelp(); return; }
        }
        // Fallback: mostrar modal de ayuda directamente (durante auth)
        _showHelpModal();
    });

    function _showHelpModal() {
        const existing = document.getElementById('helpModal');
        if (existing) { new bootstrap.Modal(existing).show(); return; }

        const modalHtml = `
        <div class="modal fade" id="helpModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-book-open"></i> Manual de Usuario — Bitácora Escolar <span class="badge bg-secondary">${typeof CONFIG !== 'undefined' ? CONFIG.VERSION : ''}</span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <h6 class="text-primary border-bottom pb-1 mt-2"><i class="fas fa-sign-in-alt"></i> 1. Primer Acceso</h6>
                        <ol class="small">
                            <li>Al abrir la app por primera vez, aparece la pantalla de <strong>Configuración Inicial</strong>.</li>
                            <li>Ingrese su <strong>correo institucional</strong> y presione <em>"Enviar credenciales"</em>.</li>
                            <li>Revise su correo: recibirá su <strong>nombre de usuario</strong> y una <strong>contraseña temporal</strong>.</li>
                            <li>Use esas credenciales para iniciar sesión en la pantalla de Login.</li>
                            <li>El sistema le pedirá <strong>establecer una nueva contraseña</strong> (mínimo 8 caracteres). Este paso es obligatorio.</li>
                        </ol>
                        <div class="alert alert-info py-2 small">💡 El <strong>usuario</strong> es la parte de su correo antes del @. Ej: <code>maria.gomez@colegio.cr</code> → usuario: <code>mariagomez</code></div>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-cog"></i> 2. Configuración Inicial del Sistema</h6>
                        <ol class="small">
                            <li><strong>Nombre del profesor:</strong> ingrese su nombre completo y presione <em>Guardar</em>. Aparecerá en el encabezado y en los PDFs.</li>
                            <li><strong>Importar estudiantes:</strong> cargue el archivo <code>.json</code> con los grupos y listas de estudiantes.</li>
                            <li><strong>Grupos visibles:</strong> seleccione cuáles grupos aparecen en el selector principal.</li>
                            <li><strong>Prefijo PDF</strong> (opcional): un código que se añade al nombre del archivo PDF descargado.</li>
                        </ol>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-graduation-cap"></i> 3. Registrar una Clase</h6>
                        <ol class="small">
                            <li>En el <strong>Panel de Control</strong>, seleccione el <em>Grupo</em>, la <em>Fecha</em> y la <em>Hora de inicio</em>. La sesión se crea automáticamente.</li>
                            <li>Marque la asistencia: <span class="badge bg-success">Presente</span> <span class="badge bg-danger">Ausente</span> <span class="badge bg-warning text-dark">Tarde</span>.</li>
                            <li>Registre actividades especiales: 🚻 Baño &nbsp;|&nbsp; ➕ Enfermería &nbsp;|&nbsp; ⋯ Otra &nbsp;|&nbsp; 🤝 Apoyos Educativos (requiere comentario obligatorio).</li>
                            <li>Complete los campos de la <strong>Lección</strong> y la sección de <strong>Evaluación</strong>.</li>
                            <li>Presione <strong>Guardar Datos</strong> o use <kbd>Ctrl+S</kbd>.</li>
                        </ol>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-file-pdf"></i> 4. Generar Bitácora PDF</h6>
                        <ol class="small">
                            <li>Con una sesión activa, presione <strong>"Generar Bitácora PDF"</strong> o use <kbd>Ctrl+P</kbd>.</li>
                            <li>El PDF se descargará con el nombre: <code>[Prefijo]_Bitacora_[Grupo]_[Fecha].pdf</code></li>
                        </ol>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-history"></i> 5. Historial y Estadísticas</h6>
                        <ul class="small">
                            <li>Botón <strong>Historial</strong>: vea, recargue y genere PDF de sesiones anteriores. Filtre por grupo o rango de fechas.</li>
                            <li>Botón <strong>Estadísticas</strong>: resúmenes de asistencia por estudiante y por grupo.</li>
                        </ul>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-map-marked-alt"></i> 6. Mapa de Clase</h6>
                        <ul class="small">
                            <li><strong>Espejo de Clase:</strong> representación visual del aula con los estudiantes del grupo activo.</li>
                            <li><strong>Grupos Aleatorios:</strong> genere grupos de trabajo (tamaño 2–6) con excepciones configurables.</li>
                        </ul>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-save"></i> 7. Respaldo y Recuperación</h6>
                        <table class="table table-sm small">
                            <thead class="table-light"><tr><th>Acción</th><th>Dónde</th><th>Qué hace</th></tr></thead>
                            <tbody>
                                <tr><td>Exportar Historial</td><td>Config</td><td>Descarga todas las sesiones en <code>.json</code></td></tr>
                                <tr><td>Importar Historial</td><td>Config</td><td>Recupera sesiones desde un <code>.json</code> previo, sin sobreescribir</td></tr>
                                <tr><td>Crear Respaldo Completo</td><td>Config</td><td>Exporta todo el contenido del navegador</td></tr>
                            </tbody>
                        </table>
                        <div class="alert alert-warning py-2 small">⚠️ Los datos se guardan <strong>solo en este navegador y dispositivo</strong>. Exporte el historial regularmente y guárdelo en OneDrive o una unidad segura.</div>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-lock"></i> 8. Seguridad</h6>
                        <ul class="small">
                            <li><strong>Cambiar contraseña:</strong> Config → Seguridad → Cambiar Contraseña.</li>
                            <li><strong>Cerrar sesión:</strong> botón <i class="fas fa-sign-out-alt"></i> en la esquina superior derecha.</li>
                            <li>Tras <strong>5 intentos fallidos</strong> de login, el acceso se bloquea por 30 segundos.</li>
                        </ul>

                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-keyboard"></i> 9. Atajos de Teclado</h6>
                        <dl class="row small">
                            <dt class="col-sm-3"><kbd>Ctrl</kbd>+<kbd>S</kbd></dt><dd class="col-sm-9">Guardar sesión activa</dd>
                            <dt class="col-sm-3"><kbd>Ctrl</kbd>+<kbd>P</kbd></dt><dd class="col-sm-9">Generar PDF de la sesión</dd>
                        </dl>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('helpModal')).show();
    }

    // ─── Helpers de UI ────────────────────────────────────────────────────────
    function showAuthScreen(id) {
        ['auth-setup-screen', 'auth-login-screen', 'auth-change-pass-screen']
            .forEach(s => {
                const el = document.getElementById(s);
                if (el) el.style.display = (s === id) ? 'flex' : 'none';
            });
    }

    // ─── Aviso de privacidad (primera vez) ───────────────────────────────────
    const PRIVACY_KEY = 'privacy_accepted';
    function showPrivacyNotice(onAccepted) {
        if (localStorage.getItem(PRIVACY_KEY) === 'true') {
            onAccepted();
            return;
        }
        const notice = document.getElementById('privacy-notice');
        if (notice) notice.style.display = 'flex';
        document.getElementById('btn-accept-privacy')?.addEventListener('click', () => {
            localStorage.setItem(PRIVACY_KEY, 'true');
            if (notice) notice.style.display = 'none';
            onAccepted();
        });
    }

    function hideAuthScreens() {
        ['auth-setup-screen', 'auth-login-screen', 'auth-change-pass-screen']
            .forEach(s => {
                const el = document.getElementById(s);
                if (el) el.style.display = 'none';
            });
    }

    function setStatusMsg(elementId, message, type = 'info') {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = `auth-status-msg auth-${type}`;
        el.textContent = message;
        el.style.display = 'block';
    }

    function clearStatusMsg(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.style.display = 'none';
    }

    function setLoading(btnId, loading, text = '') {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
        } else {
            btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
        }
    }

    function togglePasswordVisibility(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;
        btn.addEventListener('click', () => {
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            btn.querySelector('i').className = `fas fa-${isPass ? 'eye-slash' : 'eye'}`;
        });
    }

    // ─── Inicializar app (post-auth) ──────────────────────────────────────────
    function initApp() {
        hideAuthScreens();
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.style.display = '';
            logoutBtn.addEventListener('click', () => {
                if (confirm('¿Desea cerrar sesión?')) {
                    AuthService.logout();
                    window.location.reload();
                }
            });
        }
        try {
            console.log('DOM cargado, inicializando Bitácora Escolar...');
            window.bitacoraApp = new BitacoraApp();
        } catch (error) {
            console.error('Error crítico inicializando aplicación:', error);
            errorHandler.showGlobalError('Error crítico al inicializar la aplicación. Recargue la página.');
        }
    }

    // ─── Flujo: Setup inicial ─────────────────────────────────────────────────
    function initSetupScreen() {
        const emailInput = document.getElementById('setup-email');
        if (emailInput) emailInput.focus();

        document.getElementById('btn-setup-provision')?.addEventListener('click', async () => {
            const email = document.getElementById('setup-email')?.value.trim();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setStatusMsg('setup-step-status', 'Ingrese un correo electrónico válido.', 'error');
                return;
            }
            setLoading('btn-setup-provision', true, 'Enviando correo...');
            clearStatusMsg('setup-step-status');
            const result = await AuthService.provisionUser(email);
            setLoading('btn-setup-provision', false);
            if (result.success) {
                setStatusMsg('setup-step-status', `✅ ${result.message} — Ahora inicie sesión.`, 'success');
                // Inicializar los handlers del login ANTES de mostrarlo
                initLoginScreen();
                initChangePasScreen();
                setTimeout(() => showAuthScreen('auth-login-screen'), 3000);
            } else {
                setStatusMsg('setup-step-status', `❌ ${result.message}`, 'error');
            }
        });

        // Enviar al presionar Enter
        document.getElementById('setup-email')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('btn-setup-provision')?.click();
        });
    }

    // ─── Flujo: Login ─────────────────────────────────────────────────────────
    function initLoginScreen() {
        togglePasswordVisibility('login-password', 'btn-toggle-login-pass');

        const LOCKOUT_KEY = 'auth_lockout';
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_SECONDS = 30;

        function getLockoutState() {
            try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY)) || { attempts: 0, until: 0 }; }
            catch { return { attempts: 0, until: 0 }; }
        }
        function saveLockoutState(state) {
            localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
        }
        function clearLockout() {
            localStorage.removeItem(LOCKOUT_KEY);
        }

        function startLockoutCountdown(remainingMs) {
            const btn = document.getElementById('btn-login');
            const interval = setInterval(() => {
                const remaining = Math.ceil((getLockoutState().until - Date.now()) / 1000);
                if (remaining <= 0) {
                    clearInterval(interval);
                    clearLockout();
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión'; }
                    clearStatusMsg('login-status');
                } else {
                    setStatusMsg('login-status', `⏳ Demasiados intentos fallidos. Espere ${remaining} segundo(s).`, 'error');
                    if (btn) btn.disabled = true;
                }
            }, 1000);
        }

        // Verificar si hay bloqueo activo al cargar
        const state = getLockoutState();
        if (state.until > Date.now()) {
            startLockoutCountdown(state.until - Date.now());
        }

        const doLogin = async () => {
            const lockState = getLockoutState();
            if (lockState.until > Date.now()) return; // Bloqueado

            const user = document.getElementById('login-username')?.value.trim();
            const pass = document.getElementById('login-password')?.value;
            if (!user || !pass) {
                setStatusMsg('login-status', 'Ingrese usuario y contraseña.', 'error');
                return;
            }
            setLoading('btn-login', true, 'Verificando...');
            clearStatusMsg('login-status');
            const result = await AuthService.login(user, pass);
            setLoading('btn-login', false);
            if (result.success) {
                clearLockout();
                if (result.firstLogin) {
                    showAuthScreen('auth-change-pass-screen');
                } else {
                    initApp();
                }
            } else {
                lockState.attempts = (lockState.attempts || 0) + 1;
                if (lockState.attempts >= MAX_ATTEMPTS) {
                    lockState.until = Date.now() + LOCKOUT_SECONDS * 1000;
                    saveLockoutState(lockState);
                    startLockoutCountdown(LOCKOUT_SECONDS * 1000);
                } else {
                    saveLockoutState(lockState);
                    const remaining = MAX_ATTEMPTS - lockState.attempts;
                    setStatusMsg('login-status', `❌ ${result.message} (${remaining} intento(s) restante(s))`, 'error');
                }
            }
        };

        document.getElementById('btn-login')?.addEventListener('click', doLogin);
        document.getElementById('login-password')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') doLogin();
        });
    }

    // ─── Flujo: Cambio de contraseña obligatorio ──────────────────────────────
    function initChangePasScreen() {
        togglePasswordVisibility('chpass-new', 'btn-toggle-new-pass');

        document.getElementById('btn-change-pass')?.addEventListener('click', async () => {
            const current = document.getElementById('chpass-current')?.value;
            const next = document.getElementById('chpass-new')?.value;
            const confirm = document.getElementById('chpass-confirm')?.value;
            clearStatusMsg('chpass-status');

            if (!current || !next || !confirm) {
                setStatusMsg('chpass-status', 'Complete todos los campos.', 'error');
                return;
            }
            if (next !== confirm) {
                setStatusMsg('chpass-status', 'Las contraseñas nuevas no coinciden.', 'error');
                return;
            }
            setLoading('btn-change-pass', true, 'Guardando...');
            const result = await AuthService.changePassword(current, next);
            setLoading('btn-change-pass', false);
            if (result.success) {
                setStatusMsg('chpass-status', `✅ ${result.message}`, 'success');
                setTimeout(() => initApp(), 1500);
            } else {
                setStatusMsg('chpass-status', `❌ ${result.message}`, 'error');
            }
        });
    }

    // ─── Punto de entrada: decidir qué pantalla mostrar ────────────────────────
    showPrivacyNotice(() => {
        if (AuthService.isAuthenticated()) {
            initApp();
        } else if (!AuthService.isConfigured()) {
            initSetupScreen();
            showAuthScreen('auth-setup-screen');
        } else {
            initLoginScreen();
            initChangePasScreen();
            showAuthScreen('auth-login-screen');
            setTimeout(() => document.getElementById('login-username')?.focus(), 200);
        }
    });
});
