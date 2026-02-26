/**
 * Servicio de almacenamiento seguro
 */
class StorageService {
    /**
     * Verifica si localStorage está disponible
     * @returns {boolean}
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
     * Itera solo las claves de esta app. Devuelve array de raw keys (con prefijo).
     * @private
     */
    static _appKeys() {
        return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter(key => key && key.startsWith(CONFIG.STORAGE_PREFIX));
    }

    /**
     * Obtiene el tamaño usado del almacenamiento
     * @returns {number} - Bytes utilizados
     */
    static getStorageSize() {
        try {
            return this._appKeys().reduce((total, key) => total + key.length + localStorage[key].length, 0);
        } catch (error) {
            console.error('Error calculando tamaño de almacenamiento:', error);
            return 0;
        }
    }

    /**
     * Verifica si hay espacio suficiente
     * @param {string} data - Datos a almacenar
     * @returns {boolean}
     */
    static hasSpace(data) {
        return (this.getStorageSize() + JSON.stringify(data).length) < CONFIG.MAX_STORAGE_SIZE;
    }

    /**
     * Guarda datos de forma segura
     * @param {string} key - Clave
     * @param {any} value - Valor a guardar
     * @returns {boolean}
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
     * @returns {any}
     */
    static get(key, defaultValue = null) {
        if (!this.isAvailable()) return defaultValue;

        try {
            const sanitizedKey = SecurityUtils.sanitizeAttribute(CONFIG.STORAGE_PREFIX + key);
            const item = localStorage.getItem(sanitizedKey);
            return item === null ? defaultValue : JSON.parse(item);
        } catch (error) {
            console.error('Error obteniendo datos del almacenamiento:', error);
            return defaultValue;
        }
    }

    /**
     * Elimina datos
     * @param {string} key - Clave a eliminar
     * @returns {boolean}
     */
    static remove(key) {
        if (!this.isAvailable()) return false;

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
     * Obtiene todas las claves que contienen el patrón dado (sin prefijo)
     * @param {string} pattern - Patrón a buscar
     * @returns {Array<string>}
     */
    static getKeysMatching(pattern) {
        if (!this.isAvailable()) return [];

        try {
            const fullPattern = CONFIG.STORAGE_PREFIX + pattern;
            return this._appKeys()
                .filter(key => key.includes(fullPattern))
                .map(key => key.replace(CONFIG.STORAGE_PREFIX, ''));
        } catch (error) {
            console.error('Error obteniendo claves:', error);
            return [];
        }
    }

    /**
     * Limpia todos los datos de la aplicación
     * @returns {boolean}
     */
    static clear() {
        if (!this.isAvailable()) return false;

        try {
            // Snapshot first to avoid mutation during iteration
            this._appKeys().forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Error limpiando almacenamiento:', error);
            return false;
        }
    }

    /**
     * Crea respaldo completo de datos
     * @returns {Object}
     */
    static createBackup() {
        if (!this.isAvailable()) {
            throw new Error('localStorage no está disponible');
        }

        try {
            const backup = {
                version: CONFIG.VERSION,
                timestamp: new Date().toISOString(),
                data: {}
            };

            this._appKeys().forEach(key => {
                const cleanKey = key.replace(CONFIG.STORAGE_PREFIX, '');
                backup.data[cleanKey] = JSON.parse(localStorage.getItem(key));
            });

            return backup;
        } catch (error) {
            throw new Error('Error creando respaldo: ' + error.message);
        }
    }

    /**
     * Restaura desde respaldo
     * @param {Object} backup - Datos de respaldo
     * @returns {boolean}
     */
    static restoreFromBackup(backup) {
        if (!this.isAvailable()) {
            throw new Error('localStorage no está disponible');
        }

        if (!backup || !backup.data) {
            throw new Error('Formato de respaldo inválido');
        }

        try {
            this.clear();
            for (const [key, value] of Object.entries(backup.data)) {
                this.set(key, value);
            }
            return true;
        } catch (error) {
            throw new Error('Error restaurando respaldo: ' + error.message);
        }
    }
}