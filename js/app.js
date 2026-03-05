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

    // ─── Helpers de UI ────────────────────────────────────────────────────────
    function showAuthScreen(id) {
        ['auth-setup-screen', 'auth-login-screen', 'auth-change-pass-screen']
            .forEach(s => {
                const el = document.getElementById(s);
                if (el) el.style.display = (s === id) ? 'flex' : 'none';
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

        const doLogin = async () => {
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
                if (result.firstLogin) {
                    showAuthScreen('auth-change-pass-screen');
                } else {
                    initApp();
                }
            } else {
                setStatusMsg('login-status', `❌ ${result.message}`, 'error');
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
    if (AuthService.isAuthenticated()) {
        initApp();
    } else if (!AuthService.isConfigured()) {
        initSetupScreen();
        showAuthScreen('auth-setup-screen');
    } else {
        initLoginScreen();
        initChangePasScreen();
        showAuthScreen('auth-login-screen');
        // Enfocar campo de usuario
        setTimeout(() => document.getElementById('login-username')?.focus(), 200);
    }
});
