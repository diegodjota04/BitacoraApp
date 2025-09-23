/**
 * Utilidades de seguridad para prevenir vulnerabilidades
 */
class SecurityUtils {
    /**
     * Sanitiza texto para prevenir XSS
     * @param {string} text - Texto a sanitizar
     * @returns {string} - Texto sanitizado
     */
    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Valida y sanitiza entrada de texto
     * @param {string} input - Entrada a sanitizar
     * @param {number} maxLength - Longitud máxima
     * @returns {string} - Texto sanitizado
     */
    static sanitizeInput(input, maxLength = CONFIG.MAX_TEXT_LENGTH) {
        if (!input || typeof input !== 'string') return '';
        return input.trim().substring(0, maxLength);
    }

    /**
     * Sanitiza atributos HTML
     * @param {string} attr - Atributo a sanitizar
     * @returns {string} - Atributo sanitizado
     */
    static sanitizeAttribute(attr) {
        if (typeof attr !== 'string') return '';
        return attr.replace(/['"<>&]/g, '');
    }

    /**
     * Valida formato de ID
     * @param {string} id - ID a validar
     * @returns {boolean} - Verdadero si es válido
     */
    static validateId(id) {
        if (!id || typeof id !== 'string') return false;
        return /^[a-zA-Z0-9_-]+$/.test(id);
    }

    /**
     * Genera ID único seguro
     * @param {string} prefix - Prefijo opcional
     * @returns {string} - ID único
     */
    static generateSecureId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2);
        return this.sanitizeAttribute(`${prefix}${timestamp}_${random}`);
    }

    /**
     * Valida estructura de datos JSON
     * @param {any} data - Datos a validar
     * @param {Object} schema - Esquema de validación
     * @returns {boolean} - Verdadero si es válido
     */
    static validateJsonStructure(data, schema) {
        try {
            return this._validateObjectAgainstSchema(data, schema);
        } catch (error) {
            console.error('Error validando estructura JSON:', error);
            return false;
        }
    }

    static _validateObjectAgainstSchema(obj, schema) {
        if (typeof obj !== typeof schema.type) return false;
        
        if (schema.required && (obj === null || obj === undefined)) return false;
        
        if (schema.properties && typeof obj === 'object') {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (!this._validateObjectAgainstSchema(obj[key], propSchema)) {
                    return false;
                }
            }
        }
        
        return true;
    }
}