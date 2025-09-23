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
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('DOM cargado, inicializando Bitácora Escolar...');
        window.bitacoraApp = new BitacoraApp();
        
    } catch (error) {
        console.error('Error crítico inicializando aplicación:', error);
        errorHandler.showGlobalError('Error crítico al inicializar la aplicación. Recargue la página.');
    }
});