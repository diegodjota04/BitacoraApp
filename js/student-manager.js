/**
 * Gestor de estudiantes
 */
class StudentManager {
    constructor() {
        this.currentStudents = new Map();
        this.groups = new Map();
        this.loadGroups();
    }

    /**
     * Carga grupos desde almacenamiento únicamente (sin valores por defecto)
     */
    loadGroups() {
        try {
            const storedGroups = StorageService.get('groups');
            if (storedGroups && typeof storedGroups === 'object' && Object.keys(storedGroups).length > 0) {
                this.groups = new Map(Object.entries(storedGroups));
                console.log('Grupos cargados desde almacenamiento:', Object.keys(storedGroups));
            } else {
                // Sin grupos por defecto - empezar vacío
                this.groups = new Map();
                console.log('No hay grupos almacenados. Sistema iniciado sin grupos.');
            }
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.loadGroups');
            this.groups = new Map();
        }
    }



    /**
     * Guarda grupos en almacenamiento
     */
    saveGroups() {
        try {
            const groupsObject = Object.fromEntries(this.groups);
            StorageService.set('groups', groupsObject);
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.saveGroups');
            return false;
        }
    }

    /**
     * Obtiene lista de grupos
     * @returns {Array} - Array de nombres de grupos
     */
    getGroupNames() {
        return Array.from(this.groups.keys()).sort();
    }

    /**
     * Obtiene estudiantes de un grupo
     * @param {string} groupName - Nombre del grupo
     * @returns {Array} - Array de estudiantes
     */
    getStudentsInGroup(groupName) {
        const validation = Validators.validateGroup(groupName);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        return this.groups.get(validation.value) || [];
    }

    /**
     * Agrega nuevo grupo
     * @param {string} groupName - Nombre del grupo
     * @param {Array} students - Lista de estudiantes
     * @returns {boolean} - Verdadero si se agregó correctamente
     */
    addGroup(groupName, students) {
        try {
            const groupValidation = Validators.validateGroup(groupName);
            if (!groupValidation.valid) {
                throw new Error(groupValidation.message);
            }

            if (!Array.isArray(students) || students.length === 0) {
                throw new Error('Debe proporcionar una lista válida de estudiantes');
            }

            const validStudents = [];
            for (const student of students) {
                const studentValidation = Validators.validateStudentName(student);
                if (!studentValidation.valid) {
                    throw new Error(`Estudiante inválido: ${studentValidation.message}`);
                }
                validStudents.push(studentValidation.value);
            }

            this.groups.set(groupValidation.value, validStudents);
            return this.saveGroups();
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.addGroup');
            return false;
        }
    }

    /**
     * Elimina grupo
     * @param {string} groupName - Nombre del grupo
     * @returns {boolean} - Verdadero si se eliminó correctamente
     */
    removeGroup(groupName) {
        try {
            const validation = Validators.validateGroup(groupName);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            if (!this.groups.has(validation.value)) {
                throw new Error('El grupo no existe');
            }

            this.groups.delete(validation.value);
            return this.saveGroups();
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.removeGroup');
            return false;
        }
    }

    /**
     * Inicializa estudiantes para una sesión
     * @param {string} groupName - Nombre del grupo
     * @returns {Map} - Map de estudiantes con datos iniciales
     */
    initializeStudentsForSession(groupName) {
        try {
            const students = this.getStudentsInGroup(groupName);
            this.currentStudents.clear();

            students.forEach(studentName => {
                this.currentStudents.set(studentName, {
                    estado: CONFIG.STUDENT_STATES.PRESENTE,
                    bano: false,
                    enfermeria: false,
                    otro: false,
                    apoyosEducativos: false,
                    comentarios: []
                });
            });

            return this.currentStudents;
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.initializeStudentsForSession');
            return new Map();
        }
    }

    /**
     * Actualiza estado de estudiante
     * @param {string} studentName - Nombre del estudiante
     * @param {string} field - Campo a actualizar
     * @param {any} value - Nuevo valor
     * @returns {boolean} - Verdadero si se actualizó correctamente
     */
    updateStudentState(studentName, field, value) {
        try {
            const nameValidation = Validators.validateStudentName(studentName);
            if (!nameValidation.valid) {
                throw new Error(nameValidation.message);
            }

            if (!this.currentStudents.has(nameValidation.value)) {
                throw new Error('Estudiante no encontrado en la sesión actual');
            }

            const student = this.currentStudents.get(nameValidation.value);

            // Validar campo y valor
            switch (field) {
                case 'estado':
                    if (!Object.values(CONFIG.STUDENT_STATES).includes(value)) {
                        throw new Error('Estado inválido');
                    }
                    break;
                case 'bano':
                case 'enfermeria':
                case 'otro':
                case 'apoyosEducativos':
                    if (typeof value !== 'boolean') {
                        throw new Error('Valor debe ser verdadero o falso');
                    }
                    break;
                default:
                    throw new Error('Campo no válido: ' + field);
            }

            student[field] = value;
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.updateStudentState');
            return false;
        }
    }

    /**
     * Agrega comentario a estudiante
     * @param {string} studentName - Nombre del estudiante
     * @param {string} commentText - Texto del comentario
     * @param {string} type - Tipo de comentario
     * @returns {boolean} - Verdadero si se agregó correctamente
     */
    addStudentComment(studentName, commentText, type = CONFIG.COMMENT_TYPES.GENERAL) {
        try {
            const nameValidation = Validators.validateStudentName(studentName);
            if (!nameValidation.valid) {
                throw new Error(nameValidation.message);
            }

            const commentValidation = Validators.validateComment(commentText);
            if (!commentValidation.valid) {
                throw new Error(commentValidation.message);
            }

            if (!Object.values(CONFIG.COMMENT_TYPES).includes(type)) {
                throw new Error('Tipo de comentario inválido');
            }

            if (!this.currentStudents.has(nameValidation.value)) {
                throw new Error('Estudiante no encontrado en la sesión actual');
            }

            const student = this.currentStudents.get(nameValidation.value);
            const comment = {
                text: commentValidation.value,
                type: type,
                timestamp: new Date().toISOString(),
                id: SecurityUtils.generateSecureId('comment_')
            };

            student.comentarios.push(comment);
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.addStudentComment');
            return false;
        }
    }

    /**
     * Elimina comentario de estudiante
     * @param {string} studentName - Nombre del estudiante
     * @param {string} commentId - ID del comentario
     * @returns {boolean} - Verdadero si se eliminó correctamente
     */
    removeStudentComment(studentName, commentId) {
        try {
            const nameValidation = Validators.validateStudentName(studentName);
            if (!nameValidation.valid) {
                throw new Error(nameValidation.message);
            }

            if (!SecurityUtils.validateId(commentId)) {
                throw new Error('ID de comentario inválido');
            }

            if (!this.currentStudents.has(nameValidation.value)) {
                throw new Error('Estudiante no encontrado en la sesión actual');
            }

            const student = this.currentStudents.get(nameValidation.value);
            const commentIndex = student.comentarios.findIndex(c => c.id === commentId);

            if (commentIndex === -1) {
                throw new Error('Comentario no encontrado');
            }

            student.comentarios.splice(commentIndex, 1);
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.removeStudentComment');
            return false;
        }
    }

    /**
     * Obtiene datos de estudiantes actuales
     * @returns {Object} - Objeto con datos de estudiantes
     */
    getCurrentStudentsData() {
        return Object.fromEntries(this.currentStudents);
    }

    /**
     * Carga datos de estudiantes desde objeto
     * @param {Object} studentsData - Datos de estudiantes
     */
    loadStudentsData(studentsData) {
        try {
            this.currentStudents.clear();

            for (const [studentName, studentData] of Object.entries(studentsData)) {
                const nameValidation = Validators.validateStudentName(studentName);
                if (!nameValidation.valid) {
                    console.warn(`Estudiante inválido ignorado: ${studentName}`);
                    continue;
                }

                // Validar y sanitizar datos del estudiante
                const cleanStudentData = {
                    estado: Object.values(CONFIG.STUDENT_STATES).includes(studentData.estado)
                        ? studentData.estado
                        : CONFIG.STUDENT_STATES.PRESENTE,
                    bano: Boolean(studentData.bano),
                    enfermeria: Boolean(studentData.enfermeria),
                    otro: Boolean(studentData.otro),
                    apoyosEducativos: Boolean(studentData.apoyosEducativos),
                    comentarios: Array.isArray(studentData.comentarios)
                        ? studentData.comentarios.filter(comment => {
                            const validation = Validators.validateComment(comment.text);
                            return validation.valid;
                        })
                        : []
                };

                this.currentStudents.set(nameValidation.value, cleanStudentData);
            }
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.loadStudentsData');
        }
    }

    /**
     * Importa grupos desde datos externos
     * @param {Object} groupsData - Datos de grupos
     * @returns {boolean} - Verdadero si se importó correctamente
     */
    importGroups(groupsData) {
        try {
            const validation = Validators.validateImportedGroups(groupsData);
            if (!validation.valid) {
                throw new Error(validation.errors.join('\n'));
            }

            // Crear respaldo antes de importar
            const backup = this.createGroupsBackup();

            try {
                this.groups = new Map(Object.entries(validation.validGroups));

                if (this.saveGroups()) {
                    errorHandler.showSuccess(`Se importaron ${Object.keys(validation.validGroups).length} grupos correctamente`);
                    return true;
                } else {
                    throw new Error('Error guardando grupos importados');
                }
            } catch (importError) {
                // Restaurar respaldo en caso de error
                this.restoreGroupsFromBackup(backup);
                throw importError;
            }
        } catch (error) {
            errorHandler.handle(error, 'StudentManager.importGroups');
            return false;
        }
    }

    /**
     * Crea respaldo de grupos
     * @returns {Map} - Respaldo de grupos
     */
    createGroupsBackup() {
        return new Map(this.groups);
    }

    /**
     * Restaura grupos desde respaldo
     * @param {Map} backup - Respaldo de grupos
     */
    restoreGroupsFromBackup(backup) {
        this.groups = backup;
        this.saveGroups();
    }

    /**
     * Exporta grupos a objeto
     * @returns {Object} - Objeto con grupos
     */
    exportGroups() {
        return Object.fromEntries(this.groups);
    }
}