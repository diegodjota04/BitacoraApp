/**
 * Configuración global del sistema
 */
const CONFIG = {
    // Configuración general
    VERSION: '2.3.1',
    APP_NAME: 'Bitácora Escolar',

    // Llave de sesión — cambiar este valor e intentar un push invalida TODAS las sesiones activas.
    // Formato sugerido: 'YYYY-MM-DD-vN' (ej: '2026-03-05-v2')
    SESSION_KEY: '2026-03-05-v1',

    // Intervalos y límites
    AUTO_SAVE_INTERVAL: 2 * 60 * 1000, // 2 minutos
    MAX_TEXT_LENGTH: 1000,
    MAX_COMMENT_LENGTH: 500,
    MAX_STUDENT_NAME_LENGTH: 100,

    // Almacenamiento
    STORAGE_PREFIX: 'bitacora_v2_',
    MAX_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB

    // Colores del sistema
    COLORS: {
        PRIMARY: [37, 99, 235],
        SECONDARY: [100, 116, 139],
        SUCCESS: [5, 150, 105],
        WARNING: [217, 119, 6],
        DANGER: [220, 38, 38],
        INFO: [8, 145, 178]
    },

    // Estados de estudiantes
    STUDENT_STATES: {
        PRESENTE: 'presente',
        AUSENTE: 'ausente',
        TARDE: 'tarde'
    },

    // Tipos de comentarios
    COMMENT_TYPES: {
        GENERAL: 'general',
        AUSENTE: 'ausente',
        TARDE: 'tarde',
        BANO: 'salidaBano',
        ENFERMERIA: 'enfermeria',
        OTRO: 'otro',
        APOYOS_EDUCATIVOS: 'apoyosEducativos'
    },



    // Opciones de evaluación
    EVALUATION_OPTIONS: {
        AGREEMENT: ['De Acuerdo', 'Parcialmente de acuerdo', 'Parcialmente en desacuerdo', 'En desacuerdo'],
        QUALITY: ['Excelente', 'Bueno', 'Regular', 'Deficiente'],
        TIME: ['Suficiente', 'Adecuado', 'Moderado', 'Insuficiente']
    },
    // EmailJS — configurado por el administrador del sistema
    // Las credenciales solo funcionan para enviar correos de aprovisionamiento de cuenta.
    EMAILJS: {
        SERVICE_ID: 'service_wzbibmf',
        TEMPLATE_ID: 'template_yawich7',
        PUBLIC_KEY: 'SYu9VRyENeB0YbYfT',
    },
};

// Congelar configuración para prevenir modificaciones
Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.STUDENT_STATES);
Object.freeze(CONFIG.COMMENT_TYPES);
Object.freeze(CONFIG.EVALUATION_OPTIONS);
Object.freeze(CONFIG.EMAILJS);
// SESSION_KEY no se congela para permitir comparación dinámica
