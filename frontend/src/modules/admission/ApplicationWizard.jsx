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
import { toast } from "sonner";

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

    const [loadingCalls, setLoadingCalls] = useState(true);
    const [creating, setCreating] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(false);

    const [calls, setCalls] = useState([]);
    const [selectedCall, setSelectedCall] = useState(null);
    const [preferences, setPreferences] = useState([]); // [careerId,...]

    const [application, setApplication] = useState(null);

    const [payment, setPayment] = useState({
        status: "PENDING",
        method: "PSP",
        checkout_url: null,
    });

    const [requiredDocs, setRequiredDocs] = useState([]);
    const [docs, setDocs] = useState([]);

    const canContinueToDocs = useMemo(() => payment.status === "PAID", [payment.status]);

    useEffect(() => {
        (async () => {
            try {
                setLoadingCalls(true);
                const list = await AdmissionCalls.listPublic();
                setCalls(Array.isArray(list) ? list : []);
            } catch (e) {
                console.error(e);
                toast.error("No se pudieron cargar las convocatorias");
            } finally {
                setLoadingCalls(false);
            }
        })();
    }, []);

    const ensureApplicant = async () => {
        const me = await getApplicantMe();
        if (me?.exists) return me.applicant;

        // Si tú ya tienes pantalla de perfil, aquí redirige en vez de prompts.
        // Por ahora, “modo full working”:
        const dni = prompt("No tienes perfil de postulante. Ingresa tu DNI:");
        const names = prompt("Nombres completos:");
        const email = prompt("Email:");
        const phone = prompt("Teléfono (opcional):") || "";

        if (!dni || !names || !email) {
            throw new Error("Perfil incompleto: DNI, nombres y email son obligatorios.");
        }

        const created = await createApplicant({ dni, names, email, phone });
        toast.success("Perfil de postulante creado");
        return created;
    };

    // Step 1: crear postulación
    const createApplication = async () => {
        try {
            if (!selectedCall) return toast.error("Seleccione una convocatoria");
            if (preferences.length === 0) return toast.error("Seleccione al menos una carrera");

            setCreating(true);

            await ensureApplicant();

            // ✅ payload correcto para backend
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
            console.error(e);
            const msg =
                e?.response?.data?.detail ||
                e?.response?.data?.errors?.non_field_errors?.[0] ||
                e?.message ||
                "No se pudo crear la postulación";
            toast.error(msg);

            if (e?.response?.data?.errors) {
                console.log("Validation errors:", e.response.data.errors);
            }
        } finally {
            setCreating(false);
        }
    };

    // Step 2: pago
    const startPayment = async () => {
        try {
            if (!application?.id) return toast.error("No hay postulación creada");
            const data = await ApplicationPayment.start(application.id, payment.method);

            // Si tu backend es stub (sin checkout_url), lo comunicamos.
            toast.info(`Pago iniciado. Estado: ${data?.status || "STARTED"}`);
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "No se pudo iniciar el pago");
        }
    };

    const refreshPayment = async () => {
        try {
            if (!application?.id) return toast.error("No hay postulación creada");
            const s = await ApplicationPayment.status(application.id);

            setPayment((p) => ({ ...p, status: s.status }));

            if (s.status === "PAID") {
                toast.success("Pago confirmado");
                setStep(STEPS.DOCS);
            } else if (s.status === "FAILED") {
                toast.error("Pago fallido");
            } else {
                toast.message("Pago pendiente");
            }
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "No se pudo consultar el estado del pago");
        }
    };

    // Step 3: documentos
    const fetchDocs = async () => {
        if (!application?.id) return;
        try {
            setLoadingDocs(true);
            const arr = await ApplicantDocs.listMine(application.id);
            setDocs(Array.isArray(arr) ? arr : []);
        } catch (e) {
            console.error(e);
            toast.error("No se pudieron cargar los documentos");
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        if (application?.id && step === STEPS.DOCS) fetchDocs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [application?.id, step]);

    const upload = async (docType, file) => {
        try {
            if (!application?.id) return toast.error("No hay postulación creada");
            if (!file) return;

            await ApplicantDocs.upload(application.id, docType, file);
            toast.success("Documento subido");
            fetchDocs();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "No se pudo subir el documento");
        }
    };

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <Card>
                <CardHeader>
                    <CardTitle>Postulación – Asistente</CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Steps */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="min-w-[120px] justify-center text-center whitespace-normal" variant={step >= STEPS.CALL ? "default" : "secondary"}>
                            1. Convocatoria
                        </Badge>
                        <Badge className="min-w-[120px] justify-center text-center whitespace-normal" variant={step >= STEPS.PAYMENT ? "default" : "secondary"}>
                            2. Pago
                        </Badge>
                        <Badge className="min-w-[120px] justify-center text-center whitespace-normal" variant={step >= STEPS.DOCS ? "default" : "secondary"}>
                            3. Documentos
                        </Badge>
                        <Badge className="min-w-[120px] justify-center text-center whitespace-normal" variant={step >= STEPS.REVIEW ? "default" : "secondary"}>
                            4. Revisión
                        </Badge>
                    </div>

                    {/* STEP 1 */}
                    {step === STEPS.CALL && (
                        <div className="space-y-4">
                            <Label>Convocatoria</Label>

                            <Select
                                disabled={loadingCalls}
                                onValueChange={(val) => setSelectedCall(calls.find((x) => String(x.id) === String(val)))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingCalls ? "Cargando..." : "Seleccione"} />
                                </SelectTrigger>

                                <SelectContent>
                                    {calls.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name} ({new Date(c.registration_start).toLocaleDateString()}–{new Date(c.registration_end).toLocaleDateString()})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedCall && (
                                <>
                                    <Label className="mt-2">Carreras de preferencia</Label>

                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {selectedCall.careers?.map((k) => {
                                            const checked = preferences.includes(k.id);
                                            return (
                                                <label key={k.id} className="border rounded p-2 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) =>
                                                            setPreferences((prev) =>
                                                                e.target.checked ? [...prev, k.id] : prev.filter((id) => id !== k.id)
                                                            )
                                                        }
                                                    />
                                                    <span className="text-sm">{k.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {preferences.length > 0 && (
                                        <p className="text-xs text-gray-500">
                                            Orden de preferencia = orden en que marcaste. (Sí, tu backend ahora sí lo guarda 😄)
                                        </p>
                                    )}
                                </>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={createApplication} disabled={!selectedCall || creating}>
                                    {creating ? "Creando..." : "Continuar"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === STEPS.PAYMENT && application && (
                        <div className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Método de pago</Label>
                                    <Select value={payment.method} onValueChange={(v) => setPayment((p) => ({ ...p, method: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PSP">Pasarela</SelectItem>
                                            <SelectItem value="CASHIER">Caja (presencial)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Estado</Label>
                                    <Input readOnly value={payment.status} />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={startPayment}>Generar pago</Button>
                                <Button variant="outline" onClick={refreshPayment}>
                                    Actualizar estado
                                </Button>
                                <Button variant="outline" disabled={!canContinueToDocs} onClick={() => setStep(STEPS.DOCS)}>
                                    Continuar
                                </Button>
                            </div>

                            {!canContinueToDocs && (
                                <p className="text-xs text-gray-500">
                                    Tip: si tu pago es “caja”, un admin tiene que confirmarlo (Payment → CONFIRMED) para que aquí salga PAID.
                                </p>
                            )}
                        </div>
                    )}

                    {/* STEP 3 */}
                    {step === STEPS.DOCS && application && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Label>Documentos requeridos</Label>
                                <Button variant="outline" onClick={fetchDocs} disabled={loadingDocs}>
                                    {loadingDocs ? "Refrescando..." : "Refrescar"}
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {requiredDocs.map((t) => {
                                    const existing = docs.find((d) => d.document_type === t);
                                    return (
                                        <div key={t} className="flex items-center justify-between border rounded p-2 gap-3 flex-wrap">
                                            <div className="text-sm min-w-[220px]">
                                                <div className="font-medium">{DOC_LABELS[t] || t}</div>

                                                {existing ? (
                                                    <>
                                                        <div className="text-xs text-gray-500">Estado: {existing.review_status || "UPLOADED"}</div>
                                                        {existing.observations && (
                                                            <div className="text-xs text-amber-600">Obs: {existing.observations}</div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="text-xs text-gray-500">Aún no subido</div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input type="file" onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} />
                                                {existing?.url && (
                                                    <a className="text-sm text-blue-600 underline" href={existing.url} target="_blank" rel="noreferrer">
                                                        Ver
                                                    </a>
                                                )}
                                                {existing && <Badge variant="outline">Subido</Badge>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button onClick={() => setStep(STEPS.REVIEW)}>Continuar</Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 */}
                    {step === STEPS.REVIEW && (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                Revise que su pago esté confirmado y que todos los documentos estén cargados.
                            </p>
                            <div className="flex justify-end">
                                <Button onClick={() => toast.success("Postulación lista. Recibirá notificaciones de evaluación y resultados.")}>
                                    Finalizar
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
