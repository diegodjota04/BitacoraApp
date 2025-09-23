/**
 * Servicio de almacenamiento seguro
 */
class StorageService {
    /**
     * Verifica si localStorage está disponible
     * @returns {boolean} - Verdadero si está disponible
     */
    static isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Obtiene el tamaño usado del almacenamiento
     * @returns {number} - Bytes utilizados
     */
    static getStorageSize() {
        let total = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key) && key.startsWith(CONFIG.STORAGE_PREFIX)) {
                    total += localStorage[key].length + key.length;
                }
            }
        } catch (error) {
            console.error('Error calculando tamaño de almacenamiento:', error);
        }
        return total;
    }

    /**
     * Verifica si hay espacio suficiente
     * @param {string} data - Datos a almacenar
     * @returns {boolean} - Verdadero si hay espacio
     */
    static hasSpace(data) {
        const currentSize = this.getStorageSize();
        const dataSize = JSON.stringify(data).length;
        return (currentSize + dataSize) < CONFIG.MAX_STORAGE_SIZE;
    }

    /**
     * Guarda datos de forma segura
     * @param {string} key - Clave
     * @param {any} value - Valor a guardar
     * @returns {boolean} - Verdadero si se guardó correctamente
     */
    static set(key, value) {
        if (!this.isAvailable()) {
            throw new Error('localStorage no está disponible');
        }

        try {
            const sanitizedKey = SecurityUtils.sanitizeAttribute(CONFIG.STORAGE_PREFIX + key);
            const serializedValue = JSON.stringify(value);
            
            if (!this.hasSpace(serializedValue)) {
                throw new Error('No hay suficiente espacio de almacenamiento');
            }
            
            localStorage.setItem(sanitizedKey, serializedValue);
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StorageService.set');
            return false;
        }
    }

    /**
     * Obtiene datos de forma segura
     * @param {string} key - Clave
     * @param {any} defaultValue - Valor por defecto
     * @returns {any} - Valor almacenado o valor por defecto
     */
    static get(key, defaultValue = null) {
        if (!this.isAvailable()) {
            return defaultValue;
        }

        try {
            const sanitizedKey = SecurityUtils.sanitizeAttribute(CONFIG.STORAGE_PREFIX + key);
            const item = localStorage.getItem(sanitizedKey);
            
            if (item === null) {
                return defaultValue;
            }
            
            return JSON.parse(item);
        } catch (error) {
            console.error('Error obteniendo datos del almacenamiento:', error);
            return defaultValue;
        }
    }

    /**
     * Elimina datos
     * @param {string} key - Clave a eliminar
     * @returns {boolean} - Verdadero si se eliminó
     */
    static remove(key) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const sanitizedKey = SecurityUtils.sanitizeAttribute(CONFIG.STORAGE_PREFIX + key);
            localStorage.removeItem(sanitizedKey);
            return true;
        } catch (error) {
            console.error('Error eliminando datos:', error);
            return false;
        }
    }

    /**
     * Obtiene todas las claves que coinciden con un patrón
     * @param {string} pattern - Patrón a buscar
     * @returns {Array} - Array de claves
     */
    static getKeysMatching(pattern) {
        if (!this.isAvailable()) {
            return [];
        }

        const keys = [];
        const fullPattern = CONFIG.STORAGE_PREFIX + pattern;
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes(fullPattern)) {
                    keys.push(key.replace(CONFIG.STORAGE_PREFIX, ''));
                }
            }
        } catch (error) {
            console.error('Error obteniendo claves:', error);
        }
        
        return keys;
    }

    /**
     * Limpia todos los datos de la aplicación
     * @returns {boolean} - Verdadero si se limpió correctamente
     */
    static clear() {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CONFIG.STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Error limpiando almacenamiento:', error);
            return false;
        }
    }

    /**
     * Crea respaldo completo de datos
     * @returns {Object} - Objeto con todos los datos
     */
    static createBackup() {
        if (!this.isAvailable()) {
            throw new Error('localStorage no está disponible');
        }

        const backup = {
            version: CONFIG.VERSION,
            timestamp: new Date().toISOString(),
            data: {}
        };

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CONFIG.STORAGE_PREFIX)) {
                    const cleanKey = key.replace(CONFIG.STORAGE_PREFIX, '');
                    backup.data[cleanKey] = JSON.parse(localStorage.getItem(key));
                }
            }
        } catch (error) {
            throw new Error('Error creando respaldo: ' + error.message);
        }

        return backup;
    }

    /**
     * Restaura desde respaldo
     * @param {Object} backup - Datos de respaldo
     * @returns {boolean} - Verdadero si se restauró correctamente
     */
    static restoreFromBackup(backup) {
        if (!this.isAvailable()) {
            throw new Error('localStorage no está disponible');
        }

        if (!backup || !backup.data) {
            throw new Error('Formato de respaldo inválido');
        }

        try {
            // Limpiar datos existentes
            this.clear();
            
            // Restaurar datos
            for (const [key, value] of Object.entries(backup.data)) {
                this.set(key, value);
            }
            
            return true;
        } catch (error) {
            throw new Error('Error restaurando respaldo: ' + error.message);
        }
    }
}