/**
 * Gestor centralizado de errores
 */
class ErrorHandler {
    constructor() {
        this.errors = new Map();
        this.maxLogs = 100;
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
            errorElement.textContent = this.escapeHtml(message);
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
     * Muestra error global
     * @param {string} message - Mensaje de error
     */
    showGlobalError(message) {
        let errorDiv = document.getElementById('global-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'global-error';
            errorDiv.className = 'alert alert-danger alert-dismissible fade show';
            errorDiv.style.cssText = `
                position: fixed; 
                top: 20px; 
                right: 20px; 
                z-index: 9999; 
                max-width: 400px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            `;
            errorDiv.setAttribute('role', 'alert');
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <strong>Error:</strong> ${this.escapeHtml(message)}
            <button type="button" class="btn-close" aria-label="Cerrar" onclick="this.parentElement.remove()"></button>
        `;

        setTimeout(() => {
            if (errorDiv && errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    /**
     * Muestra mensaje de éxito
     * @param {string} message - Mensaje de éxito
     */
    showSuccess(message) {
        let successDiv = document.getElementById('global-success');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'global-success';
            successDiv.className = 'alert alert-success alert-dismissible fade show';
            successDiv.style.cssText = `
                position: fixed; 
                top: 20px; 
                right: 20px; 
                z-index: 9999; 
                max-width: 400px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            `;
            successDiv.setAttribute('role', 'alert');
            document.body.appendChild(successDiv);
        }
        
        successDiv.innerHTML = `
            <strong>Éxito:</strong> ${this.escapeHtml(message)}
            <button type="button" class="btn-close" aria-label="Cerrar" onclick="this.parentElement.remove()"></button>
        `;

        setTimeout(() => {
            if (successDiv && successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }

    /**
     * Sanitiza HTML básico
     * @param {string} text - Texto a sanitizar
     * @returns {string} - Texto sanitizado
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        try {
            // Usar localStorage directamente para evitar dependencia circular
            const storageKey = 'bitacora_v2_errorLogs';
            const logs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            logs.push(errorLog);
            
            // Mantener solo los últimos 100 logs
            if (logs.length > this.maxLogs) {
                logs.splice(0, logs.length - this.maxLogs);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(logs));
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
            const storageKey = 'bitacora_v2_errorLogs';
            return JSON.parse(localStorage.getItem(storageKey) || '[]');
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
            const storageKey = 'bitacora_v2_errorLogs';
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error('Error limpiando logs de errores:', error);
        }
    }
}

// Instancia global del manejador de errores
const errorHandler = new ErrorHandler();