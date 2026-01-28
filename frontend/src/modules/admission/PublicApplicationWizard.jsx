// src/modules/admission/PublicApplicationWizard.jsx
import React, { useEffect, useState } from "react";
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
const STORAGE_KEY = "admission_wizard_backup";

const DEPARTMENTS_PE = [
    "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco",
    "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto",
    "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

const LANGS = ["Español", "Quechua", "Aymara", "Asháninka", "Otra"];
const ETHNIC = ["Mestizo", "Quechua", "Aymara", "Amazonía", "Afroperuano", "Otro", "Prefiero no decir"];
const SCHOOL_TYPES = ["Público", "Privado"];

// Componente pequeño para mostrar error
const ErrorMsg = ({ msg }) => {
    if (!msg) return null;
    return <p className="text-red-500 text-xs mt-1 font-medium ml-1">⚠ {msg}</p>;
};

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

    const [isInitialized, setIsInitialized] = useState(false);
    const [step, setStep] = useState(STEPS.PERSONAL);
    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Estado para guardar errores de validación { campo: "mensaje" }
    const [errors, setErrors] = useState({});

    const [primaryCareerId, setPrimaryCareerId] = useState("");
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

    // 1. RECUPERAR DATOS
    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.profile) setProfile(parsed.profile);
                if (parsed.school) setSchool(parsed.school);
                if (parsed.step) setStep(parsed.step);
                if (parsed.primaryCareerId) setPrimaryCareerId(parsed.primaryCareerId);
            } catch (error) {
                console.error("Error recuperando backup:", error);
            }
        }
        setIsInitialized(true);
    }, []);

    // 2. GUARDAR DATOS
    useEffect(() => {
        if (!isInitialized) return;
        const dataToSave = { profile, school, step, primaryCareerId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, [profile, school, step, primaryCareerId, isInitialized]);

    // CARGAR CONVOCATORIA
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!data) throw new Error();
                setCall(data);
                setPrimaryCareerId((prev) => prev || "");
            } catch {
                toast.error("Convocatoria inválida");
                onClose ? onClose() : navigate("/public/admission");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate, onClose]);

    const fullName = `${profile.first_names} ${profile.last_name_father} ${profile.last_name_mother}`.trim();

    // ---- VALIDACIONES ----

    // Función para manejar input de DNI con restricción
    const handleDocumentChange = (e) => {
        const val = onlyDigits(e.target.value);
        // Si es DNI, no permitir más de 8 dígitos
        if (profile.document_type === "DNI" && val.length > 8) return;
        
        setProfile({ ...profile, document_number: val });
        // Limpiar error si ya lo corrigió
        if (errors.document_number) setErrors({ ...errors, document_number: null });
    };

    const validatePersonalStep = () => {
        const newErrors = {};
        
        if (!profile.nationality) newErrors.nationality = "Requerido";
        if (!profile.document_type) newErrors.document_type = "Requerido";
        if (!profile.sex) newErrors.sex = "Requerido";
        
        // Validación específica DNI
        if (!profile.document_number) {
            newErrors.document_number = "Ingrese su número de documento";
        } else if (profile.document_type === "DNI" && profile.document_number.length !== 8) {
            newErrors.document_number = "El DNI debe tener 8 dígitos exactos";
        }

        if (!profile.last_name_father) newErrors.last_name_father = "Requerido";
        if (!profile.last_name_mother) newErrors.last_name_mother = "Requerido";
        if (!profile.first_names) newErrors.first_names = "Requerido";
        
        if (!profile.birth_date) newErrors.birth_date = "Indique fecha de nacimiento";
        if (!profile.birth_department) newErrors.birth_department = "Requerido";
        if (!profile.ethnic_identity) newErrors.ethnic_identity = "Requerido";
        if (!profile.mother_tongue) newErrors.mother_tongue = "Requerido";

        if (!profile.mobile) {
            newErrors.mobile = "Requerido";
        } else if (profile.mobile.length < 9) {
            newErrors.mobile = "Mínimo 9 dígitos";
        }

        if (!profile.email || !profile.email.includes("@")) newErrors.email = "Correo inválido";
        
        if (!profile.address) newErrors.address = "Requerido";
        if (!profile.address_department) newErrors.address_department = "Requerido";

        if (!primaryCareerId) newErrors.career = "Debe seleccionar una carrera";

        setErrors(newErrors);
        // Si hay llaves en el objeto errores, retorna false (inválido)
        return Object.keys(newErrors).length === 0;
    };

    const validateSchoolStep = () => {
        const newErrors = {};
        if (!school.school_department) newErrors.school_department = "Seleccione el lugar del colegio";
        
        if (!school.promotion_year) {
            newErrors.promotion_year = "Requerido";
        } else if (school.promotion_year.length !== 4) {
            newErrors.promotion_year = "Debe ser un año (ej. 2023)";
        }

        if (!school.school_type) newErrors.school_type = "Requerido";
        if (!school.school_name) newErrors.school_name = "Escriba el nombre del colegio";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNextToSchool = () => {
        if (validatePersonalStep()) {
            setStep(STEPS.SCHOOL);
            window.scrollTo(0, 0);
        } else {
            toast.error("Por favor complete los campos marcados en rojo");
        }
    };

    const handleNextToPhoto = () => {
        if (validateSchoolStep()) {
            setStep(STEPS.PHOTO);
            window.scrollTo(0, 0);
        } else {
            toast.error("Por favor complete los datos del colegio");
        }
    };

    // ---- END VALIDACIONES ----

    const pickPrimaryCareer = (careerId) => {
        setPrimaryCareerId(String(careerId));
        if (errors.career) setErrors({ ...errors, career: null });
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
                career_preferences: [Number(primaryCareerId)],
                profile: { ...profile, document_number: applicantPayload.dni },
                school,
                photo_base64: photoPreview || null,
            };

            const res = await AdmissionPublic.apply(payload);
            toast.success("Postulación registrada con éxito");
            localStorage.removeItem(STORAGE_KEY);

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
            <Card className="shadow-sm border-blue-100 border">
                <CardHeader>
                    <CardTitle className="text-lg text-blue-900">Registro de Datos – {call.name}</CardTitle>
                </CardHeader>
            </Card>

            {/* Stepper simple */}
            <div className="flex gap-2 flex-wrap">
                <Badge variant={step === STEPS.PERSONAL ? "default" : "outline"} className="text-sm py-1">1. Datos Personales</Badge>
                <Badge variant={step === STEPS.SCHOOL ? "default" : "outline"} className="text-sm py-1">2. Colegio</Badge>
                <Badge variant={step === STEPS.PHOTO ? "default" : "outline"} className="text-sm py-1">3. Foto</Badge>
            </div>

            {/* STEP 1 */}
            {step === STEPS.PERSONAL && (
                <Card className="shadow-sm">
                    <CardContent className="space-y-6 pt-6">
                        {/* Fila 1 */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label className={errors.nationality ? "text-red-500" : ""}>Nacionalidad *</Label>
                                <Select value={profile.nationality} onValueChange={(v) => setProfile({ ...profile, nationality: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERUANA">Peruana</SelectItem>
                                        <SelectItem value="OTRA">Otra</SelectItem>
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.nationality} />
                            </div>

                            <div>
                                <Label className={errors.document_type ? "text-red-500" : ""}>Tipo Documento *</Label>
                                <Select value={profile.document_type} onValueChange={(v) => setProfile({ ...profile, document_type: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DNI">DNI</SelectItem>
                                        <SelectItem value="CE">Carné Extranjería</SelectItem>
                                        <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.document_type} />
                            </div>

                            <div>
                                <Label className={errors.sex ? "text-red-500" : ""}>Sexo *</Label>
                                <Select value={profile.sex} onValueChange={(v) => setProfile({ ...profile, sex: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Masculino</SelectItem>
                                        <SelectItem value="F">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.sex} />
                            </div>
                        </div>

                        {/* Fila 2 - Documento y Apellidos */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label className={errors.document_number ? "text-red-500" : ""}>
                                    N° Documento {profile.document_type === 'DNI' && '(8 dígitos)'} *
                                </Label>
                                <Input 
                                    className={`h-11 ${errors.document_number ? "border-red-500" : ""}`}
                                    value={profile.document_number} 
                                    onChange={handleDocumentChange} 
                                    placeholder="Ingrese números"
                                />
                                <ErrorMsg msg={errors.document_number} />
                            </div>
                            <div>
                                <Label className={errors.last_name_father ? "text-red-500" : ""}>Ap. Paterno *</Label>
                                <Input className="h-11" value={profile.last_name_father} onChange={(e) => setProfile({ ...profile, last_name_father: e.target.value })} />
                                <ErrorMsg msg={errors.last_name_father} />
                            </div>
                            <div>
                                <Label className={errors.last_name_mother ? "text-red-500" : ""}>Ap. Materno *</Label>
                                <Input className="h-11" value={profile.last_name_mother} onChange={(e) => setProfile({ ...profile, last_name_mother: e.target.value })} />
                                <ErrorMsg msg={errors.last_name_mother} />
                            </div>
                        </div>

                        {/* Fila 3 - Nombres y Etnia */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label className={errors.first_names ? "text-red-500" : ""}>Nombres *</Label>
                                <Input className="h-11" value={profile.first_names} onChange={(e) => setProfile({ ...profile, first_names: e.target.value })} />
                                <ErrorMsg msg={errors.first_names} />
                            </div>
                            <div>
                                <Label className={errors.ethnic_identity ? "text-red-500" : ""}>Identidad étnica *</Label>
                                <Select value={profile.ethnic_identity} onValueChange={(v) => setProfile({ ...profile, ethnic_identity: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {ETHNIC.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.ethnic_identity} />
                            </div>
                        </div>

                        {/* Fila 4 - Nacimiento */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label className={errors.birth_date ? "text-red-500" : ""}>Fecha Nacimiento *</Label>
                                <Input className="h-11" type="date" value={profile.birth_date} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} />
                                <ErrorMsg msg={errors.birth_date} />
                            </div>
                            <div>
                                <Label className={errors.birth_department ? "text-red-500" : ""}>Departamento (nacimiento) *</Label>
                                <Select value={profile.birth_department} onValueChange={(v) => setProfile({ ...profile, birth_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.birth_department} />
                            </div>
                        </div>

                        {/* Fila 5 - Lenguas */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label className={errors.mother_tongue ? "text-red-500" : ""}>Lengua materna *</Label>
                                <Select value={profile.mother_tongue} onValueChange={(v) => setProfile({ ...profile, mother_tongue: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {LANGS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.mother_tongue} />
                            </div>
                            <div>
                                <Label>Lengua secundaria</Label>
                                <Input className="h-11" value={profile.secondary_language} onChange={(e) => setProfile({ ...profile, secondary_language: e.target.value })} placeholder="Opcional" />
                            </div>
                        </div>

                        {/* Fila 6 - Contacto */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label className={errors.mobile ? "text-red-500" : ""}>N° Celular *</Label>
                                <Input 
                                    className={`h-11 ${errors.mobile ? "border-red-500" : ""}`}
                                    value={profile.mobile} 
                                    maxLength={9}
                                    onChange={(e) => setProfile({ ...profile, mobile: onlyDigits(e.target.value) })} 
                                />
                                <ErrorMsg msg={errors.mobile} />
                            </div>
                            <div>
                                <Label className={errors.email ? "text-red-500" : ""}>Correo electrónico *</Label>
                                <Input 
                                    className={`h-11 ${errors.email ? "border-red-500" : ""}`}
                                    type="email" 
                                    value={profile.email} 
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })} 
                                />
                                <ErrorMsg msg={errors.email} />
                            </div>
                        </div>

                        {/* Fila 7 - Dirección */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label className={errors.address ? "text-red-500" : ""}>Dirección actual *</Label>
                                <Input className="h-11" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                                <ErrorMsg msg={errors.address} />
                            </div>
                            <div>
                                <Label className={errors.address_department ? "text-red-500" : ""}>Departamento (domicilio) *</Label>
                                <Select value={profile.address_department} onValueChange={(v) => setProfile({ ...profile, address_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.address_department} />
                            </div>
                        </div>

                        {/* Sección Carrera */}
                        <div className="pt-4 border-t space-y-2">
                            <Label className={`text-base ${errors.career ? "text-red-500 font-bold" : ""}`}>
                                Seleccione la carrera (consume vacante) * {errors.career && "(Requerido)"}
                            </Label>
                            
                            <div className="grid md:grid-cols-2 gap-3">
                                {call.careers.map((c) => (
                                    <button
                                        type="button"
                                        key={c.id}
                                        disabled={Number(c.vacancies) <= 0}
                                        onClick={() => pickPrimaryCareer(c.id)}
                                        className={`text-left border rounded-xl p-4 transition-all relative
                                      ${String(primaryCareerId) === String(c.id) ? "border-blue-600 ring-2 ring-blue-100 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}
                                      ${Number(c.vacancies) <= 0 ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}
                                    `}
                                    >
                                        <div className="font-semibold">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.vacancies} vacantes</div>
                                        {Number(c.vacancies) <= 0 && <div className="text-xs text-red-600 font-semibold mt-1">Sin vacantes</div>}
                                    </button>
                                ))}
                            </div>
                            <ErrorMsg msg={errors.career} />
                        </div>

                        <div className="flex justify-end pt-4">
                            {/* CAMBIO: Botón habilitado pero valida al hacer click */}
                            <Button size="lg" onClick={handleNextToSchool}>
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
                                <Label className={errors.school_department ? "text-red-500" : ""}>Departamento (Colegio) *</Label>
                                <Select value={school.school_department} onValueChange={(v) => setSchool({ ...school, school_department: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.school_department} />
                            </div>

                            <div>
                                <Label className={errors.promotion_year ? "text-red-500" : ""}>Año de promoción *</Label>
                                <Input 
                                    className={`h-11 ${errors.promotion_year ? "border-red-500" : ""}`}
                                    value={school.promotion_year} 
                                    maxLength={4}
                                    onChange={(e) => setSchool({ ...school, promotion_year: onlyDigits(e.target.value) })} 
                                    placeholder="Ej. 2024" 
                                />
                                <ErrorMsg msg={errors.promotion_year} />
                            </div>

                            <div>
                                <Label className={errors.school_type ? "text-red-500" : ""}>Tipo de colegio *</Label>
                                <Select value={school.school_type} onValueChange={(v) => setSchool({ ...school, school_type: v })}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {SCHOOL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <ErrorMsg msg={errors.school_type} />
                            </div>
                        </div>

                        <div>
                            <Label className={errors.school_name ? "text-red-500" : ""}>Nombre del colegio *</Label>
                            <Input 
                                className={`h-11 ${errors.school_name ? "border-red-500" : ""}`}
                                value={school.school_name} 
                                onChange={(e) => setSchool({ ...school, school_name: e.target.value })} 
                                placeholder="Ingrese nombre del colegio"
                            />
                            <ErrorMsg msg={errors.school_name} />
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(STEPS.PERSONAL)}>Atrás</Button>
                            {/* CAMBIO: Valida antes de pasar */}
                            <Button size="lg" onClick={handleNextToPhoto}>Siguiente</Button>
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
                            <p className="text-xs text-gray-500 mt-1">Se recomienda una foto tamaño carnet o pasaporte.</p>
                        </div>

                        {photoPreview && (
                            <div className="border rounded-xl p-3 bg-gray-50 flex flex-col items-center">
                                <Label className="mb-2">Vista previa:</Label>
                                <img src={photoPreview} alt="preview" className="max-h-64 rounded-xl shadow-sm" />
                            </div>
                        )}

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(STEPS.SCHOOL)}>Atrás</Button>
                            <Button disabled={submitting} onClick={submit} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px]">
                                {submitting ? "Registrando..." : "Confirmar Registro"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}