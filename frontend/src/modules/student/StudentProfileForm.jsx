// src/modules/student/StudentProfileForm.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { 
    Upload, 
    Image as ImageIcon, 
    Save, 
    Lock, 
    Crop, 
    X, 
    Check,
    UserCircle,   
    Phone,        
    MapPin,       
    Building2,    
    BookOpen,     
    RefreshCw     // Icono para el botón de cambiar
} from "lucide-react";
import Cropper from "react-easy-crop";

import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

// --- CONSTANTES ---
const empty = {
    // ✅ Excel
    region: "", provincia: "", distrito: "",
    codigoModular: "", nombreInstitucion: "", gestion: "", tipo: "",
    programaCarrera: "", ciclo: "", turno: "", seccion: "",
    apellidoPaterno: "", apellidoMaterno: "", nombres: "",
    fechaNac: "", sexo: "",
    numDocumento: "", lengua: "", periodo: "", discapacidad: "", tipoDiscapacidad: "",
    // ✅ Opcionales
    email: "", celular: "", photoUrl: "",
};

const safeDate = (v) => (v ? String(v).slice(0, 10) : "");

const TURNOS = [
    { value: "Mañana", label: "Mañana" },
    { value: "Tarde", label: "Tarde" },
    { value: "Noche", label: "Noche" },
];

const SEXOS = [
    { value: "M", label: "Masculino (M)" },
    { value: "F", label: "Femenino (F)" },
    { value: "Otro", label: "Otro" },
];

const DISCAPACIDAD_OPTS = [
    { value: "SI", label: "SI" },
    { value: "NO", label: "NO" },
];

// --- COMPONENTE PRINCIPAL ---
export default function StudentProfileForm({ mode, student, loading, onSave, onUploadPhoto }) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    // Estados de foto
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const fileInputRef = useRef(null); // ✅ Referencia segura al input

    // Estados Cropper
    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const isAdmin = mode === "admin";

    const studentEditable = useMemo(
        () => new Set(["email", "celular"]),
        []
    );

    const canEditField = (key) => (isAdmin ? true : studentEditable.has(key));

    // ✅ Función corregida para seleccionar foto
    const pickPhoto = (file) => {
        if (!file) return;
        setPhotoFile(file);
        // Crear URL temporal y forzar apertura del cropper
        setPhotoPreview(URL.createObjectURL(file));
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setIsCropping(true); // ✅ Abre el modal automáticamente
        
        // Resetear input para permitir seleccionar la misma foto si se cancela
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Cargar datos
    useEffect(() => {
        if (!student) {
            setForm(empty);
            setPhotoPreview("");
            return;
        }
        setForm({
            ...empty,
            ...student,
            fechaNac: safeDate(student?.fechaNac),
            ciclo: student?.ciclo ?? "",
            photoUrl: student?.photoUrl || "",
        });
        // Si hay foto en backend, mostrarla. Si no, vacío.
        setPhotoPreview(student?.photoUrl || "");
        setPhotoFile(null);
    }, [student]);

    // Lógica recorte
    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSaveCrop = async () => {
        try {
            const croppedImageBlob = await getCroppedImg(photoPreview, croppedAreaPixels);
            const file = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });
            
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
            setIsCropping(false);
            toast.success("Foto lista para guardar");
        } catch (e) {
            console.error(e);
            toast.error("Error al recortar la imagen");
        }
    };

    // Submit
    const submit = async (e) => {
        e.preventDefault();
        if (!student && mode === "admin") {
            toast.error("Selecciona un estudiante primero.");
            return;
        }

        try {
            setSaving(true);
            const payload = { ...form };
            payload.ciclo = payload.ciclo === "" ? null : Number(payload.ciclo);

            if (!isAdmin) {
                const filtered = {};
                for (const k of Object.keys(payload)) {
                    if (studentEditable.has(k)) filtered[k] = payload[k];
                }
                await onSave(filtered);
            } else {
                await onSave(payload);
            }

            if (photoFile) {
                await onUploadPhoto(photoFile);
                setPhotoFile(null);
            }
        } finally {
            setSaving(false);
        }
    };

    // --- RENDER HELPERS ---
    const SectionTitle = ({ icon: Icon, title }) => (
        <div className="flex items-center gap-2 mb-4 mt-1 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Icon className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                {title}
            </h3>
        </div>
    );

    const field = (key, label, props = {}) => (
        <div className="group">
            <Label className="flex items-center gap-2 mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider group-focus-within:text-indigo-500 transition-colors">
                {label}
                {!canEditField(key) && <Lock className="h-3 w-3 opacity-50" />}
            </Label>
            <Input
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 transition-all"
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                disabled={!canEditField(key) || loading || saving}
                {...props}
            />
        </div>
    );

    const selectField = (key, label, options, props = {}) => (
        <div className="group">
            <Label className="flex items-center gap-2 mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider group-focus-within:text-indigo-500 transition-colors">
                {label}
                {!canEditField(key) && <Lock className="h-3 w-3 opacity-50" />}
            </Label>
            <div className="relative">
                <select
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 px-3 py-2 text-sm shadow-sm transition-all focus:ring-2 focus:ring-ring focus:bg-white dark:focus:bg-black/40 outline-none appearance-none disabled:opacity-50"
                    value={form[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    disabled={!canEditField(key) || loading || saving}
                    {...props}
                >
                    <option value="">— Selecciona —</option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );

    return (
        <>
            <Card className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-neutral-900/40 p-1 shadow-sm">
                <form onSubmit={submit} className="p-4 md:p-6 space-y-8">
                    
                    {/* --- SECCIÓN 1: FOTO HERO --- */}
                    <div className="bg-slate-50/80 dark:bg-slate-900/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6 md:gap-8">
                        {/* Avatar grande */}
                        <div className="relative group shrink-0">
                            <div className="h-28 w-28 rounded-full overflow-hidden bg-white shadow-md border-4 border-white dark:border-slate-800 flex items-center justify-center">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="foto" className="h-full w-full object-cover" />
                                ) : (
                                    <ImageIcon className="h-10 w-10 opacity-30" />
                                )}
                            </div>
                        </div>

                        {/* Controles de Foto */}
                        <div className="flex flex-col items-center sm:items-start gap-3 w-full">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 text-center sm:text-left">
                                    Foto de Perfil
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm text-center sm:text-left">
                                    Esta imagen será visible en tu carnet. Usa una foto formal.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-1">
                                {/* Input oculto y seguro */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={loading || saving}
                                    onChange={(e) => pickPhoto(e.target.files?.[0] || null)}
                                />

                                {/* Botón Subir */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl gap-2 bg-white dark:bg-black border shadow-sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading || saving}
                                >
                                    <Upload className="h-4 w-4" />
                                    {photoPreview ? "Cambiar foto" : "Subir nueva"}
                                </Button>

                                {photoPreview && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl gap-2"
                                        onClick={() => {
                                            setZoom(1);
                                            setCrop({ x: 0, y: 0 });
                                            setIsCropping(true);
                                        }}
                                        disabled={loading || saving}
                                    >
                                        <Crop className="h-4 w-4" />
                                        Recortar
                                    </Button>
                                )}

                                {photoFile && !isCropping && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => {
                                            setPhotoFile(null);
                                            setPhotoPreview(form.photoUrl || "");
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                        disabled={loading || saving}
                                    >
                                        Revertir
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- FORMULARIO GRID --- */}
                    <div className="grid grid-cols-1 gap-10">
                        {/* IDENTIDAD */}
                        <section>
                            <SectionTitle icon={UserCircle} title="Identidad Personal" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {field("numDocumento", "N° Documento (DNI)")}
                                {field("nombres", "Nombres")}
                                {field("apellidoPaterno", "Apellido Paterno")}
                                {field("apellidoMaterno", "Apellido Materno")}
                                {selectField("sexo", "Sexo", SEXOS)}
                                {field("fechaNac", "Fecha de Nacimiento", { type: "date" })}
                            </div>
                        </section>

                        {/* CONTACTO & UBICACIÓN */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <section>
                                <SectionTitle icon={Phone} title="Información de Contacto" />
                                <div className="grid grid-cols-1 gap-5">
                                    {field("email", "Correo Electrónico", { type: "email" })}
                                    {field("celular", "Teléfono / Celular")}
                                </div>
                            </section>

                            <section>
                                <SectionTitle icon={MapPin} title="Ubicación Geográfica" />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    {field("region", "Región")}
                                    {field("provincia", "Provincia")}
                                    {field("distrito", "Distrito")}
                                </div>
                            </section>
                        </div>

                        {/* INSTITUCIÓN */}
                        <section>
                            <SectionTitle icon={Building2} title="Datos Institucionales" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                {field("codigoModular", "Código Modular")}
                                <div className="lg:col-span-2">
                                    {field("nombreInstitucion", "Nombre de la Institución")}
                                </div>
                                {field("gestion", "Tipo de Gestión")}
                                {field("tipo", "Tipo Institución")}
                            </div>
                        </section>

                        {/* ACADÉMICO */}
                        <section>
                            <SectionTitle icon={BookOpen} title="Información Académica" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="lg:col-span-2">
                                    {field("programaCarrera", "Programa de Estudios / Carrera")}
                                </div>
                                {field("ciclo", "Ciclo Actual", { type: "number", min: 0 })}
                                {selectField("turno", "Turno", TURNOS)}
                                {field("seccion", "Sección")}
                                {field("periodo", "Periodo Lectivo")}
                                {field("lengua", "Lengua Materna")}
                                {selectField("discapacidad", "¿Tiene Discapacidad?", DISCAPACIDAD_OPTS)}
                                <div className="lg:col-span-4">
                                    {field("tipoDiscapacidad", "Especifique Tipo de Discapacidad (Si aplica)")}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* --- FOOTER ACTIONS --- */}
                    <div className="flex items-center justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            type="submit"
                            size="lg"
                            className="rounded-xl gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-500/20 px-8 transition-transform active:scale-95"
                            disabled={loading || saving}
                        >
                            <Save className="h-5 w-5" /> 
                            {saving ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* ✅ MODAL DE RECORTE (Z-Index alto) */}
            {isCropping && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header Modal */}
                        <div className="px-6 py-4 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-neutral-900 z-10">
                            <div>
                                <h3 className="font-bold text-lg">Ajustar Foto</h3>
                                <p className="text-xs text-muted-foreground">Arrastra y haz zoom para encuadrar.</p>
                            </div>
                            <Button 
                                size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => setIsCropping(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Area de recorte */}
                        <div className="relative w-full h-80 bg-neutral-950 flex items-center justify-center">
                            <Cropper
                                image={photoPreview}
                                crop={crop}
                                zoom={zoom}
                                aspect={1} 
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                showGrid={true}
                                cropShape="round"
                            />
                        </div>

                        {/* Controles Modal */}
                        <div className="p-6 space-y-6 bg-white dark:bg-neutral-900 z-10">
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                    <span>Alejar</span>
                                    <span>Zoom: {zoom.toFixed(1)}x</span>
                                    <span>Acercar</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" className="rounded-xl border-slate-200 dark:border-slate-700" onClick={() => setIsCropping(false)}>
                                    Cancelar
                                </Button>
                                <Button className="rounded-xl gap-2 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black" onClick={handleSaveCrop}>
                                    <Check className="h-4 w-4" /> 
                                    Confirmar Recorte
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// --- UTILITIES ---
const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous"); 
        image.src = url;
    });

async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0,
        pixelCrop.width, pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Canvas is empty"));
                return;
            }
            resolve(blob);
        }, "image/jpeg", 0.95);
    });
}