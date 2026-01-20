// src/modules/academic/EnrollmentComponent.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { CheckCircle,Trash2,BookOpen,Check,Library, AlertTriangle, Clock, Plus, Search as SearchIcon, FileText, Hash } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";
/* ---------------- helpers ---------------- */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d.map((e) => {
        const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
        return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

const EnrollmentComponent = () => {
  const { user, api } = useAuth();

  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);

  const [enrollmentData, setEnrollmentData] = useState({
    student_id: user?.id || "",
    academic_period: "2025-I",
    selected_courses: [],
  });

  const [validation, setValidation] = useState({
    status: null,
    errors: [],
    warnings: [],
    suggestions: [],
  });

  const [loading, setLoading] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);

  const [suggestions, setSuggestions] = useState([]);

  // ---- define fetchAvailableCourses ANTES del efecto que lo usa
  const fetchAvailableCourses = useCallback(async () => {
    try {
      const { data } = await api.get("/courses/available");
      setCourses(data?.courses ?? data ?? []);
    } catch (error) {
      console.error("Error fetching courses:", error);
      showToast("error", formatApiError(error, "Error al cargar cursos disponibles"));
    }
  }, [api]);

  useEffect(() => { fetchAvailableCourses(); }, [fetchAvailableCourses]);

  // Si el user llega más tarde, sincroniza el student_id
  useEffect(() => {
    setEnrollmentData((d) => ({ ...d, student_id: user?.id || "" }));
  }, [user?.id]);

  const showToast = (type, message) => {
    const toastElement = document.createElement("div");
    toastElement.setAttribute("data-testid", `toast-${type}`);
    toastElement.textContent = message;
    document.body.appendChild(toastElement);
    toast[type](message);
    setTimeout(() => { if (toastElement.parentNode) document.body.removeChild(toastElement); }, 5000);
  };

  const fetchSuggestions = async () => {
    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map(c => c.id),
    };
    try {
      const d = await api.post("/enrollments/suggestions", payload);
      const list = d?.data?.suggestions || d?.suggestions || [];
      setSuggestions(list);
      if (!list.length) showToast("success", "No hay alternativas mejores disponibles");
    } catch (e) { showToast("error", formatApiError(e, "No se pudieron obtener sugerencias")); }
  };

  const validateEnrollment = async () => {
    if (selectedCourses.length === 0) {
      showToast("error", "Seleccione al menos un curso para validar");
      return;
    }
    setIsValidating(true);
    setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
    setScheduleConflicts([]);

    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map((c) => c.id),
    };

    try {
      const { data } = await api.post("/enrollments/validate", payload);
      setValidation({
        status: "success",
        errors: [],
        warnings: data?.warnings || [],
        suggestions: [],
      });
      showToast("success", "Validación exitosa. Puede proceder con la matrícula.");
    } catch (err) {
      const status = err?.response?.status;
      const result = err?.response?.data || {};
      if (status === 409) {
        setValidation({
          status: "conflict",
          errors: result.errors || [],
          warnings: result.warnings || [],
          suggestions: result.suggestions || [],
        });
        if (result.schedule_conflicts) setScheduleConflicts(result.schedule_conflicts);
        showToast("error", "Conflictos detectados en la matrícula");
      } else {
        setValidation({
          status: "error",
          errors: [formatApiError(err, "Error en validación")],
          warnings: [],
          suggestions: [],
        });
        showToast("error", "Error en la validación de matrícula");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const commitEnrollment = async () => {
    if (validation.status !== "success") {
      showToast("error", "Debe validar la matrícula antes de confirmarla");
      return;
    }
    setLoading(true);
    const idempotencyKey = `enrollment-${user?.id ?? "anon"}-${Date.now()}`;

    const payload = {
      student_id: enrollmentData.student_id,
      academic_period: enrollmentData.academic_period,
      course_ids: selectedCourses.map((c) => c.id),
    };

    try {
      const { data } = await api.post("/enrollments/commit", payload, {
        headers: { "Idempotency-Key": idempotencyKey },
      });

      showToast("success", "Matrícula realizada exitosamente");

      // Reset
      setSelectedCourses([]);
      setValidation({ status: null, errors: [], warnings: [], suggestions: [] });
      setScheduleConflicts([]);

      if (data?.enrollment_id) {
        await generateEnrollmentCertificate(data.enrollment_id);
      }
    } catch (error) {
      console.error("Enrollment commit error:", error);
      showToast("error", formatApiError(error, "Error al confirmar la matrícula"));
    } finally {
      setLoading(false);
    }
  };

  const generateEnrollmentCertificate = async (enrollmentId) => {
    try {
      const result = await generatePDFWithPolling(
        `/enrollments/${enrollmentId}/certificate`,
        {},
        { testId: "enrollment-certificate" }
      );
      if (result.success) {
        await downloadFile(result.downloadUrl, `matricula-${enrollmentId}.pdf`);
        showToast("success", "Constancia de matrícula generada");
      }
    } catch (error) {
      console.error("Certificate generation error:", error);
      showToast("error", "Error al generar constancia de matrícula");
    }
  };

  const generateSchedulePDF = async () => {
    if (selectedCourses.length === 0) {
      showToast("error", "Seleccione cursos para generar horario");
      return;
    }
    try {
      const result = await generatePDFWithPolling(
        "/schedules/export",
        {
          student_id: enrollmentData.student_id,
          academic_period: enrollmentData.academic_period,
          course_ids: selectedCourses.map((c) => c.id),
        },
        { testId: "schedule-pdf" }
      );
      if (result.success) {
        await downloadFile(result.downloadUrl, `horario-${enrollmentData.academic_period}.pdf`);
        showToast("success", "Horario exportado exitosamente");
      }
    } catch (error) {
      console.error("Schedule export error:", error);
      showToast("error", "Error al exportar horario");
    }
  };

  const addCourseToSelection = (course) => {
    setSelectedCourses((prev) => (prev.find((c) => c.id === course.id) ? prev : [...prev, course]));
  };
  const removeCourseFromSelection = (courseId) => {
    setSelectedCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  return (
   <div className="space-y-6 pb-24 sm:pb-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Matrícula de Cursos</h2>
        <div className="flex space-x-2">
          <Button data-testid="schedule-export-pdf" variant="outline" onClick={generateSchedulePDF} disabled={selectedCourses.length === 0}>
            <FileText className="h-4 w-4 mr-2" /> Exportar Horario
          </Button>
        </div>
      </div>

     {/* Course Selection Section */}
    <div className="space-y-6"> {/* Contenedor para separar ambas tarjetas */}
      
      {/* 1. Grid de Cursos Disponibles */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Library className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-800">Selección de Cursos</CardTitle>
              <CardDescription>
                Cursos disponibles para el período <span className="font-medium text-slate-700">{enrollmentData.academic_period}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(Array.isArray(courses) ? courses : []).map((course) => {
              const selected = selectedCourses.some((c) => c.id === course.id);
              
              return (
                <Card 
                  key={course.id} 
                  className={`
                    relative transition-all duration-200 cursor-pointer group
                    ${selected 
                      ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10 shadow-sm" 
                      : "border-slate-200 hover:border-blue-300 hover:shadow-md bg-white"
                    }
                  `}
                >
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    
                    {/* Header del Card */}
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="p-1.5 bg-slate-100 rounded-md text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                            <BookOpen className="h-4 w-4" />
                        </div>
                        <Badge variant={selected ? "default" : "secondary"} className={selected ? "bg-blue-600" : "bg-slate-100 text-slate-600"}>
                          {course.credits} créditos
                        </Badge>
                      </div>
                      
                      <h4 className={`font-bold text-base mb-1 leading-tight ${selected ? "text-blue-700" : "text-slate-800"}`}>
                        {course.name}
                      </h4>
                    </div>

                    {/* Info del Curso */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-mono text-slate-600">{course.code}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{course.schedule}</span>
                      </div>
                    </div>

                    {/* Botón de Acción */}
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => (selected ? removeCourseFromSelection(course.id) : addCourseToSelection(course))}
                      className={`w-full rounded-xl transition-all ${
                        selected 
                          ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200" 
                          : "border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check className="h-4 w-4 mr-2" /> Seleccionado
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" /> Agregar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Lista de Cursos Seleccionados (Resumen) */}
      {selectedCourses.length > 0 && (
        <Card className="border-green-200 bg-green-50/30 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="pb-3 border-b border-green-100">
            <CardTitle className="text-base text-green-800 flex items-center gap-2">
              <Check className="h-5 w-5 p-1 bg-green-200 rounded-full text-green-700" />
              Cursos Seleccionados ({selectedCourses.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {selectedCourses.map((course) => (
                <div 
                  key={course.id} 
                  className="group flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="font-semibold text-slate-800 text-sm">{course.name}</span>
                    <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      {course.code}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-slate-200 text-slate-600 font-normal">
                      {course.credits} cr.
                    </Badge>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      onClick={() => removeCourseFromSelection(course.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>

      {/* Validation Results */}
      {validation.status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {validation.status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {(validation.status === "conflict" || validation.status === "error") && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span>Resultado de Validación</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validation.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Errores:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-red-600 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-yellow-600 mb-2">Advertencias:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-yellow-600 text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {scheduleConflicts.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Conflictos de Horario:</h4>
                <div className="space-y-2">
                  {scheduleConflicts.map((conflict, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">{conflict.message}</p>
                    </div>
                  ))}
                </div>

                <Button data-testid="enroll-suggest-alt" variant="outline" onClick={fetchSuggestions} className="mt-3">
                  Ver Sugerencias Alternativas
                </Button>
                {suggestions.length > 0 && (
                  <div className="mt-3 border rounded p-3">
                    <div className="font-medium mb-2">Alternativas</div>
                    <div className="space-y-2">
                      {suggestions.map((sg, i) => (
                        <div key={i} className="p-2 border rounded">
                          <div className="text-sm"><b>{sg.course_name}</b> · {sg.section_code} · {sg.teacher_name}</div>
                          <div className="text-xs text-gray-500">{(Array.isArray(sg.slots) ? sg.slots : []).map(k => `${k.day} ${k.start}-${k.end}`).join(", ")}</div>
                          <div className="text-xs text-gray-500">Cupo: {sg.available} / {sg.capacity}</div>
                          <div className="mt-2">
                            <Button size="sm" onClick={() => {
                              setSelectedCourses(prev => {
                                const filtered = prev.filter(c => c.code !== sg.course_code);
                                return [...filtered, { id: sg.course_id, name: sg.course_name, code: sg.course_code, credits: sg.credits, schedule: (Array.isArray(sg.slots) ? sg.slots : []).map(k => `${k.day} ${k.start}-${k.end}`).join(', ') }];
                              });
                              showToast("success", "Alternativa aplicada. Vuelva a validar.");
                            }}>
                              Reemplazar por esta opción
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button
          data-testid="enroll-validate"
          variant="outline"
          onClick={validateEnrollment}
          disabled={isValidating || selectedCourses.length === 0}
        >
          {isValidating ? (<><Clock className="h-4 w-4 mr-2 animate-spin" /> Validando...</>) : (<><SearchIcon className="h-4 w-4 mr-2" /> Validar Matrícula</>)}
        </Button>

        <Button
          data-testid="enroll-commit"
          onClick={commitEnrollment}
          disabled={loading || validation.status !== "success"}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (<><Clock className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>) : (<><CheckCircle className="h-4 w-4 mr-2" /> Confirmar Matrícula</>)}
        </Button>
      </div>

      {/* Status indicators E2E */}
      <div style={{ display: "none" }}>
        <div data-testid="enrollment-certificate-status">IDLE</div>
        <div data-testid="schedule-pdf-status">IDLE</div>
      </div>
    </div>
  );
};

export default EnrollmentComponent;
