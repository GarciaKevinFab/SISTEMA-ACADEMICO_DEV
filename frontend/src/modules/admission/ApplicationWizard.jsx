import React, { useEffect, useMemo, useState } from "react";
import {
  AdmissionCalls,
  Applications,
  ApplicationPayment,
  ApplicantDocs,
  getApplicantMe,
  createApplicant,
} from "../../services/admission.service";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  Circle, 
  CreditCard, 
  FileText, 
  Calendar, 
  GraduationCap, 
  User, 
  Upload, 
  Eye, 
  RefreshCw,
  ArrowRight
} from "lucide-react";

const STEPS = { CALL: 1, PAYMENT: 2, DOCS: 3, REVIEW: 4 };

const DOC_LABELS = {
  BIRTH_CERTIFICATE: "Partida de nacimiento",
  STUDY_CERTIFICATE: "Certificado de estudios",
  PHOTO: "Fotografía",
  DNI_COPY: "Copia de DNI",
  CONADIS_COPY: "Copia carné CONADIS",
};

export default function ApplicationWizard() {
  const [step, setStep] = useState(STEPS.CALL);

  // Estados de carga
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Datos de convocatoria
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [preferences, setPreferences] = useState([]);

  // Postulación y Pago
  const [application, setApplication] = useState(null);
  const [payment, setPayment] = useState({
    status: "PENDING",
    method: "PSP",
    checkout_url: null,
  });

  // Documentos
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [docs, setDocs] = useState([]);

  // --- ESTADOS PARA PERFIL DE POSTULANTE (MODAL) ---
  const [openProfileModal, setOpenProfileModal] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ 
    dni: "", names: "", email: "", phone: "" 
  });

  const canContinueToDocs = useMemo(() => payment.status === "PAID", [payment.status]);

  // Carga inicial de convocatorias
  useEffect(() => {
    (async () => {
      try {
        setLoadingCalls(true);
        const list = await AdmissionCalls.listPublic();
        setCalls(Array.isArray(list) ? list : []);
      } catch (e) {
        toast.error("No se pudieron cargar las convocatorias");
      } finally {
        setLoadingCalls(false);
      }
    })();
  }, []);

  // --- LÓGICA DE PERFIL (REEMPLAZA PROMPTS) ---
  const ensureApplicant = async () => {
    const me = await getApplicantMe();
    if (me?.exists) return me.applicant;
    setOpenProfileModal(true);
    return null;
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setIsCreatingProfile(true);
    try {
      await createApplicant(profileForm);
      toast.success("Perfil de postulante creado");
      setOpenProfileModal(false);
      toast.info("Ya puedes continuar con tu postulación");
    } catch (e) {
      toast.error("Error al crear el perfil");
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Step 1: Crear postulación
  const createApplication = async () => {
    try {
      if (!selectedCall) return toast.error("Seleccione una convocatoria");
      if (preferences.length === 0) return toast.error("Seleccione al menos una carrera");

      setCreating(true);
      const applicant = await ensureApplicant();
      if (!applicant) return; // Se detiene si el modal se abrió

      const payload = {
        call: selectedCall.id,
        career_preferences: preferences,
      };

      const res = await Applications.create(payload);
      const appObj = res?.application || res;

      setApplication(appObj);
      setRequiredDocs(selectedCall.required_documents || []);
      toast.success("Preinscripción creada");
      setStep(STEPS.PAYMENT);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Error al crear postulación";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // Step 2: Pago
  const startPayment = async () => {
    try {
      if (!application?.id) return toast.error("No hay postulación");
      const data = await ApplicationPayment.start(application.id, payment.method);
      toast.info(`Pago iniciado. Estado: ${data?.status || "STARTED"}`);
    } catch (e) {
      toast.error("No se pudo iniciar el pago");
    }
  };

  const refreshPayment = async () => {
    try {
      if (!application?.id) return;
      const s = await ApplicationPayment.status(application.id);
      setPayment((p) => ({ ...p, status: s.status }));
      if (s.status === "PAID") {
        toast.success("Pago confirmado");
        setStep(STEPS.DOCS);
      } else {
        toast.info("Pago aún pendiente");
      }
    } catch (e) {
      toast.error("Error al consultar pago");
    }
  };

  // Step 3: Documentos
  const fetchDocs = async () => {
    if (!application?.id) return;
    try {
      setLoadingDocs(true);
      const arr = await ApplicantDocs.listMine(application.id);
      setDocs(Array.isArray(arr) ? arr : []);
    } catch (e) {
      toast.error("Error al cargar documentos");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (application?.id && step === STEPS.DOCS) fetchDocs();
  }, [application?.id, step]);

  const upload = async (docType, file) => {
    try {
      if (!application?.id) return;
      await ApplicantDocs.upload(application.id, docType, file);
      toast.success("Documento subido");
      fetchDocs();
    } catch (e) {
      toast.error("Error al subir archivo");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 sm:pb-12 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Asistente de Postulación</h2>
        <p className="text-gray-600 mt-1 text-sm font-medium">Sigue los pasos para completar tu registro al IESPP.</p>
      </div>

      <Card className="border-0 shadow-xl ring-1 ring-gray-200 rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-0">
          
          {/* INDICADOR DE PASOS - ESTILO CLEAN */}
          <div className="grid grid-cols-4 border-b border-gray-100 bg-gray-50/50">
            {[
              { id: STEPS.CALL, label: "Convocatoria", icon: Calendar },
              { id: STEPS.PAYMENT, label: "Pago", icon: CreditCard },
              { id: STEPS.DOCS, label: "Documentos", icon: FileText },
              { id: STEPS.REVIEW, label: "Revisión", icon: CheckCircle2 },
            ].map((s) => (
              <div 
                key={s.id} 
                className={`flex flex-col items-center py-4 px-2 gap-1 border-b-2 transition-all ${
                  step >= s.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400"
                }`}
              >
                <s.icon className={`h-5 w-5 ${step === s.id ? "animate-pulse" : ""}`} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:block">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="p-6 sm:p-10">
            {/* STEP 1: CONVOCATORIA */}
            {step === STEPS.CALL && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-4">
                  <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">1. Seleccione Convocatoria</Label>
                  <Select
                    disabled={loadingCalls}
                    onValueChange={(val) => setSelectedCall(calls.find((x) => String(x.id) === String(val)))}
                  >
                    <SelectTrigger className="h-12 text-base border-gray-300 rounded-xl focus:ring-blue-100">
                      <SelectValue placeholder={loadingCalls ? "Cargando convocatorias..." : "Buscar proceso de admisión..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {calls.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)} className="py-3">
                          {c.name} <span className="text-gray-400 ml-2 text-xs">({new Date(c.registration_start).toLocaleDateString()})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCall && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">2. Carreras de preferencia (En orden)</Label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {selectedCall.careers?.map((k) => {
                        const isSelected = preferences.includes(k.id);
                        return (
                          <button
                            key={k.id}
                            onClick={() => setPreferences(prev => 
                                isSelected ? prev.filter(id => id !== k.id) : [...prev, k.id]
                            )}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                isSelected ? "border-blue-600 bg-blue-50/50 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <span className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-gray-700"}`}>{k.name}</span>
                            {isSelected ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : <Circle className="h-5 w-5 text-gray-300" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button 
                    size="lg"
                    onClick={createApplication} 
                    disabled={!selectedCall || preferences.length === 0 || creating}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-10 h-12 font-bold shadow-lg shadow-blue-900/10"
                  >
                    {creating ? "Procesando..." : "Continuar"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: PAGO */}
            {step === STEPS.PAYMENT && application && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center gap-4 text-blue-800">
                    <div className="p-3 bg-blue-600 rounded-full text-white shadow-lg">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-lg">Monto a pagar: S/. {application.application_fee || "0.00"}</p>
                        <p className="text-sm opacity-80">Seleccione su método de pago preferido para continuar.</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase">Método de pago</Label>
                    <Select value={payment.method} onValueChange={(v) => setPayment((p) => ({ ...p, method: v }))}>
                      <SelectTrigger className="h-12 border-gray-300 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PSP">Pasarela de Pagos (Visa/Mastercard)</SelectItem>
                        <SelectItem value="CASHIER">Caja de la Institución (Presencial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase">Estado actual</Label>
                    <div className="h-12 flex items-center px-4 rounded-xl bg-gray-100 border border-gray-200 font-bold text-gray-700">
                        {payment.status}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button variant="outline" onClick={startPayment} className="h-12 rounded-xl border-gray-300 font-bold px-6">
                    Generar Orden de Pago
                  </Button>
                  <Button variant="outline" onClick={refreshPayment} className="h-12 rounded-xl border-gray-300 font-bold px-6 text-blue-600">
                    <RefreshCw className="mr-2 h-4 w-4" /> Verificar Pago
                  </Button>
                  <Button 
                    disabled={!canContinueToDocs} 
                    onClick={() => setStep(STEPS.DOCS)}
                    className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 shadow-lg shadow-blue-900/10"
                  >
                    Siguiente Paso
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: DOCUMENTOS */}
            {step === STEPS.DOCS && application && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <Label className="text-lg font-bold text-gray-900">Documentación Requerida</Label>
                  <Button variant="ghost" size="sm" onClick={fetchDocs} disabled={loadingDocs} className="text-blue-600 font-bold">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingDocs ? "animate-spin" : ""}`} /> Actualizar
                  </Button>
                </div>

                <div className="grid gap-4">
                  {requiredDocs.map((t) => {
                    const existing = docs.find((d) => d.document_type === t);
                    return (
                      <div key={t} className="flex flex-col sm:flex-row items-center justify-between p-5 border border-gray-200 rounded-2xl bg-white hover:border-blue-200 transition-colors gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2 rounded-lg ${existing ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                                <FileText size={20} />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{DOC_LABELS[t] || t}</div>
                                <div className="text-xs text-gray-500 font-medium">Estado: {existing?.review_status || "Pendiente de envío"}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {existing?.url && (
                                <Button variant="ghost" size="sm" asChild className="text-blue-600">
                                    <a href={existing.url} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 mr-1" /> Ver</a>
                                </Button>
                            )}
                            
                            <div className="relative">
                                <Input 
                                    type="file" 
                                    className="hidden" 
                                    id={`file-${t}`}
                                    onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} 
                                />
                                <Button asChild variant={existing ? "outline" : "default"} className={`h-10 rounded-lg cursor-pointer ${!existing && "bg-blue-600"}`}>
                                    <label htmlFor={`file-${t}`}>
                                        <Upload className="h-4 w-4 mr-2" /> {existing ? "Reemplazar" : "Subir archivo"}
                                    </label>
                                </Button>
                            </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-4">
                  <Button size="lg" onClick={() => setStep(STEPS.REVIEW)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 rounded-xl">
                    Continuar a Revisión
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: REVISIÓN */}
            {step === STEPS.REVIEW && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 text-center">
                <div className="py-10 space-y-4">
                    <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">¡Todo listo para finalizar!</h3>
                    <p className="text-gray-600 max-w-md mx-auto font-medium">
                        Tu preinscripción ha sido registrada con éxito. Una vez que confirmes, nuestro equipo administrativo revisará tu documentación.
                    </p>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-left max-w-md mx-auto space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Postulante:</span>
                        <span className="font-bold text-gray-900">{profileForm.names || "Registrado"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Convocatoria:</span>
                        <span className="font-bold text-gray-900">{selectedCall?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Estado de Pago:</span>
                        <Badge className="bg-green-500">{payment.status}</Badge>
                    </div>
                </div>

                <div className="pt-6">
                  <Button 
                    size="lg"
                    onClick={() => {
                        toast.success("Postulación enviada correctamente");
                        // Aquí redirigirías al dashboard o perfil
                    }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-12 h-14 rounded-2xl shadow-xl shadow-blue-900/20 text-lg"
                  >
                    Finalizar Postulación
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- MODAL: PERFIL DE POSTULANTE (ESTILO CLEAN) --- */}
      <Dialog open={openProfileModal} onOpenChange={setOpenProfileModal}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-3xl bg-white shadow-2xl border-0 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
                <User className="text-blue-600" /> Perfil del Postulante
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base font-normal mt-1">
                Por única vez, necesitamos tus datos para registrarte en el sistema.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={submitProfile} className="px-8 py-8 space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Número de DNI *</Label>
                <Input
                  value={profileForm.dni}
                  onChange={(e) => setProfileForm({ ...profileForm, dni: e.target.value })}
                  placeholder="8 dígitos"
                  className="h-11 font-medium border-gray-300 focus:border-blue-500 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombres y Apellidos *</Label>
                <Input
                  value={profileForm.names}
                  onChange={(e) => setProfileForm({ ...profileForm, names: e.target.value })}
                  placeholder="Escriba aquí sus nombres"
                  className="h-11 font-medium border-gray-300 focus:border-blue-500 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email de contacto *</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className="h-11 font-medium border-gray-300 focus:border-blue-500 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono Celular</Label>
                <Input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="900000000"
                  className="h-11 font-medium border-gray-300 focus:border-blue-500 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={isCreatingProfile}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-900/10"
              >
                {isCreatingProfile ? "Guardando..." : "Crear Perfil y Continuar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}