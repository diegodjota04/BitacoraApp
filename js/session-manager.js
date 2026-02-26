/**
 * Gestor de sesiones de clase
 */
class SessionManager {
    constructor(studentManager) {
        this.studentManager = studentManager;
        this.currentSession = null;
        this.autoSaveInterval = null;
        this.isDirty = false; // Indica si hay cambios sin guardar
    }

    /**
     * Crea nueva sesión
     * @param {string} grupo - Grupo de la sesión
     * @param {string} fecha - Fecha de la sesión
     * @param {string} startTime - Hora de inicio
     * @returns {boolean} - Verdadero si se creó correctamente
     */
    createSession(grupo, fecha, startTime) {
        try {
            // Validar datos
            const groupValidation = Validators.validateGroup(grupo);
            const dateValidation = Validators.validateDate(fecha);
            const timeValidation = Validators.validateTime(startTime);

            if (!groupValidation.valid) throw new Error(groupValidation.message);
            if (!dateValidation.valid) throw new Error(dateValidation.message);
            if (!timeValidation.valid) throw new Error(timeValidation.message);

            // Detener auto-guardado anterior si existe
            this.stopAutoSave();

            // Crear nueva sesión
            this.currentSession = {
                id: SecurityUtils.generateSecureId('session_'),
                grupo: groupValidation.value,
                fecha: dateValidation.value,
                startTime: timeValidation.value,
                students: {},
                lessonContent: '',
                planningComment: '',
                lessonProgress: '',
                observations: '',
                improvementProposals: '',
                activityTime: 'Adecuado',
                evaluation: {
                    activityAccessibility: 'De Acuerdo',
                    classMaterials: 'De Acuerdo',
                    physicalSpace: 'De Acuerdo',
                    studentInvolvement: 'Bueno',
                    studentAttitude: 'Bueno'
                },
                createdAt: new Date().toISOString(),
                lastSaved: null
            };

            // Inicializar estudiantes
            const studentsMap = this.studentManager.initializeStudentsForSession(grupo);
            this.currentSession.students = Object.fromEntries(studentsMap);

            // Cargar sesión existente si está disponible
            this.loadExistingSession();

            // Iniciar auto-guardado
            this.startAutoSave();

            this.isDirty = false;
            return true;
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.createSession');
            return false;
        }
    }

    /**
     * Carga sesión existente desde almacenamiento
     */
    loadExistingSession() {
        if (!this.currentSession) return;

        const sessionKey = `session_${this.currentSession.grupo}_${this.currentSession.fecha}`;
        const savedSession = StorageService.get(sessionKey);

        if (savedSession && savedSession.lastSaved) {
            // Fusionar datos guardados con sesión actual
            this.currentSession = { ...this.currentSession, ...savedSession };
            this.studentManager.loadStudentsData(this.currentSession.students);
        }
    }

    /**
     * Guarda sesión actual
     * @param {boolean} showNotification - Mostrar notificación de éxito
     * @returns {boolean} - Verdadero si se guardó correctamente
     */
    saveSession(showNotification = false) {
        if (!this.currentSession) {
            if (showNotification) errorHandler.handle(new Error('No hay sesión activa para guardar'), 'SessionManager.saveSession');
            return false;
        }

        try {
            // Actualizar datos de estudiantes desde el manager
            this.currentSession.students = this.studentManager.getCurrentStudentsData();
            this.currentSession.lastSaved = new Date().toISOString();

            const sessionKey = `session_${this.currentSession.grupo}_${this.currentSession.fecha}`;

            if (StorageService.set(sessionKey, this.currentSession)) {
                this.isDirty = false;

                // Actualizar estadísticas si hay referencia disponible
                window.bitacoraApp?.getComponent('statisticsManager')?.updateFromSession(this.currentSession);

                if (showNotification) {
                    errorHandler.showSuccess('Sesión guardada correctamente');
                }
                return true;
            } else {
                throw new Error('Error al guardar en almacenamiento');
            }
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.saveSession');
            return false;
        }
    }

    /**
     * Actualiza campo de la sesión
     * @param {string} field - Campo a actualizar
     * @param {any} value - Nuevo valor
     * @returns {boolean} - Verdadero si se actualizó
     */
    updateSessionField(field, value) {
        if (!this.currentSession) return false;

        try {
            // Validar campos específicos
            switch (field) {
                case 'lessonContent':
                case 'planningComment':
                case 'lessonProgress':
                case 'observations':
                case 'improvementProposals':
                    value = SecurityUtils.sanitizeInput(value, CONFIG.MAX_TEXT_LENGTH);
                    break;
                case 'activityTime':
                    if (!CONFIG.EVALUATION_OPTIONS.TIME.includes(value)) {
                        throw new Error('Valor de tiempo de actividad inválido');
                    }
                    break;
                default:
                    if (field.startsWith('evaluation.')) {
                        const evalField = field.split('.')[1];
                        if (!this.currentSession.evaluation.hasOwnProperty(evalField)) {
                            throw new Error('Campo de evaluación inválido');
                        }
                        this.currentSession.evaluation[evalField] = SecurityUtils.sanitizeInput(value, 50);
                        this.markDirty();
                        return true;
                    }
                    break;
            }

            this.currentSession[field] = value;
            this.markDirty();
            return true;
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.updateSessionField');
            return false;
        }
    }

    /**
     * Marca sesión como modificada
     */
    markDirty() {
        this.isDirty = true;
    }

    /**
     * Inicia auto-guardado
     */
    startAutoSave() {
        this.stopAutoSave(); // Detener cualquier intervalo previo

        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty && this.currentSession) {
                this.saveSession(false);
                console.log('Auto-guardado realizado:', new Date().toLocaleTimeString());
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
    }

    /**
     * Detiene auto-guardado
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    /**
     * Obtiene sesión actual
     * @returns {Object|null} - Sesión actual o null
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Verifica si hay cambios sin guardar
     * @returns {boolean} - Verdadero si hay cambios
     */
    hasUnsavedChanges() {
        return this.isDirty;
    }

    /**
     * Obtiene historial de sesiones
     * @returns {Array} - Array de sesiones
     */
    getSessionHistory() {
        try {
            const sessionKeys = StorageService.getKeysMatching('session_');
            const sessions = [];

            sessionKeys.forEach(key => {
                const session = StorageService.get(key);
                if (session && session.grupo && session.fecha) {
                    sessions.push({
                        id: session.id,
                        grupo: session.grupo,
                        fecha: session.fecha,
                        startTime: session.startTime,
                        lastSaved: session.lastSaved,
                        studentCount: Object.keys(session.students || {}).length,
                        presentCount: Object.values(session.students || {}).filter(s => s.estado === CONFIG.STUDENT_STATES.PRESENTE).length
                    });
                }
            });

            // Ordenar por fecha descendente
            return sessions.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.getSessionHistory');
            return [];
        }
    }

    /**
     * Carga sesión específica
     * @param {string} grupo - Grupo de la sesión
     * @param {string} fecha - Fecha de la sesión
     * @returns {boolean} - Verdadero si se cargó correctamente
     */
    loadSession(grupo, fecha) {
        try {
            const sessionKey = `session_${grupo}_${fecha}`;
            const savedSession = StorageService.get(sessionKey);

            if (!savedSession) {
                throw new Error('Sesión no encontrada');
            }

            // Validar sesión
            const validation = Validators.validateSessionData(savedSession);
            if (!validation.valid) {
                throw new Error('Datos de sesión inválidos: ' + Object.values(validation.errors).join(', '));
            }

            this.stopAutoSave();
            this.currentSession = savedSession;
            this.studentManager.loadStudentsData(savedSession.students);
            this.startAutoSave();
            this.isDirty = false;

            return true;
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.loadSession');
            return false;
        }
    }

    /**
     * Elimina sesión
     * @param {string} grupo - Grupo de la sesión
     * @param {string} fecha - Fecha de la sesión
     * @returns {boolean} - Verdadero si se eliminó correctamente
     */
    deleteSession(grupo, fecha) {
        try {
            const sessionKey = `session_${grupo}_${fecha}`;
            return StorageService.remove(sessionKey);
        } catch (error) {
            errorHandler.handle(error, 'SessionManager.deleteSession');
            return false;
        }
    }

    /**
     * Limpia sesión actual
     */
    clearCurrentSession() {
        this.stopAutoSave();
        this.currentSession = null;
        this.isDirty = false;
        this.studentManager.currentStudents.clear();
    }

    /**
     * Obtiene estadísticas de asistencia de la sesión actual
     * @returns {Object} - Estadísticas de asistencia
     */
    getCurrentAttendanceStats() {
        if (!this.currentSession || !this.currentSession.students) {
            return { presente: 0, ausente: 0, tarde: 0, total: 0 };
        }

        const stats = { presente: 0, ausente: 0, tarde: 0 };

        Object.values(this.currentSession.students).forEach(student => {
            stats[student.estado] = (stats[student.estado] || 0) + 1;
        });

        stats.total = stats.presente + stats.ausente + stats.tarde;
        return stats;
    }

    /**
     * Obtiene estudiantes con incidencias
     * @returns {Array} - Array de estudiantes con incidencias
     */
    getStudentsWithIncidents() {
        if (!this.currentSession || !this.currentSession.students) {
            return [];
        }

        return Object.entries(this.currentSession.students)
            .filter(([, student]) =>
                student.estado !== CONFIG.STUDENT_STATES.PRESENTE ||
                student.bano ||
                student.enfermeria ||
                student.otro ||
                student.comentarios?.length > 0
            )
            .map(([name, student]) => ({ name, ...student }));
    }

    /**
     * Destructor - limpia recursos
     */
    destroy() {
        this.stopAutoSave();
        this.currentSession = null;
        this.isDirty = false;
    }
}