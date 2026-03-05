/**
 * Servicio de Autenticación — Bitácora Escolar
 * Usa SHA-256 (Web Crypto API) para hashear contraseñas.
 * Las credenciales se guardan en localStorage (hasheadas).
 * La sesión activa se guarda en sessionStorage.
 */
const AuthService = {

    // ─── Claves de almacenamiento ─────────────────────────────────────────────
    KEYS: {
        USERNAME: 'auth_username',
        PASS_HASH: 'auth_pass_hash',
        IS_CONFIGURED: 'auth_configured',
        FIRST_LOGIN: 'auth_first_login',
        SESSION_TOKEN: 'auth_session',
        SESSION_KEY: 'auth_session_key',
    },

    // ─── SHA-256 mediante Web Crypto API ──────────────────────────────────────
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ─── Generador de contraseña aleatoria ────────────────────────────────────
    generateRandomPassword(length = 10) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, b => chars[b % chars.length]).join('');
    },

    // ─── Estado ───────────────────────────────────────────────────────────────
    isConfigured() {
        return localStorage.getItem(this.KEYS.IS_CONFIGURED) === 'true';
    },

    isFirstLogin() {
        return localStorage.getItem(this.KEYS.FIRST_LOGIN) === 'true';
    },

    isAuthenticated() {
        const hasSession = sessionStorage.getItem(this.KEYS.SESSION_TOKEN) === 'authenticated';
        if (!hasSession) return false;
        // Verificar que la llave de sesión siga siendo válida
        const storedKey = localStorage.getItem(this.KEYS.SESSION_KEY);
        if (storedKey !== CONFIG.SESSION_KEY) {
            this.logout();
            return false;
        }
        return true;
    },

    getUsername() {
        return localStorage.getItem(this.KEYS.USERNAME) || '';
    },


    // ─── Provisionar nuevo usuario ────────────────────────────────────────────
    /**
     * Genera credenciales, las guarda (hasheadas) y envía el correo.
     * @param {string} email  Correo del usuario destino
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async provisionUser(email) {
        const { SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY } = CONFIG.EMAILJS;
        if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
            return { success: false, message: 'El servicio de correo no está configurado en el sistema.' };
        }

        const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const tempPassword = this.generateRandomPassword();

        try {
            emailjs.init({ publicKey: PUBLIC_KEY });

            await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                to_email: email,
                username: username,
                password: tempPassword,
                app_name: CONFIG.APP_NAME,
                app_version: CONFIG.VERSION,
            });

            const hash = await this.hashPassword(tempPassword);
            localStorage.setItem(this.KEYS.USERNAME, username);
            localStorage.setItem(this.KEYS.PASS_HASH, hash);
            localStorage.setItem(this.KEYS.IS_CONFIGURED, 'true');
            localStorage.setItem(this.KEYS.FIRST_LOGIN, 'true');

            return {
                success: true,
                message: `Credenciales enviadas a ${email}. Usuario: ${username}`
            };
        } catch (err) {
            console.error('[Auth] Error enviando correo:', err);
            return {
                success: false,
                message: `Error al enviar el correo. Verifique que la dirección sea correcta.`
            };
        }
    },

    // ─── Login ────────────────────────────────────────────────────────────────
    async login(username, password) {
        const storedUser = this.getUsername();
        const storedHash = localStorage.getItem(this.KEYS.PASS_HASH);

        if (!storedUser || !storedHash) {
            return { success: false, message: 'No hay usuario configurado.' };
        }

        if (username.trim().toLowerCase() !== storedUser.toLowerCase()) {
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }

        const hash = await this.hashPassword(password);
        if (hash !== storedHash) {
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }

        sessionStorage.setItem(this.KEYS.SESSION_TOKEN, 'authenticated');
        localStorage.setItem(this.KEYS.SESSION_KEY, CONFIG.SESSION_KEY);
        return { success: true, firstLogin: this.isFirstLogin() };
    },

    // ─── Cambio de contraseña ─────────────────────────────────────────────────
    async changePassword(currentPassword, newPassword) {
        const storedHash = localStorage.getItem(this.KEYS.PASS_HASH);
        const currentHash = await this.hashPassword(currentPassword);

        if (currentHash !== storedHash) {
            return { success: false, message: 'La contraseña actual es incorrecta.' };
        }

        if (newPassword.length < 8) {
            return { success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres.' };
        }

        const newHash = await this.hashPassword(newPassword);
        localStorage.setItem(this.KEYS.PASS_HASH, newHash);
        localStorage.setItem(this.KEYS.FIRST_LOGIN, 'false');
        return { success: true, message: 'Contraseña cambiada correctamente.' };
    },

    // ─── Logout ───────────────────────────────────────────────────────────────
    logout() {
        sessionStorage.removeItem(this.KEYS.SESSION_TOKEN);
    },
};
