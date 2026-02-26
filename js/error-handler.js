/**
 * Gestor centralizado de errores
 */
class ErrorHandler {
    constructor() {
        this.errors = new Map();
        this.maxLogs = 100;
        this._storageKey = CONFIG.STORAGE_PREFIX + 'errorLogs';
    }

    /**
     * Maneja errores de la aplicación
     * @param {Error} error - Error ocurrido
     * @param {string} context - Contexto del error
     * @param {string|null} fieldId - ID del campo relacionado
     */
    handle(error, context = '', fieldId = null) {
        console.error(`Error en ${context}:`, error);
        this.logError(error, context);

        if (fieldId) {
            this.showFieldError(fieldId, error.message);
        } else {
            this.showGlobalError(error.message || 'Ha ocurrido un error inesperado');
        }
    }

    /**
     * Muestra error en un campo específico
     * @param {string} fieldId - ID del campo
     * @param {string} message - Mensaje de error
     */
    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = SecurityUtils.escapeHtml(message);
            errorElement.style.display = 'block';

            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.add('is-invalid');
                field.setAttribute('aria-invalid', 'true');
                field.setAttribute('aria-describedby', `${fieldId}-error`);
            }
        }
    }

    /**
     * Limpia errores de un campo
     * @param {string} fieldId - ID del campo
     */
    clearFieldError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';

            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.remove('is-invalid');
                field.removeAttribute('aria-invalid');
                field.removeAttribute('aria-describedby');
            }
        }
    }

    /**
     * Muestra una notificación flotante (error o éxito).
     * @private
     */
    _showNotification(id, cssClass, prefix, message, duration) {
        let div = document.getElementById(id);
        if (!div) {
            div = document.createElement('div');
            div.id = id;
            div.className = `alert ${cssClass} alert-dismissible fade show`;
            div.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            `;
            div.setAttribute('role', 'alert');
            document.body.appendChild(div);
        }

        div.innerHTML = `
            <strong>${prefix}</strong> ${SecurityUtils.escapeHtml(message)}
            <button type="button" class="btn-close" aria-label="Cerrar" onclick="this.parentElement.remove()"></button>
        `;

        setTimeout(() => {
            if (div && div.parentNode) div.remove();
        }, duration);
    }

    /**
     * Muestra error global
     * @param {string} message - Mensaje de error
     */
    showGlobalError(message) {
        this._showNotification('global-error', 'alert-danger', 'Error:', message, 5000);
    }

    /**
     * Muestra mensaje de éxito
     * @param {string} message - Mensaje de éxito
     */
    showSuccess(message) {
        this._showNotification('global-success', 'alert-success', 'Éxito:', message, 3000);
    }

    /**
     * Registra errores para debugging
     * @param {Error} error - Error a registrar
     * @param {string} context - Contexto del error
     */
    logError(error, context) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        try {
            const logs = JSON.parse(localStorage.getItem(this._storageKey) || '[]');
            logs.push(errorLog);

            // Mantener solo los últimos N logs
            if (logs.length > this.maxLogs) {
                logs.splice(0, logs.length - this.maxLogs);
            }

            localStorage.setItem(this._storageKey, JSON.stringify(logs));
        } catch (storageError) {
            console.error('Error guardando log de errores:', storageError);
        }
    }

    /**
     * Obtiene logs de errores
     * @returns {Array} - Array de logs de errores
     */
    getErrorLogs() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
        } catch (error) {
            console.error('Error obteniendo logs de errores:', error);
            return [];
        }
    }

    /**
     * Limpia logs de errores
     */
    clearErrorLogs() {
        try {
            localStorage.removeItem(this._storageKey);
        } catch (error) {
            console.error('Error limpiando logs de errores:', error);
        }
    }
}

// Instancia global del manejador de errores
const errorHandler = new ErrorHandler();