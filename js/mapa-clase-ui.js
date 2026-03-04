/**
 * ============================================================
 *  MAPA DE CLASE — Interfaz de Usuario
 *  Módulo: mapa-clase-ui.js
 *  Depende de: mapa-clase.js, studentManager (BitacoraApp)
 * ============================================================
 */
class MapaClaseUI {
    constructor() {
        this.espejo = null;
        this.grupos = null;
        this.currentGroup = null;
        this.activeTab = 'espejo';

        // Drag-and-drop state (Espejo)
        this._dragFrom = null;       // { type:'seat'|'unassigned', index, name }
        // Drag-and-drop state (Grupos)
        this._groupDrag = null;      // { studentName, groupIdx }
    }

    /* ══════════════════════════════════════════════════════
       INICIALIZACIÓN
    ══════════════════════════════════════════════════════ */

    /**
     * Crea e inyecta el overlay/modal en el DOM si no existe.
     */
    _ensureModalDOM() {
        if (document.getElementById('mc-overlay')) return;

        const el = document.createElement('div');
        el.id = 'mc-overlay';
        el.className = 'mc-overlay';
        el.innerHTML = `
<div class="mc-panel" role="dialog" aria-modal="true" aria-label="Mapa de Clase">

  <!-- Header -->
  <div class="mc-panel-header">
    <h2><i class="fas fa-map-marked-alt"></i> Mapa de Clase</h2>
    <button class="mc-close-btn" id="mc-close-btn" title="Cerrar">
      <i class="fas fa-times"></i>
    </button>
  </div>

  <!-- Tabs -->
  <div class="mc-tabs" role="tablist">
    <button class="mc-tab-btn active" id="mc-tab-espejo"
            role="tab" aria-selected="true" data-tab="espejo">
      <i class="fas fa-th"></i> Espejo de Clase
    </button>
    <button class="mc-tab-btn" id="mc-tab-grupos"
            role="tab" aria-selected="false" data-tab="grupos">
      <i class="fas fa-users"></i> Grupos Aleatorios
    </button>
  </div>

  <!-- ── TAB: ESPEJO ── -->
  <div class="mc-tab-content active" id="mc-content-espejo" role="tabpanel">

    <div class="mc-mirror-controls">
      <label for="mc-cols-input"><i class="fas fa-columns"></i> Columnas:</label>
      <input type="number" id="mc-cols-input" min="2" max="10" value="5">
      <button class="mc-btn mc-btn-ghost mc-btn-sm" id="mc-cols-apply-btn">
        <i class="fas fa-sync-alt"></i> Aplicar
      </button>
      <span style="flex:1"></span>
      <button class="mc-btn mc-btn-success mc-btn-sm" id="mc-espejo-save-btn">
        <i class="fas fa-save"></i> Guardar
      </button>
      <button class="mc-btn mc-btn-warning mc-btn-sm" id="mc-espejo-reset-btn">
        <i class="fas fa-undo"></i> Restablecer
      </button>
      <button class="mc-btn mc-btn-pdf mc-btn-sm" id="mc-espejo-pdf-btn" title="Exportar a PDF">
        <i class="fas fa-file-pdf"></i> PDF
      </button>
    </div>

    <div class="mc-mirror-info">
      <i class="fas fa-info-circle"></i>
      Arrastra los estudiantes para cambiar su posición. Los asientos vacíos sirven de espaciadores.
    </div>

    <div id="mc-mirror-grid" class="mc-mirror-grid"></div>
    <div id="mc-unassigned-zone" class="mc-unassigned-zone" style="display:none">
      <h6><i class="fas fa-user-clock"></i> Sin asiento asignado</h6>
      <div class="mc-unassigned-list" id="mc-unassigned-list"></div>
    </div>

    <div id="mc-espejo-alert" style="margin-top:12px"></div>
  </div>

  <!-- ── TAB: GRUPOS ── -->
  <div class="mc-tab-content" id="mc-content-grupos" role="tabpanel">

    <div class="mc-toolbar">
      <label>Tamaño de grupo:</label>
      <div class="mc-group-size-selector" id="mc-size-selector">
        ${[2, 3, 4, 5, 6].map(n =>
            `<button class="mc-size-btn${n === 3 ? ' active' : ''}" data-size="${n}">${n}</button>`
        ).join('')}
      </div>
      <button class="mc-btn mc-btn-primary" id="mc-generate-btn">
        <i class="fas fa-random"></i> Generar
      </button>
      <button class="mc-btn mc-btn-ghost mc-btn-sm" id="mc-grupos-reset-btn">
        <i class="fas fa-broom"></i> Limpiar
      </button>
      <button class="mc-btn mc-btn-pdf mc-btn-sm" id="mc-grupos-pdf-btn" title="Exportar a PDF">
        <i class="fas fa-file-pdf"></i> PDF
      </button>
    </div>

    <div id="mc-grupos-alert"></div>
    <div id="mc-groups-result" class="mc-groups-result"></div>

    <!-- Panel de excepciones (colapsado) -->
    <div class="mc-exceptions-area" id="mc-exceptions-area">
      <h6><i class="fas fa-ban"></i> Excepciones (no pueden quedar en el mismo grupo)</h6>
      <div class="mc-exception-row" id="mc-exc-add-row">
        <select class="mc-exception-select" id="mc-exc-sel-a">
          <option value="">Estudiante A</option>
        </select>
        <span style="color:#fca5a5;font-weight:700">≠</span>
        <select class="mc-exception-select" id="mc-exc-sel-b">
          <option value="">Estudiante B</option>
        </select>
        <button class="mc-btn mc-btn-danger mc-btn-sm" id="mc-exc-add-btn">
          <i class="fas fa-plus"></i> Añadir
        </button>
      </div>
      <div id="mc-exc-list" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px"></div>
    </div>

  </div>
</div>`;
        document.body.appendChild(el);
        this._bindModalEvents();
    }

    /* ══════════════════════════════════════════════════════
       ABRIR / CERRAR
    ══════════════════════════════════════════════════════ */

    /**
     * Abre el modal para el grupo indicado.
     * @param {string} groupName
     */
    open(groupName) {
        if (!groupName) {
            alert('Selecciona un grupo primero.');
            return;
        }

        this._ensureModalDOM();
        this.currentGroup = groupName;

        // Instanciar lógica
        this.espejo = new EspejoClase(studentManager);
        this.grupos = new GruposAleatorios(studentManager);

        this.espejo.init(groupName);
        this.grupos.init(groupName);

        // Actualizar el número de columnas en el input
        document.getElementById('mc-cols-input').value = this.espejo.columns;

        // Poblar selects de excepciones
        this._populateExceptionSelects();

        // Renderizar la tab activa
        this._switchTab(this.activeTab);

        // Mostrar overlay
        const overlay = document.getElementById('mc-overlay');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        const overlay = document.getElementById('mc-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ══════════════════════════════════════════════════════
       TABS
    ══════════════════════════════════════════════════════ */

    _switchTab(tab) {
        this.activeTab = tab;

        document.querySelectorAll('.mc-tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === tab;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });
        document.querySelectorAll('.mc-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `mc-content-${tab}`);
        });

        if (tab === 'espejo') this.renderMirror();
        if (tab === 'grupos') this.renderGroups();
    }

    /* ══════════════════════════════════════════════════════
       ESPEJO DE CLASE — RENDER
    ══════════════════════════════════════════════════════ */

    renderMirror() {
        const { rows, unassigned } = this.espejo.getGridData();
        const grid = document.getElementById('mc-mirror-grid');
        const unzone = document.getElementById('mc-unassigned-zone');
        const unlist = document.getElementById('mc-unassigned-list');

        if (!grid) return;

        // Actualizar CSS grid-template-columns
        grid.style.gridTemplateColumns = `repeat(${this.espejo.columns}, 1fr)`;

        // Construir HTML del grid
        let html = `<div class="mc-teacher-desk"><i class="fas fa-chalkboard"></i> Pizarra</div>`;

        rows.forEach(row => {
            row.forEach((name, colIdx) => {
                const seatIdx = rows.indexOf(row) * this.espejo.columns + colIdx;
                if (name) {
                    html += `
<div class="mc-seat occupied"
     draggable="true"
     data-seat-idx="${seatIdx}"
     data-name="${this._esc(name)}">
  <span class="seat-num">${seatIdx + 1}</span>
  <span class="seat-icon">🪑</span>
  <span class="seat-name">${this._esc(name)}</span>
</div>`;
                } else {
                    html += `
<div class="mc-seat empty"
     data-seat-idx="${seatIdx}">
  <span class="seat-num">${seatIdx + 1}</span>
  <span class="seat-icon" style="opacity:0.25">🪑</span>
  <span class="seat-name">—</span>
</div>`;
                }
            });
        });

        grid.innerHTML = html;

        // Zona sin asignar
        if (unassigned.length > 0) {
            unzone.style.display = 'block';
            unlist.innerHTML = unassigned.map(n =>
                `<div class="mc-unassigned-chip" draggable="true"
                      data-unassigned="${this._esc(n)}">${this._esc(n)}</div>`
            ).join('');
        } else {
            unzone.style.display = 'none';
            unlist.innerHTML = '';
        }

        this._bindMirrorDrag();
    }

    /* ── Drag-and-drop del Espejo ────────────────────────── */
    _bindMirrorDrag() {
        const grid = document.getElementById('mc-mirror-grid');
        const unlist = document.getElementById('mc-unassigned-list');
        const unzone = document.getElementById('mc-unassigned-zone');

        const onDragStart = (e) => {
            const seat = e.target.closest('[data-seat-idx]');
            const chip = e.target.closest('[data-unassigned]');
            if (seat && seat.classList.contains('occupied')) {
                this._dragFrom = {
                    type: 'seat',
                    index: parseInt(seat.dataset.seatIdx),
                    name: seat.dataset.name
                };
                seat.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            } else if (chip) {
                this._dragFrom = {
                    type: 'unassigned',
                    name: chip.dataset.unassigned
                };
                chip.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        };

        const onDragOver = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const seat = e.target.closest('[data-seat-idx]');
            if (seat) {
                document.querySelectorAll('.mc-seat.drag-over').forEach(s => s.classList.remove('drag-over'));
                seat.classList.add('drag-over');
            }
        };

        const onDrop = (e) => {
            e.preventDefault();
            document.querySelectorAll('.mc-seat.drag-over, .mc-seat.dragging, .mc-unassigned-chip.dragging')
                .forEach(el => el.classList.remove('drag-over', 'dragging'));

            if (!this._dragFrom) return;

            const targetSeat = e.target.closest('[data-seat-idx]');
            const targetUnzone = e.target.closest('#mc-unassigned-zone');

            if (targetSeat) {
                const toIdx = parseInt(targetSeat.dataset.seatIdx);
                if (this._dragFrom.type === 'seat') {
                    this.espejo.move(this._dragFrom.index, toIdx);
                } else {
                    this.espejo.move('unassigned', toIdx, this._dragFrom.name);
                }
            } else if (targetUnzone) {
                if (this._dragFrom.type === 'seat') {
                    this.espejo.move(this._dragFrom.index, 'unassigned');
                }
            }

            this._dragFrom = null;
            this.renderMirror();
        };

        const onDragEnd = () => {
            document.querySelectorAll('.mc-seat.drag-over, .mc-seat.dragging, .mc-unassigned-chip.dragging')
                .forEach(el => el.classList.remove('drag-over', 'dragging'));
            this._dragFrom = null;
        };

        grid.addEventListener('dragstart', onDragStart);
        grid.addEventListener('dragover', onDragOver);
        grid.addEventListener('drop', onDrop);
        grid.addEventListener('dragend', onDragEnd);

        if (unlist) {
            unlist.addEventListener('dragstart', onDragStart);
        }
        if (unzone) {
            unzone.addEventListener('dragover', onDragOver);
            unzone.addEventListener('drop', onDrop);
        }
    }

    /* ══════════════════════════════════════════════════════
       GRUPOS ALEATORIOS — RENDER
    ══════════════════════════════════════════════════════ */

    renderGroups() {
        this._renderExceptions();

        if (this.grupos.groups.length === 0) {
            document.getElementById('mc-groups-result').innerHTML =
                `<p style="color:#a78bfa;grid-column:1/-1;text-align:center;padding:30px 0;">
                    <i class="fas fa-dice-three" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.5"></i>
                    Presiona <strong>Generar</strong> para crear grupos aleatorios.
                 </p>`;
            return;
        }

        this._renderGroupCards();
    }

    _renderGroupCards() {
        const container = document.getElementById('mc-groups-result');
        if (!container) return;

        container.innerHTML = this.grupos.groups.map((group, gIdx) => `
<div class="mc-group-card" data-group-idx="${gIdx}"
     ondragover="event.preventDefault();this.classList.add('drag-target')"
     ondragleave="this.classList.remove('drag-target')"
     ondrop="mapaClaseUI._onGroupDrop(event,${gIdx})">
  <div class="mc-group-header">
    <i class="fas fa-users"></i> Grupo ${gIdx + 1}
    <small style="opacity:0.75;margin-left:4px">(${group.length})</small>
  </div>
  <div class="mc-group-body">
    ${group.map(name => `
      <div class="mc-student-chip"
           draggable="true"
           data-student="${this._esc(name)}"
           data-group="${gIdx}"
           ondragstart="mapaClaseUI._onGroupDragStart(event)">
        <span class="chip-drag-icon"><i class="fas fa-grip-vertical"></i></span>
        ${this._esc(name)}
      </div>`).join('')}
  </div>
</div>`).join('');
    }

    _onGroupDragStart(e) {
        const chip = e.target.closest('[data-student]');
        if (!chip) return;
        this._groupDrag = {
            studentName: chip.dataset.student,
            groupIdx: parseInt(chip.dataset.group)
        };
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    _onGroupDrop(e, toGroupIdx) {
        e.preventDefault();
        document.querySelectorAll('.mc-group-card.drag-target').forEach(c => c.classList.remove('drag-target'));
        document.querySelectorAll('.mc-student-chip.dragging').forEach(c => c.classList.remove('dragging'));

        if (!this._groupDrag) return;
        const { studentName, groupIdx: fromGroupIdx } = this._groupDrag;
        this._groupDrag = null;

        if (fromGroupIdx === toGroupIdx) return;
        this.grupos.moveStudent(studentName, fromGroupIdx, toGroupIdx);
        this._renderGroupCards();
    }

    /* ══════════════════════════════════════════════════════
       EXCEPCIONES
    ══════════════════════════════════════════════════════ */

    _populateExceptionSelects() {
        let students = [];
        try {
            students = studentManager.getStudentsInGroup(this.currentGroup);
        } catch (_) { }

        const opts = `<option value="">— Elegir —</option>` +
            students.map(s => `<option value="${this._esc(s)}">${this._esc(s)}</option>`).join('');

        const selA = document.getElementById('mc-exc-sel-a');
        const selB = document.getElementById('mc-exc-sel-b');
        if (selA) selA.innerHTML = opts;
        if (selB) selB.innerHTML = opts;
    }

    _renderExceptions() {
        const list = document.getElementById('mc-exc-list');
        if (!list) return;

        const exc = this.grupos.getExceptions();
        if (exc.length === 0) {
            list.innerHTML = `<span style="color:#a78bfa;font-size:0.82rem">Sin excepciones configuradas.</span>`;
            return;
        }

        list.innerHTML = exc.map(([a, b], idx) => `
<div class="mc-exception-tag">
  <i class="fas fa-ban" style="font-size:0.7rem"></i>
  ${this._esc(a)} ≠ ${this._esc(b)}
  <button onclick="mapaClaseUI._removeException(${idx})" title="Eliminar">
    <i class="fas fa-times"></i>
  </button>
</div>`).join('');
    }

    _removeException(idx) {
        this.grupos.removeException(idx);
        this._renderExceptions();
    }

    /* ══════════════════════════════════════════════════════
       EVENTOS DEL MODAL
    ══════════════════════════════════════════════════════ */

    _bindModalEvents() {
        // Cerrar
        document.getElementById('mc-close-btn')
            ?.addEventListener('click', () => this.close());
        document.getElementById('mc-overlay')
            ?.addEventListener('click', (e) => {
                if (e.target.id === 'mc-overlay') this.close();
            });

        // Tabs
        document.querySelectorAll('.mc-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        // ── Espejo ──────────────────────────────────────────
        document.getElementById('mc-cols-apply-btn')?.addEventListener('click', () => {
            const val = parseInt(document.getElementById('mc-cols-input').value) || 5;
            this.espejo.setColumns(val);
            this.renderMirror();
        });

        document.getElementById('mc-espejo-save-btn')?.addEventListener('click', () => {
            if (this.espejo.save()) {
                this._showAlert('mc-espejo-alert', 'success',
                    '<i class="fas fa-check-circle"></i> Disposición guardada correctamente.');
            }
        });

        document.getElementById('mc-espejo-reset-btn')?.addEventListener('click', () => {
            if (confirm('¿Restablecer la disposición original? Se perderá el acomodo actual.')) {
                this.espejo.reset();
                this.renderMirror();
            }
        });

        // ── Grupos ──────────────────────────────────────────
        document.getElementById('mc-size-selector')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.mc-size-btn');
            if (!btn) return;
            document.querySelectorAll('.mc-size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        document.getElementById('mc-generate-btn')?.addEventListener('click', () => {
            const activeSize = document.querySelector('.mc-size-btn.active');
            const size = activeSize ? parseInt(activeSize.dataset.size) : 3;
            const { groups, warnings } = this.grupos.generate(size);

            let alertHtml = '';
            if (warnings.length > 0) {
                alertHtml = warnings.map(w =>
                    `<div class="mc-alert mc-alert-warning">${w}</div>`).join('');
            } else {
                alertHtml = `<div class="mc-alert mc-alert-success">
                    <i class="fas fa-check-circle"></i>
                    ${groups.length} grupos generados correctamente sin conflictos.
                </div>`;
            }
            document.getElementById('mc-grupos-alert').innerHTML = alertHtml;
            this._renderGroupCards();
        });

        // Reset grupos
        document.getElementById('mc-grupos-reset-btn')?.addEventListener('click', () => {
            if (this.grupos.groups.length > 0 &&
                !confirm('¿Limpiar la distribución actual de grupos?')) return;
            this.grupos.groups = [];
            this.grupos._saveLayout();
            document.getElementById('mc-grupos-alert').innerHTML = '';
            this.renderGroups();
        });

        // ── PDF Espejo ────────────────────────────────────
        document.getElementById('mc-espejo-pdf-btn')?.addEventListener('click', () => {
            this.exportEspejoPDF();
        });

        // ── PDF Grupos ───────────────────────────────────────
        document.getElementById('mc-grupos-pdf-btn')?.addEventListener('click', () => {
            this.exportGruposPDF();
        });

        // Añadir excepción
        document.getElementById('mc-exc-add-btn')?.addEventListener('click', () => {
            const a = document.getElementById('mc-exc-sel-a')?.value;
            const b = document.getElementById('mc-exc-sel-b')?.value;
            if (!a || !b) {
                alert('Selecciona dos estudiantes distintos.');
                return;
            }
            if (a === b) {
                alert('Debes elegir dos estudiantes diferentes.');
                return;
            }
            const added = this.grupos.addException(a, b);
            if (!added) {
                alert('Esa excepción ya existe.');
                return;
            }
            // Reset selects
            document.getElementById('mc-exc-sel-a').value = '';
            document.getElementById('mc-exc-sel-b').value = '';
            this._renderExceptions();
        });
    }

    /* ══════════════════════════════════════════════════════
       EXPORTAR PDF
    ══════════════════════════════════════════════════════ */

    /**
     * Genera y descarga un PDF del Espejo de Clase actual.
     */
    exportEspejoPDF() {
        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) throw new Error('jsPDF no disponible');

            const doc = new jsPDF();
            const grupo = this.currentGroup || 'Grupo';
            const fecha = new Date().toLocaleDateString('es-ES');
            const { rows, unassigned } = this.espejo.getGridData();
            const cols = this.espejo.columns;

            // ── Encabezado ──────────────────────────────────
            doc.setFillColor(109, 40, 217);          // morado
            doc.rect(0, 0, 210, 38, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('ESPEJO DE CLASE', 15, 16);
            doc.setFontSize(11);
            doc.text(`Grupo: ${grupo}`, 15, 26);
            doc.text(`Fecha: ${fecha}`, 15, 33);

            // ── Pizarra ─────────────────────────────────────
            doc.setFillColor(55, 65, 81);
            doc.roundedRect(15, 45, 180, 10, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('⬛ PIZARRA / FRENTE DEL SALÓN', 105, 51.5, { align: 'center' });

            // ── Grid de asientos ────────────────────────────
            const cellW = Math.min(180 / cols, 40);
            const cellH = 14;
            let startY = 62;

            rows.forEach((row, rIdx) => {
                row.forEach((name, cIdx) => {
                    const x = 15 + cIdx * cellW;
                    const y = startY + rIdx * (cellH + 3);
                    const seatNum = rIdx * cols + cIdx + 1;

                    if (name) {
                        doc.setFillColor(237, 233, 254);    // lila claro
                        doc.setDrawColor(109, 40, 217);
                    } else {
                        doc.setFillColor(243, 244, 246);    // gris claro
                        doc.setDrawColor(209, 213, 219);
                    }
                    doc.setLineWidth(0.4);
                    doc.roundedRect(x, y, cellW - 2, cellH, 2, 2, 'FD');

                    // Número de asiento
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                    doc.setTextColor(150, 150, 150);
                    doc.text(`${seatNum}`, x + 1.5, y + 4);

                    // Nombre
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.setTextColor(name ? 55 : 180, name ? 20 : 180, name ? 90 : 180);
                    const displayName = name
                        ? (name.length > Math.floor(cellW / 2.5)
                            ? name.substring(0, Math.floor(cellW / 2.5)) + '…'
                            : name)
                        : '—';
                    doc.text(displayName, x + cellW / 2 - 1, y + 10, { align: 'center' });
                });
            });

            // ── Sin asiento ─────────────────────────────────
            if (unassigned.length > 0) {
                const lastY = startY + rows.length * (cellH + 3) + 8;
                if (lastY < 250) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(109, 40, 217);
                    doc.text('Sin asiento asignado:', 15, lastY);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(60, 60, 60);
                    doc.setFontSize(8);
                    doc.text(unassigned.join(' · '), 15, lastY + 6);
                }
            }

            // ── Pie de página ────────────────────────────────
            doc.setDrawColor(109, 40, 217);
            doc.setLineWidth(0.5);
            doc.line(15, 285, 195, 285);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(`Bitácora Escolar · ${grupo} · ${fecha}`, 15, 290);

            const safeName = grupo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
            doc.save(`EspejoClase_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);

        } catch (err) {
            console.error('Error exportando Espejo PDF:', err);
            alert('No se pudo generar el PDF. Asegúrate de que jsPDF está cargado.');
        }
    }

    /**
     * Genera y descarga un PDF con la distribución de grupos actuales.
     */
    exportGruposPDF() {
        try {
            if (!this.grupos || this.grupos.groups.length === 0) {
                alert('Genera los grupos primero antes de exportar.');
                return;
            }

            const { jsPDF } = window.jspdf;
            if (!jsPDF) throw new Error('jsPDF no disponible');

            const doc = new jsPDF();
            const grupo = this.currentGroup || 'Grupo';
            const fecha = new Date().toLocaleDateString('es-ES');
            const groups = this.grupos.groups;

            // ── Encabezado ──────────────────────────────────
            doc.setFillColor(109, 40, 217);
            doc.rect(0, 0, 210, 38, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('GRUPOS ALEATORIOS', 15, 16);
            doc.setFontSize(11);
            doc.text(`Grupo: ${grupo}`, 15, 26);
            doc.text(`Fecha: ${fecha}  ·  ${groups.length} grupos generados`, 15, 33);

            // ── Tarjetas de grupos ───────────────────────────
            const cardsPerRow = 2;
            const cardW = 85;
            const cardPaddingX = 10; // Horizontal space between cards
            const cardPaddingY = 8;  // Vertical space between cards
            const startX = 15;
            let currentY = 50; // Starting Y position for the first row of cards

            // Calculate max card height to ensure consistent row spacing
            const maxCardH = Math.max(...groups.map(g => 12 + g.length * 8));

            groups.forEach((members, gIdx) => {
                const col = gIdx % cardsPerRow;
                const row = Math.floor(gIdx / cardsPerRow);

                const x = startX + col * (cardW + cardPaddingX);
                const y = currentY + row * (maxCardH + cardPaddingY);

                // Check if a new page is needed
                if (y + maxCardH > 270 && col === 0) { // Only add page if starting a new row and it overflows
                    doc.addPage();
                    currentY = 20; // Reset Y for new page
                    y = currentY; // Recalculate y for the current card on the new page
                }

                const cardH = 12 + members.length * 8; // Actual height of the current card

                // Card background
                doc.setFillColor(237, 233, 254);
                doc.setDrawColor(109, 40, 217);
                doc.setLineWidth(0.5);
                doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');

                // Card header
                doc.setFillColor(109, 40, 217);
                doc.roundedRect(x, y, cardW, 10, 3, 3, 'F');
                doc.rect(x, y + 4, cardW, 6, 'F'); // Extend fill to cover rounded corners below
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(`Grupo ${gIdx + 1}  (${members.length} estudiantes)`, x + 4, y + 7);

                // List of students
                doc.setTextColor(40, 20, 80);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                members.forEach((name, mIdx) => {
                    doc.text(`• ${name}`, x + 5, y + 16 + mIdx * 8);
                });
            });

            // ── Pie de página ────────────────────────────────
            // Position footer relative to the last card or a fixed position if few cards
            const finalY = Math.max(currentY + Math.ceil(groups.length / cardsPerRow) * (maxCardH + cardPaddingY), 285);

            doc.setDrawColor(109, 40, 217);
            doc.setLineWidth(0.5);
            doc.line(15, finalY, 195, finalY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text(`Bitácora Escolar · ${grupo} · ${fecha}`, 15, finalY + 5);

            const safeName = grupo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
            doc.save(`GruposAleatorios_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);

        } catch (err) {
            console.error('Error exportando Grupos PDF:', err);
            alert('No se pudo generar el PDF. Asegúrate de que jsPDF está cargado.');
        }
    }

    /* ══════════════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════════════ */

    _esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _showAlert(containerId, type, html, durationMs = 3500) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = `<div class="mc-alert mc-alert-${type}">${html}</div>`;
        if (durationMs > 0) {
            setTimeout(() => { el.innerHTML = ''; }, durationMs);
        }
    }
}

/* ══════════════════════════════════════════════════════════
   INSTANCIA GLOBAL
══════════════════════════════════════════════════════════ */
const mapaClaseUI = new MapaClaseUI();
