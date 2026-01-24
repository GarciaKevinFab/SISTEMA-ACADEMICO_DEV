// src/modules/admission/PublicApplicationWizard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

import { AdmissionCalls, AdmissionPublic } from "../../services/admission.service";

const STEPS = { PERSONAL: 1, SCHOOL: 2, PHOTO: 3 };
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

const DEPARTMENTS_PE = [
    "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco",
    "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto",
    "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

const LANGS = ["Español", "Quechua", "Aymara", "Asháninka", "Otra"];
const ETHNIC = ["Mestizo", "Quechua", "Aymara", "Amazonía", "Afroperuano", "Otro", "Prefiero no decir"];
const SCHOOL_TYPES = ["Público", "Privado"];

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

export default function PublicApplicationWizard({ callId, onClose, onApplied }) {
    const params = useParams();
    const id = callId || params.id;
    const navigate = useNavigate();

    const [step, setStep] = useState(STEPS.PERSONAL);
    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [primaryCareerId, setPrimaryCareerId] = useState(""); // ✅ carrera principal
    const [photoPreview, setPhotoPreview] = useState("");

    const [profile, setProfile] = useState({
        nationality: "PERUANA",
        document_type: "DNI",
        sex: "",
        ethnic_identity: "",
        document_number: "",
        last_name_father: "",
        last_name_mother: "",
        first_names: "",
        birth_date: "",
        birth_department: "",
        mother_tongue: "",
        secondary_language: "",
        mobile: "",
        email: "",
        address: "",
        address_department: "",
    });

    const [school, setSchool] = useState({
        school_department: "",
        promotion_year: "",
        school_type: "",
        school_name: "",
    });

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!data) throw new Error();
                setCall(data);
                setPrimaryCareerId("");
            } catch {
                toast.error("Convocatoria inválida");
                onClose ? onClose() : navigate("/public/admission");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate, onClose]);

    const fullName = `${profile.first_names} ${profile.last_name_father} ${profile.last_name_mother}`.trim();

    const canPersonalNext = useMemo(() => {
        const dniOk = onlyDigits(profile.document_number).length >= 8;
        const emailOk = (profile.email || "").includes("@");
        const namesOk = (profile.first_names || "").trim().length >= 2 && (profile.last_name_father || "").trim().length >= 2;
        const phoneOk = onlyDigits(profile.mobile).length >= 9;
        const birthOk = !!profile.birth_date && !!profile.birth_department;
        const homeOk = !!profile.address && !!profile.address_department;
        const langOk = !!profile.mother_tongue;
        const ethOk = !!profile.ethnic_identity;
        const sexOk = !!profile.sex;
        const careerOk = !!primaryCareerId;
        return dniOk && emailOk && namesOk && phoneOk && birthOk && homeOk && langOk && ethOk && sexOk && careerOk;
    }, [profile, primaryCareerId]);

    const canSchoolNext = useMemo(() => {
        return !!school.school_department && !!school.promotion_year && !!school.school_type;
    }, [school]);

    const pickPrimaryCareer = (careerId) => {
        setPrimaryCareerId(String(careerId));
    };

    const onPhotoChange = async (file) => {
        if (!file) return;
        try {
            const b64 = await fileToBase64(file);
            setPhotoPreview(b64);
        } catch {
            toast.error("No se pudo leer la imagen");
        }
    };

    const submit = async () => {
        if (!call) return;

        if (!primaryCareerId) return toast.error("Seleccione una carrera");

        try {
            setSubmitting(true);

            const applicantPayload = {
                dni: onlyDigits(profile.document_number),
                names: fullName,
                email: profile.email.trim(),
                phone: onlyDigits(profile.mobile),
            };

            const payload = {
                call_id: call.id,
                applicant: applicantPayload,
                career_preferences: [Number(primaryCareerId)], // ✅ primera preferencia (consume vacante)
                profile: { ...profile, document_number: applicantPayload.dni },
                school,
                photo_base64: photoPreview || null,
            };

            const res = await AdmissionPublic.apply(payload);
            toast.success("Postulación registrada");

            // ✅ refresca vacantes de inmediato
            if (onApplied && res?.updated_call) onApplied(res.updated_call);

            onClose ? onClose() : navigate("/public/admission/results");
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "No se pudo registrar");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Cargando...</div>;
    if (!call) return null;

    return (
        <div className="space-y-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Registro de Datos del Postulante – {call.name}</CardTitle>
                </CardHeader>
            </Card>

            <div className="flex gap-2 flex-wrap">
                <Badge variant={step === STEPS.PERSONAL ? "default" : "secondary"}>1. Datos Personales</Badge>
                <Badge variant={step === STEPS.SCHOOL ? "default" : "secondary"}>2. Colegio</Badge>
                <Badge variant={step === STEPS.PHOTO ? "default" : "secondary"}>3. Foto</Badge>
            </div>

            {/* STEP 1 */}
            {step === STEPS.PERSONAL && (
                <Card className="shadow-sm">
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label>Nacionalidad *</Label>
                                <Select value={profile.nationality} onValueChange={(v) => setProfile({ ...profile, nationality: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERUANA">Peruana</SelectItem>
                                        <SelectItem value="OTRA">Otra</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Tipo Documento *</Label>
                                <Select value={profile.document_type} onValueChange={(v) => setProfile({ ...profile, document_type: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DNI">DNI</SelectItem>
                                        <SelectItem value="CE">Carné Extranjería</SelectItem>
                                        <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Sexo *</Label>
                                <Select value={profile.sex} onValueChange={(v) => setProfile({ ...profile, sex: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Masculino</SelectItem>
                                        <SelectItem value="F">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label>DNI *</Label>
                                <Input className="h-11" value={profile.document_number} onChange={(e) => setProfile({ ...profile, document_number: onlyDigits(e.target.value) })} />
                            </div>
                            <div>
                                <Label>Ap. Paterno *</Label>
                                <Input className="h-11" value={profile.last_name_father} onChange={(e) => setProfile({ ...profile, last_name_father: e.target.value })} />
                            </div>
                            <div>
                                <Label>Ap. Materno *</Label>
                                <Input className="h-11" value={profile.last_name_mother} onChange={(e) => setProfile({ ...profile, last_name_mother: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Nombres *</Label>
                                <Input className="h-11" value={profile.first_names} onChange={(e) => setProfile({ ...profile, first_names: e.target.value })} />
                            </div>
                            <div>
                                <Label>Identidad étnica *</Label>
                                <Select value={profile.ethnic_identity} onValueChange={(v) => setProfile({ ...profile, ethnic_identity: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {ETHNIC.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Fecha Nacimiento *</Label>
                                <Input className="h-11" type="date" value={profile.birth_date} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} />
                            </div>
                            <div>
                                <Label>Departamento (nacimiento) *</Label>
                                <Select value={profile.birth_department} onValueChange={(v) => setProfile({ ...profile, birth_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Lengua materna *</Label>
                                <Select value={profile.mother_tongue} onValueChange={(v) => setProfile({ ...profile, mother_tongue: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {LANGS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Lengua secundaria</Label>
                                <Input className="h-11" value={profile.secondary_language} onChange={(e) => setProfile({ ...profile, secondary_language: e.target.value })} placeholder="Opcional" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>N° Celular *</Label>
                                <Input className="h-11" value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: onlyDigits(e.target.value) })} />
                            </div>
                            <div>
                                <Label>Correo electrónico *</Label>
                                <Input className="h-11" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Dirección actual *</Label>
                                <Input className="h-11" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                            </div>
                            <div>
                                <Label>Departamento (domicilio) *</Label>
                                <Select value={profile.address_department} onValueChange={(v) => setProfile({ ...profile, address_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-4 border-t space-y-2">
                            <Label>Seleccione la carrera (consume vacante) *</Label>
                            <div className="grid md:grid-cols-2 gap-3">
                                {call.careers.map((c) => (
                                    <button
                                        type="button"
                                        key={c.id}
                                        disabled={Number(c.vacancies) <= 0}
                                        onClick={() => pickPrimaryCareer(c.id)}
                                        className={`text-left border rounded-xl p-4 transition-all
                      ${String(primaryCareerId) === String(c.id) ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-200"}
                      ${Number(c.vacancies) <= 0 ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}
                    `}
                                    >
                                        <div className="font-semibold">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.vacancies} vacantes</div>
                                        {Number(c.vacancies) <= 0 && <div className="text-xs text-red-600 font-semibold mt-1">Sin vacantes</div>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button disabled={!canPersonalNext} onClick={() => setStep(STEPS.SCHOOL)}>
                                Siguiente
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* STEP 2 */}
            {step === STEPS.SCHOOL && (
                <Card className="shadow-sm">
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label>Departamento (Colegio) *</Label>
                                <Select value={school.school_department} onValueChange={(v) => setSchool({ ...school, school_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Año de promoción *</Label>
                                <Input className="h-11" value={school.promotion_year} onChange={(e) => setSchool({ ...school, promotion_year: onlyDigits(e.target.value).slice(0, 4) })} placeholder="2024" />
                            </div>

                            <div>
                                <Label>Tipo de colegio *</Label>
                                <Select value={school.school_type} onValueChange={(v) => setSchool({ ...school, school_type: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {SCHOOL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Nombre del colegio</Label>
                            <Input className="h-11" value={school.school_name} onChange={(e) => setSchool({ ...school, school_name: e.target.value })} />
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(STEPS.PERSONAL)}>Atrás</Button>
                            <Button disabled={!canSchoolNext} onClick={() => setStep(STEPS.PHOTO)}>Siguiente</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* STEP 3 */}
            {step === STEPS.PHOTO && (
                <Card className="shadow-sm">
                    <CardContent className="space-y-6 pt-6">
                        <div>
                            <Label>Foto (opcional)</Label>
                            <Input className="h-11" type="file" accept="image/*" onChange={(e) => onPhotoChange(e.target.files?.[0] || null)} />
                        </div>

                        {photoPreview && (
                            <div className="border rounded-xl p-3 bg-gray-50">
                                <img src={photoPreview} alt="preview" className="max-h-64 mx-auto rounded-xl" />
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep(STEPS.SCHOOL)}>Atrás</Button>
                            <Button disabled={submitting} onClick={submit} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {submitting ? "Registrando..." : "Registrar"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
