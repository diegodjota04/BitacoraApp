/**
 * Sistema de validación de datos
 */
class Validators {
    /**
     * Valida nombre de estudiante
     * @param {string} name - Nombre a validar
     * @returns {Object} - Resultado de validación
     */
    static validateStudentName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, message: 'El nombre es requerido' };
        }
        
        const sanitized = SecurityUtils.sanitizeInput(name, CONFIG.MAX_STUDENT_NAME_LENGTH);
        
        if (sanitized.length < 2) {
            return { valid: false, message: 'El nombre debe tener al menos 2 caracteres' };
        }
        
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(sanitized)) {
            return { valid: false, message: 'El nombre solo puede contener letras y espacios' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Valida fecha
     * @param {string} date - Fecha a validar
     * @returns {Object} - Resultado de validación
     */
    static validateDate(date) {
        if (!date) {
            return { valid: false, message: 'La fecha es requerida' };
        }
        
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return { valid: false, message: 'Formato de fecha inválido' };
        }
        
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (parsedDate > today) {
            return { valid: false, message: 'La fecha no puede ser futura' };
        }
        
        // Validar que no sea muy antigua (1 año)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        if (parsedDate < oneYearAgo) {
            return { valid: false, message: 'La fecha no puede ser anterior a un año' };
        }
        
        return { valid: true, value: date };
    }

    /**
     * Valida hora
     * @param {string} time - Hora a validar
     * @returns {Object} - Resultado de validación
     */
    static validateTime(time) {
        if (!time) {
            return { valid: false, message: 'La hora es requerida' };
        }
        
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return { valid: false, message: 'Formato de hora inválido (HH:MM)' };
        }
        
        return { valid: true, value: time };
    }

    /**
     * Valida grupo
     * @param {string} group - Grupo a validar
     * @returns {Object} - Resultado de validación
     */
    static validateGroup(group) {
        if (!group || typeof group !== 'string') {
            return { valid: false, message: 'Debe seleccionar un grupo' };
        }
        
        const sanitized = SecurityUtils.sanitizeInput(group, 10);
        
        if (!/^[0-9]+[A-Z]$/.test(sanitized)) {
            return { valid: false, message: 'Formato de grupo inválido' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Valida comentario
     * @param {string} comment - Comentario a validar
     * @returns {Object} - Resultado de validación
     */
    static validateComment(comment) {
        if (!comment || typeof comment !== 'string') {
            return { valid: false, message: 'El comentario no puede estar vacío' };
        }
        
        const sanitized = SecurityUtils.sanitizeInput(comment, CONFIG.MAX_COMMENT_LENGTH);
        
        if (sanitized.length < 3) {
            return { valid: false, message: 'El comentario debe tener al menos 3 caracteres' };
        }
        
        // Verificar que no contenga solo caracteres especiales
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/.test(sanitized)) {
            return { valid: false, message: 'El comentario debe contener texto válido' };
        }
        
        return { valid: true, value: sanitized };
    }

    /**
     * Valida datos de sesión completa
     * @param {Object} sessionData - Datos de sesión
     * @returns {Object} - Resultado de validación
     */
    static validateSessionData(sessionData) {
        const errors = {};
        
        // Validar grupo
        const groupValidation = this.validateGroup(sessionData.grupo);
        if (!groupValidation.valid) {
            errors.grupo = groupValidation.message;
        }
        
        // Validar fecha
        const dateValidation = this.validateDate(sessionData.fecha);
        if (!dateValidation.valid) {
            errors.fecha = dateValidation.message;
        }
        
        // Validar hora
        const timeValidation = this.validateTime(sessionData.startTime);
        if (!timeValidation.valid) {
            errors.startTime = timeValidation.message;
        }
        
        // Validar estudiantes
        if (!sessionData.students || typeof sessionData.students !== 'object') {
            errors.students = 'Datos de estudiantes inválidos';
        } else {
            for (const [studentName, studentData] of Object.entries(sessionData.students)) {
                const nameValidation = this.validateStudentName(studentName);
                if (!nameValidation.valid) {
                    errors[`student_${studentName}`] = nameValidation.message;
                    continue;
                }
                
                if (!Object.values(CONFIG.STUDENT_STATES).includes(studentData.estado)) {
                    errors[`student_state_${studentName}`] = 'Estado de estudiante inválido';
                }
                
                // Validar comentarios del estudiante
                if (studentData.comentarios && Array.isArray(studentData.comentarios)) {
                    studentData.comentarios.forEach((comment, index) => {
                        const commentValidation = this.validateComment(comment.text);
                        if (!commentValidation.valid) {
                            errors[`comment_${studentName}_${index}`] = commentValidation.message;
                        }
                    });
                }
            }
        }
        
        return {
            valid: Object.keys(errors).length === 0,
            errors: errors
        };
    }

    /**
     * Valida estructura de datos importados
     * @param {any} data - Datos a validar
     * @returns {Object} - Resultado de validación
     */
    static validateImportedGroups(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return { valid: false, message: 'Formato de datos inválido. Debe ser un objeto.' };
        }
        
        const validGroups = {};
        const errors = [];
        
        for (const [groupName, students] of Object.entries(data)) {
            const groupValidation = this.validateGroup(groupName);
            if (!groupValidation.valid) {
                errors.push(`Grupo "${groupName}": ${groupValidation.message}`);
                continue;
            }
            
            if (!Array.isArray(students)) {
                errors.push(`Grupo "${groupName}": debe contener una lista de estudiantes`);
                continue;
            }
            
            if (students.length === 0) {
                errors.push(`Grupo "${groupName}": no puede estar vacío`);
                continue;
            }
            
            const validStudents = [];
            students.forEach((student, index) => {
                const studentValidation = this.validateStudentName(student);
                if (!studentValidation.valid) {
                    errors.push(`Grupo "${groupName}", estudiante ${index + 1}: ${studentValidation.message}`);
                } else {
                    validStudents.push(studentValidation.value);
                }
            });
            
            if (validStudents.length > 0) {
                validGroups[groupValidation.value] = validStudents;
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            validGroups: validGroups
        };
    }
}