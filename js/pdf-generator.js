/**
 * Generador de PDF mejorado y seguro
 */
class PDFGenerator {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.colors = CONFIG.COLORS;
    }

    /**
     * Genera PDF de la bitácora
     * @returns {boolean} - Verdadero si se generó correctamente
     */
    async generatePDF() {
        const session = this.sessionManager.getCurrentSession();
        if (!session) {
            errorHandler.handle(new Error('No hay sesión activa'), 'PDFGenerator.generatePDF');
            return false;
        }

        try {
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                throw new Error('La librería jsPDF no está disponible');
            }

            const doc = new jsPDF();
            let yPos = 20;

            // Generar contenido del PDF
            yPos = this.addHeader(doc, session, yPos);
            yPos = this.addAttendanceSummary(doc, session, yPos);
            yPos = this.addIncidents(doc, session, yPos); // incluye comentarios
            yPos = this.addLessonContent(doc, session, yPos);
            yPos = this.addEvaluation(doc, session, yPos);
            this.addFooter(doc, session);

            // Generar nombre de archivo seguro
            const fileName = this.generateSecureFileName(session);
            doc.save(fileName);

            errorHandler.showSuccess('PDF generado correctamente');
            return true;
        } catch (error) {
            errorHandler.handle(error, 'PDFGenerator.generatePDF');
            return false;
        }
    }

    /**
     * Agrega encabezado al PDF
     */
    addHeader(doc, session, yPos) {
        // Fondo del encabezado
        doc.setFillColor(...this.colors.PRIMARY);
        doc.rect(0, 0, 210, 45, 'F');

        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('BITÁCORA ESCOLAR', 20, 20);

        // Información del profesor
        doc.setFontSize(12);
        const teacherName = StorageService.get('teacher_name', 'Diego Durán-Jiménez');
        doc.text(`Prof. ${teacherName}`, 20, 30);

        // Información de sesión
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const sessionText = `${this.escapeText(session.grupo)} | ${new Date(session.fecha).toLocaleDateString('es-ES')} | ${session.startTime}`;
        const sessionWidth = doc.getTextWidth(sessionText);
        doc.text(sessionText, 210 - sessionWidth - 15, 25);

        // Línea decorativa
        doc.setDrawColor(...this.colors.WARNING);
        doc.setLineWidth(3);
        doc.line(15, 48, 195, 48);

        doc.setTextColor(0, 0, 0);
        return 65;
    }

    /**
     * Agrega resumen de asistencia
     */
    addAttendanceSummary(doc, session, yPos) {
        const stats = this.sessionManager.getCurrentAttendanceStats();

        // Cuadro principal
        doc.setFillColor(248, 250, 252);
        this.drawRoundedRect(doc, 15, yPos, 180, 35, 5);
        doc.setDrawColor(...this.colors.PRIMARY);
        doc.setLineWidth(1);
        this.drawRoundedRect(doc, 15, yPos, 180, 35, 5, false);

        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...this.colors.PRIMARY);
        doc.text('RESUMEN DE ASISTENCIA', 20, yPos + 10);

        // Estadísticas
        const statBoxes = [
            { label: 'PRESENTES', value: stats.presente, color: this.colors.SUCCESS, x: 25 },
            { label: 'AUSENTES', value: stats.ausente, color: this.colors.DANGER, x: 70 },
            { label: 'TARDANZAS', value: stats.tarde, color: this.colors.WARNING, x: 115 },
            { label: 'TOTAL', value: stats.total, color: this.colors.PRIMARY, x: 160 }
        ];

        statBoxes.forEach(box => {
            doc.setFillColor(...box.color);
            this.drawRoundedRect(doc, box.x, yPos + 15, 30, 15, 3);

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            const numWidth = doc.getTextWidth(box.value.toString());
            doc.text(box.value.toString(), box.x + (30 - numWidth) / 2, yPos + 23);

            doc.setFontSize(7);
            const labelWidth = doc.getTextWidth(box.label);
            doc.text(box.label, box.x + (30 - labelWidth) / 2, yPos + 28);
        });

        doc.setTextColor(0, 0, 0);
        return yPos + 50;
    }

    /**
       * Agrega sección de incidencias con comentarios integrados
       */
    addIncidents(doc, session, yPos) {
        const studentsWithIncidents = this.sessionManager.getStudentsWithIncidents();

        if (studentsWithIncidents.length === 0) {
            // Cuadro simple para "sin incidencias"
            doc.setFillColor(252, 252, 252);
            this.drawRoundedRect(doc, 15, yPos, 180, 25, 5);
            doc.setDrawColor(...this.colors.SUCCESS);
            doc.setLineWidth(1);
            this.drawRoundedRect(doc, 15, yPos, 180, 25, 5, false);

            doc.setFillColor(...this.colors.SUCCESS);
            this.drawRoundedRect(doc, 15, yPos, 180, 12, 5);
            doc.rect(15, yPos + 6, 180, 6, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('EXCELENTE: NO HAY INCIDENCIAS', 20, yPos + 8);

            return yPos + 40;
        }

        // Calcular altura dinámica basada en incidencias y comentarios
        let totalLines = 0;
        studentsWithIncidents.forEach(student => {
            totalLines += 2; // Línea del estudiante + espacio
            if (student.comentarios && student.comentarios.length > 0) {
                totalLines += student.comentarios.length;
            }
        });

        const boxHeight = Math.min(totalLines * 8 + 35, 120);

        // Cuadro principal
        doc.setFillColor(252, 252, 252);
        this.drawRoundedRect(doc, 15, yPos, 180, boxHeight, 5);
        doc.setDrawColor(...this.colors.DANGER);
        doc.setLineWidth(1);
        this.drawRoundedRect(doc, 15, yPos, 180, boxHeight, 5, false);

        // Header
        doc.setFillColor(...this.colors.DANGER);
        this.drawRoundedRect(doc, 15, yPos, 180, 12, 5);
        doc.rect(15, yPos + 6, 180, 6, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`INCIDENCIAS Y OBSERVACIONES (${studentsWithIncidents.length})`, 20, yPos + 8);

        // Contenido de incidencias con comentarios
        let incidentY = yPos + 20;
        doc.setTextColor(50, 50, 50);

        studentsWithIncidents.slice(0, 10).forEach(student => {
            // Nombre del estudiante
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`${this.escapeText(student.name)}:`, 20, incidentY);

            // Incidencias en la misma línea
            let details = [];
            if (student.estado !== CONFIG.STUDENT_STATES.PRESENTE) {
                details.push(student.estado.toUpperCase());
            }
            if (student.bano) details.push('Baño');
            if (student.enfermeria) details.push('Enfermería');
            if (student.otro) details.push('Otro');

            doc.setFont('helvetica', 'normal');
            doc.text(details.join(', '), 85, incidentY);

            incidentY += 6;

            // Comentarios del estudiante (si los tiene)
            if (student.comentarios && student.comentarios.length > 0) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);

                student.comentarios.forEach(comment => {
                    const commentText = this.escapeText(comment.text);
                    const truncatedComment = commentText.length > 70 ? commentText.substring(0, 70) + '...' : commentText;
                    doc.text(`• ${truncatedComment}`, 25, incidentY);
                    incidentY += 5;
                });

                incidentY += 2; // Espacio extra después de comentarios
            }
        });

        if (studentsWithIncidents.length > 10) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.text(`... y ${studentsWithIncidents.length - 10} estudiantes más con incidencias`, 20, incidentY);
        }

        doc.setTextColor(0, 0, 0);
        return yPos + boxHeight + 15;
    }

    /**
      * Agrega contenido de lección 
      */
    addLessonContent(doc, session, yPos) {
        // Verificar si necesita nueva página
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        // Título de sección
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...this.colors.PRIMARY);
        doc.text('DESARROLLO DE LA LECCION', 20, yPos);
        yPos += 15;

        const fields = [
            { label: 'CONTENIDO', value: session.lessonContent || '', icon: '' },
            { label: 'PLANIFICACION', value: session.planningComment || '', icon: '' },
            { label: 'AVANCES/OBSTACULOS', value: session.lessonProgress || '', icon: '' },
            { label: 'OBSERVACIONES', value: session.observations || '', icon: '' }
        ];

        fields.forEach((field, index) => {
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            yPos = this.addContentBox(doc, field, 15, yPos, 180);
            yPos += 5;
        });

        // Propuestas de mejora
        if (session.improvementProposals) {
            if (yPos > 200) {
                doc.addPage();
                yPos = 20;
            }
            yPos = this.addContentBox(doc, {
                label: 'PROPUESTAS DE MEJORA',
                value: session.improvementProposals,
                icon: ''
            }, 15, yPos, 180);
        }

        return yPos;
    }

    /**
     * Agrega evaluación 
     */
    addEvaluation(doc, session, yPos) {
        if (yPos > 160) {
            doc.addPage();
            yPos = 20;
        }

        // Cuadro principal
        doc.setFillColor(248, 250, 252);
        this.drawRoundedRect(doc, 15, yPos, 180, 70, 5);
        doc.setDrawColor(...this.colors.PRIMARY);
        doc.setLineWidth(1);
        this.drawRoundedRect(doc, 15, yPos, 180, 70, 5, false);

        // Header
        doc.setFillColor(...this.colors.PRIMARY);
        this.drawRoundedRect(doc, 15, yPos, 180, 10, 5);
        doc.rect(15, yPos + 5, 180, 5, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('EVALUACION DE LA CLASE', 20, yPos + 7);

        // Items de evaluación
        const evaluationFields = [
            { label: 'Tiempo de actividades', value: session.activityTime || 'Adecuado' },
            { label: 'Actividades accesibles', value: session.evaluation?.activityAccessibility || 'De Acuerdo' },
            { label: 'Materiales adecuados', value: session.evaluation?.classMaterials || 'De Acuerdo' },
            { label: 'Espacio fisico', value: session.evaluation?.physicalSpace || 'De Acuerdo' },
            { label: 'Involucramiento', value: session.evaluation?.studentInvolvement || 'Bueno' },
            { label: 'Actitud general', value: session.evaluation?.studentAttitude || 'Bueno' }
        ];

        let evalY = yPos + 18;
        doc.setTextColor(50, 50, 50);

        evaluationFields.forEach(field => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`${field.label}:`, 20, evalY);

            doc.setFont('helvetica', 'bold');
            doc.text(this.escapeText(field.value), 85, evalY);

            // Indicador de color
            const indicatorColor = this.getEvaluationColor(field.value);
            doc.setFillColor(...indicatorColor);
            doc.circle(165, evalY - 2, 2, 'F');

            evalY += 9;
        });

        doc.setTextColor(0, 0, 0);
        return yPos + 75;
    }

    /**
     * Agrega pie de página
     */
    addFooter(doc, session) {
        const pageCount = doc.internal.getNumberOfPages();

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Línea superior
            doc.setDrawColor(...this.colors.PRIMARY);
            doc.setLineWidth(1);
            doc.line(15, 275, 195, 275);

            // Información del pie
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...this.colors.SECONDARY);

            const footerText = `${this.escapeText(session.grupo)} - ${session.fecha} | Generado: ${new Date().toLocaleDateString('es-ES')}`;
            doc.text(footerText, 15, 280);

            // Línea de firma
            doc.text('_____________________', 80, 285);
            doc.text('Firma del Docente', 90, 290);

            // Numeración
            const pageText = `Página ${i} de ${pageCount}`;
            doc.text(pageText, 195 - doc.getTextWidth(pageText), 280);
        }
    }

    /**
     * Dibuja rectángulo redondeado
     */
    drawRoundedRect(doc, x, y, w, h, r, fill = true) {
        doc.roundedRect(x, y, w, h, r, r, fill ? 'F' : 'S');
    }

    /**
         * Agrega cuadro de contenido 
         */
    addContentBox(doc, field, x, y, width) {
        const value = field.value || 'No especificado';
        const height = 30;

        // Cuadro principal
        doc.setFillColor(252, 252, 252);
        this.drawRoundedRect(doc, x, y, width, height, 3);
        doc.setDrawColor(...this.colors.SECONDARY);
        doc.setLineWidth(0.5);
        this.drawRoundedRect(doc, x, y, width, height, 3, false);

        // Header
        doc.setFillColor(...this.colors.PRIMARY);
        this.drawRoundedRect(doc, x, y, width, 8, 3);
        doc.rect(x, y + 4, width, 4, 'F');

        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(field.label, x + 3, y + 6);

        // Contenido
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        const cleanValue = this.escapeText(value);
        const textLines = doc.splitTextToSize(cleanValue, width - 10);
        textLines.slice(0, 3).forEach((line, index) => {
            doc.text(line, x + 5, y + 15 + (index * 4));
        });

        if (textLines.length > 3) {
            doc.setFont('helvetica', 'italic');
            doc.text('...', x + 5, y + 27);
        }

        doc.setTextColor(0, 0, 0);
        return y + height + 5;
    }

    /**
     * Obtiene color de evaluación
     */
    getEvaluationColor(value) {
        const colorMap = {
            'Excelente': this.colors.SUCCESS,
            'De Acuerdo': this.colors.SUCCESS,
            'Bueno': this.colors.PRIMARY,
            'Parcialmente de acuerdo': this.colors.WARNING,
            'Regular': this.colors.WARNING,
            'Parcialmente en desacuerdo': this.colors.DANGER,
            'Deficiente': this.colors.DANGER,
            'En desacuerdo': this.colors.DANGER
        };
        return colorMap[value] || this.colors.SECONDARY;
    }

    /**
     * Genera nombre de archivo seguro
     */
    generateSecureFileName(session) {
        const sanitizedGroup = this.escapeText(session.grupo).replace(/[^a-zA-Z0-9]/g, '');
        const dateStr = session.fecha.replace(/-/g, '');
        return `Bitacora_${sanitizedGroup}_${dateStr}.pdf`;
    }

    /**
     * Sanitiza texto para PDF
     */
    escapeText(text) {
        if (typeof text !== 'string') return '';
        return text.replace(/[<>&"']/g, '');
    }
}