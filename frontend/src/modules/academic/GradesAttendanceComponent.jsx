// src/pages/academic/GradesAttendanceComponent.jsx
import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Progress } from "../../components/ui/progress";
import { toast } from "sonner";
import { Upload, Save, Send, Lock, Unlock, FileText, Users, Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { generatePDFWithPolling, generateQRWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import { Attendance, Teacher, SectionStudents, Grades, AttendanceImport } from "../../services/academic.service";

/* ----------------------------- Pagination helper ----------------------------- */
function Pagination({ page, totalPages, onPageChange, className = "" }) {
  if (totalPages <= 1) return null;

  const go = (p) => onPageChange(Math.min(Math.max(1, p), totalPages));

  const nums = (() => {
    const set = new Set([1, totalPages, page - 1, page, page + 1]);
    const arr = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < arr.length; i++) {
      out.push(arr[i]);
      if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) out.push("…");
    }
    return out;
  })();

  return (
    <div className={`flex items-center justify-between gap-2 flex-wrap ${className}`}>
      <div className="text-xs text-muted-foreground">
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {nums.map((n, idx) =>
            n === "…" ? (
              <span key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={n}
                type="button"
                variant={n === page ? "default" : "outline"}
                size="sm"
                className="rounded-xl min-w-[2.25rem]"
                onClick={() => go(n)}
              >
                {n}
              </Button>
            )
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- BARRA DE IMPORTACIÓN ----------------------------- */
function ImportProgressOverlay({ isImporting, progress, onCancel }) {
  if (!isImporting) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <div>
              <h3 className="font-semibold text-lg">Importando asistencia...</h3>
              <p className="text-sm text-muted-foreground">
                No cambies de pestaña hasta que termine el proceso
              </p>
            </div>
          </div>

          <Progress value={progress} className="h-3" />
          <p className="text-sm text-center text-muted-foreground">
            {Math.round(progress)}% completado
          </p>

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
            disabled={progress > 50}
          >
            Cancelar (puede fallar)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GradesAttendanceComponent() {
  const { user } = useContext(AuthContext);

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);

  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [attendanceSessions, setAttendanceSessions] = useState([]);

  const [activeTab, setActiveTab] = useState("grades");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // IMPORTACIÓN CSV
  const [importDialog, setImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionRows, setSessionRows] = useState([]);

  // ✅ PAGINACIÓN
  const [gradesPage, setGradesPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [takeAttPage, setTakeAttPage] = useState(1);

  const gradesPageSize = 8; // Reducido por más columnas del ACTA
  const sessionsPageSize = 10;
  const takeAttendancePageSize = 10;

  /* ======================= NUEVO ESQUEMA ACTA ======================= */
  const LEVELS = ["PI", "I", "P", "L", "D"];
  const LEVEL_TO_NUM = { PI: 1, I: 2, P: 3, L: 4, D: 5 };

  const FIELDS = {
    C1_LEVEL: "C1_LEVEL",
    C1_REC: "C1_REC",
    C2_LEVEL: "C2_LEVEL",
    C2_REC: "C2_REC",
    C3_LEVEL: "C3_LEVEL",
    C3_REC: "C3_REC",
    C1: "C1", // 1..5
    C2: "C2", // 1..5
    C3: "C3", // 1..5
  };

  const attendanceStates = {
    PRESENT: { label: "Presente", color: "bg-green-500" },
    ABSENT: { label: "Ausente", color: "bg-red-500" },
    LATE: { label: "Tardanza", color: "bg-yellow-500" },
    EXCUSED: { label: "Justificado", color: "bg-blue-500" },
  };

  // ✅ CÁLCULOS AUTOMÁTICOS DEL ACTA
  const calcPromedio = useCallback((sg) => {
    const values = [sg?.C1, sg?.C2, sg?.C3, sg?.FINAL].map(Number).filter(n => !Number.isNaN(n));
    if (values.length === 0) return "";
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 10) / 10;
  }, []);

  const calcEscala05 = useCallback((sg) => {
    const c1 = Number(sg?.C1);
    const c2 = Number(sg?.C2);
    const c3 = Number(sg?.C3);
    const vals = [c1, c2, c3].filter((n) => !Number.isNaN(n) && n >= 1 && n <= 5);
    if (vals.length !== 3) return "";
    const avg = vals.reduce((a, b) => a + b, 0) / 3;
    return Math.round(avg * 10) / 10; // 1 decimal => 4.0
  }, []);

  const calcPromFinal20 = useCallback((sg) => {
    const escala = calcEscala05(sg);
    if (escala === "" || escala === null || escala === undefined) return "";
    const val = ((Number(escala) - 1) / 4) * 20;
    return Math.round(val); // 4.0 -> 15
  }, [calcEscala05]);

  const calcEstado = useCallback((sg) => {
    const pf = calcPromFinal20(sg);
    if (pf === "" || pf === null || pf === undefined) return "";
    return Number(pf) >= 11 ? "Logrado" : "En proceso";
  }, [calcPromFinal20]);

  const showToast = (type, message) => {
    const toastElement = document.createElement("div");
    toastElement.setAttribute("data-testid", `toast-${type}`);
    toastElement.textContent = message;
    document.body.appendChild(toastElement);
    toast[type](message);
    setTimeout(() => {
      if (document.body.contains(toastElement)) document.body.removeChild(toastElement);
    }, 5000);
  };

  // ✅ EFECTOS
  useEffect(() => {
    if (!user?.id) return;
    fetchTeacherSections();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSection?.id) return;
    fetchSectionStudents();
    fetchGrades();
    fetchAttendanceSessions();
    setGradesPage(1);
    setSessionsPage(1);
    setTakeAttPage(1);
  }, [selectedSection?.id]);

  useEffect(() => {
    setGradesPage(1);
    setSessionsPage(1);
    setTakeAttPage(1);
  }, [activeTab]);

  // ✅ FETCH FUNCTIONS
  const fetchTeacherSections = async () => {
    try {
      const data = await Teacher.sections(user.id);
      const secs = data?.sections || [];
      setSections(secs);
      setSelectedSection((prev) => {
        if (!prev?.id) return prev;
        return secs.find((s) => String(s.id) === String(prev.id)) || null;
      });
    } catch (e) {
      showToast("error", e.message || "Error al cargar secciones");
      setSections([]);
    }
  };

  const fetchSectionStudents = async () => {
    try {
      const { students } = await SectionStudents.list(selectedSection.id);
      setStudents(students || []);
    } catch (e) {
      showToast("error", e.message || "Error al cargar estudiantes");
    }
  };

  const fetchGrades = async () => {
    try {
      const data = await Grades.get(selectedSection.id);
      setGrades(data?.grades || {});
    } catch (e) {
      showToast("error", e.message || "Error al cargar calificaciones");
    }
  };

  const fetchAttendanceSessions = async () => {
    try {
      const d = await Attendance.listSessions(selectedSection.id);
      setAttendanceSessions(d?.sessions || []);
    } catch (e) {
      showToast("error", e.message || "Error al cargar sesiones");
    }
  };

  // ✅ ASISTENCIA
  const createAttendanceSession = async () => {
    try {
      const r = await Attendance.createSession(selectedSection.id, { date: sessionDate });
      const ses = r?.session || r;
      setCurrentSession(ses);
      const rows = students.map((s) => ({ student_id: s.id, status: "PRESENT" }));
      setSessionRows(rows);
      setTakeAttPage(1);
      await fetchAttendanceSessions();
      showToast("success", "Sesión creada");
    } catch (e) {
      showToast("error", e.message || "No se pudo crear la sesión");
    }
  };

  const setRowStatus = (studentId, status) => {
    setSessionRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)));
  };

  const saveAttendance = async () => {
    if (!currentSession) return;
    try {
      await Attendance.set(selectedSection.id, currentSession.id, sessionRows);
      showToast("success", "Asistencia guardada");
    } catch (e) {
      showToast("error", e.message || "Error al guardar asistencia");
    }
  };

  const closeAttendance = async () => {
    if (!currentSession) return;
    try {
      await Attendance.set(selectedSection.id, currentSession.id, sessionRows);
      await Attendance.closeSession(selectedSection.id, currentSession.id);
      setCurrentSession(null);
      setSessionRows([]);
      await fetchAttendanceSessions();
      showToast("success", "Sesión cerrada");
    } catch (e) {
      showToast("error", e.message || "Error al cerrar sesión");
    }
  };

  // ✅ NUEVAS FUNCIONES ACTA
  const updateGrade = (studentId, field, value) => {
    setGrades((prev) => {
      const current = prev[studentId] || {};
      const next = { ...current, [field]: value ?? "" };

      // ✅ Si cambian niveles, auto-deriva C1/C2/C3 (1..5) como en acta
      if (field === "C1_LEVEL") next.C1 = LEVEL_TO_NUM[value] ?? next.C1 ?? "";
      if (field === "C2_LEVEL") next.C2 = LEVEL_TO_NUM[value] ?? next.C2 ?? "";
      if (field === "C3_LEVEL") next.C3 = LEVEL_TO_NUM[value] ?? next.C3 ?? "";

      // ✅ Si editan C1/C2/C3 manualmente, solo permitimos 1..5
      if (field === "C1" || field === "C2" || field === "C3") {
        if (value === "") return { ...prev, [studentId]: { ...next, [field]: "" } };
        const n = Number(value);
        if (Number.isNaN(n) || n < 1 || n > 5) return prev; // no cambies nada
        next[field] = n;
      }

      return { ...prev, [studentId]: next };
    });
  };


  const saveGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    setIsSaving(true);
    try {
      await Grades.save(selectedSection.id, grades);
      showToast("success", "Acta guardada");
    } catch (e) {
      showToast("error", e.message || "Error al guardar acta");
    } finally {
      setIsSaving(false);
    }
  };

  const submitGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");

    const requiredFields = ["C1_LEVEL", "C2_LEVEL", "C3_LEVEL", "C1", "C2", "C3"];
    const missing = students.some((st) => {
      const sg = grades[st.id] || {};
      return requiredFields.some((f) => sg[f] === undefined || sg[f] === null || sg[f] === "");
    });

    if (missing) return showToast("error", "Complete niveles PI/I/P/L/D y C1-C3 (1..5) antes de enviar");
    setIsSubmitting(true);
    try {
      await Grades.submit(selectedSection.id, grades);
      showToast("success", "Acta enviada y cerrada");
      await generateActaPDF();
    } catch (e) {
      showToast("error", e.message || "Error al enviar acta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reopenGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    setIsSubmitting(true);
    try {
      await Grades.reopen(selectedSection.id);
      showToast("success", "Acta reabierta");
      await fetchGrades();
    } catch (e) {
      showToast("error", e.message || "Error al reabrir acta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateActaPDF = async () => {
    if (!selectedSection?.id) return;
    try {
      const result = await generatePDFWithPolling(`/sections/${selectedSection.id}/acta`, {}, { testId: "acta-pdf" });
      if (result.success) {
        await downloadFile(result.downloadUrl, `acta-${selectedSection.course_code || "CURSO"}-${selectedSection.id}.pdf`);
        showToast("success", "Acta PDF generada");
        await generateActaQR();
      }
    } catch (error) {
      showToast("error", "Error al generar acta PDF");
    }
  };

  const generateActaQR = async () => {
    if (!selectedSection?.id) return;
    try {
      const result = await generateQRWithPolling(`/sections/${selectedSection.id}/acta/qr`, {}, { testId: "acta-qr-code" });
      if (result.success) showToast("success", "Código QR generado");
    } catch (error) {
      showToast("error", "Error al generar código QR");
    }
  };

  // ✅ IMPORTACIÓN CON BARRA DE PROGRESO
  const importAttendanceCSV = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (!csvFile) return showToast("error", "Seleccione un archivo CSV");

    setIsImporting(true);
    setImportProgress(0);

    try {
      const result = await AttendanceImport.preview(selectedSection.id, csvFile);
      setImportPreview(result.preview || []);
      setImportErrors(result.errors || []);

      if (result.errors?.length) {
        showToast("error", `${result.errors.length} errores en el archivo`);
      } else {
        showToast("success", "Vista previa generada");
        setImportProgress(70);
      }
    } catch (e) {
      showToast("error", e.message || "Error al importar asistencia");
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  const saveAttendanceImport = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (importErrors.length > 0) return showToast("error", "Corrija los errores antes de guardar");

    setIsImporting(true);
    setImportProgress(10);

    try {
      await AttendanceImport.save(selectedSection.id, importPreview);
      showToast("success", "Asistencia importada correctamente");
      setImportDialog(false);
      setImportPreview([]);
      setImportErrors([]);
      setCsvFile(null);
      setImportProgress(100);
      await fetchAttendanceSessions();
    } catch (e) {
      showToast("error", e.message || "Error al guardar asistencia");
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 1000);
    }
  };

  // ✅ DATOS PAGINADOS
  const gradesTotalPages = Math.max(1, Math.ceil(students.length / gradesPageSize));
  const pagedStudentsForGrades = useMemo(() => {
    const start = (gradesPage - 1) * gradesPageSize;
    return students.slice(start, start + gradesPageSize);
  }, [students, gradesPage]);

  const sessionsTotalPages = Math.max(1, Math.ceil(attendanceSessions.length / sessionsPageSize));
  const pagedSessions = useMemo(() => {
    const start = (sessionsPage - 1) * sessionsPageSize;
    return attendanceSessions.slice(start, start + sessionsPageSize);
  }, [attendanceSessions, sessionsPage]);

  const takeAttTotalPages = Math.max(1, Math.ceil(students.length / takeAttendancePageSize));
  const pagedStudentsForAttendance = useMemo(() => {
    const start = (takeAttPage - 1) * takeAttendancePageSize;
    return students.slice(start, start + takeAttendancePageSize);
  }, [students, takeAttPage]);

  // Clamp pages
  useEffect(() => {
    if (gradesPage > gradesTotalPages) setGradesPage(gradesTotalPages);
  }, [gradesTotalPages, gradesPage]);

  useEffect(() => {
    if (sessionsPage > sessionsTotalPages) setSessionsPage(sessionsTotalPages);
  }, [sessionsTotalPages, sessionsPage]);

  useEffect(() => {
    if (takeAttPage > takeAttTotalPages) setTakeAttPage(takeAttTotalPages);
  }, [takeAttTotalPages, takeAttPage]);

  // ✅ COLORES ASISTENCIA
  const getStatusColorClass = (status) => {
    if (status === "PRESENT") return "!bg-blue-600 !text-white !border-blue-700";
    if (status === "ABSENT") return "!bg-red-600 !text-white !border-red-700";
    if (status === "LATE" || status === "EXCUSED") return "!bg-amber-500 !text-white !border-amber-600";
    return "";
  };

  return (
    <>
      <div className="space-y-6 pb-24 sm:pb-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Acta, Calificaciones y Asistencia
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label htmlFor="section-select" className="text-sm">
              Sección:
            </Label>
            <Select
              value={selectedSection?.id ? String(selectedSection.id) : ""}
              onValueChange={(value) => {
                const section = sections.find((s) => String(s.id) === value);
                setSelectedSection(section || null);
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Seleccionar sección" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={String(section.id)}>
                    {(section.course_name || section.course_code || "Curso")} -{" "}
                    {(section.section_code || section.label || `SEC-${section.id}`)}
                  </SelectItem>
                ))}
                {sections.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">
                    No tienes secciones asignadas
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedSection && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto overflow-x-auto flex flex-nowrap gap-2">
              <TabsTrigger value="grades" className="shrink-0 data-[state=active]:bg-blue-600">Acta</TabsTrigger>
              <TabsTrigger value="attendance" className="shrink-0">Asistencia</TabsTrigger>
            </TabsList>

            {/* ✅ TAB 1: ACTA COMPLETA (reemplaza parciales) */}
            <TabsContent value="grades">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <CardTitle>Acta de Evaluación</CardTitle>
                      <CardDescription className="break-words">
                        {selectedSection.course_name || selectedSection.course_code} -{" "}
                        {selectedSection.section_code || selectedSection.label}
                      </CardDescription>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full lg:w-auto">
                      <Button
                        data-testid="grade-save"
                        variant="outline"
                        onClick={saveGrades}
                        disabled={isSaving}
                        className="w-full sm:w-auto"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Guardar Acta
                          </>
                        )}
                      </Button>

                      <Button
                        data-testid="grade-submit"
                        onClick={submitGrades}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar y Cerrar Acta
                          </>
                        )}
                      </Button>

                      {(user?.role === "REGISTRAR" || user?.role === "ADMIN_ACADEMIC") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button data-testid="grade-reopen" variant="outline" className="w-full sm:w-auto">
                              <Unlock className="h-4 w-4 mr-2" />
                              Reabrir Acta
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Reabrir acta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esto desbloquea la sección para editar el acta nuevamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={reopenGrades} disabled={isSubmitting}>
                                Sí, reabrir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      <Button data-testid="act-generate-pdf" variant="outline" onClick={generateActaPDF} className="w-full sm:w-auto">
                        <FileText className="h-4 w-4 mr-2" />
                        Generar PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* ✅ TABLA ACTA (SEGÚN IMAGEN MINEDU) */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Estudiante</th>

                          {/* 3 competencias: nivel + recomendación */}
                          <th className="p-2 text-center">Comp 1 (Nivel)</th>
                          <th className="p-2 text-left min-w-[220px]">Recomendación</th>

                          <th className="p-2 text-center">Comp 2 (Nivel)</th>
                          <th className="p-2 text-left min-w-[220px]">Recomendación</th>

                          <th className="p-2 text-center">Comp 3 (Nivel)</th>
                          <th className="p-2 text-left min-w-[220px]">Recomendación</th>

                          {/* Conclusión descriptiva */}
                          <th className="p-2 text-center">C1</th>
                          <th className="p-2 text-center">C2</th>
                          <th className="p-2 text-center">C3</th>

                          {/* Cálculos de la derecha */}
                          <th className="p-2 text-center">Calif. sistema (0-5)</th>
                          <th className="p-2 text-center">Promedio final</th>
                          <th className="p-2 text-center">Calificación</th>
                        </tr>
                      </thead>

                      <tbody>
                        {pagedStudentsForGrades.map((st) => {
                          const sg = grades[st.id] || {};
                          const escala05 = calcEscala05(sg);
                          const promFinal = calcPromFinal20(sg);
                          const estado = calcEstado(sg);

                          return (
                            <tr key={st.id} className="border-t hover:bg-gray-50">
                              <td className="p-2 font-medium">
                                {st.first_name} {st.last_name}
                              </td>

                              {/* COMP 1 */}
                              <td className="p-2 text-center">
                                <Select value={sg.C1_LEVEL || ""} onValueChange={(v) => updateGrade(st.id, "C1_LEVEL", v)}>
                                  <SelectTrigger className="w-16 h-9 justify-center">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LEVELS.map((l) => (
                                      <SelectItem key={l} value={l}>{l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-9"
                                  placeholder="Recomendación / comentario"
                                  value={sg.C1_REC || ""}
                                  onChange={(e) => updateGrade(st.id, "C1_REC", e.target.value)}
                                />
                              </td>

                              {/* COMP 2 */}
                              <td className="p-2 text-center">
                                <Select value={sg.C2_LEVEL || ""} onValueChange={(v) => updateGrade(st.id, "C2_LEVEL", v)}>
                                  <SelectTrigger className="w-16 h-9 justify-center">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LEVELS.map((l) => (
                                      <SelectItem key={l} value={l}>{l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-9"
                                  placeholder="Recomendación / comentario"
                                  value={sg.C2_REC || ""}
                                  onChange={(e) => updateGrade(st.id, "C2_REC", e.target.value)}
                                />
                              </td>

                              {/* COMP 3 */}
                              <td className="p-2 text-center">
                                <Select value={sg.C3_LEVEL || ""} onValueChange={(v) => updateGrade(st.id, "C3_LEVEL", v)}>
                                  <SelectTrigger className="w-16 h-9 justify-center">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LEVELS.map((l) => (
                                      <SelectItem key={l} value={l}>{l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-9"
                                  placeholder="Recomendación / comentario"
                                  value={sg.C3_REC || ""}
                                  onChange={(e) => updateGrade(st.id, "C3_REC", e.target.value)}
                                />
                              </td>

                              {/* CONCLUSIÓN C1 C2 C3 (1..5) */}
                              {["C1", "C2", "C3"].map((c) => (
                                <td key={c} className="p-2 text-center">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="5"
                                    step="1"
                                    className="w-16 h-9 text-center"
                                    value={sg[c] ?? ""}
                                    onChange={(e) => updateGrade(st.id, c, e.target.value)}
                                  />
                                </td>
                              ))}

                              {/* Calif sistema (0-5) */}
                              <td className="p-2 text-center font-semibold">
                                {escala05 === "" ? "-" : escala05.toFixed(1)}
                              </td>

                              {/* Promedio final (0-20) */}
                              <td className="p-2 text-center font-semibold">
                                {promFinal === "" ? "-" : promFinal}
                              </td>

                              {/* Estado */}
                              <td className="p-2 text-center">
                                <Badge variant={estado === "Logrado" ? "default" : "secondary"} className="font-semibold">
                                  {estado || "-"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}

                        {students.length === 0 && (
                          <tr>
                            <td colSpan={13} className="p-6 text-center text-gray-500">
                              Sin estudiantes en esta sección
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>


                  <Pagination
                    page={gradesPage}
                    totalPages={gradesTotalPages}
                    onPageChange={setGradesPage}
                  />

                  {/* Fecha sesión (para nueva asistencia desde acta) */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div>
                      <Label>Fecha de sesión</Label>
                      <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                    </div>
                    <Button onClick={createAttendanceSession} className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Nueva sesión
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ✅ TAB 2: ASISTENCIA (sin cambios) */}
            <TabsContent value="attendance">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <CardTitle>Control de Asistencia</CardTitle>
                      <CardDescription className="break-words">
                        {selectedSection.course_name || selectedSection.course_code} -{" "}
                        {selectedSection.section_code || selectedSection.label}
                      </CardDescription>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                      <div className="flex items-end gap-2">
                        <div>
                          <Label>Fecha</Label>
                          <Input
                            type="date"
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                          />
                        </div>
                        <Button onClick={createAttendanceSession} className="gap-2">
                          <Calendar className="h-4 w-4" />
                          Nueva sesión
                        </Button>
                      </div>

                      <Dialog open={importDialog} onOpenChange={setImportDialog}>
                        <DialogTrigger asChild>
                          <Button data-testid="attendance-import" variant="outline" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Importar CSV
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Importar Asistencia CSV</DialogTitle>
                            <DialogDescription>
                              <strong>¡IMPORTANTE!</strong> No cambie de pestaña durante la importación.
                              El proceso puede tomar varios minutos con archivos grandes.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="csv-file">Archivo CSV</Label>
                              <Input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                              />
                            </div>

                            <Button onClick={importAttendanceCSV} disabled={!csvFile} className="gap-2">
                              <FileText className="h-4 w-4" />
                              Generar Vista Previa
                            </Button>

                            {importErrors.length > 0 && (
                              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <h4 className="font-semibold text-red-800 mb-3">
                                  ⚠️ {importErrors.length} errores encontrados:
                                </h4>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {importErrors.map((error, index) => (
                                    <p key={index} className="text-sm text-red-700">
                                      • Fila {error.row}: {error.message}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {importPreview.length > 0 && (
                              <div className="mt-6">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  📋 Vista previa ({importPreview.length} registros)
                                </h4>
                                <div className="max-h-48 overflow-auto border rounded-lg">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                      <tr>
                                        <th className="p-3 text-left">Estudiante</th>
                                        <th className="p-3 text-left">Fecha</th>
                                        <th className="p-3 text-left">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {importPreview.slice(0, 8).map((record, index) => (
                                        <tr key={index} className="border-t">
                                          <td className="p-3">{record.student_name}</td>
                                          <td className="p-3">{record.date}</td>
                                          <td className="p-3">
                                            <Badge className={`bg-[${attendanceStates[record.status]?.color || 'gray'}-100'] text-[${attendanceStates[record.status]?.color || 'gray'}-800]`}>
                                              {attendanceStates[record.status]?.label || record.status}
                                            </Badge>
                                          </td>
                                        </tr>
                                      ))}
                                      {importPreview.length > 8 && (
                                        <tr>
                                          <td colSpan={3} className="p-3 text-center text-gray-500 text-xs">
                                            ... y {importPreview.length - 8} registros más
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button
                                data-testid="dialog-cancel"
                                variant="outline"
                                onClick={() => {
                                  setImportDialog(false);
                                  setCsvFile(null);
                                  setImportPreview([]);
                                  setImportErrors([]);
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                data-testid="attendance-save"
                                onClick={saveAttendanceImport}
                                disabled={importPreview.length === 0 || importErrors.length > 0 || isImporting}
                                className="gap-2 bg-green-600 hover:bg-green-700"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Importando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4" />
                                    Guardar Asistencia
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Lista sesiones */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="p-4 font-semibold bg-gradient-to-r from-gray-50 to-gray-100">
                      Sesiones registradas ({attendanceSessions.length})
                    </div>
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="p-3 text-left">Fecha</th>
                            <th className="p-3 text-left">Estado</th>
                            <th className="p-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedSessions.map((s) => (
                            <tr key={s.id} className="border-t hover:bg-gray-50">
                              <td className="p-3 font-medium">{s.date}</td>
                              <td className="p-3">
                                {s.is_closed ? (
                                  <Badge variant="destructive">Cerrada</Badge>
                                ) : (
                                  <Badge variant="default">Abierta</Badge>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => {
                                    setCurrentSession(s);
                                    const rowsFromApi = Array.isArray(s?.rows)
                                      ? s.rows.map((r) => ({
                                        student_id: Number(r.student_id ?? r.student ?? r.studentId),
                                        status: String(r.status || "PRESENT").toUpperCase(),
                                      }))
                                      : [];
                                    const byId = new Map(rowsFromApi.map((r) => [String(r.student_id), r]));
                                    const merged = students.map((st) => {
                                      const hit = byId.get(String(st.id));
                                      return { student_id: st.id, status: hit?.status || "PRESENT" };
                                    });
                                    setSessionRows(merged);
                                    setTakeAttPage(1);
                                  }}
                                  disabled={Boolean(s?.is_closed)}
                                >
                                  {s.is_closed ? "Cerrada" : "Abrir"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {attendanceSessions.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-500">
                                Sin sesiones registradas
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Pagination
                    page={sessionsPage}
                    totalPages={sessionsTotalPages}
                    onPageChange={setSessionsPage}
                  />

                  {/* Sesión actual */}
                  {currentSession && (
                    <Card className="border-2 border-blue-200">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                          <div className="font-semibold text-lg text-blue-900">
                            📝 Tomando asistencia — {currentSession.date}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCurrentSession(null);
                                setSessionRows([]);
                              }}
                            >
                              Cerrar
                            </Button>
                          </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-50">
                              <tr>
                                <th className="p-3 text-left">Estudiante</th>
                                <th className="p-3 text-left w-48">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedStudentsForAttendance.map((st) => {
                                const row = sessionRows.find((r) => r.student_id === st.id) || { status: "PRESENT" };
                                return (
                                  <tr key={st.id} className="border-t">
                                    <td className="p-3">{st.first_name} {st.last_name}</td>
                                    <td className="p-3">
                                      <Select value={row.status} onValueChange={(v) => setRowStatus(st.id, v)}>
                                        <SelectTrigger className={`w-48 font-semibold transition-all ${getStatusColorClass(row.status)}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PRESENT">✅ Presente</SelectItem>
                                          <SelectItem value="ABSENT">❌ Ausente</SelectItem>
                                          <SelectItem value="LATE">⏰ Tardanza</SelectItem>
                                          <SelectItem value="EXCUSED">📄 Justificado</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <Pagination
                          page={takeAttPage}
                          totalPages={takeAttTotalPages}
                          onPageChange={setTakeAttPage}
                        />

                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                          <Button variant="outline" onClick={saveAttendance} className="flex-1 sm:flex-none">
                            <Save className="h-4 w-4 mr-2" />
                            Guardar temporal
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700">
                                <Lock className="h-4 w-4 mr-2" />
                                Cerrar sesión definitivamente
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar cierre</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se guardará permanentemente y no podrás editarla después.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={closeAttendance}>
                                  Sí, cerrar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!currentSession && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gradient-to-b from-gray-50 to-white">
                      <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="font-semibold text-lg mb-1 text-gray-900">No hay sesión activa</h3>
                      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                        Crea una nueva sesión de asistencia o abre una existente para editarla (solo si está abierta).
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-4 w-4" />
                          <span>{sessionDate}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={createAttendanceSession}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Crear primera sesión
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Status indicators */}
        <div style={{ display: "none" }}>
          <div data-testid="acta-pdf-status">IDLE</div>
          <div data-testid="acta-qr-status">IDLE</div>
          <img data-testid="acta-qr-code" data-status="idle" alt="QR Code" />
        </div>
      </div>

      {/* ✅ OVERLAY BARRA DE IMPORTACIÓN */}
      <ImportProgressOverlay
        isImporting={isImporting}
        progress={importProgress}
        onCancel={() => {
          setIsImporting(false);
          setImportProgress(0);
        }}
      />
    </>
  );
}