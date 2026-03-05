/**
 * CryptoService — Cifrado AES-256-GCM para datos sensibles
 * Usa Web Crypto API (nativa del navegador, sin dependencias).
 * La clave se deriva de la contraseña con PBKDF2 y se guarda
 * en sessionStorage solo durante la sesión activa.
 */
const CryptoService = {

    SESSION_KEY_NAME: 'crypto_session_key',
    SALT_KEY_NAME: 'crypto_salt',

    // ─── Derivar clave AES desde la contraseña ────────────────────────────────
    /**
     * Deriva una clave AES-256-GCM a partir de la contraseña del usuario.
     * @param {string} password
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password) {
        const encoder = new TextEncoder();
        // Obtener o crear salt persistente (el mismo para el dispositivo)
        let saltB64 = localStorage.getItem(this.SALT_KEY_NAME);
        let salt;
        if (saltB64) {
            salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
        } else {
            salt = crypto.getRandomValues(new Uint8Array(16));
            localStorage.setItem(this.SALT_KEY_NAME, btoa(String.fromCharCode(...salt)));
        }

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // ─── Guardar clave de sesión ──────────────────────────────────────────────
    /**
     * Exporta la clave derivada y la guarda en sessionStorage.
     * @param {CryptoKey} key
     */
    async saveSessionKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key);
        const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
        sessionStorage.setItem(this.SESSION_KEY_NAME, b64);
    },

    /**
     * Recupera la clave AES desde sessionStorage.
     * @returns {Promise<CryptoKey|null>}
     */
    async getSessionKey() {
        const b64 = sessionStorage.getItem(this.SESSION_KEY_NAME);
        if (!b64) return null;
        try {
            const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        } catch {
            return null;
        }
    },

    /**
     * Indica si hay una clave de sesión disponible.
     */
    hasSessionKey() {
        return !!sessionStorage.getItem(this.SESSION_KEY_NAME);
    },

    /**
     * Limpia la clave de sesión al salir.
     */
    clearSessionKey() {
        sessionStorage.removeItem(this.SESSION_KEY_NAME);
    },

    // ─── Cifrado / Descifrado ─────────────────────────────────────────────────
    /**
     * Cifra un objeto JavaScript y devuelve un string base64 serializado.
     * @param {any} data
     * @param {CryptoKey} key
     * @returns {Promise<string>} — Prefijado con 'enc:' para identificar datos cifrados
     */
    async encrypt(data, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        // Empaquetar iv + ciphertext en base64
        const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.byteLength);
        return 'enc:' + btoa(String.fromCharCode(...combined));
    },

    /**
     * Descifra un string cifrado previamente con encrypt().
     * @param {string} encryptedStr
     * @param {CryptoKey} key
     * @returns {Promise<any>}
     */
    async decrypt(encryptedStr, key) {
        if (!encryptedStr.startsWith('enc:')) throw new Error('Datos no cifrados');
        const combined = Uint8Array.from(atob(encryptedStr.slice(4)), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(decrypted));
    },

    /**
     * Indica si un valor almacenado está cifrado.
     * @param {string} value
     * @returns {boolean}
     */
    isEncrypted(value) {
        return typeof value === 'string' && value.startsWith('enc:');
    },
};
