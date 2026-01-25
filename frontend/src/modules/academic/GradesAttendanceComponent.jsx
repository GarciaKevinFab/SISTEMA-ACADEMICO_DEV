// src/pages/academic/GradesAttendanceComponent.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { Upload, Save, Send, Lock, Unlock, FileText, Users, Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
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
    // compacto: 1 ... (p-1) p (p+1) ... last
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

  const [importDialog, setImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionRows, setSessionRows] = useState([]); // {student_id, status}

  // ✅ PAGINACIÓN
  const [gradesPage, setGradesPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [takeAttPage, setTakeAttPage] = useState(1);

  const gradesPageSize = 10;
  const sessionsPageSize = 10;
  const takeAttendancePageSize = 10;

  // Grade periods
  const gradePeriods = ["PARCIAL_1", "PARCIAL_2", "PARCIAL_3", "FINAL"];
  const gradeLabels = {
    PARCIAL_1: "1er Parcial",
    PARCIAL_2: "2do Parcial",
    PARCIAL_3: "3er Parcial",
    FINAL: "Examen Final",
  };

  const attendanceStates = {
    PRESENT: { label: "Presente", color: "bg-green-500" },
    ABSENT: { label: "Ausente", color: "bg-red-500" },
    LATE: { label: "Tardanza", color: "bg-yellow-500" },
    EXCUSED: { label: "Justificado", color: "bg-blue-500" },
  };

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

  useEffect(() => {
    if (!user?.id) return;
    fetchTeacherSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSection?.id) return;
    fetchSectionStudents();
    fetchGrades();
    fetchAttendanceSessions();

    // ✅ reset paginación al cambiar sección
    setGradesPage(1);
    setSessionsPage(1);
    setTakeAttPage(1);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection?.id]);

  useEffect(() => {
    // ✅ si cambias de tab, arranca desde la página 1 para evitar "vacío"
    setGradesPage(1);
    setSessionsPage(1);
    setTakeAttPage(1);
  }, [activeTab]);

  const fetchTeacherSections = async () => {
    try {
      const data = await Teacher.sections(user.id);
      console.log("Teacher.sections response:", data);

      const secs = data?.sections || [];
      setSections(secs);

      setSelectedSection((prev) => {
        if (!prev?.id) return prev;
        const still = secs.find((s) => String(s.id) === String(prev.id));
        return still || null;
      });
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al cargar secciones");
      setSections([]);
      setSelectedSection(null);
    }
  };

  const fetchSectionStudents = async () => {
    try {
      const { students } = await SectionStudents.list(selectedSection.id);
      setStudents(students || []);
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al cargar estudiantes");
    }
  };

  const fetchGrades = async () => {
    try {
      const data = await Grades.get(selectedSection.id);
      setGrades(data?.grades || {});
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al cargar calificaciones");
    }
  };

  const fetchAttendanceSessions = async () => {
    try {
      const d = await Attendance.listSessions(selectedSection.id);
      setAttendanceSessions(d?.sessions || []);
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al cargar sesiones");
    }
  };

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

  const updateGrade = (studentId, period, value) => {
    if (value === "") {
      setGrades((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [period]: "" } }));
      return;
    }

    const numericValue = parseFloat(value);
    if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 20) return;

    setGrades((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [period]: numericValue } }));
  };

  const saveGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    setIsSaving(true);
    try {
      await Grades.save(selectedSection.id, grades);
      showToast("success", "Calificaciones guardadas");
    } catch (e) {
      showToast("error", e.message || "Error al guardar calificaciones");
    } finally {
      setIsSaving(false);
    }
  };

  const submitGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");

    const missing = students.some((st) => {
      const sg = grades[st.id] || {};
      return gradePeriods.some((p) => sg[p] === undefined || sg[p] === null || sg[p] === "");
    });
    if (missing) return showToast("error", "Complete todas las calificaciones antes de enviar");

    setIsSubmitting(true);
    try {
      await Grades.submit(selectedSection.id, grades);
      showToast("success", "Calificaciones enviadas y cerradas");
      await generateActaPDF();
    } catch (e) {
      showToast("error", e.message || "Error al enviar calificaciones");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reopenGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");

    setIsSubmitting(true);
    try {
      await Grades.reopen(selectedSection.id);
      showToast("success", "Calificaciones reabiertas");
      await fetchGrades();
    } catch (e) {
      showToast("error", e.message || "Error al reabrir calificaciones");
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
      console.error(error);
      showToast("error", "Error al generar acta PDF");
    }
  };

  const generateActaQR = async () => {
    if (!selectedSection?.id) return;
    try {
      const result = await generateQRWithPolling(`/sections/${selectedSection.id}/acta/qr`, {}, { testId: "acta-qr-code" });
      if (result.success) showToast("success", "Código QR generado");
    } catch (error) {
      console.error(error);
      showToast("error", "Error al generar código QR");
    }
  };

  const importAttendanceCSV = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (!csvFile) return showToast("error", "Seleccione un archivo CSV");
    try {
      const result = await AttendanceImport.preview(selectedSection.id, csvFile);
      setImportPreview(result.preview || []);
      setImportErrors(result.errors || []);
      if (result.errors?.length) showToast("error", `${result.errors.length} errores en el archivo`);
      else showToast("success", "Vista previa generada");
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al importar asistencia");
    }
  };

  const saveAttendanceImport = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (importErrors.length > 0) return showToast("error", "Corrija los errores antes de guardar");
    try {
      await AttendanceImport.save(selectedSection.id, importPreview);
      showToast("success", "Asistencia importada");
      setImportDialog(false);
      setImportPreview([]);
      setImportErrors([]);
      setCsvFile(null);
      await fetchAttendanceSessions();
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "Error al guardar asistencia");
    }
  };

  /* ----------------------------- PAGINATED DATA ----------------------------- */
  const gradesTotalPages = Math.max(1, Math.ceil(students.length / gradesPageSize));
  const pagedStudentsForGrades = useMemo(() => {
    const start = (gradesPage - 1) * gradesPageSize;
    return students.slice(start, start + gradesPageSize);
  }, [students, gradesPage]);

  const sessionsTotalPages = Math.max(1, Math.ceil((attendanceSessions || []).length / sessionsPageSize));
  const pagedSessions = useMemo(() => {
    const arr = attendanceSessions || [];
    const start = (sessionsPage - 1) * sessionsPageSize;
    return arr.slice(start, start + sessionsPageSize);
  }, [attendanceSessions, sessionsPage]);

  const takeAttTotalPages = Math.max(1, Math.ceil(students.length / takeAttendancePageSize));
  const pagedStudentsForAttendance = useMemo(() => {
    const start = (takeAttPage - 1) * takeAttendancePageSize;
    return students.slice(start, start + takeAttendancePageSize);
  }, [students, takeAttPage]);

  // ✅ clamp page si cambian listas
  useEffect(() => {
    if (gradesPage > gradesTotalPages) setGradesPage(gradesTotalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradesTotalPages]);

  useEffect(() => {
    if (sessionsPage > sessionsTotalPages) setSessionsPage(sessionsTotalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsTotalPages]);

  useEffect(() => {
    if (takeAttPage > takeAttTotalPages) setTakeAttPage(takeAttTotalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeAttTotalPages]);

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Calificaciones y Asistencia
        </h2>

        {/* Section Selector */}
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
                  No tienes secciones asignadas (o el backend devolvió 0).
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSection && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto overflow-x-auto flex flex-nowrap gap-2">
            <TabsTrigger value="grades" className="shrink-0">Calificaciones</TabsTrigger>
            <TabsTrigger value="attendance" className="shrink-0">Asistencia</TabsTrigger>
          </TabsList>

          {/* Grades Tab */}
          <TabsContent value="grades">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <CardTitle>Registro de Calificaciones</CardTitle>
                    <CardDescription className="break-words">
                      Sección: {selectedSection.course_name || selectedSection.course_code} -{" "}
                      {selectedSection.section_code || selectedSection.label}
                    </CardDescription>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full lg:w-auto">
                    <Button data-testid="grade-save" variant="outline" onClick={saveGrades} disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar
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
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar y Cerrar
                        </>
                      )}
                    </Button>

                    {(user?.role === "REGISTRAR" || user?.role === "ADMIN_ACADEMIC") ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button data-testid="grade-reopen" variant="outline" className="w-full sm:w-auto">
                            <Unlock className="h-4 w-4 mr-2" />
                            Reabrir
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Reabrir calificaciones?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esto desbloquea la sección para editar notas nuevamente. Úsalo solo si es necesario.
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">
                              Cancelar
                            </AlertDialogCancel>

                            <AlertDialogAction
                              className="w-full sm:w-auto"
                              onClick={reopenGrades}
                              disabled={isSubmitting}
                            >
                              Sí, reabrir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}

                    <Button data-testid="act-generate-pdf" variant="outline" onClick={generateActaPDF} className="w-full sm:w-auto">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Acta
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Tabla notas */}
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Estudiante</th>
                        {gradePeriods.map((p) => (
                          <th key={p} className="p-2 text-center">
                            {gradeLabels[p]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedStudentsForGrades.map((st) => {
                        const sg = grades[st.id] || {};
                        return (
                          <tr key={st.id} className="border-t">
                            <td className="p-2">
                              {st.first_name} {st.last_name}
                            </td>
                            {gradePeriods.map((p) => (
                              <td key={p} className="p-2 text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="1"
                                  className="w-20 text-center"
                                  value={sg[p] ?? ""}
                                  onChange={(e) => updateGrade(st.id, p, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}

                      {students.length === 0 && (
                        <tr>
                          <td className="p-3 text-center text-gray-500" colSpan={1 + gradePeriods.length}>
                            Sin estudiantes
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ✅ Paginación calificaciones */}
                <Pagination
                  page={gradesPage}
                  totalPages={gradesTotalPages}
                  onPageChange={setGradesPage}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div>
                    <Label>Fecha de sesión</Label>
                    <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                  </div>
                  <Button onClick={createAttendanceSession}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Nueva sesión
                  </Button>
                </div>

                {/* Sesiones */}
                <div className="border rounded">
                  <div className="p-2 font-medium bg-gray-50">Sesiones registradas</div>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Fecha</th>
                          <th className="p-2 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedSessions.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{s.date}</td>
                            <td className="p-2">
                              {s.is_closed ? <Badge variant="secondary">Cerrada</Badge> : <Badge>Abierta</Badge>}
                            </td>
                          </tr>
                        ))}

                        {(!attendanceSessions || attendanceSessions.length === 0) && (
                          <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={2}>
                              Sin sesiones
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ✅ Paginación sesiones */}
                <Pagination
                  page={sessionsPage}
                  totalPages={sessionsTotalPages}
                  onPageChange={setSessionsPage}
                />

                {/* Sesión actual */}
{currentSession && (
  <div className="border rounded p-3 space-y-3">
    <div className="font-medium">Tomando asistencia — {currentSession.date}</div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Estudiante</th>
            <th className="p-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {pagedStudentsForAttendance.map((st) => {
            const row = sessionRows.find((r) => r.student_id === st.id) || { status: "PRESENT" };

            // --- LÓGICA DE COLORES SÓLIDOS (IMPORTANT) ---
            let colorClass = "";
            if (row.status === "PRESENT") {
              // AZUL
              colorClass = "!bg-blue-600 !text-white !border-blue-700";
            } else if (row.status === "ABSENT") {
              // ROJO
              colorClass = "!bg-red-600 !text-white !border-red-700";
            } else if (row.status === "LATE" || row.status === "EXCUSED") {
              // AMARILLO / ÁMBAR
              colorClass = "!bg-amber-500 !text-white !border-amber-600";
            }
            // ---------------------------------------------

            return (
              <tr key={st.id} className="border-t">
                <td className="p-2">
                  {st.first_name} {st.last_name}
                </td>
                <td className="p-2">
                  <Select value={row.status} onValueChange={(v) => setRowStatus(st.id, v)}>
                    {/* Aplicamos la clase con '!' para pintar toda la caja */}
                    <SelectTrigger className={`w-40 font-medium transition-colors ${colorClass}`}>
                      <SelectValue />
                    </SelectTrigger>
                    
                    <SelectContent>
                      <SelectItem value="PRESENT">Presente</SelectItem>
                      <SelectItem value="ABSENT">Ausente</SelectItem>
                      <SelectItem value="LATE">Tardanza</SelectItem>
                      <SelectItem value="EXCUSED">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>


                    {/* ✅ Paginación tomando asistencia */}
                    <Pagination
                      page={takeAttPage}
                      totalPages={takeAttTotalPages}
                      onPageChange={setTakeAttPage}
                    />

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={saveAttendance}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="bg-blue-600 hover:bg-blue-700">
                            <Lock className="h-4 w-4 mr-2" />
                            Cerrar sesión
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Cerrar sesión de asistencia?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se guardará la asistencia y la sesión quedará cerrada. Luego ya no podrás editarla.
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">
                              Cancelar
                            </AlertDialogCancel>

                            <AlertDialogAction
                              className="w-full sm:w-auto"
                              onClick={closeAttendance}
                            >
                              Sí, cerrar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <CardTitle>Control de Asistencia</CardTitle>
                    <CardDescription className="break-words">
                      Sección: {selectedSection.course_name || selectedSection.course_code} -{" "}
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

                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Importar Asistencia desde CSV</DialogTitle>
                          <DialogDescription>
                            Seleccione un archivo CSV con los datos de asistencia
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
                            <div className="mt-4">
                              <h4 className="font-semibold text-red-600 mb-2">
                                Errores encontrados ({importErrors.length}):
                              </h4>
                              <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded">
                                {importErrors.map((error, index) => (
                                  <p key={index} className="text-sm text-red-700">
                                    Fila {error.row}: {error.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {importPreview.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">
                                Vista Previa ({importPreview.length} registros):
                              </h4>
                              <div className="max-h-60 overflow-auto border rounded">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="p-2 text-left">Estudiante</th>
                                      <th className="p-2 text-left">Fecha</th>
                                      <th className="p-2 text-left">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {importPreview.slice(0, 10).map((record, index) => (
                                      <tr key={index} className="border-t">
                                        <td className="p-2">{record.student_name}</td>
                                        <td className="p-2">{record.date}</td>
                                        <td className="p-2">
                                          <Badge className={attendanceStates[record.status]?.color}>
                                            {attendanceStates[record.status]?.label}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {importPreview.length > 10 && (
                                  <p className="p-2 text-center text-gray-500">
                                    ... y {importPreview.length - 10} registros más
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end space-x-2">
                            <Button
                              data-testid="dialog-cancel"
                              variant="outline"
                              onClick={() => setImportDialog(false)}
                            >
                              Cancelar
                            </Button>

                            <Button
                              data-testid="attendance-save"
                              onClick={saveAttendanceImport}
                              disabled={importPreview.length === 0 || importErrors.length > 0}
                              className="gap-2"
                            >
                              <Save className="h-4 w-4" />
                              Guardar Asistencia
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* LISTA DE SESIONES */}
                <div className="border rounded">
                  <div className="p-2 font-medium bg-gray-50">Sesiones registradas</div>

                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Fecha</th>
                          <th className="p-2 text-left">Estado</th>
                          <th className="p-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedSessions.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">{s.date}</td>
                            <td className="p-2">
                              {s.is_closed ? (
                                <Badge variant="secondary">Cerrada</Badge>
                              ) : (
                                <Badge>Abierta</Badge>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => {
                                  // ✅ Abrir sesión existente para editar / revisar
                                  setCurrentSession(s);

                                  // Si el serializer trae rows, los usamos. Si no, creamos default.
                                  // (Tu backend hace prefetch_related("rows"), depende del serializer si los expone)
                                  const rowsFromApi = Array.isArray(s?.rows)
                                    ? s.rows.map((r) => ({
                                      student_id: Number(r.student_id ?? r.student ?? r.studentId),
                                      status: String(r.status || "PRESENT").toUpperCase(),
                                    }))
                                    : [];

                                  const byId = new Map(rowsFromApi.map((r) => [String(r.student_id), r]));

                                  const merged = students.map((st) => {
                                    const hit = byId.get(String(st.id));
                                    return {
                                      student_id: st.id,
                                      status: hit?.status || "PRESENT",
                                    };
                                  });

                                  setSessionRows(merged);
                                  setTakeAttPage(1);
                                }}
                                disabled={Boolean(s?.is_closed)}
                                title={s?.is_closed ? "Sesión cerrada" : "Abrir sesión"}
                              >
                                Abrir
                              </Button>
                            </td>
                          </tr>
                        ))}

                        {(!attendanceSessions || attendanceSessions.length === 0) && (
                          <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={3}>
                              Sin sesiones
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ✅ Paginación sesiones */}
                <Pagination page={sessionsPage} totalPages={sessionsTotalPages} onPageChange={setSessionsPage} />

                {/* SESIÓN ACTUAL (EDICIÓN) */}
                {currentSession ? (
                  <div className="border rounded p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="font-medium">
                        Sesión actual — <span className="font-semibold">{currentSession.date}</span>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setCurrentSession(null);
                            setSessionRows([]);
                          }}
                        >
                          Salir
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left">Estudiante</th>
                            <th className="p-2 text-left">Estado</th>
                          </tr>
                        </thead>
                      <tbody className="divide-y">
  {pagedStudentsForAttendance.map((st) => {
    // 1. Buscamos la fila o asignamos default
    const row = sessionRows.find((r) => r.student_id === st.id) || { status: "PRESENT" };

    // 2. Lógica de COLORES FORZADOS (Usamos '!' para obligar el cambio)
    let colorClass = "bg-white text-gray-900 border-gray-300";

    if (row.status === "PRESENT") {
      // AZUL FORZADO
      colorClass = "!bg-blue-600 !text-white !border-blue-600 hover:!bg-blue-700";
    } else if (row.status === "ABSENT") {
      // ROJO FORZADO
      colorClass = "!bg-red-600 !text-white !border-red-600 hover:!bg-red-700";
    } else if (row.status === "LATE" || row.status === "EXCUSED") {
      // AMARILLO FORZADO
      colorClass = "!bg-amber-500 !text-white !border-amber-500 hover:!bg-amber-600";
    }

    return (
      <tr key={st.id} className="border-t">
        <td className="p-2">
          {st.first_name} {st.last_name}
        </td>
        <td className="p-2">
          <Select value={row.status} onValueChange={(v) => setRowStatus(st.id, v)}>
            {/* 3. APLICAMOS LA CLASE CON '!' */}
            <SelectTrigger className={`w-44 font-medium transition-colors ${colorClass}`}>
              <SelectValue />
            </SelectTrigger>
            
            <SelectContent>
              <SelectItem value="PRESENT">Presente</SelectItem>
              <SelectItem value="ABSENT">Ausente</SelectItem>
              <SelectItem value="LATE">Tardanza</SelectItem>
              <SelectItem value="EXCUSED">Justificado</SelectItem>
            </SelectContent>
          </Select>
        </td>
      </tr>
    );
  })}

  {students.length === 0 ? (
    <tr>
      <td colSpan={2} className="p-3 text-center text-gray-500">
        Sin estudiantes
      </td>
    </tr>
  ) : null}
</tbody>
                      </table>
                    </div>

                    {/* ✅ Paginación alumnos */}
                    <Pagination page={takeAttPage} totalPages={takeAttTotalPages} onPageChange={setTakeAttPage} />

                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <Button variant="outline" onClick={saveAttendance} className="gap-2">
                        <Save className="h-4 w-4" />
                        Guardar
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                            <Lock className="h-4 w-4" />
                            Cerrar sesión
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Cerrar sesión de asistencia?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se guardará la asistencia y la sesión quedará cerrada. Luego ya no podrás editarla.
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">
                              Cancelar
                            </AlertDialogCancel>

                            <AlertDialogAction className="w-full sm:w-auto" onClick={closeAttendance}>
                              Sí, cerrar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border rounded-2xl">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No hay sesión activa</p>
                    <p className="text-sm mt-1">
                      Crea una nueva sesión o abre una sesión existente (si está abierta).
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      )}

      {/* Status indicators for E2E testing */}
      <div style={{ display: "none" }}>
        <div data-testid="acta-pdf-status">IDLE</div>
        <div data-testid="acta-qr-status">IDLE</div>
        <img data-testid="acta-qr-code" data-status="idle" alt="QR Code" />
      </div>
    </div>
  );
}
