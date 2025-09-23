/**
 * Gestor de estadísticas del sistema
 */
class StatisticsManager {
    constructor() {
        this.data = new Map();
        this.loadStatistics();
    }

    /**
     * Carga estadísticas desde almacenamiento 
     */
    loadStatistics() {
        try {
            const savedStats = StorageService.get('statistics', {});
            if (savedStats && typeof savedStats === 'object') {
                // Convertir objetos guardados de vuelta a Maps
                this.data = new Map();
                
                Object.entries(savedStats).forEach(([groupName, groupData]) => {
                    if (groupData && typeof groupData === 'object') {
                        this.data.set(groupName, new Map(Object.entries(groupData)));
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            errorHandler.handle(error, 'StatisticsManager.loadStatistics');
            this.data = new Map();
        }
    }

    /**
     * Guarda estadísticas 
     */
    saveStatistics() {
        try {
            const statsObject = {};
            
            // Convertir Maps a objetos para guardado
            this.data.forEach((groupStats, groupName) => {
                if (groupStats instanceof Map) {
                    statsObject[groupName] = Object.fromEntries(groupStats.entries());
                } else {
                    statsObject[groupName] = groupStats;
                }
            });
            
            return StorageService.set('statistics', statsObject);
        } catch (error) {
            console.error('Error guardando estadísticas:', error);
            errorHandler.handle(error, 'StatisticsManager.saveStatistics');
            return false;
        }
    }

    /**
     * Actualiza estadísticas con datos de sesión
     * @param {Object} sessionData - Datos de la sesión
     * @returns {boolean} - Verdadero si se actualizó correctamente
     */
    updateFromSession(sessionData) {
        try {
            if (!sessionData || !sessionData.grupo || !sessionData.students) {
                throw new Error('Datos de sesión inválidos');
            }

            const grupo = sessionData.grupo;
            if (!this.data.has(grupo)) {
                this.data.set(grupo, new Map());
            }

            const groupStats = this.data.get(grupo);

            // Actualizar estadísticas por estudiante
            Object.entries(sessionData.students).forEach(([studentName, studentData]) => {
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

                const studentStats = groupStats.get(studentName);
                
                // Incrementar contadores
                studentStats[studentData.estado]++;
                if (studentData.bano) studentStats.bano++;
                if (studentData.enfermeria) studentStats.enfermeria++;
                if (studentData.otro) studentStats.otro++;
                studentStats.totalSesiones++;

                // Agregar comentarios
                if (studentData.comentarios && Array.isArray(studentData.comentarios)) {
                    studentData.comentarios.forEach(comment => {
                        if (comment.text) {
                            studentStats.comentarios.push({
                                fecha: sessionData.fecha,
                                texto: SecurityUtils.sanitizeInput(comment.text, CONFIG.MAX_COMMENT_LENGTH),
                                tipo: comment.type || CONFIG.COMMENT_TYPES.GENERAL
                            });
                        }
                    });
                }
            });

            return this.saveStatistics();
        } catch (error) {
            errorHandler.handle(error, 'StatisticsManager.updateFromSession');
            return false;
        }
    }

    /**
     * Obtiene estadísticas de un grupo
     * @param {string} groupName - Nombre del grupo
     * @returns {Object} - Estadísticas del grupo
     */
     getGroupStatistics(groupName) {
        try {
            if (!this.data.has(groupName)) {
                return { students: {}, summary: this.getEmptyGroupSummary() };
            }

            const groupStats = this.data.get(groupName);
            
            // Verificar que groupStats sea un Map
            if (!groupStats || !(groupStats instanceof Map)) {
                console.warn(`Datos inválidos para grupo ${groupName}:`, groupStats);
                return { students: {}, summary: this.getEmptyGroupSummary() };
            }

            const students = Object.fromEntries(groupStats.entries());
            const summary = this.calculateGroupSummary(groupStats);

            return { students, summary };
        } catch (error) {
            console.error('Error en getGroupStatistics:', error);
            errorHandler.handle(error, 'StatisticsManager.getGroupStatistics');
            return { students: {}, summary: this.getEmptyGroupSummary() };
        }
    }

    /**
     * Calcula resumen de grupo
     * @param {Map} groupStats - Estadísticas del grupo
     * @returns {Object} - Resumen calculado
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

        // Calcular totales
        groupStats.forEach((studentStats, studentName) => {
            summary.totalPresentes += studentStats.presente;
            summary.totalAusentes += studentStats.ausente;
            summary.totalTardes += studentStats.tarde;
            summary.totalBano += studentStats.bano;
            summary.totalEnfermeria += studentStats.enfermeria;
            summary.totalOtro += studentStats.otro;
            
            if (studentStats.totalSesiones > maxSesiones) {
                maxSesiones = studentStats.totalSesiones;
            }
        });

        summary.totalSesiones = maxSesiones;
        
        // Calcular promedio de asistencia
        const totalPosibleAsistencias = summary.totalEstudiantes * summary.totalSesiones;
        if (totalPosibleAsistencias > 0) {
            summary.promedioAsistencia = (summary.totalPresentes / totalPosibleAsistencias) * 100;
        }

        // Identificar estudiantes problemáticos
        summary.estudiantesConMasAusencias = this.getTopStudentsByMetric(groupStats, 'ausente', 5);
        summary.estudiantesConMasTardanzas = this.getTopStudentsByMetric(groupStats, 'tarde', 5);

        return summary;
    }

    /**
     * Obtiene estudiantes con mayor valor en una métrica
     */
    getTopStudentsByMetric(groupStats, metric, limit = 5) {
        return Array.from(groupStats.entries())
            .filter(([name, stats]) => stats[metric] > 0)
            .sort((a, b) => b[1][metric] - a[1][metric])
            .slice(0, limit)
            .map(([name, stats]) => ({
                nombre: name,
                valor: stats[metric],
                porcentaje: stats.totalSesiones > 0 ? (stats[metric] / stats.totalSesiones * 100).toFixed(1) : 0
            }));
    }

    /**
     * Obtiene resumen vacío de grupo
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
     * Obtiene todas las estadísticas
     */
    getAllStatistics() {
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