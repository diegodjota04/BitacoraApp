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
            { id: 'btn-save', handler: () => this.saveSession() }
            // btn-help es manejado globalmente en app.js (funciona antes y después del login)
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
        this.loadTeacherName();

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
            document.getElementById('btn-open-config')?.addEventListener('click', () => {
                this.showConfig();
            });
        }
    }

    /**
     * Carga grupos en el selector, filtrando por grupos visibles
     */
    loadGroups() {
        const groupSelect = this.elements.get('groupSelect');
        if (!groupSelect) return;

        try {
            const allGroups = this.studentManager.getGroupNames();
            const visibleGroups = StorageService.get('visible_groups', null);
            // Si no hay configuración guardada => mostrar todos
            const groups = (visibleGroups && visibleGroups.length > 0)
                ? allGroups.filter(g => visibleGroups.includes(g))
                : allGroups;

            groupSelect.innerHTML = '<option value="" selected disabled>Seleccione un grupo</option>';

            if (allGroups.length === 0) {
                groupSelect.innerHTML = '<option value="" disabled>No hay grupos configurados - Use Configuración</option>';
                return;
            }

            if (groups.length === 0) {
                groupSelect.innerHTML = '<option value="" disabled>Ningún grupo habilitado — Active grupos en Configuración</option>';
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
     * Intenta crear sesión si los 3 campos requeridos tienen valor.
     * Usado por los 3 manejadores de cambio de grupo/fecha/hora.
     */
    _tryCreateSession() {
        const grupo = this.elements.get('groupSelect')?.value;
        const fecha = this.elements.get('classDate')?.value;
        const startTime = this.elements.get('startTime')?.value;
        if (grupo && fecha && startTime) {
            this.createSession(grupo, fecha, startTime);
        }
    }

    handleGroupChange() { this._tryCreateSession(); }
    handleDateChange() { this._tryCreateSession(); }
    handleTimeChange() { this._tryCreateSession(); }

    /**
     * Crea nueva sesión (async por el cifrado de datos)
     */
    async createSession(grupo, fecha, startTime) {
        try {
            if (await this.sessionManager.createSession(grupo, fecha, startTime)) {
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

        if (currentSession) currentSession.textContent = `${session.grupo} - ${session.fecha}`;
        if (studentCount) studentCount.textContent = Object.keys(session.students).length;
        if (sessionInfo) sessionInfo.style.display = 'block';
    }

    /**
     * Muestra interfaz completa
     */
    showBasicInterface() {
        const actionButtons = this.elements.get('actionButtons');
        if (actionButtons) actionButtons.style.display = 'block';

        this.renderStudentsTable();
        this.renderLessonForm();
        this.renderEvaluationForm();

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
     * Genera HTML de tabla de estudiantes
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

        Object.entries(session.students).forEach(([studentName, studentData]) => {
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
                            <button type="button" class="btn btn-activity ${studentData.apoyosEducativos ? 'btn-purple active' : 'btn-outline-purple'}"
                                    data-activity="apoyosEducativos" title="Apoyos Educativos">
                                <i class="fas fa-hands-helping"></i>
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
     * Renderiza formulario de evaluación con 2 columnas
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
                        <div class="col-md-6">
                            <label class="form-label fw-bold mb-3">El tiempo de las actividades fue:</label>
                            <div class="btn-group-evaluation mb-4" data-field="activityTime">
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Suficiente' ? 'btn-success active' : 'btn-outline-success'}" data-value="Suficiente"><i class="fas fa-clock"></i> Suficiente</button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Adecuado' ? 'btn-primary active' : 'btn-outline-primary'}" data-value="Adecuado"><i class="fas fa-check-circle"></i> Adecuado</button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Moderado' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Moderado"><i class="fas fa-exclamation-circle"></i> Moderado</button>
                                <button type="button" class="btn btn-evaluation ${session?.activityTime === 'Insuficiente' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="Insuficiente"><i class="fas fa-times-circle"></i> Insuficiente</button>
                            </div>

                            <label class="form-label fw-bold mb-3">Las actividades fueron accesibles:</label>
                            <div class="btn-group-evaluation mb-4" data-field="activityAccessibility">
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" data-value="De Acuerdo"><i class="fas fa-thumbs-up"></i> De Acuerdo</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" data-value="Parcialmente de acuerdo"><i class="fas fa-adjust"></i> Parcial +</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Parcialmente en desacuerdo"><i class="fas fa-minus-circle"></i> Parcial -</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.activityAccessibility === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="En desacuerdo"><i class="fas fa-thumbs-down"></i> Desacuerdo</button>
                            </div>

                            <label class="form-label fw-bold mb-3">Los materiales fueron adecuados:</label>
                            <div class="btn-group-evaluation" data-field="classMaterials">
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" data-value="De Acuerdo"><i class="fas fa-thumbs-up"></i> De Acuerdo</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" data-value="Parcialmente de acuerdo"><i class="fas fa-adjust"></i> Parcial +</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Parcialmente en desacuerdo"><i class="fas fa-minus-circle"></i> Parcial -</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.classMaterials === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="En desacuerdo"><i class="fas fa-thumbs-down"></i> Desacuerdo</button>
                            </div>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label fw-bold mb-3">El espacio físico fue adecuado:</label>
                            <div class="btn-group-evaluation mb-4" data-field="physicalSpace">
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'De Acuerdo' ? 'btn-success active' : 'btn-outline-success'}" data-value="De Acuerdo"><i class="fas fa-thumbs-up"></i> De Acuerdo</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'Parcialmente de acuerdo' ? 'btn-info active' : 'btn-outline-info'}" data-value="Parcialmente de acuerdo"><i class="fas fa-adjust"></i> Parcial +</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'Parcialmente en desacuerdo' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Parcialmente en desacuerdo"><i class="fas fa-minus-circle"></i> Parcial -</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.physicalSpace === 'En desacuerdo' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="En desacuerdo"><i class="fas fa-thumbs-down"></i> Desacuerdo</button>
                            </div>

                            <label class="form-label fw-bold mb-3">Involucramiento de estudiantes:</label>
                            <div class="btn-group-evaluation mb-4" data-field="studentInvolvement">
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Excelente' ? 'btn-success active' : 'btn-outline-success'}" data-value="Excelente"><i class="fas fa-star"></i> Excelente</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Bueno' ? 'btn-primary active' : 'btn-outline-primary'}" data-value="Bueno"><i class="fas fa-thumbs-up"></i> Bueno</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Regular' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Regular"><i class="fas fa-meh"></i> Regular</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentInvolvement === 'Deficiente' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="Deficiente"><i class="fas fa-frown"></i> Deficiente</button>
                            </div>

                            <label class="form-label fw-bold mb-3">Actitud general de estudiantes:</label>
                            <div class="btn-group-evaluation" data-field="studentAttitude">
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Excelente' ? 'btn-success active' : 'btn-outline-success'}" data-value="Excelente"><i class="fas fa-star"></i> Excelente</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Bueno' ? 'btn-primary active' : 'btn-outline-primary'}" data-value="Bueno"><i class="fas fa-thumbs-up"></i> Bueno</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Regular' ? 'btn-warning active' : 'btn-outline-warning'}" data-value="Regular"><i class="fas fa-meh"></i> Regular</button>
                                <button type="button" class="btn btn-evaluation ${evaluation.studentAttitude === 'Deficiente' ? 'btn-danger active' : 'btn-outline-danger'}" data-value="Deficiente"><i class="fas fa-frown"></i> Deficiente</button>
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

    // =========================================================================
    // MENÚ CONFIGURACIÓN — incluye "Limpiar Todos los Datos" y "Ver Datos"
    // =========================================================================

    /**
     * Muestra modal de configuración
     */
    showConfig() {
        const savedName = StorageService.get('teacher_name', 'Diego Durán-Jiménez');

        // Construir checkboxes de grupos visibles
        const allGroups = this.studentManager.getGroupNames();
        const visibleGroups = StorageService.get('visible_groups', null);
        const groupsCheckboxHtml = allGroups.length === 0
            ? '<small class="text-muted">No hay grupos importados aún.</small>'
            : allGroups.map(g => {
                const checked = (!visibleGroups || visibleGroups.includes(g)) ? 'checked' : '';
                const safe = SecurityUtils.escapeHtml(g);
                const safeVal = SecurityUtils.sanitizeAttribute(g);
                return `<div class="form-check">
                    <input class="form-check-input config-group-check" type="checkbox"
                           id="grp-vis-${safeVal}" value="${safeVal}" ${checked}>
                    <label class="form-check-label" for="grp-vis-${safeVal}">${safe}</label>
                </div>`;
            }).join('');

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
                                    <i class="fas fa-chalkboard-teacher"></i> Información del Profesor
                                </h6>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-user-tie"></i></span>
                                    <input type="text" class="form-control" id="config-teacher-name"
                                        placeholder="Nombre del profesor" value="${savedName}"
                                        maxlength="100">
                                    <button class="btn btn-primary" id="config-save-teacher">
                                        <i class="fas fa-save"></i> Guardar
                                    </button>
                                </div>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-users"></i> Gestión de Estudiantes
                                </h6>
                                <button class="btn btn-outline-primary" id="config-import">
                                    <i class="fas fa-upload"></i> Importar Estudiantes desde JSON
                                </button>
                                <button class="btn btn-outline-secondary" id="config-export">
                                    <i class="fas fa-download"></i> Exportar Lista Actual
                                </button>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-eye"></i> Grupos Visibles en el Combobox
                                </h6>
                                <small class="text-muted mb-1">Seleccione cuáles grupos se mostrarán al docente. Si todos están marcados, se muestran todos.</small>
                                <div id="config-groups-checkboxes" class="ps-1">
                                    ${groupsCheckboxHtml}
                                </div>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-tools"></i> Mantenimiento
                                </h6>
                                <button class="btn btn-outline-danger" id="config-reset">
                                    <i class="fas fa-eraser"></i> Reiniciar Formulario Actual
                                </button>
                                <button class="btn btn-outline-success" id="config-backup">
                                    <i class="fas fa-save"></i> Crear Respaldo Completo
                                </button>
                                <button class="btn btn-outline-info" id="config-data-info">
                                    <i class="fas fa-folder"></i> Ver Datos Guardados
                                </button>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-trash-alt"></i> Zona de Peligro
                                </h6>
                                <button class="btn btn-danger" id="config-clear-all">
                                    <i class="fas fa-trash-alt"></i> Limpiar Todos los Datos
                                </button>
                                <small class="text-muted">
                                    ⚠️ Elimina sesiones, estadísticas y grupos. No se puede deshacer.
                                </small>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-history"></i> Historial de Sesiones
                                </h6>
                                <small class="text-muted mb-2 d-block">Guarde sus sesiones en un archivo para recuperarlas si se limpia el navegador o se actualiza la app.</small>
                                <button class="btn btn-outline-success" id="config-export-history">
                                    <i class="fas fa-file-export"></i> Exportar Historial
                                </button>
                                <button class="btn btn-outline-primary" id="config-import-history">
                                    <i class="fas fa-file-import"></i> Importar Historial
                                </button>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-file-pdf"></i> Prefijo para Archivos PDF
                                </h6>
                                <small class="text-muted mb-2 d-block">Se añade al inicio del nombre del PDF al descargarlo. Ejemplo: <code>7A</code> → <code>7A_Bitacora_...</code></small>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-folder"></i></span>
                                    <input type="text" class="form-control" id="config-pdf-folder"
                                        placeholder="Ej: Grupo7A" maxlength="30"
                                        value="${StorageService.get('pdf_folder', '')}">
                                    <button class="btn btn-primary" id="config-save-pdf-folder">
                                        <i class="fas fa-save"></i> Guardar
                                    </button>
                                </div>

                                <h6 class="text-muted border-bottom pb-2 mt-3">
                                    <i class="fas fa-lock"></i> Seguridad
                                </h6>
                                <button class="btn btn-outline-warning" id="config-change-password">
                                    <i class="fas fa-key"></i> Cambiar Contraseña
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('configModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.bindConfigEvents();

        const modal = new bootstrap.Modal(document.getElementById('configModal'));
        this.modals.set('config', modal);
        modal.show();
    }

    /**
     * Enlaza eventos del modal de configuración
     */
    bindConfigEvents() {
        const actions = [
            { id: 'config-import', handler: () => this.importStudents() },
            { id: 'config-export', handler: () => this.exportStudents() },
            { id: 'config-reset', handler: () => this.resetForm() },
            { id: 'config-backup', handler: () => this.createBackup() },
            { id: 'config-data-info', handler: () => this.showStoredDataModal() },
            { id: 'config-clear-all', handler: () => this.clearAllData() },
            { id: 'config-export-history', handler: () => this.exportHistory() },
            { id: 'config-import-history', handler: () => this.importHistory() },
            { id: 'config-change-password', handler: () => this.showChangePasswordModal() },
        ];
        actions.forEach(({ id, handler }) =>
            document.getElementById(id)?.addEventListener('click', handler)
        );

        // Guardar prefijo PDF
        document.getElementById('config-save-pdf-folder')?.addEventListener('click', () => {
            const val = (document.getElementById('config-pdf-folder')?.value || '').trim();
            StorageService.set('pdf_folder', val);
            errorHandler.showSuccess(val ? `Prefijo PDF guardado: "${val}"` : 'Prefijo PDF eliminado.');
        });

        document.getElementById('config-save-teacher')?.addEventListener('click', () => {
            const input = document.getElementById('config-teacher-name');
            const name = (input?.value || '').trim();
            if (!name) {
                errorHandler.showError('El nombre del profesor no puede estar vacío.');
                return;
            }
            StorageService.set('teacher_name', name);
            this.updateTeacherNameDisplay(name);
            errorHandler.showSuccess(`Nombre guardado: ${name}`);
        });

        // Grupos visibles — guardar en tiempo real al marcar/desmarcar
        const groupsContainer = document.getElementById('config-groups-checkboxes');
        if (groupsContainer) {
            groupsContainer.addEventListener('change', () => {
                const checked = Array.from(
                    groupsContainer.querySelectorAll('.config-group-check:checked')
                ).map(cb => cb.value);
                const allGroups = this.studentManager.getGroupNames();
                // Si todos están marcados, guardar null (sin filtro)
                if (checked.length === allGroups.length) {
                    StorageService.set('visible_groups', null);
                } else {
                    StorageService.set('visible_groups', checked);
                }
                this.loadGroups();
            });
        }
    }

    /**
     * Actualiza el nombre del profesor en el header
     * @param {string} name
     */
    updateTeacherNameDisplay(name) {
        const el = document.getElementById('teacherName');
        if (el) el.textContent = `Profesor ${name}`;
    }

    /**
     * Carga el nombre del profesor desde storage al iniciar
     */
    loadTeacherName() {
        const name = StorageService.get('teacher_name', null);
        if (name) this.updateTeacherNameDisplay(name);
    }

    /**
     * Limpia TODOS los datos guardados en localStorage
     */
    clearAllData() {
        const count = StorageService.getKeysMatching('').length;

        if (count === 0) {
            errorHandler.showGlobalError('No hay datos guardados para eliminar.');
            return;
        }

        this.showModal('confirm-clear', '⚠️ Limpiar Todos los Datos', `
            <p>Se eliminarán <strong>${count} elemento(s)</strong> guardados:</p>
            <ul>
                <li>Sesiones de clase guardadas</li>
                <li>Estadísticas de asistencia</li>
                <li>Grupos y listas de estudiantes</li>
                <li>Configuraciones guardadas</li>
            </ul>
            <p class="text-danger fw-bold">Esta acción no se puede deshacer.</p>
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-outline-secondary" id="confirm-backup-btn">Descargar respaldo antes</button>
                <button class="btn btn-danger" id="confirm-delete-btn">Eliminar ahora</button>
            </div>
        `);

        document.getElementById('confirm-backup-btn')?.addEventListener('click', () => {
            this.createBackup();
        });

        document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
            this.closeModal('confirm-clear');
            const cleaned = StorageService.clear();
            if (cleaned) {
                this.sessionManager.clearCurrentSession();
                this.elements.get('groupSelect') && (this.elements.get('groupSelect').value = '');
                this.setCurrentDateTime();
                ['dynamicContent'].forEach(k => { const el = this.elements.get(k); if (el) el.innerHTML = ''; });
                ['sessionInfo', 'actionButtons'].forEach(k => { const el = this.elements.get(k); if (el) el.style.display = 'none'; });
                this.loadGroups();
                this.closeModal('config');
                errorHandler.showSuccess(`Se eliminaron ${count} elemento(s). La aplicación fue reiniciada.`);
                this.showNoGroupsMessage();
            } else {
                errorHandler.showGlobalError('Error al limpiar los datos.');
            }
        });
    }

    /**
     * Muestra modal con lista de datos guardados en el navegador
     */
    showStoredDataModal() {
        const rawKeys = StorageService.getKeysMatching('');
        let totalSize = 0;

        const items = rawKeys.map(cleanKey => {
            const fullKey = CONFIG.STORAGE_PREFIX + cleanKey;
            const value = localStorage.getItem(fullKey) || '';
            const sizeBytes = fullKey.length + value.length;
            totalSize += sizeBytes;

            let label = cleanKey;
            let icon = '📄';
            let badge = 'secondary';

            if (cleanKey.startsWith('session_')) {
                const parts = cleanKey.replace('session_', '').split('_');
                label = `Sesión: ${parts[0]} del ${parts[1] || ''}`;
                icon = '📋';
                badge = 'primary';
            } else if (cleanKey === 'groups') {
                try {
                    const groups = JSON.parse(value);
                    const count = Object.values(groups).reduce((acc, arr) => acc + arr.length, 0);
                    label = `Grupos (${Object.keys(groups).length} grupos, ${count} estudiantes)`;
                } catch {
                    label = 'Grupos de estudiantes';
                }
                icon = '👥';
                badge = 'success';
            } else if (cleanKey === 'statistics') {
                icon = '📊';
                label = 'Estadísticas de asistencia';
                badge = 'info';
            } else if (cleanKey === 'errorLogs') {
                icon = '⚠️';
                label = 'Registro de errores';
                badge = 'warning';
            }

            return { key: cleanKey, label, icon, badge, size: sizeBytes };
        });

        const totalKB = (totalSize / 1024).toFixed(1);
        const maxKB = (5 * 1024).toFixed(0);
        const usagePercent = Math.min((totalSize / (5 * 1024 * 1024)) * 100, 100).toFixed(1);

        let listHtml = '';
        if (items.length === 0) {
            listHtml = '<p class="text-muted text-center py-3">No hay datos guardados.</p>';
        } else {
            listHtml = items.map(item => `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                        <span class="me-2">${item.icon}</span>
                        <span>${SecurityUtils.escapeHtml(item.label)}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <small class="text-muted">${(item.size / 1024).toFixed(1)} KB</small>
                        <span class="badge bg-${item.badge} text-truncate" style="max-width:100px" title="${item.key}">${item.key}</span>
                    </div>
                </div>
            `).join('');
        }

        const content = `
            <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <small>Espacio usado: <strong>${totalKB} KB</strong> de ${maxKB} KB</small>
                    <small>${usagePercent}%</small>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar ${usagePercent > 80 ? 'bg-danger' : 'bg-success'}"
                         style="width: ${usagePercent}%"></div>
                </div>
            </div>
            <div style="max-height: 350px; overflow-y: auto;">
                ${listHtml}
            </div>
            <div class="mt-3 text-muted">
                <small>Total: <strong>${items.length} elemento(s)</strong> guardado(s) en este navegador</small>
            </div>
        `;

        this.closeModal('config');
        this.showModal('data-info', '📁 Datos Guardados en Navegador', content);
    }

    // =========================================================================
    // GESTIÓN DE ESTUDIANTES
    // =========================================================================

    /**
     * Importa estudiantes desde JSON
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
     * Exporta estudiantes a JSON
     */
    exportStudents() {
        try {
            const groups = this.studentManager.exportGroups();
            const dataStr = JSON.stringify(groups, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
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
     * Reinicia formulario actual
     */
    resetForm() {
        this.showModal('confirm-reset', 'Reiniciar Formulario', `
            <p>¿Está seguro de que desea reiniciar el formulario actual?</p>
            <p class="text-muted">Los datos no guardados se perderán.</p>
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button class="btn btn-danger" id="confirm-reset-btn">Reiniciar</button>
            </div>
        `);

        document.getElementById('confirm-reset-btn')?.addEventListener('click', () => {
            this.closeModal('confirm-reset');
            this.sessionManager.clearCurrentSession();
            const groupSelect = this.elements.get('groupSelect');
            if (groupSelect) groupSelect.value = '';
            this.setCurrentDateTime();
            const dynamicContent = this.elements.get('dynamicContent');
            if (dynamicContent) dynamicContent.innerHTML = '';
            const sessionInfo = this.elements.get('sessionInfo');
            if (sessionInfo) sessionInfo.style.display = 'none';
            const actionButtons = this.elements.get('actionButtons');
            if (actionButtons) actionButtons.style.display = 'none';
            errorHandler.showSuccess('Formulario reiniciado correctamente');
            this.closeModal('config');
        });
    }

    /**
     * Crea respaldo completo
     */
    createBackup() {
        try {
            const backup = StorageService.createBackup();
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
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
     * Exporta solo el historial de sesiones a JSON
     */
    exportHistory() {
        try {
            StorageService.exportHistoryToFile();
            errorHandler.showSuccess('Historial exportado correctamente');
        } catch (error) {
            errorHandler.handle(error, 'UIManager.exportHistory');
        }
    }

    /**
     * Importa sesiones desde un JSON de historial
     */
    importHistory() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const jsonData = JSON.parse(ev.target.result);
                    const result = StorageService.importHistoryFromFile(jsonData);
                    errorHandler.showSuccess(
                        `Historial importado: ${result.imported} sesión(es) recuperada(s)` +
                        (result.skipped ? `, ${result.skipped} omitida(s) (ya existían).` : '.')
                    );
                } catch (err) {
                    errorHandler.handle(err, 'UIManager.importHistory');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Muestra modal para cambiar contraseña desde Config
     */
    showChangePasswordModal() {
        this.closeModal('config');
        this.showModal('change-password', '🔐 Cambiar Contraseña', `
            <div class="mb-3">
                <label class="form-label">Contraseña actual</label>
                <input type="password" id="modal-chpass-current" class="form-control" placeholder="••••••••">
            </div>
            <div class="mb-3">
                <label class="form-label">Nueva contraseña <small class="text-muted">(mín. 8 caracteres)</small></label>
                <input type="password" id="modal-chpass-new" class="form-control" placeholder="Nueva contraseña">
            </div>
            <div class="mb-3">
                <label class="form-label">Confirmar nueva contraseña</label>
                <input type="password" id="modal-chpass-confirm" class="form-control" placeholder="Repita la nueva contraseña">
            </div>
            <div id="modal-chpass-status" class="mb-2" style="display:none;"></div>
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button class="btn btn-warning" id="modal-btn-change-pass">
                    <i class="fas fa-key"></i> Cambiar Contraseña
                </button>
            </div>
        `);

        document.getElementById('modal-btn-change-pass')?.addEventListener('click', async () => {
            const current = document.getElementById('modal-chpass-current')?.value;
            const next = document.getElementById('modal-chpass-new')?.value;
            const confirm = document.getElementById('modal-chpass-confirm')?.value;
            const statusEl = document.getElementById('modal-chpass-status');

            if (!current || !next || !confirm) {
                if (statusEl) { statusEl.textContent = 'Complete todos los campos.'; statusEl.className = 'alert alert-danger'; statusEl.style.display = ''; }
                return;
            }
            if (next !== confirm) {
                if (statusEl) { statusEl.textContent = 'Las contraseñas nuevas no coinciden.'; statusEl.className = 'alert alert-danger'; statusEl.style.display = ''; }
                return;
            }
            const result = await AuthService.changePassword(current, next);
            if (result.success) {
                if (statusEl) { statusEl.textContent = '✅ ' + result.message; statusEl.className = 'alert alert-success'; statusEl.style.display = ''; }
                setTimeout(() => this.closeModal('change-password'), 1800);
            } else {
                if (statusEl) { statusEl.textContent = '❌ ' + result.message; statusEl.className = 'alert alert-danger'; statusEl.style.display = ''; }
            }
        });
    }

    /**
     * Cierra un modal por ID
     */
    closeModal(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.hide();
            this.modals.delete(id);
        }
    }

    showHelp() {
        const modalHtml = `
        <div class="modal fade" id="helpModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-book-open"></i> Manual de Usuario — Bitácora Escolar <span class="badge bg-secondary">${CONFIG.VERSION}</span></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="help-manual-body">

                        <!-- SECCIÓN 1 -->
                        <h6 class="text-primary border-bottom pb-1 mt-2"><i class="fas fa-sign-in-alt"></i> 1. Primer Acceso</h6>
                        <ol>
                            <li>Al abrir la app por primera vez, aparece la pantalla de <strong>Configuración Inicial</strong>.</li>
                            <li>Ingrese su <strong>correo institucional</strong> y presione <em>"Enviar credenciales"</em>.</li>
                            <li>Revise su correo: recibirá su <strong>nombre de usuario</strong> y una <strong>contraseña temporal</strong>.</li>
                            <li>Use esas credenciales para iniciar sesión en la pantalla de Login.</li>
                            <li>El sistema le pedirá <strong>establecer una nueva contraseña</strong> (mínimo 8 caracteres). Este paso es obligatorio.</li>
                        </ol>
                        <div class="alert alert-info py-2 small">💡 El <strong>usuario</strong> es la parte de su correo antes del @. Ej: <code>maria.gomez@colegio.cr</code> → usuario: <code>mariagomez</code></div>

                        <!-- SECCIÓN 2 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-cog"></i> 2. Configuración Inicial del Sistema</h6>
                        <p class="small">Antes de registrar clases, realice estos pasos en <strong>Config</strong>:</p>
                        <ol class="small">
                            <li><strong>Nombre del profesor:</strong> ingrese su nombre completo y presione <em>Guardar</em>. Aparecerá en el encabezado y en los PDFs.</li>
                            <li><strong>Importar estudiantes:</strong> cargue el archivo <code>.json</code> con los grupos y listas de estudiantes.</li>
                            <li><strong>Grupos visibles:</strong> seleccione cuáles grupos aparecen en el selector principal.</li>
                            <li><strong>Prefijo PDF</strong> (opcional): un código que se añade al nombre del archivo PDF descargado.</li>
                        </ol>

                        <!-- SECCIÓN 3 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-graduation-cap"></i> 3. Registrar una Clase</h6>
                        <ol class="small">
                            <li>En el <strong>Panel de Control</strong>, seleccione el <em>Grupo</em>, la <em>Fecha</em> y la <em>Hora de inicio</em>. La sesión se crea automáticamente.</li>
                            <li>En la <strong>Lista de Estudiantes</strong>, marque la asistencia de cada uno: <span class="badge bg-success">Presente</span> <span class="badge bg-danger">Ausente</span> <span class="badge bg-warning text-dark">Tarde</span>.</li>
                            <li>Use los botones de actividad para registrar eventos especiales:
                                <ul>
                                    <li>🚻 Baño &nbsp;|&nbsp; ➕ Enfermería &nbsp;|&nbsp; ⋯ Otra actividad &nbsp;|&nbsp; 🤝 Apoyos Educativos</li>
                                </ul>
                            </li>
                            <li>Al activar <em>Apoyos Educativos</em>, se pedirá un <strong>comentario obligatorio</strong>.</li>
                            <li>Complete los campos de la <strong>Lección</strong>: contenido, planificación, avances, observaciones y propuestas de mejora.</li>
                            <li>Evalúe la clase usando los botones de la sección <strong>Evaluación</strong>.</li>
                            <li>Presione <strong>Guardar Datos</strong> o use <kbd>Ctrl+S</kbd>.</li>
                        </ol>

                        <!-- SECCIÓN 4 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-file-pdf"></i> 4. Generar Bitácora PDF</h6>
                        <ol class="small">
                            <li>Con una sesión activa y datos completados, presione <strong>"Generar Bitácora PDF"</strong> o use <kbd>Ctrl+P</kbd>.</li>
                            <li>El PDF se descargará automáticamente con el nombre: <code>[Prefijo]_Bitacora_[Grupo]_[Fecha].pdf</code></li>
                        </ol>

                        <!-- SECCIÓN 5 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-history"></i> 5. Historial de Sesiones</h6>
                        <p class="small">Acceda con el botón <strong>Historial</strong> del Panel de Control.</p>
                        <ul class="small">
                            <li>Ver, recargar y generar PDF de sesiones anteriores.</li>
                            <li>Filtrar por grupo o rango de fechas.</li>
                        </ul>

                        <!-- SECCIÓN 6 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-chart-line"></i> 6. Estadísticas</h6>
                        <ul class="small">
                            <li>El botón <strong>Estadísticas</strong> muestra resúmenes de asistencia por estudiante y por grupo.</li>
                            <li>Se actualizan automáticamente al guardar cada sesión.</li>
                        </ul>

                        <!-- SECCIÓN 7 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-map-marked-alt"></i> 7. Mapa de Clase</h6>
                        <ul class="small">
                            <li><strong>Espejo de Clase:</strong> representación visual del aula con los estudiantes del grupo activo.</li>
                            <li><strong>Grupos Aleatorios:</strong> genere grupos de trabajo configurando el tamaño (2–6) y definiendo excepciones de estudiantes que no pueden agruparse.</li>
                        </ul>

                        <!-- SECCIÓN 8 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-save"></i> 8. Respaldo y Recuperación de Datos</h6>
                        <table class="table table-sm small">
                            <thead class="table-light"><tr><th>Acción</th><th>Dónde</th><th>Qué hace</th></tr></thead>
                            <tbody>
                                <tr><td>Exportar Historial</td><td>Config</td><td>Descarga todas las sesiones en <code>.json</code></td></tr>
                                <tr><td>Importar Historial</td><td>Config</td><td>Recupera sesiones desde un <code>.json</code> previo, sin sobreescribir</td></tr>
                                <tr><td>Crear Respaldo Completo</td><td>Config</td><td>Exporta todo el contenido del navegador</td></tr>
                                <tr><td>Exportar estudiantes</td><td>Config</td><td>Descarga la lista de grupos en <code>.json</code></td></tr>
                            </tbody>
                        </table>
                        <div class="alert alert-warning py-2 small">⚠️ Los datos se guardan <strong>solo en este navegador y dispositivo</strong>. Se recomienda exportar el historial regularmente y guardarlo en OneDrive o una unidad segura.</div>

                        <!-- SECCIÓN 9 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-lock"></i> 9. Seguridad y Contraseña</h6>
                        <ul class="small">
                            <li><strong>Cambiar contraseña:</strong> Config → Seguridad → Cambiar Contraseña.</li>
                            <li><strong>Cerrar sesión:</strong> botón <i class="fas fa-sign-out-alt"></i> en la esquina superior derecha.</li>
                            <li>Tras <strong>5 intentos fallidos</strong> de login, el acceso se bloquea por 30 segundos.</li>
                            <li>No instale la app en dispositivos compartidos o no institucionales.</li>
                        </ul>

                        <!-- SECCIÓN 10 -->
                        <h6 class="text-primary border-bottom pb-1 mt-3"><i class="fas fa-keyboard"></i> 10. Atajos de Teclado</h6>
                        <dl class="row small">
                            <dt class="col-sm-3"><kbd>Ctrl</kbd>+<kbd>S</kbd></dt><dd class="col-sm-9">Guardar sesión activa</dd>
                            <dt class="col-sm-3"><kbd>Ctrl</kbd>+<kbd>P</kbd></dt><dd class="col-sm-9">Generar PDF de la sesión</dd>
                        </dl>

                    </div>
                    <div class="modal-footer justify-content-between">
                        <button class="btn btn-outline-danger btn-sm" id="btn-download-manual-pdf">
                            <i class="fas fa-file-pdf"></i> Descargar Manual PDF
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>`;

        const existing = document.getElementById('helpModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('btn-download-manual-pdf')?.addEventListener('click', () => {
            this._generateHelpPDF();
        });

        const modal = new bootstrap.Modal(document.getElementById('helpModal'));
        this.modals.set('help', modal);
        modal.show();
    }

    /**
     * Genera y descarga el manual de usuario como PDF usando jsPDF
     */
    _generateHelpPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const margin = 15;
            const pageW = doc.internal.pageSize.getWidth();
            const maxW = pageW - margin * 2;
            let y = margin;

            // Función helper para añadir texto con salto de página automático
            const addLine = (text, opts = {}) => {
                const { size = 10, bold = false, color = [30, 30, 30], indent = 0, spacing = 5 } = opts;
                doc.setFontSize(size);
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setTextColor(...color);
                const lines = doc.splitTextToSize(text, maxW - indent);
                lines.forEach(line => {
                    if (y + spacing > doc.internal.pageSize.getHeight() - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, margin + indent, y);
                    y += spacing;
                });
            };

            const addSection = (title) => {
                y += 3;
                doc.setFillColor(37, 99, 235);
                doc.rect(margin, y - 4, maxW, 7, 'F');
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                doc.text(title, margin + 2, y);
                y += 6;
                doc.setTextColor(30, 30, 30);
            };

            // Portada
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, pageW, 45, 'F');
            doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
            doc.text('Bitácora Escolar', margin, 22);
            doc.setFontSize(13); doc.setFont('helvetica', 'normal');
            doc.text(`Manual de Usuario — v${CONFIG.VERSION}`, margin, 32);
            doc.setFontSize(9); doc.setTextColor(200, 220, 255);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-CR')}`, margin, 40);
            y = 55;
            doc.setTextColor(30, 30, 30);

            addSection('1. Primer Acceso');
            addLine('Al abrir la app por primera vez, ingrese su correo institucional y presione "Enviar credenciales".', { size: 9 });
            addLine('Revise su correo: recibirá su usuario (parte antes del @) y una contraseña temporal.', { size: 9 });
            addLine('Inicie sesión y establezca una nueva contraseña (mínimo 8 caracteres). Este paso es obligatorio.', { size: 9 });

            addSection('2. Configuración Inicial');
            addLine('En Config, realice estos pasos antes de registrar clases:', { size: 9 });
            addLine('• Ingrese su nombre completo y presione Guardar.', { size: 9, indent: 4 });
            addLine('• Importe el archivo .json con los grupos y listas de estudiantes.', { size: 9, indent: 4 });
            addLine('• Seleccione los grupos visibles en el selector del Panel de Control.', { size: 9, indent: 4 });

            addSection('3. Registrar una Clase');
            addLine('En el Panel de Control, seleccione Grupo, Fecha y Hora de inicio (la sesión se crea automáticamente).', { size: 9 });
            addLine('Marque la asistencia: Presente / Ausente / Tarde para cada estudiante.', { size: 9 });
            addLine('Use los botones de actividad para registrar: Baño, Enfermería, Otra actividad, Apoyos Educativos.', { size: 9 });
            addLine('Al activar Apoyos Educativos se le solicitará un comentario obligatorio.', { size: 9 });
            addLine('Complete los campos de la Lección y la Evaluación de la clase.', { size: 9 });
            addLine('Presione "Guardar Datos" o use Ctrl+S para guardar.', { size: 9 });

            addSection('4. Generar Bitácora PDF');
            addLine('Con una sesión activa, presione "Generar Bitácora PDF" o use Ctrl+P.', { size: 9 });
            addLine('El archivo se descargará con el nombre: [Prefijo]_Bitacora_[Grupo]_[Fecha].pdf', { size: 9 });

            addSection('5. Historial y Estadísticas');
            addLine('Botón "Historial": vea, recargue y genere PDF de sesiones anteriores.', { size: 9 });
            addLine('Botón "Estadísticas": resúmenes de asistencia por estudiante y por grupo.', { size: 9 });

            addSection('6. Mapa de Clase');
            addLine('Espejo de Clase: representación visual del aula con posiciones de estudiantes.', { size: 9 });
            addLine('Grupos Aleatorios: configure tamaño de grupos (2-6) y excepciones de agrupación.', { size: 9 });

            addSection('7. Respaldo y Recuperación');
            addLine('Exportar Historial → descarga todas las sesiones en .json (respaldo regular recomendado).', { size: 9 });
            addLine('Importar Historial → recupera sesiones desde un archivo previo sin sobreescribir los existentes.', { size: 9 });
            addLine('Crear Respaldo Completo → exporta todos los datos del navegador a un archivo .json.', { size: 9 });
            addLine('IMPORTANTE: Los datos solo existen en este dispositivo y navegador. Respalde regularmente en OneDrive.', { size: 9, color: [180, 60, 0] });

            addSection('8. Seguridad');
            addLine('Cambiar contraseña: Config → Seguridad → Cambiar Contraseña.', { size: 9 });
            addLine('Cerrar sesión: botón en la esquina superior derecha del encabezado.', { size: 9 });
            addLine('Tras 5 intentos fallidos de login, el acceso se bloquea 30 segundos.', { size: 9 });
            addLine('No instale la app en dispositivos compartidos o no institucionales.', { size: 9 });

            addSection('9. Atajos de Teclado');
            addLine('Ctrl + S    →   Guardar sesión activa', { size: 9 });
            addLine('Ctrl + P    →   Generar PDF de la sesión', { size: 9 });

            doc.save(`Manual_BitacoraEscolar_v${CONFIG.VERSION}.pdf`);
        } catch (err) {
            console.error('[Help] Error generando PDF del manual:', err);
            errorHandler.showGlobalError('No se pudo generar el PDF del manual.');
        }
    }


    /**
     * Genera PDF (sincroniza campos primero)
     */
    generatePDF() {
        this.syncLessonFields();
        setTimeout(() => {
            this.pdfGenerator.generatePDF();
        }, 100);
    }

    /**
     * Lee los campos del formulario de lección y los aplica a la sesión.
     * @private
     */
    _readLessonFieldsFromDom() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;
        ['lessonContent', 'planningComment', 'lessonProgress', 'observations', 'improvementProposals'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value.trim()) session[id] = el.value;
        });
        this.sessionManager.currentSession = session;
    }

    /**
     * Guarda sesión activa
     */
    saveSession() {
        if (!this.sessionManager.getCurrentSession()) {
            errorHandler.showGlobalError('No hay sesión activa');
            return;
        }
        this._readLessonFieldsFromDom();
        this.sessionManager.markDirty();
        if (this.sessionManager.saveSession(true)) {
            this.statisticsManager.updateFromSession(this.sessionManager.getCurrentSession());
        }
    }

    // =========================================================================
    // EVENTOS DINÁMICOS
    // =========================================================================

    /**
     * Enlaza eventos dinámicos para la tabla de estudiantes
     */
    bindDynamicEvents(container) {
        container.querySelectorAll('.btn-attendance, .btn-activity').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        const newContainer = document.querySelector('[data-section="students"]');

        newContainer.querySelectorAll('.btn-attendance').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const group = e.target.closest('.btn-group-attendance');
                const studentName = group.dataset.student;
                const state = e.target.dataset.state;

                group.querySelectorAll('.btn-attendance').forEach(btn => {
                    btn.classList.remove('active', 'btn-success', 'btn-danger', 'btn-warning');
                    btn.classList.add(`btn-outline-${btn.dataset.state === 'presente' ? 'success' : btn.dataset.state === 'ausente' ? 'danger' : 'warning'}`);
                });

                e.target.classList.add('active');
                e.target.classList.remove(`btn-outline-${state === 'presente' ? 'success' : state === 'ausente' ? 'danger' : 'warning'}`);
                e.target.classList.add(`btn-${state === 'presente' ? 'success' : state === 'ausente' ? 'danger' : 'warning'}`);

                this.updateStudentState(studentName, 'estado', state);
            });
        });

        newContainer.querySelectorAll('.btn-activity').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const actualButton = e.currentTarget;
                const studentName = actualButton.closest('.btn-group-activities').dataset.student;
                const activity = actualButton.getAttribute('data-activity');
                const isActive = actualButton.classList.contains('active');

                if (!activity) return;

                // Apoyos Educativos requiere comentario obligatorio
                if (activity === 'apoyosEducativos') {
                    if (isActive) {
                        // Toggle off
                        actualButton.classList.remove('active', 'btn-purple');
                        actualButton.classList.add('btn-outline-purple');
                        this.updateStudentState(studentName, 'apoyosEducativos', false);
                    } else {
                        // Abrir modal con comentario obligatorio
                        this.showApoyosModal(studentName, actualButton);
                    }
                    return;
                }

                if (isActive) {
                    actualButton.classList.remove('active');
                } else {
                    actualButton.classList.add('active');
                }

                this.updateStudentState(studentName, activity, !isActive);
            });
        });

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
     * Enlaza eventos de botones de evaluación
     */
    bindEvaluationEvents() {
        document.querySelectorAll('.btn-evaluation').forEach(button => {
            button.addEventListener('click', (e) => {
                const group = e.target.closest('.btn-group-evaluation');
                const field = group.dataset.field;
                const value = e.target.dataset.value;

                group.querySelectorAll('.btn-evaluation').forEach(btn => {
                    btn.classList.remove('active');
                    const colorClass = this.getButtonColorClass(btn.dataset.value);
                    btn.classList.remove(`btn-${colorClass}`);
                    btn.classList.add(`btn-outline-${colorClass}`);
                });

                const colorClass = this.getButtonColorClass(value);
                e.target.classList.add('active');
                e.target.classList.remove(`btn-outline-${colorClass}`);
                e.target.classList.add(`btn-${colorClass}`);

                if (field === 'activityTime') {
                    this.updateSessionField(field, value);
                } else {
                    this.updateSessionField(`evaluation.${field}`, value);
                }
            });
        });
    }

    /**
     * Devuelve clase de color Bootstrap según el valor de evaluación
     */
    getButtonColorClass(value) {
        const colorMap = {
            'Excelente': 'success', 'De Acuerdo': 'success', 'Suficiente': 'success',
            'Bueno': 'primary', 'Adecuado': 'primary',
            'Parcialmente de acuerdo': 'info',
            'Regular': 'warning', 'Moderado': 'warning', 'Parcialmente en desacuerdo': 'warning',
            'Deficiente': 'danger', 'En desacuerdo': 'danger', 'Insuficiente': 'danger'
        };
        return colorMap[value] || 'secondary';
    }

    /**
     * Enlaza eventos de formularios de lección
     */
    bindFormEvents() {
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
    }

    // =========================================================================
    // ACCIONES DE ESTUDIANTES
    // =========================================================================

    updateStudentState(studentName, field, value) {
        if (this.studentManager.updateStudentState(studentName, field, value)) {
            this.sessionManager.markDirty();
        }
    }

    /**
     * Muestra modal de Apoyos Educativos con comentario obligatorio
     * @param {string} studentName
     * @param {HTMLElement} button — botón que activó la acción
     */
    showApoyosModal(studentName, button) {
        const safeName = SecurityUtils.escapeHtml(studentName);
        const modalId = 'apoyos-modal';

        const modalHtml = `
            <div class="modal fade" id="apoyosModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-hands-helping"></i> Apoyo Educativo
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Estudiante: <strong>${safeName}</strong></p>
                            <label class="form-label fw-bold" for="apoyo-comment-input">
                                Describa el apoyo educativo aplicado: <span class="text-danger">*</span>
                            </label>
                            <textarea id="apoyo-comment-input" class="form-control" rows="4"
                                      maxlength="500" placeholder="Describa el apoyo educativo brindado al estudiante..."></textarea>
                            <div id="apoyo-error" class="text-danger small mt-1" style="display:none;">El comentario es obligatorio para registrar un apoyo educativo.</div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-primary" id="apoyo-confirm-btn">
                                <i class="fas fa-save"></i> Confirmar Apoyo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('apoyosModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const bsModal = new bootstrap.Modal(document.getElementById('apoyosModal'));
        this.modals.set(modalId, bsModal);
        bsModal.show();

        document.getElementById('apoyosModal').addEventListener('shown.bs.modal', () => {
            document.getElementById('apoyo-comment-input')?.focus();
        });

        document.getElementById('apoyo-confirm-btn')?.addEventListener('click', () => {
            const textarea = document.getElementById('apoyo-comment-input');
            const text = (textarea?.value || '').trim();
            const errorEl = document.getElementById('apoyo-error');
            if (!text) {
                errorEl.style.display = 'block';
                textarea?.focus();
                return;
            }
            errorEl.style.display = 'none';

            // Guardar comentario con tipo apoyosEducativos
            if (this.studentManager.addStudentComment(studentName, text, CONFIG.COMMENT_TYPES.APOYOS_EDUCATIVOS)) {
                this.updateStudentState(studentName, 'apoyosEducativos', true);
                // Marcar el botón visualmente
                button.classList.add('active', 'btn-purple');
                button.classList.remove('btn-outline-purple');
                this.sessionManager.markDirty();
                errorHandler.showSuccess(`Apoyo educativo registrado para ${studentName}`);
            }
            this.closeModal(modalId);
        });

        // Limpiar modal del DOM al cerrar
        document.getElementById('apoyosModal')?.addEventListener('hidden.bs.modal', () => {
            document.getElementById('apoyosModal')?.remove();
            this.modals.delete(modalId);
        });
    }

    toggleCommentContainer(studentName) {
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

    saveComment(studentName, commentText) {
        const validation = Validators.validateComment(commentText);
        if (!validation.valid) {
            errorHandler.showGlobalError(validation.message);
            return;
        }

        if (this.studentManager.addStudentComment(studentName, validation.value)) {
            this.sessionManager.markDirty();
            this.renderStudentsTable();
            errorHandler.showSuccess('Comentario agregado correctamente');
        }
    }

    // =========================================================================
    // CAMPOS DE SESIÓN
    // =========================================================================

    debouncedUpdateSession(field, value) {
        if (this.debounceTimers.has(field)) {
            clearTimeout(this.debounceTimers.get(field));
        }
        const timer = setTimeout(() => {
            this.updateSessionField(field, value);
        }, 500);
        this.debounceTimers.set(field, timer);
    }

    updateSessionField(field, value) {
        this.sessionManager.updateSessionField(field, value);
    }

    syncLessonFields() {
        this._readLessonFieldsFromDom();
        this.sessionManager.saveSession(false);
    }

    // =========================================================================
    // MODALES DE ESTADÍSTICAS E HISTORIAL
    // =========================================================================

    showStatistics() {
        const stats = this.statisticsManager.getAllStatistics();
        this.showModal('statistics', 'Estadísticas Detalladas', this.generateStatisticsHtml(stats));
    }

    showHistory() {
        const history = this.sessionManager.getSessionHistory();
        this.showModal('history', 'Historial de Sesiones', this.generateHistoryHtml(history));
    }

    /**
     * Muestra un modal genérico
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

        const existingModal = document.getElementById(`modal-${id}`);
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalElement = document.getElementById(`modal-${id}`);
        const modal = new bootstrap.Modal(modalElement);

        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
            this.modals.delete(id);
        });

        this.modals.set(id, modal);
        modal.show();
    }

    generateStatisticsHtml(stats) {
        if (!stats || Object.keys(stats).length === 0) {
            return '<p class="text-muted">No hay estadísticas disponibles. Guarde algunos datos primero.</p>';
        }

        let html = '';
        Object.entries(stats).forEach(([groupName, groupStats]) => {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0">Grupo ${SecurityUtils.escapeHtml(groupName)}</h6>
                    </div>
                    <div class="card-body">
                        <div class="row mb-2">
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 class="text-primary mb-0">${groupStats.summary.totalEstudiantes}</h5>
                                <small class="text-muted">Estudiantes</small>
                            </div>
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 class="text-success mb-0">${groupStats.summary.promedioAsistencia.toFixed(1)}%</h5>
                                <small class="text-muted">Asistencia</small>
                            </div>
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 class="text-info mb-0">${groupStats.summary.totalSesiones}</h5>
                                <small class="text-muted">Sesiones</small>
                            </div>
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 class="text-warning mb-0">${groupStats.summary.totalAusentes}</h5>
                                <small class="text-muted">Ausencias</small>
                            </div>
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 style="color:#06b6d4" class="mb-0">🚽 ${groupStats.summary.totalBano}</h5>
                                <small class="text-muted">Sal. Baño</small>
                            </div>
                            <div class="col-4 col-md-2 text-center mb-2">
                                <h5 style="color:#f97316" class="mb-0">🏥 ${groupStats.summary.totalEnfermeria}</h5>
                                <small class="text-muted">Sal. Enfermería</small>
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
                                        <th>🚽 Baño</th>
                                        <th>🏥 Enf.</th>
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
                        <td><span class="badge bg-warning text-dark">${studentStats.tarde}</span></td>
                        <td><span class="badge" style="background:#06b6d4">${studentStats.bano || 0}</span></td>
                        <td><span class="badge" style="background:#f97316">${studentStats.enfermeria || 0}</span></td>
                        <td>${attendance}%</td>
                    </tr>`;
            });

            html += `</tbody></table></div></div></div>`;
        });

        return html;
    }

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
                    <p class="mb-1">Hora: ${session.startTime} | Estudiantes: ${session.presentCount}/${session.studentCount} presentes</p>
                </div>`;
        });
        html += '</div>';
        return html;
    }

    // =========================================================================
    // CARGA DE DATOS GUARDADOS EN LA INTERFAZ
    // =========================================================================

    loadSessionDataToUI() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        const lessonFields = ['lessonContent', 'planningComment', 'lessonProgress', 'observations', 'improvementProposals'];
        lessonFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            const value = session[fieldId] || '';
            if (element && value) element.value = value;
        });

        if (session.evaluation) {
            const evaluationFields = ['activityAccessibility', 'classMaterials', 'physicalSpace', 'studentInvolvement', 'studentAttitude'];
            evaluationFields.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                const value = session.evaluation[fieldId];
                if (element && value) element.value = value;
            });
        }

        this.updateEvaluationButtons();
    }

    updateEvaluationButtons() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

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
