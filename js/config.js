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
    
    // Datos por defecto de grupos
    DEFAULT_GROUPS: {
        "9A": [
            "Ana García López", "Carlos Martínez Pérez", "María Rodríguez Silva",
            "José López García", "Carmen Sánchez Ruiz", "Pedro González Martín",
            "Laura Hernández López", "Miguel Torres Sánchez", "Isabel Moreno García",
            "Rafael Jiménez Pérez", "Elena Vargas Silva", "Fernando Castillo López"
        ],
        "9B": [
            "Sofía Ruiz Martínez", "Diego Morales García", "Valentina Castro López",
            "Andrés Herrera Silva", "Camila Romero Pérez", "Santiago Vega Martín",
            "Daniela Flores García", "Mateo Ramos López", "Gabriela Cruz Silva",
            "Nicolás Mendoza Pérez", "Andrea Guerrero García", "Sebastián Rojas López"
        ]
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
Object.freeze(CONFIG.DEFAULT_GROUPS);
Object.freeze(CONFIG.EVALUATION_OPTIONS);