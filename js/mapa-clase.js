/**
 * ============================================================
 *  MAPA DE CLASE — Lógica
 *  Módulo: mapa-clase.js
 *  Depende de: StorageService, CONFIG, Validators (BitacoraApp)
 * ============================================================
 */

/* ──────────────────────────────────────────────────────────
   ESPEJO DE CLASE
────────────────────────────────────────────────────────── */
class EspejoClase {
    constructor(studentManager) {
        this.studentManager = studentManager;
        this.currentGroup = null;
        this.columns = 5;           // columnas de la cuadrícula
        this.seats = [];            // array de strings | null (por posición)
        this.unassigned = [];       // estudiantes aún sin asiento
    }

    /**
     * Inicializa el espejo para un grupo dado.
     * Intenta cargar la disposición guardada; si no existe,
     * coloca a los estudiantes secuencialmente.
     * @param {string} groupName
     * @param {number} [cols=5]  - columnas del grid
     */
    init(groupName, cols = 5) {
        this.currentGroup = groupName;
        this.columns = Math.max(2, Math.min(cols, 10));

        let students;
        try {
            students = this.studentManager.getStudentsInGroup(groupName);
        } catch (e) {
            students = [];
        }

        const saved = StorageService.get(`espejo_${groupName}`);
        if (saved && saved.seats && saved.columns) {
            this.columns = saved.columns;
            this.seats = saved.seats;
            // Estudiantes que puedan no estar en el grid (añadidos después)
            const inGrid = this.seats.filter(Boolean);
            this.unassigned = students.filter(s => !inGrid.includes(s));
        } else {
            // Creamos un grid vacío y llenamos secuencialmente
            const total = students.length;
            const rows = Math.ceil(total / this.columns);
            this.seats = new Array(this.columns * rows).fill(null);
            students.forEach((s, i) => { this.seats[i] = s; });
            this.unassigned = [];
        }
    }

    /**
     * Mueve el estudiante (o null) de la posición `from` a la `to`.
     * Si `to` tiene un ocupante, hacer swap.
     * @param {number|'unassigned'} from  - índice en seats o 'unassigned'
     * @param {number|'unassigned'} to
     * @param {string|null} name - nombre cuando from === 'unassigned'
     */
    move(from, to, name = null) {
        if (from === 'unassigned' && name) {
            const idx = this.unassigned.indexOf(name);
            if (idx === -1) return;
            if (to === 'unassigned') return; // no-op

            const displaced = this.seats[to] || null;
            this.seats[to] = name;
            this.unassigned.splice(idx, 1);
            if (displaced) this.unassigned.push(displaced);

        } else if (to === 'unassigned') {
            const name2 = this.seats[from];
            if (!name2) return;
            this.seats[from] = null;
            this.unassigned.push(name2);

        } else {
            // Swap entre dos asientos
            const tmp = this.seats[to];
            this.seats[to] = this.seats[from];
            this.seats[from] = tmp;
        }
    }

    /**
     * Añade un asiento vacío al final.
     */
    addEmptySeat() {
        this.seats.push(null);
    }

    /**
     * Elimina el último asiento vacío si existe.
     */
    removeLastEmptySeat() {
        const lastEmpty = [...this.seats].reverse().findIndex(s => s === null);
        if (lastEmpty !== -1) {
            const idx = this.seats.length - 1 - lastEmpty;
            this.seats.splice(idx, 1);
        }
    }

    /**
     * Actualiza el número de columnas y devuelve el estado actual.
     * @param {number} newCols
     */
    setColumns(newCols) {
        this.columns = Math.max(2, Math.min(newCols, 10));
    }

    /**
     * Persiste la disposición actual.
     * @returns {boolean}
     */
    save() {
        if (!this.currentGroup) return false;
        return StorageService.set(`espejo_${this.currentGroup}`, {
            columns: this.columns,
            seats: this.seats,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Borra la disposición guardada para el grupo actual.
     */
    reset() {
        if (!this.currentGroup) return;
        StorageService.remove(`espejo_${this.currentGroup}`);
        this.init(this.currentGroup, this.columns);
    }

    /**
     * Retorna filas (arrays de celdas) para renderizar la cuadrícula.
     * @returns {{ rows: (string|null)[][], totalSeats: number, unassigned: string[] }}
     */
    getGridData() {
        const rows = [];
        for (let i = 0; i < this.seats.length; i += this.columns) {
            rows.push(this.seats.slice(i, i + this.columns));
        }
        return { rows, totalSeats: this.seats.length, unassigned: [...this.unassigned] };
    }
}


/* ──────────────────────────────────────────────────────────
   GRUPOS ALEATORIOS
────────────────────────────────────────────────────────── */
class GruposAleatorios {
    /**
     * @param {StudentManager} studentManager
     */
    constructor(studentManager) {
        this.studentManager = studentManager;
        this.currentGroup = null;
        this.groupSize = 3;
        this.groups = [];          // Array de grupos actuales (arrays de string)
        this.exceptions = [];      // Array de pares [a, b] que NO pueden coincidir
    }

    /**
     * Inicializa para un grupo de clase dado.
     * @param {string} groupName
     */
    init(groupName) {
        this.currentGroup = groupName;
        this.groups = [];

        // Cargar excepciones guardadas
        const savedExc = StorageService.get(`excepciones_${groupName}`);
        this.exceptions = Array.isArray(savedExc) ? savedExc : [];

        // Cargar la última distribución guardada
        const savedLayout = StorageService.get(`grupos_layout_${groupName}`);
        if (savedLayout && Array.isArray(savedLayout.groups) && savedLayout.groupSize) {
            this.groups = savedLayout.groups;
            this.groupSize = savedLayout.groupSize;
        }
    }

    /**
     * Genera grupos aleatorios respetando el tamaño y las excepciones.
     * @param {number} size - tamaño del grupo (2-6)
     * @returns {{ groups: string[][], warnings: string[] }}
     */
    generate(size) {
        this.groupSize = Math.max(2, Math.min(size, 6));

        let students;
        try {
            students = [...this.studentManager.getStudentsInGroup(this.currentGroup)];
        } catch (_) {
            students = [];
        }

        const MAX_ATTEMPTS = 200;
        let best = null;
        let bestViolations = Infinity;
        const warnings = [];

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const shuffled = this._shuffle([...students]);
            const divided = this._divideIntoGroups(shuffled, this.groupSize);
            const violations = this._countViolations(divided);

            if (violations < bestViolations) {
                bestViolations = violations;
                best = divided;
                if (violations === 0) break;
            }
        }

        this.groups = best || this._divideIntoGroups(students, this.groupSize);

        if (bestViolations > 0) {
            warnings.push(
                `⚠️ No fue posible respetar ${bestViolations} excepción(es) con el tamaño de grupo seleccionado. ` +
                `Considera cambiar el tamaño de grupo o revisar las excepciones.`
            );
        }

        this._saveLayout();
        return { groups: this.groups, warnings };
    }

    /**
     * Mueve un estudiante de un grupo a otro.
     * @param {string} studentName
     * @param {number} fromGroup - índice del grupo origen
     * @param {number} toGroup   - índice del grupo destino
     * @returns {boolean}
     */
    moveStudent(studentName, fromGroup, toGroup) {
        if (fromGroup === toGroup) return false;
        if (!this.groups[fromGroup] || !this.groups[toGroup]) return false;

        const src = this.groups[fromGroup];
        const dst = this.groups[toGroup];

        const idx = src.indexOf(studentName);
        if (idx === -1) return false;

        src.splice(idx, 1);
        dst.push(studentName);

        // Eliminar grupo si quedó vacío
        if (src.length === 0) {
            this.groups.splice(fromGroup, 1);
        }

        this._saveLayout();
        return true;
    }

    /**
     * Intercambia dos estudiantes de grupos distintos.
     * @param {string} studentA
     * @param {number} groupA
     * @param {string} studentB
     * @param {number} groupB
     * @returns {boolean}
     */
    swapStudents(studentA, groupA, studentB, groupB) {
        if (!this.groups[groupA] || !this.groups[groupB]) return false;

        const iA = this.groups[groupA].indexOf(studentA);
        const iB = this.groups[groupB].indexOf(studentB);

        if (iA === -1 || iB === -1) return false;

        this.groups[groupA][iA] = studentB;
        this.groups[groupB][iB] = studentA;

        this._saveLayout();
        return true;
    }

    /* ── Excepciones ─────────────────────────────────────── */

    /**
     * Agrega una excepción (par de estudiantes que no pueden coincidir).
     * @param {string} a
     * @param {string} b
     * @returns {boolean}
     */
    addException(a, b) {
        if (!a || !b || a === b) return false;
        const already = this.exceptions.some(
            ([x, y]) => (x === a && y === b) || (x === b && y === a)
        );
        if (already) return false;

        this.exceptions.push([a, b]);
        return this._saveExceptions();
    }

    /**
     * Elimina una excepción por índice.
     * @param {number} idx
     * @returns {boolean}
     */
    removeException(idx) {
        if (idx < 0 || idx >= this.exceptions.length) return false;
        this.exceptions.splice(idx, 1);
        return this._saveExceptions();
    }

    /**
     * Retorna todas las excepciones actuales.
     * @returns {[string, string][]}
     */
    getExceptions() {
        return [...this.exceptions];
    }

    /* ── Utilidades privadas ─────────────────────────────── */

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    _divideIntoGroups(students, size) {
        const total = students.length;
        if (total === 0) return [];

        const numGroups = Math.ceil(total / size);
        // How many groups need to be (size-1) to balance the remainder
        const numSmall = numGroups * size - total;  // groups of (size-1)
        const numLarge = numGroups - numSmall;       // groups of size

        const groups = [];
        let cursor = 0;

        for (let g = 0; g < numGroups; g++) {
            // Put smaller groups at the end for a natural feel
            const groupSize = (g < numLarge) ? size : (size - 1);
            groups.push(students.slice(cursor, cursor + groupSize));
            cursor += groupSize;
        }

        return groups;
    }

    _countViolations(groups) {
        let count = 0;
        for (const group of groups) {
            for (const [a, b] of this.exceptions) {
                if (group.includes(a) && group.includes(b)) count++;
            }
        }
        return count;
    }

    _saveExceptions() {
        if (!this.currentGroup) return false;
        return StorageService.set(`excepciones_${this.currentGroup}`, this.exceptions);
    }

    _saveLayout() {
        if (!this.currentGroup) return false;
        return StorageService.set(`grupos_layout_${this.currentGroup}`, {
            groups: this.groups,
            groupSize: this.groupSize,
            updatedAt: new Date().toISOString()
        });
    }
}
