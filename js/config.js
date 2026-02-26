/**
 * Configuración global del sistema
 */
const CONFIG = {
    // Configuración general
    VERSION: '2.0.0',
    APP_NAME: 'Bitácora Escolar',
    
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
        OTRO: 'otro'
    },
    
  
    
    // Opciones de evaluación
    EVALUATION_OPTIONS: {
        AGREEMENT: ['De Acuerdo', 'Parcialmente de acuerdo', 'Parcialmente en desacuerdo', 'En desacuerdo'],
        QUALITY: ['Excelente', 'Bueno', 'Regular', 'Deficiente'],
        TIME: ['Suficiente', 'Adecuado', 'Moderado', 'Insuficiente']
    }
};

// Congelar configuración para prevenir modificaciones
Object.freeze(CONFIG);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.STUDENT_STATES);
Object.freeze(CONFIG.COMMENT_TYPES);
// CONFIG.DEFAULT_GROUPS removed — groups are managed dynamically via StorageService
Object.freeze(CONFIG.EVALUATION_OPTIONS);