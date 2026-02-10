/**
 * Gestor de estadísticas del sistema
 * 
 * CORRECCIÓN: Las estadísticas ahora se recalculan desde cero
 * leyendo todas las sesiones guardadas. Esto evita que los datos
 * se dupliquen cada vez que se guarda una sesión.
 */
class StatisticsManager {
    constructor() {
        this.data = new Map();
        this.loadStatistics();
    }

    /**
     * Carga estadísticas recalculándolas desde todas las sesiones guardadas.
     * Esto garantiza que siempre estén actualizadas y sin duplicados.
     */
    loadStatistics() {
        try {
            this.data = this.recalculateFromAllSessions();
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            errorHandler.handle(error, 'StatisticsManager.loadStatistics');
            this.data = new Map();
        }
    }

    /**
     * Lee TODAS las sesiones guardadas y recalcula las estadísticas
     * desde cero. Así no hay duplicados aunque se guarde varias veces.
     * 
     * @returns {Map} - Mapa de estadísticas por grupo
     */
    recalculateFromAllSessions() {
        const result = new Map();

        try {
            // Obtener todas las claves de sesiones guardadas
            const sessionKeys = StorageService.getKeysMatching('session_');

            sessionKeys.forEach(key => {
                const session = StorageService.get(key);

                // Ignorar sesiones inválidas o sin estudiantes
                if (!session || !session.grupo || !session.students) return;
                if (!session.lastSaved) return; // Solo sesiones que se hayan guardado

                const grupo = session.grupo;

                if (!result.has(grupo)) {
                    result.set(grupo, new Map());
                }

                const groupStats = result.get(grupo);

                Object.entries(session.students).forEach(([studentName, studentData]) => {
                    if (!groupStats.has(studentName)) {
                        groupStats.set(studentName, {
                            presente: 0,
                            ausente: 0,
                            tarde: 0,
                            bano: 0,
                            enfermeria: 0,
                            otro: 0,
                            totalSesiones: 0,
                            comentarios: []
                        });
                    }

                    const stats = groupStats.get(studentName);

                    // Sumar esta sesión (cada sesión solo se lee una vez)
                    const estado = studentData.estado || 'presente';
                    if (stats.hasOwnProperty(estado)) {
                        stats[estado]++;
                    }

                    if (studentData.bano) stats.bano++;
                    if (studentData.enfermeria) stats.enfermeria++;
                    if (studentData.otro) stats.otro++;
                    stats.totalSesiones++;

                    // Agregar comentarios de esta sesión
                    if (Array.isArray(studentData.comentarios)) {
                        studentData.comentarios.forEach(comment => {
                            if (comment.text) {
                                stats.comentarios.push({
                                    fecha: session.fecha,
                                    texto: SecurityUtils.sanitizeInput(
                                        comment.text,
                                        CONFIG.MAX_COMMENT_LENGTH
                                    ),
                                    tipo: comment.type || CONFIG.COMMENT_TYPES.GENERAL
                                });
                            }
                        });
                    }
                });
            });

            console.log(`Estadísticas recalculadas: ${result.size} grupo(s), ${sessionKeys.length} sesión(es)`);
        } catch (error) {
            console.error('Error recalculando estadísticas:', error);
        }

        return result;
    }

    /**
     * Se llama al guardar una sesión. Recalcula todo desde cero
     * para que las estadísticas siempre sean correctas.
     * 
     * @param {Object} sessionData - Datos de la sesión recién guardada (no se usa
     *                               directamente, solo dispara el recálculo)
     * @returns {boolean}
     */
    updateFromSession(sessionData) {
        try {
            if (!sessionData || !sessionData.grupo || !sessionData.students) {
                throw new Error('Datos de sesión inválidos');
            }

            // Recalcular todo desde las sesiones guardadas en storage
            this.data = this.recalculateFromAllSessions();
            return true;
        } catch (error) {
            errorHandler.handle(error, 'StatisticsManager.updateFromSession');
            return false;
        }
    }

    /**
     * Guarda estadísticas (mantenido por compatibilidad, ya no es necesario
     * porque ahora se recalculan en tiempo real desde las sesiones)
     */
    saveStatistics() {
        // Las estadísticas ya no se guardan por separado.
        // Se recalculan desde las sesiones cada vez que se necesitan.
        return true;
    }

    /**
     * Obtiene estadísticas de un grupo específico
     * @param {string} groupName - Nombre del grupo
     * @returns {Object} - { students, summary }
     */
    getGroupStatistics(groupName) {
        try {
            if (!this.data.has(groupName)) {
                return { students: {}, summary: this.getEmptyGroupSummary() };
            }

            const groupStats = this.data.get(groupName);

            if (!groupStats || !(groupStats instanceof Map)) {
                return { students: {}, summary: this.getEmptyGroupSummary() };
            }

            const students = Object.fromEntries(groupStats.entries());
            const summary = this.calculateGroupSummary(groupStats);

            return { students, summary };
        } catch (error) {
            errorHandler.handle(error, 'StatisticsManager.getGroupStatistics');
            return { students: {}, summary: this.getEmptyGroupSummary() };
        }
    }

    /**
     * Calcula resumen de un grupo
     * @param {Map} groupStats
     * @returns {Object}
     */
    calculateGroupSummary(groupStats) {
        const summary = {
            totalEstudiantes: groupStats.size,
            totalSesiones: 0,
            totalPresentes: 0,
            totalAusentes: 0,
            totalTardes: 0,
            totalBano: 0,
            totalEnfermeria: 0,
            totalOtro: 0,
            promedioAsistencia: 0,
            estudiantesConMasAusencias: [],
            estudiantesConMasTardanzas: []
        };

        if (groupStats.size === 0) return summary;

        let maxSesiones = 0;

        groupStats.forEach((studentStats) => {
            summary.totalPresentes  += studentStats.presente;
            summary.totalAusentes   += studentStats.ausente;
            summary.totalTardes     += studentStats.tarde;
            summary.totalBano       += studentStats.bano;
            summary.totalEnfermeria += studentStats.enfermeria;
            summary.totalOtro       += studentStats.otro;

            if (studentStats.totalSesiones > maxSesiones) {
                maxSesiones = studentStats.totalSesiones;
            }
        });

        summary.totalSesiones = maxSesiones;

        const totalPosible = summary.totalEstudiantes * summary.totalSesiones;
        if (totalPosible > 0) {
            summary.promedioAsistencia = (summary.totalPresentes / totalPosible) * 100;
        }

        summary.estudiantesConMasAusencias  = this.getTopStudentsByMetric(groupStats, 'ausente', 5);
        summary.estudiantesConMasTardanzas  = this.getTopStudentsByMetric(groupStats, 'tarde', 5);

        return summary;
    }

    /**
     * Devuelve los N estudiantes con más ocurrencias de una métrica
     */
    getTopStudentsByMetric(groupStats, metric, limit = 5) {
        return Array.from(groupStats.entries())
            .filter(([, stats]) => stats[metric] > 0)
            .sort((a, b) => b[1][metric] - a[1][metric])
            .slice(0, limit)
            .map(([name, stats]) => ({
                nombre: name,
                valor: stats[metric],
                porcentaje: stats.totalSesiones > 0
                    ? (stats[metric] / stats.totalSesiones * 100).toFixed(1)
                    : 0
            }));
    }

    /**
     * Resumen vacío para cuando no hay datos
     */
    getEmptyGroupSummary() {
        return {
            totalEstudiantes: 0,
            totalSesiones: 0,
            totalPresentes: 0,
            totalAusentes: 0,
            totalTardes: 0,
            totalBano: 0,
            totalEnfermeria: 0,
            totalOtro: 0,
            promedioAsistencia: 0,
            estudiantesConMasAusencias: [],
            estudiantesConMasTardanzas: []
        };
    }

    /**
     * Devuelve todas las estadísticas recalculadas
     */
    getAllStatistics() {
        // Recalcular antes de mostrar para garantizar datos frescos
        this.data = this.recalculateFromAllSessions();

        const result = {};
        this.data.forEach((groupStats, groupName) => {
            result[groupName] = this.getGroupStatistics(groupName);
        });
        return result;
    }

    /**
     * Exporta estadísticas
     */
    exportStatistics() {
        return {
            version: CONFIG.VERSION,
            timestamp: new Date().toISOString(),
            statistics: Object.fromEntries(this.data)
        };
    }
}
