// src/services/academic.service.js
import api from "../lib/api";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
const pickFirstArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    for (const k of keys) {
        if (Array.isArray(data?.[k])) return data[k];
    }
    return [];
};

const asBlobGet = async (url, params = {}) => {
    const res = await api.get(url, { params, responseType: "blob" });
    return res; // axios response (blob en res.data)
};

const asJson = async (method, url, payload, config = {}) => {
    try {
        const res = await api.request({
            method,
            url,
            data: payload,
            ...config,
        });
        return res.data;
    } catch (e) {
        const data = e?.response?.data;
        const msg =
            data?.detail ||
            data?.message ||
            (data && typeof data === "object"
                ? Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                    .join(" | ")
                : null) ||
            (typeof data === "string" ? data : null) ||
            e?.message ||
            "Error en la solicitud";
        throw new Error(msg);
    }
};

/* -------------------------------------------------------
   Catálogos base
   (OJO: tus carreras están en admission y viven en /api/careers, pero backend también tiene en /academic/careers)
------------------------------------------------------- */
export const Careers = {
    /**
     * Backend admission o academic:
     * - puede devolver: [ {id,name,...} ]
     * - o: {careers:[...]}
     */
    list: async () => {
        const data = await asJson("GET", "/academic/careers");
        const arr = pickFirstArray(data, ["careers", "items", "results"]);
        return { careers: arr };
    },

    create: async (payload) => asJson("POST", "/academic/careers", payload),

    update: async (id, payload) => asJson("PUT", `/academic/careers/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/academic/careers/${id}`),

    toggleActive: async (id) => asJson("POST", `/academic/careers/${id}/toggle-active`, {}),
};

/* -------------------------------------------------------
   Planes (mallas) - academic app (stub router: /academic/plans)
------------------------------------------------------- */
export const Courses = {
    list: async (params = {}) => {
        const data = await asJson("GET", "/academic/courses", null, { params });
        const arr = pickFirstArray(data, ["items", "courses", "results"]);
        return { items: arr };
    },
};

export const Plans = {
    list: async () => {
        const data = await asJson("GET", "/academic/plans");
        const arr = pickFirstArray(data, ["plans", "items", "results"]);
        // tu backend stub usa ok(plans=[...])
        return { plans: arr };
    },

    create: async (payload) => {
        const data = await asJson("POST", "/academic/plans", payload);
        // stub retorna {plan: {...}}
        return data;
    },

    update: async (id, payload) => asJson("PUT", `/academic/plans/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/academic/plans/${id}`),

    // Cursos de un plan
    listCourses: async (planId, params = undefined) => {
        const data = await asJson("GET", `/academic/plans/${planId}/courses`, null, {
            params: params || undefined,
        });

        // Backend devuelve:
        // - { semesters: [...] } si NO mandas semester
        // - { courses: [...], semester, total } si mandas semester
        return data;
    },

    addCourse: async (planId, payload) =>
        asJson("POST", `/academic/plans/${planId}/courses`, payload),

    updateCourse: async (planId, courseId, payload) =>
        asJson("PUT", `/academic/plans/${planId}/courses/${courseId}`, payload),

    removeCourse: async (planId, courseId) =>
        asJson("DELETE", `/academic/plans/${planId}/courses/${courseId}`),

    // Prerrequisitos (según tu stub: PUT /academic/plans/:id/courses/:course_id/prereqs)
    setPrereqs: async (planId, courseId, prereqIds) =>
        asJson("PUT", `/academic/plans/${planId}/courses/${courseId}/prereqs`, {
            prerequisites: prereqIds,
        }),

    // si en algún momento lo implementas en backend real:
    listPrereqs: async (planId, courseId) =>
        asJson("GET", `/academic/plans/${planId}/courses/${courseId}/prereqs`),
};

/* -------------------------------------------------------
   Secciones / horarios
------------------------------------------------------- */
export const Sections = {
    list: async (params = {}) => {
        const data = await asJson("GET", "/academic/sections", null, { params });
        const arr = pickFirstArray(data, ["sections", "items", "results"]);
        return { sections: arr };
    },

    create: async (payload) => asJson("POST", "/academic/sections", payload),

    update: async (id, payload) => asJson("PUT", `/academic/sections/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/academic/sections/${id}`),

    // Validaciones
    checkConflicts: async (payload) =>
        asJson("POST", "/academic/sections/schedule/conflicts", payload),

    rooms: async () => {
        const data = await asJson("GET", "/academic/classrooms");
        const arr = pickFirstArray(data, ["classrooms", "items", "results"]);
        return { classrooms: arr };
    },

    teachers: async () => {
        const data = await asJson("GET", "/academic/teachers");
        const arr = pickFirstArray(data, ["teachers", "items", "results"]);
        return { teachers: arr };
    },

    // Horarios por sección (si tu backend lo implementa)
    listSchedule: async (sectionId) =>
        asJson("GET", `/academic/sections/${sectionId}/schedule`),

    setSchedule: async (sectionId, slots) =>
        asJson("PUT", `/academic/sections/${sectionId}/schedule`, { slots }),
};

/* -------------------------------------------------------
   Kárdex / PDFs
------------------------------------------------------- */

// intenta URL tal cual; si da 404, prueba con slash final o sin slash (según venga)
const asBlobGetSmart = async (url, params = {}) => {
    try {
        return await asBlobGet(url, params);
    } catch (e) {
        const status = e?.response?.status;

        // Solo fallback si es 404 (ruta no encontrada)
        if (status === 404) {
            const hasSlash = url.endsWith("/");
            const altUrl = hasSlash ? url.slice(0, -1) : `${url}/`;
            return await asBlobGet(altUrl, params);
        }

        throw e;
    }
};

export const Kardex = {
    ofStudent: (studentKey) =>
        api.get(`/academic/kardex/${studentKey}`).then((r) => r.data),

    exportXlsx: (studentKey, params) =>
        api.get(`/academic/kardex/${studentKey}/export/xlsx`, {
            params,
            responseType: "blob",
        }),

    // ✅ Boleta completa (malla)
    exportBoletaPdf: (studentKey) =>
        asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/pdf`, {}),

    // ✅ Boleta oficial por periodo (ciclo)
    exportBoletaPeriodoPdf: (studentKey, period) =>
        asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/periodo/pdf`, { period }),

    // ✅ Constancia
    exportConstanciaPdf: (studentKey) =>
        asBlobGetSmart(`/academic/kardex/${studentKey}/constancia/pdf`, {}),

    // ✅ Boleta por año (2 ciclos) — tu backend recibe period (ej: 2018-II) para sacar el año
    exportBoletaAnioPdf: (studentKey, period) =>
        asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/anio/pdf`, { period }),
};

/* -------------------------------------------------------
   Procesos académicos
------------------------------------------------------- */
export const Processes = {
    retiro: async (payload) => asJson("POST", "/academic/processes/withdraw", payload),
    reserva: async (payload) => asJson("POST", "/academic/processes/reservation", payload),
    convalidacion: async (payload) => asJson("POST", "/academic/processes/validation", payload),
    traslado: async (payload) => asJson("POST", "/academic/processes/transfer", payload),
    reincorporacion: async (payload) => asJson("POST", "/academic/processes/rejoin", payload),
};

export const Periods = {
    list: async () => asJson("GET", "/academic/periods"),
};

/* -------------------------------------------------------
   Asistencia
------------------------------------------------------- */
export const Attendance = {
    createSession: async (sectionId, payload = {}) =>
        asJson("POST", `/academic/sections/${sectionId}/attendance/sessions`, payload),

    listSessions: async (sectionId) =>
        asJson("GET", `/academic/sections/${sectionId}/attendance/sessions`),

    closeSession: async (sectionId, sessionId) =>
        asJson("POST", `/academic/sections/${sectionId}/attendance/sessions/${sessionId}/close`, {}),

    set: async (sectionId, sessionId, rows) =>
        asJson("PUT", `/academic/sections/${sectionId}/attendance/sessions/${sessionId}`, { rows }),
};

/* -------------------------------------------------------
   Sugerencias de matrícula
------------------------------------------------------- */
export const Enrollment = {
    suggestions: async (payload) => asJson("POST", "/academic/enrollments/suggestions", payload),
};

/* -------------------------------------------------------
   Sílabos & Evaluación
------------------------------------------------------- */
export const Syllabus = {
    get: async (sectionId) => asJson("GET", `/academic/sections/${sectionId}/syllabus`),

    upload: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return asJson("POST", `/academic/sections/${sectionId}/syllabus`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    delete: async (sectionId) => asJson("DELETE", `/academic/sections/${sectionId}/syllabus`),
};

export const Evaluation = {
    getConfig: async (sectionId) => asJson("GET", `/academic/sections/${sectionId}/evaluation`),

    setConfig: async (sectionId, config) =>
        asJson("PUT", `/academic/sections/${sectionId}/evaluation`, { config }),
};

/* -------------------------------------------------------
   Procesos: bandeja/archivos/estado
------------------------------------------------------- */
export const ProcessFiles = {
    list: async (processId) => asJson("GET", `/academic/processes/${processId}/files`),

    upload: async (processId, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.note) fd.append("note", meta.note);
        return asJson("POST", `/academic/processes/${processId}/files`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    remove: async (processId, fileId) =>
        asJson("DELETE", `/academic/processes/${processId}/files/${fileId}`),
};

export const ProcessesInbox = {
    myRequests: async (params = {}) => asJson("GET", "/academic/processes/my", null, { params }),

    listAll: async (params = {}) => asJson("GET", "/academic/processes", null, { params }),

    get: async (id) => asJson("GET", `/academic/processes/${id}`),

    setStatus: async (id, payload) => asJson("POST", `/academic/processes/${id}/status`, payload),

    notify: async (id, payload) => asJson("POST", `/academic/processes/${id}/notify`, payload),
};

/* -------------------------------------------------------
   Reportes
------------------------------------------------------- */
export const AcademicReports = {
    summary: async (params) => {
        const { data } = await api.get("/academic/reports/summary", { params });
        // backend devuelve ok(summary={...})
        return data?.summary ?? data;
    },

    careers: async () => {
        const { data } = await api.get("/academic/careers");
        return data?.careers ?? [];
    },

    exportPerformance: async (params) =>
        await api.get("/academic/reports/performance.xlsx", { params, responseType: "blob" }),

    exportOccupancy: async (params) =>
        await api.get("/academic/reports/occupancy.xlsx", { params, responseType: "blob" }),
};
/* -------------------------------------------------------
   Docente / Secciones / Estudiantes / Notas (para módulo docente)
------------------------------------------------------- */
export const Teacher = {
    /**
     * GET /teachers/:teacher_user_id/sections
     * Esperado:
     * - { sections: [...] }
     * o - [...] (si tu backend devuelve array directo)
     */
    sections: async (teacherUserId) => {
        const data = await asJson("GET", `/academic/teachers/${teacherUserId}/sections`);
        const arr = pickFirstArray(data, ["sections", "items", "results"]);
        return { sections: arr };
    },
    sectionsMe: () => api.get("/teachers/me/sections").then(r => r.data),
};

export const SectionStudents = {
    /**
     * GET /sections/:section_id/students
     * Esperado:
     * - { students: [...] }
     * o - [...]
     */
    list: async (sectionId) => {
        const data = await asJson("GET", `/academic/sections/${sectionId}/students`);
        const arr = pickFirstArray(data, ["students", "items", "results"]);
        return { students: arr };
    },
};

export const Grades = {
    /**
     * GET /sections/:section_id/grades
     * Esperado:
     * - { grades: { [studentId]: {PARCIAL_1:..., ...} } }
     */
    get: async (sectionId) => asJson("GET", `/academic/sections/${sectionId}/grades`),

    /**
     * POST /grades/save
     * payload: { section_id, grades }
     */
    save: async (sectionId, grades) =>
        asJson("POST", "/academic/grades/save", { section_id: sectionId, grades }),

    /**
     * POST /grades/submit
     */
    submit: async (sectionId, grades) =>
        asJson("POST", "/academic/grades/submit", { section_id: sectionId, grades }),

    /**
     * POST /grades/reopen
     */
    reopen: async (sectionId) =>
        asJson("POST", "/academic/grades/reopen", { section_id: sectionId }),
};

export const AttendanceImport = {
    /**
     * POST /attendance/import/preview (multipart)
     * formData: file + section_id
     */
    preview: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("section_id", sectionId);

        return asJson("POST", "/academic/attendance/import/preview", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    /**
     * POST /attendance/import/save
     * payload: { section_id, attendance_data }
     */
    save: async (sectionId, attendanceData) =>
        asJson("POST", "/academic/attendance/import/save", {
            section_id: sectionId,
            attendance_data: attendanceData,
        }),
};