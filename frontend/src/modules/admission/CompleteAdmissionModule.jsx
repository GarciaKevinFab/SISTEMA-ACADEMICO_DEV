// src/modules/admission/CompleteAdmissionModule.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/* UI */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Eye, Edit, Download,Calendar, GraduationCap, Filter, X  } from "lucide-react";


/* Submódulos reales */
import AdmissionDashboard from "./AdmissionDashboard";
import AdmissionReportsModule from "./AdmissionReports";
import AdmissionParamsModule from "./AdmissionParams";
import ApplicantDocuments from "./ApplicantDocuments";
import ApplicationWizard from "./ApplicationWizard";
import EvaluationBoard from "./EvaluationBoard";
import ResultsPublication from "./ResultsPublication";
import AdmissionCallsManagement from "./AdmissionCallsManagement";
import DocumentReview from "./DocumentReview";
import AdmissionScheduleModule from "./AdmissionSchedule";
import PaymentsManagement from "./PaymentsManagement";
import AdmissionCertificates from "./AdmissionCertificates";


/* Helpers */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d
        .map((e) => {
          const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
          return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
        })
        .filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}
const toIntOr = (v, def = null) => (Number.isFinite(+v) ? +v : def);

/* --------- Careers (inline) --------- */
const CareersManagement = () => {
  const { api } = useAuth();

  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);

  // create
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "",
    duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL",
    vacancies: 25, is_active: true
  });

  // view
  const [openView, setOpenView] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  // edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState(form);

  const toIntOr = (v, def = 0) => (Number.isFinite(+v) ? +v : def);

  const load = async () => {
    try {
      const { data } = await api.get("/careers");
      // backend devuelve lista simple
      setCareers(Array.isArray(data) ? data : (data?.careers ?? []));
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar carreras"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resetCreate = () =>
    setForm({ name: "", code: "", description: "", duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL", vacancies: 25, is_active: true });

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/careers", {
        ...form,
        duration_semesters: toIntOr(form.duration_semesters, 0),
        vacancies: toIntOr(form.vacancies, 0),
      });
      toast.success("Carrera creada");
      setOpenCreate(false);
      resetCreate();
      load();
    } catch (e) {
      toast.error(formatApiError(e, "Error al crear carrera"));
    }
  };

  const openDetails = (row) => {
    setViewRow(row);
    setOpenView(true);
  };

  const openEditor = async (row) => {
    try {
      const { data } = await api.get(`/careers/${row.id}`);
      setEditRow(data);
      setEditForm({
        name: data.name ?? "",
        code: data.code ?? "",
        description: data.description ?? "",
        duration_semesters: data.duration_semesters ?? 0,
        degree_type: data.degree_type ?? "BACHELOR",
        modality: data.modality ?? "PRESENCIAL",
        vacancies: data.vacancies ?? 0,
        is_active: !!data.is_active,
      });
      setOpenEdit(true);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo abrir el editor"));
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    try {
      await api.put(`/careers/${editRow.id}`, {
        ...editForm,
        duration_semesters: toIntOr(editForm.duration_semesters, 0),
        vacancies: toIntOr(editForm.vacancies, 0),
      });
      toast.success("Carrera actualizada");
      setOpenEdit(false);
      setEditRow(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e, "Error al actualizar"));
    }
  };

  const toggleActive = async (row) => {
    try {
      const { data } = await api.post(`/careers/${row.id}/toggle`);
      setCareers((prev) => prev.map((c) => (c.id === row.id ? data : c)));
      toast.success(`Carrera ${data.is_active ? "activada" : "inactivada"}`);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo cambiar el estado"));
    }
  };

  const removeCareer = async (id) => {
    try {
      await api.delete(`/careers/${id}`);
      toast.success("Carrera eliminada");
      setCareers((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo eliminar"));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 sm:pb-12 animate-in fade-in duration-500">

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Carreras Profesionales
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            Administra el catálogo académico, códigos y vacantes.
          </p>
        </div>

        <Button
          onClick={() => setOpenCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/10 transition-all hover:-translate-y-0.5 w-full sm:w-auto rounded-lg"
        >
          <Plus className="h-4 w-4 mr-2" /> Nueva Carrera
        </Button>
      </div>

      {/* --- FORMULARIO DE CREACIÓN (ANIMADO) --- */}
      {openCreate && (
        <div className="animate-in slide-in-from-top-4 duration-300">
          <Card className="border-0 shadow-md ring-1 ring-gray-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" /> Registrar Nueva Carrera
              </h3>
            </div>
            
            <div className="p-6">
              <form onSubmit={submitCreate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                  {/* Nombre y Código */}
                  <div className="sm:col-span-8 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Nombre de la Carrera *</Label>
                    <Input
                      placeholder="Ej. Educación Inicial"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Código *</Label>
                    <Input
                      placeholder="Ej. C-001"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      required
                      className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg font-mono"
                    />
                  </div>

                  {/* Descripción */}
                  <div className="sm:col-span-12 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Descripción</Label>
                    <Textarea
                      placeholder="Breve descripción del perfil profesional..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="min-h-[80px] border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg resize-none"
                    />
                  </div>

                  {/* Detalles Técnicos */}
                  <div className="sm:col-span-3 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Duración (Sem) *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={form.duration_semesters}
                      onChange={(e) => setForm({ ...form, duration_semesters: e.target.value })}
                      className="border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Vacantes *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.vacancies}
                      onChange={(e) => setForm({ ...form, vacancies: e.target.value })}
                      className="border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Grado *</Label>
                    <Select value={form.degree_type} onValueChange={(v) => setForm({ ...form, degree_type: v })}>
                      <SelectTrigger className="border-gray-300 rounded-lg">
                        <SelectValue placeholder="Seleccione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BACHELOR">Bachiller</SelectItem>
                        <SelectItem value="TECHNICAL">Técnico</SelectItem>
                        <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-2">
                    <Label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Modalidad *</Label>
                    <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                      <SelectTrigger className="border-gray-300 rounded-lg">
                        <SelectValue placeholder="Seleccione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                        <SelectItem value="VIRTUAL">Virtual</SelectItem>
                        <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-gray-100 mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenCreate(false)}
                    className="text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full sm:w-auto rounded-lg"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full sm:w-auto rounded-lg font-medium"
                  >
                    Guardar Carrera
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* --- TABLA DE RESULTADOS --- */}
      <Card className="border-0 shadow-md ring-1 ring-gray-200 rounded-xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Carrera / Descripción</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs w-24">Código</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center w-32">Duración</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center w-24">Vacantes</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-center w-32">Estado</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right w-48">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {careers.map((c) => (
                  <tr key={c.id} className="group hover:bg-blue-50/30 transition-colors duration-200">
                    <td className="px-6 py-4 align-top">
                      <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {c.description || <span className="italic opacity-50">Sin descripción</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top font-mono text-gray-600 text-xs">
                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            {c.code}
                        </span>
                    </td>
                    <td className="px-6 py-4 align-top text-center text-gray-600">
                      <span className="font-medium">{c.duration_semesters}</span> <span className="text-xs text-gray-400">sem.</span>
                    </td>
                    <td className="px-6 py-4 align-top text-center font-medium text-gray-700">
                      {c.vacancies ?? 0}
                    </td>
                    <td className="px-6 py-4 align-top text-center">
                      <Badge 
                        variant="outline" 
                        className={`
                            ${c.is_active 
                                ? "bg-blue-50 text-blue-700 border-blue-200" 
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            } px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                        `}
                      >
                        {c.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="flex justify-end items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openDetails(c)} 
                            className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openEditor(c)} 
                            className="h-8 w-8 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg"
                            title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => toggleActive(c)} 
                            className={`h-8 w-8 rounded-lg ${c.is_active ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100" : "text-blue-400 hover:text-blue-700 hover:bg-blue-50"}`}
                            title={c.is_active ? "Desactivar" : "Activar"}
                        >
                          {/* Un pequeño truco visual para el toggle */}
                          <div className={`w-3 h-3 rounded-full border-2 ${c.is_active ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {careers.length === 0 && (
                  <tr>
                    <td className="px-6 py-16 text-center text-gray-400" colSpan={6}>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-gray-50 rounded-full">
                                <Plus className="h-6 w-6 text-gray-300" />
                            </div>
                            <span className="font-medium">No hay carreras registradas</span>
                            <span className="text-xs">Inicia creando una nueva carrera profesional.</span>
                        </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* --- DIALOGO VER DETALLE --- */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-slate-900 p-6 text-white">
            <h3 className="text-lg font-bold">Detalle de Carrera</h3>
            <p className="text-blue-200 text-sm mt-1">Información registrada en el sistema.</p>
          </div>
          
          {viewRow && (
            <div className="p-6 space-y-6 bg-white">
              <div>
                <Label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Nombre</Label>
                <div className="text-xl font-bold text-gray-900 mt-1">{viewRow.name}</div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 leading-relaxed">
                 {viewRow.description || "Sin descripción disponible."}
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Código</Label>
                   <div className="font-mono text-gray-800 font-medium">{viewRow.code}</div>
                </div>
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Estado</Label>
                   <div className={`text-sm font-bold ${viewRow.is_active ? 'text-blue-600' : 'text-gray-500'}`}>
                     {viewRow.is_active ? "Activa" : "Inactiva"}
                   </div>
                </div>
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Duración</Label>
                   <div className="text-gray-800">{viewRow.duration_semesters} Semestres</div>
                </div>
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Vacantes</Label>
                   <div className="text-gray-800">{viewRow.vacancies ?? 0}</div>
                </div>
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Grado</Label>
                   <div className="text-gray-800 text-xs bg-gray-100 px-2 py-1 rounded inline-block mt-1">{viewRow.degree_type}</div>
                </div>
                <div>
                   <Label className="text-xs text-gray-400 uppercase font-bold">Modalidad</Label>
                   <div className="text-gray-800 text-xs bg-gray-100 px-2 py-1 rounded inline-block mt-1">{viewRow.modality}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- DIALOGO EDITAR (Reutiliza el estilo limpio) --- */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl rounded-2xl p-6 shadow-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4 mb-4">
            <DialogTitle className="text-xl text-gray-900">Editar Carrera</DialogTitle>
          </DialogHeader>

          {editRow && (
            <form onSubmit={submitEdit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500 uppercase">Nombre *</Label>
                    <Input className="font-medium" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500 uppercase">Código *</Label>
                    <Input className="font-mono bg-gray-50" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} required />
                </div>
              </div>
              
              <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Descripción</Label>
                  <Textarea className="resize-none" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase">Duración</Label>
                    <Input type="number" min="1" max="20" className="h-8 bg-white" value={editForm.duration_semesters} onChange={e => setEditForm({ ...editForm, duration_semesters: e.target.value })} />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase">Vacantes</Label>
                    <Input type="number" min="0" className="h-8 bg-white" value={editForm.vacancies} onChange={e => setEditForm({ ...editForm, vacancies: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase">Grado</Label>
                  <Select value={editForm.degree_type} onValueChange={(v) => setEditForm({ ...editForm, degree_type: v })}>
                    <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACHELOR">Bachiller</SelectItem>
                      <SelectItem value="TECHNICAL">Técnico</SelectItem>
                      <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-gray-500 uppercase">Modalidad</Label>
                  <Select value={editForm.modality} onValueChange={(v) => setEditForm({ ...editForm, modality: v })}>
                    <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                      <SelectItem value="VIRTUAL">Virtual</SelectItem>
                      <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    <input 
                        id="car_is_active" 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={!!editForm.is_active} 
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} 
                    />
                    <Label htmlFor="car_is_active" className="text-sm font-medium cursor-pointer">Carrera Activa</Label>
                </div>

                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setOpenEdit(false)} className="rounded-lg">Cancelar</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-lg">Guardar Cambios</Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
  };


/* --------- Applicants (inline) --------- */
const ApplicantsManagement = () => {
  const { api } = useAuth();

  const [rows, setRows] = useState([]);
  const [calls, setCalls] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [callFilter, setCallFilter] = useState("");
  const [careerFilter, setCareerFilter] = useState("");

  // crear
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ call_id: "", career_id: "" });

  // ver detalle
  const [openView, setOpenView] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const callName = (id) => calls.find(c => String(c.id) === String(id))?.name ?? `Convocatoria ${id ?? "—"}`;
  const careerName = (id) => careers.find(c => String(c.id) === String(id))?.name ?? `Carrera ${id ?? "—"}`;

  const fetchAll = async () => {
    try {
      const [appsRes, callsRes, careersRes] = await Promise.all([
        api.get(`/applications${buildQuery()}`),
        api.get("/admission-calls"),
        api.get("/careers"),
      ]);

      const apps = appsRes?.data?.applications ?? appsRes?.data ?? [];
      const nCalls = Array.isArray(callsRes?.data) ? callsRes.data : (callsRes?.data?.calls ?? callsRes?.data ?? []);
      const nCareers = Array.isArray(careersRes?.data) ? careersRes.data : (careersRes?.data?.careers ?? careersRes?.data ?? []);

      setRows(apps);
      setCalls(nCalls);
      setCareers(nCareers);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar postulantes"));
    } finally {
      setLoading(false);
    }
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (callFilter) params.set("call_id", callFilter);
    if (careerFilter) params.set("career_id", careerFilter);
    const q = params.toString();
    return q ? `?${q}` : "";
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setLoading(true); fetchAll(); /* eslint-disable-next-line */ }, [callFilter, careerFilter]);

  const openDetails = (row) => {
    setViewRow(row);
    setOpenView(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!createForm.call_id || !createForm.career_id) {
      toast.error("Selecciona convocatoria y carrera");
      return;
    }
    try {
      await api.post("/applications", {
        call_id: Number(createForm.call_id),
        career_id: Number(createForm.career_id),
      });
      toast.success("Postulación creada");
      setOpenCreate(false);
      setCreateForm({ call_id: "", career_id: "" });
      setLoading(true);
      fetchAll();
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo crear la postulación"));
    }
  };

  const exportXlsx = async () => {
    try {
      const { data } = await api.get("/reports/admission.xlsx", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "admission.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo exportar"));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6 pb-24 sm:pb-6">

      {/* Header + acciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-2xl font-bold">Gestión de Postulantes</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-2" />Exportar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />Nuevo
          </Button>
        </div>
      </div>

     {/* Filtros */}
<Card className="border-0 shadow-sm ring-1 ring-gray-200 bg-white rounded-xl overflow-hidden">
  <CardContent className="p-5">
    
    {/* Encabezado sutil de sección (opcional, ayuda al orden visual) */}
    <div className="flex items-center gap-2 mb-4 text-gray-500">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Filtros de Búsqueda</span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
      
      {/* Filtro: Convocatoria */}
      <div className="md:col-span-5 space-y-2">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
           Convocatoria
        </Label>
        <Select
          value={callFilter || "__all__"}
          onValueChange={(v) => setCallFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50 hover:bg-white hover:border-gray-300 transition-colors text-sm text-gray-700">
            <div className="flex items-center gap-2 truncate">
                <Calendar className="h-4 w-4 text-gray-400" />
                <SelectValue placeholder="Todas las convocatorias" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-lg border-gray-100 shadow-lg">
            <SelectItem value="__all__" className="font-medium text-gray-500">Todas las convocatorias</SelectItem>
            {calls
              .filter(c => c?.id != null)
              .map(c => (
                <SelectItem key={c.id} value={String(c.id)} className="text-gray-700">{c.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro: Carrera */}
      <div className="md:col-span-5 space-y-2">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
           Carrera
        </Label>
        <Select
          value={careerFilter || "__all__"}
          onValueChange={(v) => setCareerFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-gray-50/50 hover:bg-white hover:border-gray-300 transition-colors text-sm text-gray-700">
             <div className="flex items-center gap-2 truncate">
                <GraduationCap className="h-4 w-4 text-gray-400" />
                <SelectValue placeholder="Todas las carreras" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-lg border-gray-100 shadow-lg">
            <SelectItem value="__all__" className="font-medium text-gray-500">Todas las carreras</SelectItem>
            {careers
              .filter(c => c?.id != null)
              .map(c => (
                <SelectItem key={c.id} value={String(c.id)} className="text-gray-700">{c.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botón: Limpiar */}
      <div className="md:col-span-2">
        <Button 
            variant="outline" 
            onClick={() => { setCallFilter(""); setCareerFilter(""); }}
            className="w-full h-10 border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 rounded-lg transition-all"
            title="Restablecer filtros"
        >
          <X className="h-4 w-4 mr-2" />
          <span className="font-medium">Limpiar</span>
        </Button>
      </div>
    </div>
  </CardContent>
</Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Convocatoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrera</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">#{r.id}</td>
                    <td className="px-6 py-4 text-sm">{callName(r.call_id)}</td>
                    <td className="px-6 py-4 text-sm">{careerName(r.career_id)}</td>
                    <td className="px-6 py-4"><Badge variant="default">{r.status ?? "CREATED"}</Badge></td>
                    <td className="px-6 py-4 text-sm">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDetails(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* Si luego agregas edición de aplicación, activa este botón */}
                        {/* <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button> */}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="px-6 py-6 text-center text-sm text-gray-500" colSpan={6}>Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

 {/* Crear postulación */}
<Dialog open={openCreate} onOpenChange={setOpenCreate}>
  <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl bg-white shadow-2xl border-0">
    
    {/* HEADER: Limpio y con tipografía más ligera */}
    <div className="px-8 py-6 border-b border-gray-100">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-gray-900 tracking-tight">
          Nueva Postulación
        </DialogTitle>
        <DialogDescription className="text-gray-600 text-base font-normal mt-1">
          Seleccione la convocatoria y la carrera profesional a la que desea aplicar.
        </DialogDescription>
      </DialogHeader>
    </div>

    <form onSubmit={submitCreate} className="px-8 py-8 space-y-8">
      
      {/* CAMPO 1: CONVOCATORIA */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" /> Convocatoria Activa *
        </Label>
        <Select
          value={createForm.call_id}
          onValueChange={(v) => setCreateForm(f => ({ ...f, call_id: v }))}
        >
          <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-gray-50/30 hover:bg-white hover:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium text-gray-900">
            <SelectValue placeholder="Seleccione una convocatoria..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200 shadow-xl">
            {calls.map(c => (
              <SelectItem key={c.id} value={String(c.id)} className="font-normal text-gray-700 py-3 focus:bg-blue-50 focus:text-blue-900 cursor-pointer">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* CAMPO 2: CARRERA */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-600" /> Carrera Profesional *
        </Label>
        <Select
          value={createForm.career_id}
          onValueChange={(v) => setCreateForm(f => ({ ...f, career_id: v }))}
        >
          <SelectTrigger className="h-12 rounded-xl border border-gray-300 bg-gray-50/30 hover:bg-white hover:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 font-medium text-gray-900">
            <SelectValue placeholder="Seleccione una carrera..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200 shadow-xl">
            {careers.map(c => (
              <SelectItem key={c.id} value={String(c.id)} className="font-normal text-gray-700 py-3 focus:bg-blue-50 focus:text-blue-900 cursor-pointer">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* FOOTER DE ACCIONES */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => setOpenCreate(false)}
          className="text-gray-600 font-medium hover:text-gray-900 hover:bg-gray-100 rounded-lg px-6"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-8 shadow-md transition-transform active:scale-95"
        >
          Crear Postulación
        </Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
      {/* Ver detalle */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Postulación</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">ID:</span> #{viewRow.id}</div>
              <div><span className="font-medium">Convocatoria:</span> {callName(viewRow.call_id)}</div>
              <div><span className="font-medium">Carrera:</span> {careerName(viewRow.career_id)}</div>
              <div><span className="font-medium">Estado:</span> {viewRow.status ?? "CREATED"}</div>
              <div><span className="font-medium">Fecha:</span> {viewRow.created_at ? new Date(viewRow.created_at).toLocaleString() : "—"}</div>
              <div><span className="font-medium">Total:</span> {Number.isFinite(viewRow.total) ? viewRow.total : "—"}</div>
              <div><span className="font-medium">Admitido:</span> {viewRow.admitted ? "Sí" : "No"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


/* --------- Contenedor principal con tabs sincronizadas en URL --------- */
export default function CompleteAdmissionModule() {
  const { user } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();

  const [active, setActive] = useState(tab ?? "dashboard");
  useEffect(() => setActive(tab ?? "dashboard"), [tab]);

  const onTabChange = (v) => {
    setActive(v);
    navigate(`/dashboard/admission/${v}`, { replace: true });
  };

  if (!user) return <div>Acceso no autorizado</div>;

  return (
    <div className="p-6 box-border flex justify-center">
      {/* 1. CONTENEDOR: Usamos 'max-h' en vez de 'h' para que no ocupe espacio vacío */}
      <div className="w-full rounded-2xl p-[1px] bg-gradient-to-b from-slate-500/30 to-slate-900/10 flex flex-col md:max-h-[calc(100vh-3rem)]">


        {/* 2. TARJETA: Restauramos color 70 y ajustamos el flex */}
        <div className="rounded-2xl bg-slate-200/70 backdrop-blur-md border border-white/30 shadow-[0_10px_35px_rgba(0,0,0,0.18)] flex flex-col md:overflow-hidden">


          {/* HEADER (Se queda quieto) */}
          <div className="px-6 pt-5 flex-none">
            <h1 className="text-xl font-bold text-slate-900">
              Módulo Admisión
            </h1>
            <p className="text-sm text-slate-700">
              Gestión de convocatorias, postulantes, documentos, evaluación y resultados.
            </p>
            <div className="mt-3 h-px w-full bg-white/60" />
          </div>

          {/* TABS */}
<Tabs value={active} onValueChange={onTabChange} className="px-6 pt-4 flex flex-col overflow-hidden h-full">

  {/* BARRA DE MENU */}
  {/* BARRA DE MENU */}
<div className="rounded-xl bg-slate-100/80 border border-white/60 px-2 py-2 flex-none mb-4 h-auto">
  <TabsList className="w-full bg-transparent p-0 flex flex-wrap gap-2 h-auto">
    {[
      { val: "dashboard", label: "Dashboard" },
      { val: "careers", label: "Carreras" },
      { val: "calls", label: "Convocatorias" },
      { val: "applicants", label: "Postulantes" },
      { val: "apply", label: "Postulación" },
      { val: "docs", label: "Documentos" },
      { val: "doc-review", label: "Revisión Docs" },
      { val: "eval", label: "Evaluación" },
      { val: "results", label: "Resultados" },
      { val: "schedule", label: "Cronograma" },
      { val: "certificates", label: "Constancias" },
      { val: "reports", label: "Reportes" },
      { val: "payments", label: "Pagos" },
      { val: "params", label: "Parámetros" }
    ].map((item) => (
      <TabsTrigger
        key={item.val}
        value={item.val}
        className="
          rounded-lg flex-1 whitespace-nowrap text-center min-w-[100px] transition-all duration-200
          /* Estado Normal */
          text-slate-600 hover:bg-slate-200/60 hover:text-slate-900
          
          /* Estado Activo (FORZADO con !) */
          data-[state=active]:!bg-slate-800 
          data-[state=active]:!text-white 
          data-[state=active]:!shadow-md
        "
      >
        {item.label}
      </TabsTrigger>
    ))}
  </TabsList>
</div>

            {/* 3. ZONA DE CONTENIDO */}
            <div className="pb-6 pr-1 custom-scrollbar flex-1 md:overflow-y-auto">

              <TabsContent value="dashboard" className="mt-0"><AdmissionDashboard /></TabsContent>
              <TabsContent value="careers" className="mt-0"><CareersManagement /></TabsContent>
              <TabsContent value="calls" className="mt-0"><AdmissionCallsManagement /></TabsContent>
              <TabsContent value="applicants" className="mt-0"><ApplicantsManagement /></TabsContent>
              <TabsContent value="doc-review" className="mt-0"><DocumentReview /></TabsContent>
              <TabsContent value="apply" className="mt-0"><ApplicationWizard /></TabsContent>
              <TabsContent value="docs" className="mt-0"><ApplicantDocuments /></TabsContent>
              <TabsContent value="eval" className="mt-0"><EvaluationBoard /></TabsContent>
              <TabsContent value="results" className="mt-0"><ResultsPublication /></TabsContent>
              <TabsContent value="schedule" className="mt-0"><AdmissionScheduleModule /></TabsContent>
              <TabsContent value="payments" className="mt-0"><PaymentsManagement /></TabsContent>
              <TabsContent value="certificates" className="mt-0"><AdmissionCertificates /></TabsContent>
              <TabsContent value="reports" className="mt-0"><AdmissionReportsModule /></TabsContent>
              <TabsContent value="params" className="mt-0"><AdmissionParamsModule /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );


}
