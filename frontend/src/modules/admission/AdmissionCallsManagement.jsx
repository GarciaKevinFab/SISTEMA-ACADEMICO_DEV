// src/modules/admission/AdmissionCallsManagement.jsx
import React, { useEffect, useState } from "react";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Plus, Eye, Edit, Download, Calendar, FileText,BookOpenCheck, } from "lucide-react";
import { toast } from "sonner";
import {
    listAdmissionCalls,
    createAdmissionCall,
    listCareers,
    Results,
} from "../../services/admission.service";

// ---------- helpers de normalización/format ----------
const normalizeCall = (c) => {
    const careers = (c.careers || []).map((x) => ({
        id: x.id ?? x.career_id,
        name: x.name ?? x.career_name ?? x.title,
        vacancies: x.vacancies ?? x.quota ?? x.slots ?? 0,
    }));

    return {
        id: c.id,
        name: c.name,
        description: c.description || "",
        academic_year: c.academic_year ?? c.year ?? null,
        academic_period: c.academic_period ?? c.period ?? null,
        registration_start: c.registration_start ?? c.start_date ?? null,
        registration_end: c.registration_end ?? c.end_date ?? null,
        exam_date: c.exam_date ?? c.exam_at ?? null,
        results_date: c.results_date ?? c.results_at ?? null,
        application_fee: c.application_fee ?? c.fee ?? 0,
        max_applications_per_career: c.max_applications_per_career ?? c.max_choices ?? 1,
        minimum_age: c.minimum_age ?? null,
        maximum_age: c.maximum_age ?? null,
        required_documents: c.required_documents ?? [],
        careers,
        total_applications: c.total_applications ?? c.applications_count ?? 0,
        status: c.status ?? c.state ?? "OPEN",
    };
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtMoney = (n) =>
    typeof n === "number" ? n.toFixed(2) : Number(n || 0).toFixed(2);

const REQUIRED_DOCS = [
    { value: "BIRTH_CERTIFICATE", label: "Partida de nacimiento" },
    { value: "STUDY_CERTIFICATE", label: "Cert. estudios" },
    { value: "PHOTO", label: "Foto" },
    { value: "DNI_COPY", label: "Copia DNI" },
];

export default function AdmissionCallsManagement() {
    const [admissionCalls, setAdmissionCalls] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI estados
    const [openCreate, setOpenCreate] = useState(false);
    const [openView, setOpenView] = useState(false);
    const [viewCall, setViewCall] = useState(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        academic_year: new Date().getFullYear(),
        academic_period: "I",
        registration_start: "",
        registration_end: "",
        exam_date: "",
        results_date: "",
        application_fee: 0,
        max_applications_per_career: 1,
        available_careers: [],
        career_vacancies: {},
        minimum_age: 16,
        maximum_age: 35,
        required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
    });

    const load = async () => {
        try {
            const [callsRes, careersRes] = await Promise.all([
                listAdmissionCalls(),
                listCareers(),
            ]);

            const callsListRaw = Array.isArray(callsRes)
                ? callsRes
                : callsRes?.items ||
                callsRes?.results ||
                callsRes?.admission_calls ||
                callsRes?.calls ||
                [];

            const callsList = callsListRaw.map(normalizeCall);

            const careersList = Array.isArray(careersRes)
                ? careersRes
                : careersRes?.items || careersRes?.results || careersRes?.careers || [];

            setAdmissionCalls(callsList);
            setCareers(careersList);
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar convocatorias");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const toggleCareer = (careerId, checked) => {
        if (checked) {
            setForm((f) => ({
                ...f,
                available_careers: [...f.available_careers, careerId],
                career_vacancies: {
                    ...f.career_vacancies,
                    [careerId]: f.career_vacancies[careerId] ?? 30,
                },
            }));
        } else {
            setForm((f) => {
                const next = { ...f.career_vacancies };
                delete next[careerId];
                return {
                    ...f,
                    available_careers: f.available_careers.filter((id) => id !== careerId),
                    career_vacancies: next,
                };
            });
        }
    };

    const setVacancy = (careerId, val) => {
        setForm((f) => ({
            ...f,
            career_vacancies: {
                ...f.career_vacancies,
                [careerId]: parseInt(val || "0", 10),
            },
        }));
    };

    const toggleReqDoc = (val) => {
        setForm((f) => {
            const selected = new Set(f.required_documents || []);
            if (selected.has(val)) selected.delete(val);
            else selected.add(val);
            return { ...f, required_documents: Array.from(selected) };
        });
    };

    const resetForm = () =>
        setForm({
            name: "",
            description: "",
            academic_year: new Date().getFullYear(),
            academic_period: "I",
            registration_start: "",
            registration_end: "",
            exam_date: "",
            results_date: "",
            application_fee: 0,
            max_applications_per_career: 1,
            available_careers: [],
            career_vacancies: {},
            minimum_age: 16,
            maximum_age: 35,
            required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
        });

    const submit = async (e) => {
        e.preventDefault();
        try {
            await createAdmissionCall(form);
            toast.success("Convocatoria creada");
            setOpenCreate(false);
            resetForm();
            load();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "Error al crear convocatoria");
        }
    };

    const openDetails = (call) => {
        setViewCall(call);
        setOpenView(true);
    };

    const publishResults = async (call) => {
        try {
            await Results.publish({ call_id: call.id });
            toast.success("Resultados publicados");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo publicar resultados");
        }
    };

    const downloadActa = async (call) => {
        try {
            const resp = await Results.actaPdf({ call_id: call.id });
            const blob = new Blob([resp.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `acta-call-${call.id}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error("No se pudo descargar el acta");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 sm:pb-12 animate-in fade-in duration-500">

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Gestión de Convocatorias
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Administra los procesos de admisión, cronogramas y vacantes.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/10 transition-all hover:-translate-y-0.5 rounded-lg">
              <Plus className="h-4 w-4 mr-2" />
              <span>Nueva Convocatoria</span>
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl">
            {/* Header del Modal con fondo */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
                <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">Crear Nueva Convocatoria</DialogTitle>
                <DialogDescription>Complete la información para abrir un nuevo proceso de admisión.</DialogDescription>
                </DialogHeader>
            </div>

            <form onSubmit={submit} className="p-6 space-y-8">
                {/* SECCIÓN 1: DATOS GENERALES */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">1. Información General</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                        <div className="sm:col-span-8 space-y-2">
                            <Label className="text-xs font-semibold text-gray-600 uppercase">Nombre de Convocatoria *</Label>
                            <Input
                                placeholder="Ej. Admisión Ordinaria 2024-I"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                                className="font-medium"
                            />
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                            <Label className="text-xs font-semibold text-gray-600 uppercase">Año *</Label>
                            <Input
                                type="number"
                                min="2024"
                                max="2035"
                                value={form.academic_year}
                                onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value || "0", 10) })}
                                required
                                className="text-center"
                            />
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                             <Label className="text-xs font-semibold text-gray-600 uppercase">Período *</Label>
                             <Select value={form.academic_period} onValueChange={(v) => setForm({ ...form, academic_period: v })}>
                                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="I">I</SelectItem>
                                    <SelectItem value="II">II</SelectItem>
                                    <SelectItem value="III">III</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="sm:col-span-12 space-y-2">
                            <Label className="text-xs font-semibold text-gray-600 uppercase">Descripción</Label>
                            <Textarea
                                rows={2}
                                placeholder="Detalles adicionales sobre el proceso..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: CRONOGRAMA */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">2. Cronograma y Configuración</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         {/* Fechas Inscripción */}
                        <div className="bg-blue-50/50 p-4 rounded-xl space-y-4 border border-blue-100">
                            <span className="text-sm font-bold text-blue-800 block mb-2">Inscripciones</span>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-600">Inicio *</Label>
                                <Input type="datetime-local" className="bg-white" value={form.registration_start} onChange={(e) => setForm({ ...form, registration_start: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-600">Cierre *</Label>
                                <Input type="datetime-local" className="bg-white" value={form.registration_end} onChange={(e) => setForm({ ...form, registration_end: e.target.value })} required />
                            </div>
                        </div>

                        {/* Fechas Proceso */}
                        <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
                             <span className="text-sm font-bold text-gray-800 block mb-2">Evaluación</span>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-600">Fecha Examen</Label>
                                <Input type="datetime-local" className="bg-white" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-600">Publicación Resultados</Label>
                                <Input type="datetime-local" className="bg-white" value={form.results_date} onChange={(e) => setForm({ ...form, results_date: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                         <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase">Costo (S/.)</Label>
                            <Input type="number" min="0" step="0.01" value={form.application_fee} onChange={(e) => setForm({ ...form, application_fee: parseFloat(e.target.value || "0") })} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase">Máx. Postulaciones</Label>
                            <Input type="number" min="1" max="3" value={form.max_applications_per_career} onChange={(e) => setForm({ ...form, max_applications_per_career: parseInt(e.target.value || "1", 10) })} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase">Edad Mín.</Label>
                            <Input type="number" min="15" max="30" value={form.minimum_age} onChange={(e) => setForm({ ...form, minimum_age: parseInt(e.target.value || "0", 10) })} />
                        </div>
                         <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-gray-500 uppercase">Edad Máx.</Label>
                            <Input type="number" min="20" max="60" value={form.maximum_age} onChange={(e) => setForm({ ...form, maximum_age: parseInt(e.target.value || "0", 10) })} />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: REQUISITOS Y VACANTES */}
                <div className="space-y-4">
                     <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">3. Requisitos y Oferta</h4>
                    
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Documentos Solicitados</Label>
                        <div className="flex flex-wrap gap-2">
                            {REQUIRED_DOCS.map((d) => {
                                const active = form.required_documents.includes(d.value);
                                return (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => toggleReqDoc(d.value)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                                            active 
                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                                        }`}
                                    >
                                        {d.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                         <div className="flex justify-between items-end">
                            <Label className="text-sm font-semibold text-gray-700">Selección de Carreras y Vacantes</Label>
                            <span className="text-xs text-gray-400">Marque las carreras disponibles</span>
                         </div>
                        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50/50 p-2 space-y-1 custom-scrollbar">
                            {careers.map((c) => {
                                const isSelected = form.available_careers.includes(c.id);
                                return (
                                    <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isSelected ? 'bg-white border-blue-200 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id={`career_${c.id}`}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                checked={isSelected}
                                                onChange={(e) => toggleCareer(c.id, e.target.checked)}
                                            />
                                            <Label htmlFor={`career_${c.id}`} className={`text-sm cursor-pointer ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {c.name}
                                            </Label>
                                        </div>
                                        {isSelected && (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                                <span className="text-xs text-gray-400">Vacantes:</span>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="200"
                                                    className="w-20 h-8 text-center bg-gray-50 border-gray-200"
                                                    value={form.career_vacancies[c.id] ?? 30}
                                                    onChange={(e) => setVacancy(c.id, e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)} className="text-gray-600 hover:text-gray-900">
                        Cancelar
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8">
                        Guardar Convocatoria
                    </Button>
                </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- LISTA DE CONVOCATORIAS --- */}
      <div className="grid gap-6">
        {admissionCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <Calendar className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Sin convocatorias activas</h3>
                <p className="text-gray-500 text-sm max-w-sm text-center mt-1 mb-6">
                    Comienza creando un proceso de admisión para habilitar el registro de postulantes.
                </p>
                <Button onClick={() => setOpenCreate(true)} variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300">
                    Crear mi primera convocatoria
                </Button>
            </div>
        ) : (
            admissionCalls.map((call) => (
                <Card key={call.id} className="group overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-blue-200 transition-all duration-300 rounded-xl">
                    <div className={`h-1 w-full ${call.status === "OPEN" ? "bg-green-500" : "bg-gray-300"}`} />
                    
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs font-mono text-gray-500 bg-gray-50">
                                        {call.academic_year}-{call.academic_period}
                                    </Badge>
                                    <Badge className={`${call.status === "OPEN" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-100"} border-0 px-2.5`}>
                                        {call.status === "OPEN" ? "● Abierta" : "Cerrada"}
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                    {call.name}
                                </CardTitle>
                            </div>
                            <div className="text-right hidden sm:block">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Postulantes</span>
                                <div className="text-2xl font-bold text-gray-800">{call.total_applications || 0}</div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                            {/* Columna Cronograma */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Calendar className="h-3 w-3" /> Cronograma
                                </h4>
                                <div className="space-y-2 text-sm border-l-2 border-gray-100 pl-3">
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="text-gray-500 text-xs">Inscripción</span>
                                        <span className="font-medium text-gray-900">{fmtDate(call.registration_start)}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="text-gray-500 text-xs">Cierre</span>
                                        <span className="font-medium text-gray-900">{fmtDate(call.registration_end)}</span>
                                    </div>
                                    {call.exam_date && (
                                        <div className="grid grid-cols-[80px_1fr] gap-2">
                                            <span className="text-blue-600 text-xs font-bold">Examen</span>
                                            <span className="font-medium text-blue-700">{fmtDate(call.exam_date)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Columna Oferta */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <BookOpenCheck className="h-3 w-3" /> Oferta Académica
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {call.careers?.slice(0, 4).map((c) => (
                                        <span key={c.id} className="inline-flex items-center px-2 py-1 rounded bg-gray-50 border border-gray-100 text-xs text-gray-600" title={`${c.name} - ${c.vacancies} vacantes`}>
                                            <span className="max-w-[100px] truncate">{c.name}</span>
                                            <span className="ml-1.5 pl-1.5 border-l border-gray-200 font-bold text-gray-400 text-[10px]">{c.vacancies}</span>
                                        </span>
                                    ))}
                                    {(call.careers?.length || 0) > 4 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-600 text-xs font-medium">
                                            +{call.careers.length - 4} más
                                        </span>
                                    )}
                                    {(!call.careers || call.careers.length === 0) && (
                                        <span className="text-xs text-gray-400 italic">No hay carreras asignadas</span>
                                    )}
                                </div>
                            </div>

                            {/* Columna Acciones (Grid en desktop, botones full en mobile) */}
                            <div className="flex flex-col justify-end gap-2 mt-4 md:mt-0">
                                <Button variant="outline" className="w-full justify-start text-gray-600 hover:text-blue-600 hover:border-blue-200 bg-white" onClick={() => openDetails(call)}>
                                    <Eye className="h-4 w-4 mr-2 text-gray-400" /> Ver Detalles
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 justify-center text-gray-600 hover:bg-gray-50" onClick={() => publishResults(call)}>
                                        <FileText className="h-4 w-4 mr-2 text-gray-400" /> Resultados
                                    </Button>
                                    <Button variant="outline" size="icon" className="text-gray-600 hover:bg-gray-50" onClick={() => downloadActa(call)} title="Descargar Acta">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))
        )}
      </div>

      {/* --- DIALOG DETALLE --- */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
            <div className="bg-slate-900 p-6 text-white">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold">Detalles de Convocatoria</h3>
                        <p className="text-blue-200 text-sm mt-1">Revisión de parámetros y configuración.</p>
                    </div>
                </div>
            </div>

            {viewCall && (
                <div className="p-6 bg-white space-y-6">
                    {/* Header Interno */}
                    <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{viewCall.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{viewCall.academic_year}-{viewCall.academic_period}</span>
                                <Badge variant={viewCall.status === "OPEN" ? "default" : "secondary"}>
                                    {viewCall.status === "OPEN" ? "Abierta" : viewCall.status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Descripción */}
                    {viewCall.description && (
                        <div className="bg-blue-50/50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed border border-blue-100">
                            {viewCall.description}
                        </div>
                    )}

                    {/* Grid de Datos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                         <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Inicio Inscripción</span>
                            <div className="text-sm font-medium text-gray-900">{fmtDateTime(viewCall.registration_start)}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Fin Inscripción</span>
                            <div className="text-sm font-medium text-gray-900">{fmtDateTime(viewCall.registration_end)}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-blue-600 uppercase">Examen</span>
                            <div className="text-sm font-medium text-gray-900">{fmtDateTime(viewCall.exam_date)}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Resultados</span>
                            <div className="text-sm font-medium text-gray-900">{fmtDateTime(viewCall.results_date)}</div>
                        </div>

                         <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Costo</span>
                            <div className="text-sm font-medium text-gray-900">S/. {fmtMoney(viewCall.application_fee)}</div>
                        </div>
                         <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Máx. Postulaciones</span>
                            <div className="text-sm font-medium text-gray-900">{viewCall.max_applications_per_career}</div>
                        </div>
                         <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Edad Mínima</span>
                            <div className="text-sm font-medium text-gray-900">{viewCall.minimum_age ?? "—"} años</div>
                        </div>
                         <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase">Edad Máxima</span>
                            <div className="text-sm font-medium text-gray-900">{viewCall.maximum_age ?? "—"} años</div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <span className="text-xs font-bold text-gray-400 uppercase mb-3 block">Documentos Requeridos</span>
                        <div className="flex flex-wrap gap-2">
                             {(viewCall.required_documents || []).length > 0 ? (
                                viewCall.required_documents.map((d) => (
                                    <Badge key={d} variant="outline" className="bg-gray-50">{d}</Badge>
                                ))
                             ) : <span className="text-sm text-gray-400 italic">Ninguno especificado</span>}
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-4">
                        <span className="text-xs font-bold text-gray-400 uppercase mb-3 block">Carreras y Vacantes ({viewCall.careers?.length || 0})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {(viewCall.careers || []).map((c) => (
                                <div key={c.id} className="text-sm border border-gray-100 rounded-lg p-2 flex items-center justify-between bg-gray-50/50">
                                    <span className="truncate pr-2 font-medium text-gray-700">{c.name}</span>
                                    <Badge variant="secondary" className="bg-white border-gray-200 text-gray-600">{c.vacancies}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
   };