/**
 * Gestor de interfaz de usuario
 */
class UIManager {
    constructor(studentManager, sessionManager, statisticsManager, pdfGenerator) {
        this.studentManager = studentManager;
        this.sessionManager = sessionManager;
        this.statisticsManager = statisticsManager;
        this.pdfGenerator = pdfGenerator;
        
        this.elements = new Map();
        this.modals = new Map();
        this.debounceTimers = new Map();
        
        this.initializeElements();
        this.bindEvents();
    }

    /**
     * Inicializa elementos de la interfaz
     */
    initializeElements() {
        const elementIds = [
            'groupSelect', 'classDate', 'startTime', 'sessionInfo',
            'currentSession', 'studentCount', 'dynamicContent', 'actionButtons'
        ];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        });
    }

    /**
     * Enlaza eventos de la interfaz
     */
    bindEvents() {
        this.bindControlEvents();
        this.bindButtonEvents();
        this.bindGlobalEvents();
    }

    /**
     * Enlaza eventos de controles principales
     */
    bindControlEvents() {
        const groupSelect = this.elements.get('groupSelect');
        const classDate = this.elements.get('classDate');
        const startTime = this.elements.get('startTime');

        if (groupSelect) {
            groupSelect.addEventListener('change', (e) => {
                errorHandler.clearFieldError('groupSelect');
                this.handleGroupChange(e.target.value);
            });
        }

        if (classDate) {
            classDate.addEventListener('change', (e) => {
                errorHandler.clearFieldError('classDate');
                this.handleDateChange(e.target.value);
            });
        }

        if (startTime) {
            startTime.addEventListener('change', (e) => {
                errorHandler.clearFieldError('startTime');
                this.handleTimeChange(e.target.value);
            });
        }
    }

    /**
     * Enlaza eventos de botones
     */
    bindButtonEvents() {
        const buttonEvents = [
            { id: 'btn-statistics', handler: () => this.showStatistics() },
            { id: 'btn-history', handler: () => this.showHistory() },
            { id: 'btn-config', handler: () => this.showConfig() },
            { id: 'btn-pdf', handler: () => this.generatePDF() },
            { id: 'btn-save', handler: () => this.saveSession() },
            { id: 'btn-help', handler: () => this.showHelp() }
        ];

        buttonEvents.forEach(({ id, handler }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.setLoading(button, true);
                    
                    try {
                        handler();
                    } finally {
                        setTimeout(() => this.setLoading(button, false), 100);
                    }
                });
            }
        });
    }

    /**
     * Enlaza eventos globales
     */
    bindGlobalEvents() {
        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveSession();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.generatePDF();
                        break;
                }
            }
        });

        // Limpiar errores al hacer foco
        document.addEventListener('focus', (e) => {
            if (e.target.classList.contains('form-control') || e.target.classList.contains('form-select')) {
                errorHandler.clearFieldError(e.target.id);
            }
        }, true);
    }

/**
     * Inicializa la aplicación
     */
    initialize() {
        this.loadGroups();
        this.setCurrentDateTime();
        
        // Verificar si hay grupos disponibles
        const groups = this.studentManager.getGroupNames();
        if (groups.length === 0) {
            this.showNoGroupsMessage();
        }
    }

    /**
     * Muestra mensaje cuando no hay grupos
     */
    showNoGroupsMessage() {
        const dynamicContent = this.elements.get('dynamicContent');
        if (dynamicContent) {
            dynamicContent.innerHTML = `
                <div class="glass-card mb-4">
                    <div class="card-header-custom">
                        <h5 class="mb-0"><i class="fas fa-info-circle"></i> Configuración Inicial Requerida</h5>
                    </div>
                    <div class="card-body p-4 text-center">
                        <p><strong>No hay grupos configurados en el sistema.</strong></p>
                        <p>Para comenzar a usar la bitácora, debe importar los grupos de estudiantes:</p>
                        <ol class="text-start">
                            <li>Haga clic en el botón "Config"</li>
                            <li>Seleccione "Importar Estudiantes desde JSON"</li>
                            <li>Cargue su archivo con la estructura de grupos y estudiantes</li>
                        </ol>
                        <button class="btn btn-primary-custom btn-custom mt-3" id="btn-open-config">
                            <i class="fas fa-cog"></i> Abrir Configuración
                        </button>
                    </div>
                </div>
            `;
            
            // Enlazar evento al botón
            document.getElementById('btn-open-config')?.addEventListener('click', () => {
                this.showConfig();
            });
        }
    }

/**
     * Carga grupos en el selector
     */
    loadGroups() {
        const groupSelect = this.elements.get('groupSelect');
        if (!groupSelect) return;

        try {
            const groups = this.studentManager.getGroupNames();
            groupSelect.innerHTML = '<option value="" selected disabled>Seleccione un grupo</option>';
            
            if (groups.length === 0) {
                groupSelect.innerHTML = '<option value="" disabled>No hay grupos configurados - Use Configuración</option>';
                return;
            }
            
            groups.forEach(grupo => {
                const option = document.createElement('option');
                option.value = SecurityUtils.sanitizeAttribute(grupo);
                option.textContent = SecurityUtils.escapeHtml(grupo);
                groupSelect.appendChild(option);
            });
        } catch (error) {
            errorHandler.handle(error, 'UIManager.loadGroups');
        }
    }

    /**
     * Establece fecha y hora actuales
     */
    setCurrentDateTime() {
        const today = new Date();
        
        const classDate = this.elements.get('classDate');
        if (classDate) {
            classDate.value = today.toISOString().split('T')[0];
        }

        const startTime = this.elements.get('startTime');
        if (startTime) {
            startTime.value = today.toTimeString().slice(0, 5);
        }
    }

    /**
     * Maneja eventos de cambio
     */
    handleGroupChange(grupo) {
        const fecha = this.elements.get('classDate')?.value;
        const startTime = this.elements.get('startTime')?.value;
        
        if (grupo && fecha && startTime) {
            this.createSession(grupo, fecha, startTime);
        }
    }

    handleDateChange(fecha) {
        const grupo = this.elements.get('groupSelect')?.value;
        const startTime = this.elements.get('startTime')?.value;
        
        if (grupo && fecha && startTime) {
            this.createSession(grupo, fecha, startTime);
        }
    }

    handleTimeChange(startTime) {
        const grupo = this.elements.get('groupSelect')?.value;
        const fecha = this.elements.get('classDate')?.value;
        
        if (grupo && fecha && startTime) {
            this.createSession(grupo, fecha, startTime);
        }
    }

    /**
     * Crea nueva sesión
     */
    createSession(grupo, fecha, startTime) {
        try {
            if (this.sessionManager.createSession(grupo, fecha, startTime)) {
                this.updateSessionInfo();
                this.showBasicInterface();
            }
        } catch (error) {
            errorHandler.handle(error, 'UIManager.createSession');
        }
    }

    /**
     * Actualiza información de sesión
     */
    updateSessionInfo() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        const currentSession = this.elements.get('currentSession');
        const studentCount = this.elements.get('studentCount');
        const sessionInfo = this.elements.get('sessionInfo');

        if (currentSession) {
            currentSession.textContent = `${session.grupo} - ${session.fecha}`;
        }

        if (studentCount) {
            studentCount.textContent = Object.keys(session.students).length;
        }

        if (sessionInfo) {
            sessionInfo.style.display = 'block';
        }
    }

/**
     * Muestra interfaz completa 
     */
    showBasicInterface() {
        const actionButtons = this.elements.get('actionButtons');
        if (actionButtons) {
            actionButtons.style.display = 'block';
        }

        this.renderStudentsTable();
        this.renderLessonForm();
        this.renderEvaluationForm();
        
        // Cargar datos guardados después de renderizar
        setTimeout(() => {
            this.loadSessionDataToUI();
        }, 100);
    }

    /**
     * Renderiza tabla de estudiantes
     */
    renderStudentsTable() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        const studentsHtml = this.generateStudentsTableHtml();
        this.updateDynamicContent('students', studentsHtml);
    }

    /**
     * Genera HTML de tabla de estudiantes con botones mejorados
     */
    generateStudentsTableHtml() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return '';

        let html = `
            <div class="glass-card mb-4 fade-in" id="studentsCard">
                <div class="card-header-custom">
                    <h5 class="mb-0"><i class="fas fa-users"></i> Lista de Estudiantes</h5>
                </div>
                <div class="card-body p-4">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 25%">Estudiante</th>
                                    <th style="width: 25%">Estado de Asistencia</th>
                                    <th style="width: 20%">Actividades Especiales</th>
                                    <th style="width: 30%">Comentarios</th>
                                </tr>
                            </thead>
                            <tbody>`;

        Object.entries(session.students).forEach(([studentName, studentData], index) => {
            const safeStudentName = SecurityUtils.escapeHtml(studentName);
            const studentId = SecurityUtils.generateSecureId('student');
            
            html += `
                <tr class="student-row">
                    <td class="fw-bold align-middle">${safeStudentName}</td>
                    <td class="align-middle">
                        <div class="btn-group-attendance" role="group" data-student="${SecurityUtils.sanitizeAttribute(studentName)}">
                            <button type="button" class="btn btn-attendance ${studentData.estado === 'presente' ? 'btn-success active' : 'btn-outline-success'}" 
                                    data-state="presente">
                                <i class="fas fa-check-circle"></i> Presente
                            </button>
                            <button type="button" class="btn btn-attendance ${studentData.estado === 'ausente' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                    data-state="ausente">
                                <i class="fas fa-times-circle"></i> Ausente
                            </button>
                            <button type="button" class="btn btn-attendance ${studentData.estado === 'tarde' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                    data-state="tarde">
                                <i class="fas fa-clock"></i> Tarde
                            </button>
                        </div>
                    </td>
                    <td class="align-middle">
                   <div class="btn-group-activities" data-student="${SecurityUtils.sanitizeAttribute(studentName)}">
                            <button type="button" class="btn btn-activity ${studentData.bano ? 'btn-info active' : 'btn-outline-info'}" 
                                    data-activity="bano" title="Salida al baño">
                                <i class="fas fa-restroom"></i>
                            </button>
                            <button type="button" class="btn btn-activity ${studentData.enfermeria ? 'btn-warning active' : 'btn-outline-warning'}" 
                                    data-activity="enfermeria" title="Visita a enfermería">
                                <i class="fas fa-plus-square"></i>
                            </button>
                            <button type="button" class="btn btn-activity ${studentData.otro ? 'btn-secondary active' : 'btn-outline-secondary'}" 
                                    data-activity="otro" title="Otra actividad">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </div>
                    </td>
                    <td class="align-middle">
                        <button class="btn btn-outline-primary btn-sm" data-student="${SecurityUtils.sanitizeAttribute(studentName)}" data-action="toggle-comment">
                            <i class="fas fa-comment-dots"></i> Comentar
                        </button>
                        <div class="comment-container" id="comments_${studentId}">
                            ${this.generateCommentsHtml(studentData.comentarios)}
                            <div class="mt-2">
                                <input type="text" class="form-control form-control-sm" 
                                       placeholder="Agregar comentario..." maxlength="${CONFIG.MAX_COMMENT_LENGTH}">
                                <button class="btn btn-primary btn-sm mt-1" data-action="save-comment" data-student="${SecurityUtils.sanitizeAttribute(studentName)}">
                                    <i class="fas fa-save"></i> Guardar
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>`;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        return html;
    }

    /**
     * Genera HTML de comentarios
     */
    generateCommentsHtml(comentarios) {
        if (!Array.isArray(comentarios) || comentarios.length === 0) {
            return '<div class="text-muted small">Sin comentarios</div>';
        }

        return comentarios.map(comment => {
            const safeText = SecurityUtils.escapeHtml(comment.text);
            const date = new Date(comment.timestamp).toLocaleString('es-ES');
            return `<div class="comment-item comment-${comment.type}">
                        <div>${safeText}</div>
                        <small class="text-muted">${date}</small>
                    </div>`;
        }).join('');
    }

    /**
     * Renderiza formulario de lección
     */
    renderLessonForm() {
        const lessonHtml = `
            <div class="glass-card mb-4 fade-in" id="lessonCard">
                <div class="card-header-custom">
                    <h5 class="mb-0"><i class="fas fa-book-open"></i> Detalles de la Lección</h5>
                </div>
                <div class="card-body p-4">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label fw-bold" for="lessonContent">Contenido de lección:</label>
                            <textarea id="lessonContent" class="form-control" rows="4" maxlength="1000" placeholder="Describa el contenido desarrollado en la clase..."></textarea>
                            <div class="form-text">Máximo 1000 caracteres</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold" for="planningComment">Comentario sobre la planificación:</label>
                            <textarea id="planningComment" class="form-control" rows="4" maxlength="1000" placeholder="Observaciones sobre la planificación realizada..."></textarea>
                            <div class="form-text">Máximo 1000 caracteres</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold" for="lessonProgress">Avances/obstáculos para el desarrollo de la lección:</label>
                            <textarea id="lessonProgress" class="form-control" rows="4" maxlength="1000" placeholder="Describa los avances logrados y obstáculos encontrados..."></textarea>
                            <div class="form-text">Máximo 1000 caracteres</div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-bold" for="observations">Observaciones generales:</label>
                            <textarea id="observations" class="form-control" rows="4" maxlength="1000" placeholder="Observaciones adicionales sobre la clase..."></textarea>
                            <div class="form-text">Máximo 1000 caracteres</div>
                        </div>
                        <div class="col-md-12">
                            <label class="form-label fw-bold" for="improvementProposals">Propuestas de mejora:</label>
                            <textarea id="improvementProposals" class="form-control" rows="4" maxlength="1000" placeholder="Sugerencias para mejorar futuras lecciones..."></textarea>
                            <div class="form-text">Máximo 1000 caracteres</div>
                        </div>
                    </div>
                </div>
            </div>`;

        this.updateDynamicContent('lesson', lessonHtml);
        this.bindFormEvents();
    }

 /**
     * Renderiza formulario de evaluación con 2 columnas (3 criterios cada una)
     */
    renderEvaluationForm() {
        const session = this.sessionManager.getCurrentSession();
        const evaluation = session?.evaluation || {};

        const evaluationHtml = `
            <div class="glass-card mb-4 fade-in" id="evaluationCard">
                <div class="card-header-custom">
                    <h5 class="mb-0"><i class="fas fa-star"></i> Evaluación de la Clase</h5>
                </div>
                <div class="card-body p-4">
                    <div class="row g-4">
                        <!-- Primera columna - 3 criterios -->
                        <div class="col-md-6">
                            <!-- Tiempo de Actividades -->
                            <label class="form-label fw-bold mb-3">El tiempo de las actividades fue:</label>
                            <div class="btn-group-evaluation mb-4" data-field="activityTime">
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Suficiente' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="Suficiente">
                                    <i class="fas fa-clock"></i> Suficiente
                                </button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Adecuado' ? 'btn-primary active' : 'btn-outline-primary'}" 
                                        data-value="Adecuado">
                                    <i class="fas fa-check-circle"></i> Adecuado
                                </button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Moderado' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Moderado">
                                    <i class="fas fa-exclamation-circle"></i> Moderado
                                </button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Insuficiente' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="Insuficiente">
                                    <i class="fas fa-times-circle"></i> Insuficiente
                                </button>
                            </div>

                            <!-- Actividades Accesibles -->
                            <label class="form-label fw-bold mb-3">Las actividades fueron accesibles:</label>
                            <div class="btn-group-evaluation mb-4" data-field="activityAccessibility">
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="De Acuerdo">
                                    <i class="fas fa-thumbs-up"></i> De Acuerdo
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" 
                                        data-value="Parcialmente de acuerdo">
                                    <i class="fas fa-adjust"></i> Parcial +
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Parcialmente en desacuerdo">
                                    <i class="fas fa-minus-circle"></i> Parcial -
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="En desacuerdo">
                                    <i class="fas fa-thumbs-down"></i> Desacuerdo
                                </button>
                            </div>

                            <!-- Materiales -->
                            <label class="form-label fw-bold mb-3">Los materiales fueron adecuados:</label>
                            <div class="btn-group-evaluation" data-field="classMaterials">
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="De Acuerdo">
                                    <i class="fas fa-thumbs-up"></i> De Acuerdo
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" 
                                        data-value="Parcialmente de acuerdo">
                                    <i class="fas fa-adjust"></i> Parcial +
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Parcialmente en desacuerdo">
                                    <i class="fas fa-minus-circle"></i> Parcial -
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="En desacuerdo">
                                    <i class="fas fa-thumbs-down"></i> Desacuerdo
                                </button>
                            </div>
                        </div>

                        <!-- Segunda columna - 3 criterios -->
                        <div class="col-md-6">
                            <!-- Espacio Físico -->
                            <label class="form-label fw-bold mb-3">El espacio físico fue adecuado:</label>
                            <div class="btn-group-evaluation mb-4" data-field="physicalSpace">
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="De Acuerdo">
                                    <i class="fas fa-thumbs-up"></i> De Acuerdo
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" 
                                        data-value="Parcialmente de acuerdo">
                                    <i class="fas fa-adjust"></i> Parcial +
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Parcialmente en desacuerdo">
                                    <i class="fas fa-minus-circle"></i> Parcial -
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="En desacuerdo">
                                    <i class="fas fa-thumbs-down"></i> Desacuerdo
                                </button>
                            </div>

                            <!-- Involucramiento -->
                            <label class="form-label fw-bold mb-3">Involucramiento de estudiantes:</label>
                            <div class="btn-group-evaluation mb-4" data-field="studentInvolvement">
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Excelente' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="Excelente">
                                    <i class="fas fa-star"></i> Excelente
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Bueno' ? 'btn-primary active' : 'btn-outline-primary'}" 
                                        data-value="Bueno">
                                    <i class="fas fa-thumbs-up"></i> Bueno
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Regular' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Regular">
                                    <i class="fas fa-meh"></i> Regular
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Deficiente' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="Deficiente">
                                    <i class="fas fa-frown"></i> Deficiente
                                </button>
                            </div>

                            <!-- Actitud General -->
                            <label class="form-label fw-bold mb-3">Actitud general de estudiantes:</label>
                            <div class="btn-group-evaluation" data-field="studentAttitude">
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Excelente' ? 'btn-success active' : 'btn-outline-success'}" 
                                        data-value="Excelente">
                                    <i class="fas fa-star"></i> Excelente
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Bueno' ? 'btn-primary active' : 'btn-outline-primary'}" 
                                        data-value="Bueno">
                                    <i class="fas fa-thumbs-up"></i> Bueno
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Regular' ? 'btn-warning active' : 'btn-outline-warning'}" 
                                        data-value="Regular">
                                    <i class="fas fa-meh"></i> Regular
                                </button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Deficiente' ? 'btn-danger active' : 'btn-outline-danger'}" 
                                        data-value="Deficiente">
                                    <i class="fas fa-frown"></i> Deficiente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        this.updateDynamicContent('evaluation', evaluationHtml);
        this.bindEvaluationEvents();
    }

    /**
     * Actualiza contenido dinámico
     */
    updateDynamicContent(section, html) {
        const container = this.elements.get('dynamicContent');
        if (!container) return;

        let sectionElement = container.querySelector(`[data-section="${section}"]`);
        if (!sectionElement) {
            sectionElement = document.createElement('div');
            sectionElement.setAttribute('data-section', section);
            container.appendChild(sectionElement);
        }

        sectionElement.innerHTML = html;
        
        if (section === 'students') {
            this.bindDynamicEvents(sectionElement);
        }
    }

    /**
     * Establece estado de carga
     */
    setLoading(element, loading) {
        if (loading) {
            element.classList.add('loading');
            element.disabled = true;
        } else {
            element.classList.remove('loading');
            element.disabled = false;
        }
    }

    /**
     * Acciones de botones
     */
    showStatistics() {
        alert('Estadísticas: Función disponible cuando se complete el módulo de interfaz completa');
    }

    showHistory() {
        alert('Historial: Función disponible cuando se complete el módulo de interfaz completa');
    }

    /**
     * Muestra configuración
     */
    showConfig() {
        const modalHtml = `
            <div class="modal fade" id="configModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-cog"></i> Configuración del Sistema</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-grid gap-2">
                                <h6 class="text-muted border-bottom pb-2">
                                    <i class="fas fa-users"></i> Gestión de Estudiantes
                                </h6>
                                <button class="btn btn-outline-primary" id="config-import">
                                    <i class="fas fa-upload"></i> Importar Estudiantes desde JSON
                                </button>
                                <button class="btn btn-outline-secondary" id="config-export">
                                    <i class="fas fa-download"></i> Exportar Lista Actual
                                </button>
                                
                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-tools"></i> Mantenimiento
                                </h6>
                                <button class="btn btn-outline-danger" id="config-reset">
                                    <i class="fas fa-eraser"></i> Reiniciar Formulario
                                </button>
                                <button class="btn btn-outline-success" id="config-backup">
                                    <i class="fas fa-save"></i> Crear Respaldo Completo
                                </button>
                                <button class="btn btn-outline-info" id="config-data-info">
                                    <i class="fas fa-folder"></i> ¿Dónde están mis datos?
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Eliminar modal existente
        const existingModal = document.getElementById('configModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Agregar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Enlazar eventos del modal
        this.bindConfigEvents();
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('configModal'));
        this.modals.set('config', modal);
        modal.show();
    }

    /**
     * Enlaza eventos de configuración
     */
    bindConfigEvents() {
        // Importar estudiantes
        document.getElementById('config-import')?.addEventListener('click', () => {
            this.importStudents();
        });

        // Exportar estudiantes
        document.getElementById('config-export')?.addEventListener('click', () => {
            this.exportStudents();
        });

        // Reiniciar formulario
        document.getElementById('config-reset')?.addEventListener('click', () => {
            this.resetForm();
        });

        // Crear respaldo
        document.getElementById('config-backup')?.addEventListener('click', () => {
            this.createBackup();
        });

        // Información de datos
        document.getElementById('config-data-info')?.addEventListener('click', () => {
            this.showDataInfo();
        });
    }

    /**
     * Importa estudiantes
     */
    importStudents() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (this.studentManager.importGroups(data)) {
                        this.loadGroups();
                        this.closeModal('config');
                    }
                } catch (error) {
                    errorHandler.handle(error, 'UIManager.importStudents');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    /**
     * Exporta estudiantes
     */
    exportStudents() {
        try {
            const groups = this.studentManager.exportGroups();
            const dataStr = JSON.stringify(groups, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'estudiantes_grupos.json';
            link.click();
            
            URL.revokeObjectURL(url);
            errorHandler.showSuccess('Grupos exportados correctamente');
        } catch (error) {
            errorHandler.handle(error, 'UIManager.exportStudents');
        }
    }

    /**
     * Reinicia formulario
     */
    resetForm() {
        if (confirm('¿Está seguro de que desea reiniciar el formulario actual?')) {
            this.sessionManager.clearCurrentSession();
            
            // Limpiar interfaz
            this.elements.get('groupSelect').value = '';
            this.setCurrentDateTime();
            
            const dynamicContent = this.elements.get('dynamicContent');
            if (dynamicContent) dynamicContent.innerHTML = '';
            
            const sessionInfo = this.elements.get('sessionInfo');
            if (sessionInfo) sessionInfo.style.display = 'none';
            
            const actionButtons = this.elements.get('actionButtons');
            if (actionButtons) actionButtons.style.display = 'none';
            
            errorHandler.showSuccess('Formulario reiniciado correctamente');
            this.closeModal('config');
        }
    }

    /**
     * Crea respaldo
     */
    createBackup() {
        try {
            const backup = StorageService.createBackup();
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `bitacora_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            errorHandler.showSuccess('Respaldo creado correctamente');
        } catch (error) {
            errorHandler.handle(error, 'UIManager.createBackup');
        }
    }

    /**
     * Muestra información de datos
     */
    showDataInfo() {
        const info = `
            Los datos se almacenan localmente en su navegador usando localStorage.
            
            Ubicación: Navegador web local
            Capacidad: Hasta 5MB
            Persistencia: Los datos persisten hasta que se limpie el navegador
            
            Para hacer respaldos, use la función "Crear Respaldo Completo".
        `;
        alert(info);
    }

    /**
     * Cierra modal
     */
    closeModal(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.hide();
            this.modals.delete(id);
        }
    }

    showHelp() {
        alert('Ayuda: Sistema v2.0 inicializado. Use Ctrl+S para guardar y Ctrl+P para PDF.');
    }

    generatePDF() {
            // Sincronizar campos antes de generar PDF
            this.syncLessonFields();
            
            // Pequeña pausa para asegurar que se guarde
            setTimeout(() => {
                this.pdfGenerator.generatePDF();
            }, 100);
        }

   saveSession() {
        console.log('=== INICIO GUARDADO ===');
        
        // 1. Forzar sincronización inmediata de todos los campos
        const session = this.sessionManager.getCurrentSession();
        if (!session) {
            errorHandler.showGlobalError('No hay sesión activa');
            return;
        }

        // 2. Leer y sincronizar campos de lección directamente
        const lessonFields = ['lessonContent', 'planningComment', 'lessonProgress', 'observations', 'improvementProposals'];
        
        lessonFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && element.value.trim()) {
                console.log(`Sincronizando ${fieldId}: "${element.value.substring(0, 50)}..."`);
                session[fieldId] = element.value;
            }
        });

        // 3. Sincronizar evaluación y tiempo
        const activityTime = document.getElementById('activityTime');
        if (activityTime) {
            session.activityTime = activityTime.value;
        }

        // 4. Forzar actualización de la sesión en el manager
        this.sessionManager.currentSession = session;
        this.sessionManager.markDirty();

        // 5. Guardar
        if (this.sessionManager.saveSession(true)) {
            // 6. Actualizar estadísticas
            this.statisticsManager.updateFromSession(session);
            console.log('=== GUARDADO EXITOSO ===');
        } else {
            console.log('=== ERROR EN GUARDADO ===');
        }
    }
    /**
     * Enlaza eventos dinámicos para estudiantes - SIN DUPLICADOS
     */
    bindDynamicEvents(container) {
        // IMPORTANTE: Remover eventos existentes primero
        container.querySelectorAll('.btn-attendance, .btn-activity').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // Re-seleccionar elementos después del clone
        const newContainer = document.querySelector('[data-section="students"]');

        // Eventos de botones de asistencia
        newContainer.querySelectorAll('.btn-attendance').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const group = e.target.closest('.btn-group-attendance');
                const studentName = group.dataset.student;
                const state = e.target.dataset.state;
                
                // Desactivar otros botones del grupo
                group.querySelectorAll('.btn-attendance').forEach(btn => {
                    btn.classList.remove('active');
                    btn.classList.remove('btn-success', 'btn-danger', 'btn-warning');
                    btn.classList.add(`btn-outline-${btn.dataset.state === 'presente' ? 'success' : btn.dataset.state === 'ausente' ? 'danger' : 'warning'}`);
                });
                
                // Activar botón seleccionado
                e.target.classList.add('active');
                e.target.classList.remove(`btn-outline-${state === 'presente' ? 'success' : state === 'ausente' ? 'danger' : 'warning'}`);
                e.target.classList.add(`btn-${state === 'presente' ? 'success' : state === 'ausente' ? 'danger' : 'warning'}`);
                
                this.updateStudentState(studentName, 'estado', state);
            });
        });

       // Eventos de botones de actividades - CORREGIDO PARA ÍCONOS
        newContainer.querySelectorAll('.btn-activity').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // SIEMPRE usar el botón, nunca el ícono
                const actualButton = e.currentTarget; // currentTarget siempre es el botón
                const studentName = actualButton.closest('.btn-group-activities').dataset.student;
                const activity = actualButton.getAttribute('data-activity');
                const isActive = actualButton.classList.contains('active');
                
                console.log('ÚNICO EVENTO - Student:', studentName, 'Activity:', activity, 'Current Active:', isActive);
                
                if (!activity) {
                    console.error('Activity is undefined for button:', actualButton);
                    return;
                }
                
                // Toggle estado del botón
                if (isActive) {
                    actualButton.classList.remove('active');
                } else {
                    actualButton.classList.add('active');
                }
                
                this.updateStudentState(studentName, activity, !isActive);
            });
        });

        // Eventos de comentarios
        newContainer.querySelectorAll('button[data-action="toggle-comment"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const studentName = e.target.dataset.student;
                this.toggleCommentContainer(studentName);
            });
        });

        newContainer.querySelectorAll('button[data-action="save-comment"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const studentName = e.target.dataset.student;
                const input = e.target.previousElementSibling;
                this.saveComment(studentName, input.value);
                input.value = '';
            });
        });

        newContainer.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const saveButton = e.target.nextElementSibling;
                    if (saveButton && saveButton.dataset.action === 'save-comment') {
                        saveButton.click();
                    }
                }
            });
        });
    }

    /**
     * Enlaza eventos de evaluación
     */
    bindEvaluationEvents() {
        document.querySelectorAll('.btn-evaluation').forEach(button => {
            button.addEventListener('click', (e) => {
                const group = e.target.closest('.btn-group-evaluation');
                const field = group.dataset.field;
                const value = e.target.dataset.value;
                
                // Desactivar otros botones del grupo
                group.querySelectorAll('.btn-evaluation').forEach(btn => {
                    btn.classList.remove('active');
                    const btnValue = btn.dataset.value;
                    const colorClass = this.getButtonColorClass(btnValue);
                    btn.classList.remove(`btn-${colorClass}`);
                    btn.classList.add(`btn-outline-${colorClass}`);
                });
                
                // Activar botón seleccionado
                const colorClass = this.getButtonColorClass(value);
                e.target.classList.add('active');
                e.target.classList.remove(`btn-outline-${colorClass}`);
                e.target.classList.add(`btn-${colorClass}`);
                
                // Actualizar campo de evaluación
                if (field === 'activityTime') {
                    this.updateSessionField(field, value);
                } else {
                    this.updateSessionField(`evaluation.${field}`, value);
                }
            });
        });
    }

    /**
     * Obtiene clase de color para botón según el valor
     */
    getButtonColorClass(value) {
        const colorMap = {
            'Excelente': 'success',
            'De Acuerdo': 'success',
            'Suficiente': 'success',
            'Bueno': 'primary',
            'Adecuado': 'primary',
            'Parcialmente de acuerdo': 'info',
            'Regular': 'warning',
            'Moderado': 'warning',
            'Parcialmente en desacuerdo': 'warning',
            'Deficiente': 'danger',
            'En desacuerdo': 'danger',
            'Insuficiente': 'danger'
        };
        return colorMap[value] || 'secondary';
    }

   /**
     * Enlaza eventos de formularios 
     */
    bindFormEvents() {
        // Campos de lección con debounce
        const lessonFields = ['lessonContent', 'planningComment', 'lessonProgress', 'observations', 'improvementProposals'];
        
        lessonFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.debouncedUpdateSession(fieldId, e.target.value);
                });
                
                element.addEventListener('blur', (e) => {
                    this.updateSessionField(fieldId, e.target.value);
                });
            }
        });

        // Campos de evaluación
        const evaluationFields = ['activityTime', 'activityAccessibility', 'classMaterials', 'physicalSpace', 'studentInvolvement', 'studentAttitude'];
        
        evaluationFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                // Los eventos ya se manejan en bindEvaluationEvents()
            }
        });
    }

    /**
     * Actualiza estado de estudiante
     */
    updateStudentState(studentName, field, value) {
        console.log('=== DEBUG updateStudentState ===');
        console.log('studentName:', studentName);
        console.log('field:', field);
        console.log('value:', value);
        console.log('typeof field:', typeof field);
        console.log('=== FIN DEBUG ===');
        
        if (this.studentManager.updateStudentState(studentName, field, value)) {
            this.sessionManager.markDirty();
            console.log(`Estado actualizado: ${studentName} - ${field}: ${value}`);
        }
    }

    /**
     * Alterna contenedor de comentarios
     */
    toggleCommentContainer(studentName) {
        // Buscar el contenedor de comentarios para este estudiante
        const containers = document.querySelectorAll('.comment-container');
        containers.forEach(container => {
            const button = container.parentElement.querySelector(`button[data-student="${studentName}"][data-action="toggle-comment"]`);
            if (button) {
                container.classList.toggle('show');
                if (container.classList.contains('show')) {
                    const input = container.querySelector('input[type="text"]');
                    if (input) input.focus();
                }
            }
        });
    }

    /**
     * Guarda comentario de estudiante
     */
    saveComment(studentName, commentText) {
        const validation = Validators.validateComment(commentText);
        if (!validation.valid) {
            errorHandler.showGlobalError(validation.message);
            return;
        }

        if (this.studentManager.addStudentComment(studentName, validation.value)) {
            this.sessionManager.markDirty();
            this.renderStudentsTable(); // Re-renderizar para mostrar el nuevo comentario
            errorHandler.showSuccess('Comentario agregado correctamente');
        }
    }

    /**
     * Actualiza campo de sesión con debounce
     */
    debouncedUpdateSession(field, value) {
        // Limpiar timer existente
        if (this.debounceTimers.has(field)) {
            clearTimeout(this.debounceTimers.get(field));
        }

        // Crear nuevo timer
        const timer = setTimeout(() => {
            this.updateSessionField(field, value);
        }, 500);

        this.debounceTimers.set(field, timer);
    }

    /**
     * Actualiza campo de sesión 
     */
    updateSessionField(field, value) {
        console.log(`Intentando actualizar campo: ${field} con valor:`, value);
        
        if (this.sessionManager.updateSessionField(field, value)) {
            console.log(`Campo ${field} actualizado exitosamente`);
        } else {
            console.error(`Error actualizando campo ${field}`);
        }
    }

    /**
     * Sincroniza todos los campos de lección manualmente
     */
    syncLessonFields() {
        const fields = ['lessonContent', 'planningComment', 'lessonProgress', 'observations', 'improvementProposals'];
        
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && element.value.trim()) {
                console.log(`Sincronizando ${fieldId}:`, element.value);
                this.updateSessionField(fieldId, element.value);
            }
        });
        
        // Forzar guardado después de sincronizar
        this.sessionManager.saveSession(false);
        console.log('Campos sincronizados y sesión guardada');
    }
    /**
     * Implementar las funciones de estadísticas e historial
     */
    showStatistics() {
        const stats = this.statisticsManager.getAllStatistics();
        this.showModal('statistics', 'Estadísticas Detalladas', this.generateStatisticsHtml(stats));
    }

    showHistory() {
        const history = this.sessionManager.getSessionHistory();
        this.showModal('history', 'Historial de Sesiones', this.generateHistoryHtml(history));
    }

    /**
     * Muestra modal 
     */
    showModal(id, title, content) {
        const modalHtml = `
            <div class="modal fade" id="modal-${id}" tabindex="-1">
                <div class="modal-dialog ${id === 'statistics' ? 'modal-xl' : 'modal-lg'}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${SecurityUtils.escapeHtml(title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Eliminar modal existente
        const existingModal = document.getElementById(`modal-${id}`);
        if (existingModal) {
            existingModal.remove();
        }

        // Agregar nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar modal y manejar eventos correctamente
        const modalElement = document.getElementById(`modal-${id}`);
        const modal = new bootstrap.Modal(modalElement);
        
        // Manejar evento de cierre para remover aria-hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
            this.modals.delete(id);
        });
        
        this.modals.set(id, modal);
        modal.show();
    }

    /**
     * Genera HTML de estadísticas
     */
    generateStatisticsHtml(stats) {
        console.log('Estadísticas recibidas:', stats);
        
        if (!stats || Object.keys(stats).length === 0) {
            return '<p class="text-muted">No hay estadísticas disponibles. Guarde algunos datos primero usando el botón "Guardar Datos".</p>';
        }

        let html = '';
        Object.entries(stats).forEach(([groupName, groupStats]) => {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0">Grupo ${SecurityUtils.escapeHtml(groupName)}</h6>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-primary">${groupStats.summary.totalEstudiantes}</h5>
                                    <small class="text-muted">Estudiantes</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-success">${groupStats.summary.promedioAsistencia.toFixed(1)}%</h5>
                                    <small class="text-muted">Asistencia</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-info">${groupStats.summary.totalSesiones}</h5>
                                    <small class="text-muted">Sesiones</small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <h5 class="text-warning">${groupStats.summary.totalAusentes}</h5>
                                    <small class="text-muted">Ausencias</small>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Estudiante</th>
                                        <th>Presente</th>
                                        <th>Ausente</th>
                                        <th>Tarde</th>
                                        <th>% Asistencia</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            Object.entries(groupStats.students).forEach(([studentName, studentStats]) => {
                const attendance = studentStats.totalSesiones > 0 
                    ? ((studentStats.presente / studentStats.totalSesiones) * 100).toFixed(1)
                    : 0;

                html += `
                    <tr>
                        <td>${SecurityUtils.escapeHtml(studentName)}</td>
                        <td><span class="badge bg-success">${studentStats.presente}</span></td>
                        <td><span class="badge bg-danger">${studentStats.ausente}</span></td>
                        <td><span class="badge bg-warning">${studentStats.tarde}</span></td>
                        <td>${attendance}%</td>
                    </tr>`;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
        });

        return html;
    }

    /**
     * Genera HTML de historial
     */
    generateHistoryHtml(history) {
        if (history.length === 0) {
            return '<p class="text-muted">No hay sesiones guardadas.</p>';
        }

        let html = '<div class="list-group">';
        history.forEach(session => {
            html += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${SecurityUtils.escapeHtml(session.grupo)} - ${session.fecha}</h6>
                        <small>${new Date(session.lastSaved).toLocaleString()}</small>
                    </div>
                    <p class="mb-1">
                        Hora: ${session.startTime} | 
                        Estudiantes: ${session.presentCount}/${session.studentCount} presentes
                    </p>
                </div>`;
        });
        html += '</div>';

        return html;
    }
    /**
     * Carga datos guardados en la interfaz
     */
    loadSessionDataToUI() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        // Cargar campos de lección
        const lessonFields = [
            'lessonContent', 'planningComment', 'lessonProgress', 
            'observations', 'improvementProposals', 'activityTime'
        ];

        lessonFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            const value = session[fieldId] || '';
            if (element && value) {
                element.value = value;
                console.log(`Cargado ${fieldId}:`, value);
            }
        });

        // Cargar campos de evaluación
        if (session.evaluation) {
            const evaluationFields = [
                'activityAccessibility', 'classMaterials', 'physicalSpace',
                'studentInvolvement', 'studentAttitude'
            ];

            evaluationFields.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                const value = session.evaluation[fieldId];
                if (element && value) {
                    element.value = value;
                }
            });
        }

        // Actualizar estado visual de botones de evaluación
        this.updateEvaluationButtons();
    }

    /**
     * Actualiza estado visual de botones de evaluación
     */
    updateEvaluationButtons() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        // Actualizar botones de tiempo de actividad
        document.querySelectorAll('[data-field="activityTime"] .btn-evaluation').forEach(btn => {
            const value = btn.dataset.value;
            const isActive = value === session.activityTime;
            
            btn.classList.toggle('active', isActive);
            
            const colorClass = this.getButtonColorClass(value);
            if (isActive) {
                btn.classList.remove(`btn-outline-${colorClass}`);
                btn.classList.add(`btn-${colorClass}`);
            } else {
                btn.classList.remove(`btn-${colorClass}`);
                btn.classList.add(`btn-outline-${colorClass}`);
            }
        });

        // Actualizar botones de evaluación
        if (session.evaluation) {
            Object.entries(session.evaluation).forEach(([field, value]) => {
                document.querySelectorAll(`[data-field="${field}"] .btn-evaluation`).forEach(btn => {
                    const btnValue = btn.dataset.value;
                    const isActive = btnValue === value;
                    
                    btn.classList.toggle('active', isActive);
                    
                    const colorClass = this.getButtonColorClass(btnValue);
                    if (isActive) {
                        btn.classList.remove(`btn-outline-${colorClass}`);
                        btn.classList.add(`btn-${colorClass}`);
                    } else {
                        btn.classList.remove(`btn-${colorClass}`);
                        btn.classList.add(`btn-outline-${colorClass}`);
                    }
                });
            });
        }
    }
    
}