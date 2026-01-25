// src/modules/admin/ConfigCatalogsModule.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../../utils/safeToast";
import { useAuth } from "../../context/AuthContext";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "../../components/ui/dialog";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../../components/ui/select";

import {
    Settings,
    Building2,
    CalendarDays,
    Landmark,
    Users,
    HardDriveDownload,
    UploadCloud,
    Download,
    RefreshCw,
    CheckCircle,
    XCircle,
    Image as ImageIcon,
    FileSpreadsheet,
    DatabaseZap,
    Plus,
    ChevronRight,
    AlertCircle,
    MapPin,
    Image,
    Save,
    Trash2,
    CreditCard,
    UserPlus,
    Mail,
    Phone,
} from "lucide-react";

import {
    Periods,
    Campuses,
    Classrooms,
    Teachers,
    Ubigeo,
    Institution,
    Imports,
    Backup,
} from "../../services/catalogs.service";

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

// ===============================================================
// Helpers
// ===============================================================
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;

    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);

    if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
            const val = data[firstKey];
            if (Array.isArray(val)) return `${firstKey}: ${val.join(", ")}`;
            if (typeof val === "string") return `${firstKey}: ${val}`;
        }
    }

    if (typeof data?.message === "string") return data.message;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}

function saveBlobAsFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(cd, fallback) {
    if (!cd) return fallback;
    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    if (!m?.[1]) return fallback;
    return m[1].replace(/['"]/g, "").trim() || fallback;
}

// Normaliza lista de ubigeo (backend puede mandar strings o {code,name})
function normalizeUbigeoList(list) {
    const arr = list?.items ?? list ?? [];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => {
        if (typeof x === "string") return { code: x, name: x };
        const code = String(x?.code ?? x?.id ?? x?.value ?? x?.name ?? "");
        const name = String(x?.name ?? x?.label ?? x?.value ?? x?.code ?? "");
        return { code, name };
    }).filter((x) => x.code);
}

const Field = ({ label, children }) => (
    <div>
        <Label className="mb-1 block">{label}</Label>
        {children}
    </div>
);

const Section = ({ title, desc, children }) => (
    <Card className="rounded-2xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">{title}</CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

// ===============================================================
// Periodos Académicos
// ===============================================================
const PeriodsSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        code: "",
        year: new Date().getFullYear(),
        term: "I",
        start_date: "",
        end_date: "",
        is_active: false,
    });

    const resetForm = () => {
        setForm({
            code: "",
            year: new Date().getFullYear(),
            term: "I",
            start_date: "",
            end_date: "",
            is_active: false,
        });
        setEditing(null);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Periods.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            if (!form.code?.trim()) return toast.error("Código es requerido");
            if (!form.year) return toast.error("Año es requerido");

            const payload = { ...form, year: parseInt(form.year || "0", 10) };
            if (editing) await Periods.update(editing.id, payload);
            else await Periods.create(payload);

            toast.success(editing ? "Periodo actualizado" : "Periodo creado");
            setOpen(false);
            resetForm();
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const remove = async (id) => {
        try {
            await Periods.remove(id);
            toast.success("Periodo eliminado");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const toggleActive = async (r) => {
        try {
            await Periods.setActive(r.id, !r.is_active);
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    return (
        <Section
            title={
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-bold text-gray-800">Periodos académicos</span>
                </div>
            }
            desc="Defina los ciclos académicos (año, término y fechas) y establezca el vigente."
        >
            <div className="flex justify-end mb-6">
                <Dialog
                    open={open}
                    onOpenChange={(v) => {
                        setOpen(v);
                        if (!v) resetForm();
                    }}
                >
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Nuevo periodo
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-lg rounded-2xl p-6">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl font-bold text-slate-800">
                                {editing ? "Editar periodo" : "Crear nuevo periodo"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500">
                                Ingrese los detalles del ciclo. El código se genera usualmente como Año-Término (ej. 2024-I).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <Field label="Código del Periodo *">
                                    <Input
                                        className="bg-white border-slate-200 focus:border-blue-500 transition-colors font-medium"
                                        placeholder="Ej: 2024-I"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Año *">
                                    <Input
                                        type="number"
                                        className="rounded-xl border-slate-200"
                                        value={form.year}
                                        onChange={(e) => setForm({ ...form, year: e.target.value })}
                                    />
                                </Field>

                                <Field label="Término *">
                                    <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                                        <SelectTrigger className="rounded-xl border-slate-200">
                                            <SelectValue placeholder="Semestre" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">Semestre I</SelectItem>
                                            <SelectItem value="II">Semestre II</SelectItem>
                                            <SelectItem value="III">Verano / III</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Fecha Inicio">
                                    <Input
                                        type="date"
                                        className="rounded-xl border-slate-200"
                                        value={form.start_date}
                                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                    />
                                </Field>
                                <Field label="Fecha Fin">
                                    <Input
                                        type="date"
                                        className="rounded-xl border-slate-200"
                                        value={form.end_date}
                                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                    />
                                </Field>
                            </div>

                            <div
                                className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                            >
                                <input
                                    id="p-active"
                                    type="checkbox"
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                    checked={!!form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Label htmlFor="p-active" className="cursor-pointer font-medium text-slate-700">
                                    Establecer como periodo vigente
                                </Label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    className="rounded-xl px-4 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    Cancelar
                                </Button>
                                <Button onClick={save} className="rounded-xl px-6 bg-blue-600 hover:bg-blue-700 shadow-md">
                                    Guardar cambios
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-blue-600" />
                            <p className="text-sm text-slate-400 font-medium">Cargando periodos...</p>
                        </div>
                    ) : (
                        <div className="w-full relative" style={{ display: "block", maxHeight: "350px", overflowY: "auto", scrollbarWidth: "thin" }}>
                            <table className="w-full text-sm text-left border-collapse">
                                <thead
                                    className="bg-slate-50/90 backdrop-blur-sm text-xs font-semibold text-slate-500 uppercase tracking-wider"
                                    style={{ position: "sticky", top: 0, zIndex: 10 }}
                                >
                                    <tr>
                                        <th className="px-6 py-4 border-b border-slate-100">Código</th>
                                        <th className="px-6 py-4 border-b border-slate-100">Año / Término</th>
                                        <th className="px-6 py-4 border-b border-slate-100">Duración</th>
                                        <th className="px-6 py-4 border-b border-slate-100 text-center">Estado</th>
                                        <th className="px-6 py-4 border-b border-slate-100 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((r) => (
                                        <tr key={r.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-base">{r.code}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {r.year} <span className="text-slate-300 mx-1">|</span> {r.term}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col text-xs text-slate-500">
                                                    <span className="font-medium text-slate-700 mb-0.5">Inicio: {r.start_date || "--"}</span>
                                                    <span>Fin: {r.end_date || "--"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {r.is_active ? (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0 px-3 py-1 rounded-full shadow-sm">
                                                        Vigente
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-0 px-3 py-1 rounded-full">
                                                        Histórico
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`h-8 px-3 text-xs font-medium rounded-lg mr-2 ${r.is_active
                                                            ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            }`}
                                                        onClick={() => toggleActive(r)}
                                                    >
                                                        {r.is_active ? "Cerrar" : "Activar"}
                                                    </Button>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                        onClick={() => {
                                                            setEditing(r);
                                                            setForm({ ...r });
                                                            setOpen(true);
                                                        }}
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                        <span className="sr-only">Editar</span>
                                                    </Button>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => remove(r.id)}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        <span className="sr-only">Eliminar</span>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <CalendarDays className="h-12 w-12 mb-3 opacity-20" />
                                                    <p className="text-lg font-medium text-slate-500">No hay periodos registrados</p>
                                                    <p className="text-sm">Comience creando uno nuevo con el botón superior.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Section>
    );
};

// ===============================================================
// Sedes & Aulas
// ===============================================================
const CampusesSection = () => {
    const [campuses, setCampuses] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [selCampus, setSelCampus] = useState("");
    const [loading, setLoading] = useState(true);

    const [openCampus, setOpenCampus] = useState(false);
    const [openClass, setOpenClass] = useState(false);

    const [editingCampus, setEditingCampus] = useState(null);
    const [editingClass, setEditingClass] = useState(null);

    const [campusForm, setCampusForm] = useState({ code: "", name: "", address: "" });
    const [classForm, setClassForm] = useState({ code: "", name: "", capacity: 30, campus_id: "" });

    const resetCampusForm = () => {
        setEditingCampus(null);
        setCampusForm({ code: "", name: "", address: "" });
    };

    const resetClassForm = () => {
        setEditingClass(null);
        setClassForm({ code: "", name: "", capacity: 30, campus_id: "" });
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const cs = await Campuses.list();
            const arr = cs?.items ?? cs ?? [];
            setCampuses(arr);

            if (!selCampus && arr[0]) setSelCampus(String(arr[0].id));
            if (selCampus && !arr.some((x) => String(x.id) === String(selCampus))) {
                setSelCampus(arr[0] ? String(arr[0].id) : "");
            }
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [selCampus]);

    const loadClassrooms = useCallback(async () => {
        try {
            const res = await Classrooms.list(selCampus ? { campus_id: selCampus } : undefined);
            setClassrooms(res?.items ?? res ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo cargar aulas"));
        }
    }, [selCampus]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (selCampus) loadClassrooms(); }, [loadClassrooms, selCampus]);

    // ----- SEDES -----
    const onEditCampus = (c) => {
        setEditingCampus(c);
        setCampusForm({ code: c.code || "", name: c.name || "", address: c.address || "" });
        setOpenCampus(true);
    };

    const saveCampus = async () => {
        try {
            if (!campusForm.code?.trim()) return toast.error("Código de sede es requerido");
            if (!campusForm.name?.trim()) return toast.error("Nombre de sede es requerido");

            if (editingCampus?.id) {
                await Campuses.update(editingCampus.id, campusForm);
                toast.success("Sede actualizada");
            } else {
                await Campuses.create(campusForm);
                toast.success("Sede creada");
            }

            setOpenCampus(false);
            resetCampusForm();
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const removeCampus = async (c) => {
        try {
            await Campuses.remove(c.id);
            toast.success("Sede eliminada");
            await load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    // ----- AULAS -----
    const onEditClassroom = (a) => {
        setEditingClass(a);
        setClassForm({
            code: a.code || "",
            name: a.name || "",
            capacity: a.capacity ?? 30,
            campus_id: String(a.campus_id || selCampus || ""),
        });
        setOpenClass(true);
    };

    const saveClass = async () => {
        try {
            if (!classForm.code?.trim()) return toast.error("Código de aula es requerido");
            if (!classForm.name?.trim()) return toast.error("Nombre de aula es requerido");

            const campusPk = Number(classForm.campus_id || selCampus);
            if (!campusPk) return toast.error("Selecciona una sede");

            const payload = {
                code: classForm.code,
                name: classForm.name,
                capacity: Number(classForm.capacity || 0),
                campus_id: campusPk,
            };

            if (editingClass?.id) {
                await Classrooms.update(editingClass.id, payload);
                toast.success("Aula actualizada");
            } else {
                await Classrooms.create(payload);
                toast.success("Aula creada");
            }

            setOpenClass(false);
            resetClassForm();
            loadClassrooms();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const removeClassroom = async (a) => {
        try {
            await Classrooms.remove(a.id);
            toast.success("Aula eliminada");
            loadClassrooms();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    return (
        <Section
            title={
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-bold text-gray-800">Sedes & Aulas</span>
                </div>
            }
            desc="Administre las sedes (campus) y sus respectivas aulas físicas."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* SEDES */}
                <Card className="lg:col-span-1 rounded-2xl border-slate-200 shadow-sm flex flex-col h-full bg-white">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                        <div className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg text-slate-800">Sedes</CardTitle>
                                <CardDescription className="text-xs">Campus disponibles</CardDescription>
                            </div>

                            <Dialog
                                open={openCampus}
                                onOpenChange={(v) => {
                                    setOpenCampus(v);
                                    if (!v) resetCampusForm();
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
                                        onClick={() => setEditingCampus(null)}
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="rounded-2xl sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{editingCampus ? "Editar sede" : "Registrar nueva sede"}</DialogTitle>
                                        <DialogDescription>Ingrese los datos de la ubicación.</DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-2">
                                        <Field label="Código *">
                                            <Input
                                                className="rounded-xl bg-slate-50 focus:bg-white transition-colors"
                                                placeholder="Ej. LIM-01"
                                                value={campusForm.code}
                                                onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })}
                                            />
                                        </Field>

                                        <Field label="Nombre *">
                                            <Input
                                                className="rounded-xl bg-slate-50 focus:bg-white transition-colors"
                                                placeholder="Ej. Campus Central"
                                                value={campusForm.name}
                                                onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })}
                                            />
                                        </Field>

                                        <Field label="Dirección">
                                            <Input
                                                className="rounded-xl bg-slate-50 focus:bg-white transition-colors"
                                                placeholder="Av. Principal 123..."
                                                value={campusForm.address}
                                                onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })}
                                            />
                                        </Field>

                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="outline" className="rounded-xl" onClick={() => setOpenCampus(false)}>
                                                Cancelar
                                            </Button>
                                            <Button onClick={saveCampus} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md">
                                                {editingCampus ? "Guardar cambios" : "Guardar Sede"}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 p-3 overflow-y-auto max-h-[500px] space-y-2 bg-slate-50/30">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-blue-500 mb-2" />
                                <span className="text-xs">Cargando sedes...</span>
                            </div>
                        ) : (
                            campuses.map((c) => {
                                const isSelected = String(c.id) === String(selCampus);

                                // ✅ FIX: ya NO usamos <Button> contenedor para evitar <button> dentro de <button>
                                return (
                                    <div
                                        key={c.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelCampus(String(c.id))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") setSelCampus(String(c.id));
                                        }}
                                        className={`group w-full rounded-xl px-4 py-4 text-left transition-all border cursor-pointer select-none flex items-center gap-3 ${isSelected
                                            ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                                            : "bg-white border-transparent hover:bg-slate-100 text-slate-600 hover:border-slate-200"
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                                            <Landmark className="h-5 w-5" />
                                        </div>

                                        <div className="flex flex-col overflow-hidden flex-1">
                                            <span className="font-semibold truncate">{c.name}</span>
                                            <span className="text-[10px] opacity-70 truncate">{c.address || "Sin dirección"}</span>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditCampus(c);
                                                }}
                                            >
                                                <Settings className="h-4 w-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>

                                                <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                            <AlertCircle className="h-5 w-5" />
                                                            ¿Eliminar sede?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription className="text-slate-600">
                                                            Se eliminará permanentemente la sede{" "}
                                                            <span className="font-bold text-slate-900">{c.name}</span>.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>

                                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                                        <AlertDialogCancel className="w-full sm:w-auto rounded-xl border-slate-200">
                                                            Cancelar
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-xl"
                                                            onClick={() => removeCampus(c)}
                                                        >
                                                            Sí, eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>

                                        {isSelected && <ChevronRight className="ml-1 h-4 w-4 opacity-50" />}
                                    </div>
                                );
                            })
                        )}

                        {campuses.length === 0 && !loading && (
                            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm font-medium">No hay sedes</p>
                                <p className="text-xs">Registre una para comenzar</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* AULAS */}
                <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-full">
                    <CardHeader className="border-b border-slate-100 py-5 bg-white">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
                                    <span className="bg-slate-100 p-1.5 rounded-md">
                                        <Building2 className="h-4 w-4 text-slate-500" />
                                    </span>
                                    Aulas y Espacios
                                </CardTitle>
                                <CardDescription className="flex items-center gap-1 mt-1">
                                    {selCampus ? (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="font-medium text-green-700">
                                                {campuses.find((x) => String(x.id) === String(selCampus))?.name}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-orange-500 font-medium flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Seleccione una sede primero
                                        </span>
                                    )}
                                </CardDescription>
                            </div>

                            <Dialog
                                open={openClass}
                                onOpenChange={(v) => {
                                    setOpenClass(v);
                                    if (!v) resetClassForm();
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button disabled={!selCampus} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md transition-all disabled:opacity-50">
                                        <Plus className="h-4 w-4 mr-2" /> Nueva Aula
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="rounded-2xl sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{editingClass ? "Editar Aula" : "Nueva Aula"}</DialogTitle>
                                        <DialogDescription>
                                            {editingClass ? "Actualice los datos del aula." : "Registre un nuevo espacio físico."}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-2">
                                        <Field label="Código Interno *">
                                            <Input
                                                className="rounded-xl"
                                                placeholder="Ej. A-101"
                                                value={classForm.code}
                                                onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                                            />
                                        </Field>

                                        <Field label="Nombre Visible *">
                                            <Input
                                                className="rounded-xl"
                                                placeholder="Ej. Laboratorio de Cómputo 1"
                                                value={classForm.name}
                                                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                                            />
                                        </Field>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Capacidad (Estudiantes)">
                                                <Input
                                                    type="number"
                                                    className="rounded-xl"
                                                    value={classForm.capacity}
                                                    onChange={(e) => setClassForm({ ...classForm, capacity: parseInt(e.target.value || "0", 10) })}
                                                />
                                            </Field>

                                            <Field label="Sede Asignada">
                                                <Select
                                                    value={classForm.campus_id || String(selCampus || "")}
                                                    onValueChange={(v) => setClassForm({ ...classForm, campus_id: v })}
                                                >
                                                    <SelectTrigger className="rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {campuses.map((c) => (
                                                            <SelectItem key={c.id} value={String(c.id)}>
                                                                {c.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </Field>
                                        </div>

                                        <div className="flex justify-end pt-2 gap-2">
                                            <Button variant="outline" className="rounded-xl" onClick={() => setOpenClass(false)}>
                                                Cancelar
                                            </Button>
                                            <Button onClick={saveClass} className="rounded-xl bg-blue-600 w-full sm:w-auto">
                                                {editingClass ? "Guardar cambios" : "Guardar Aula"}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 overflow-x-auto min-h-[300px]">
                        <table className="w-full text-sm text-left border-collapse table-fixed">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-b border-slate-100 w-40">Código</th>
                                    <th className="px-6 py-4 border-b border-slate-100">Nombre del Aula</th>
                                    <th className="px-6 py-4 border-b border-slate-100 w-40 text-center">Capacidad</th>
                                    <th className="px-6 py-4 border-b border-slate-100 w-28 text-right">Acciones</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {classrooms.map((a) => (
                                    <tr key={a.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-slate-600 truncate">{a.code}</td>
                                        <td className="px-6 py-4 font-medium text-slate-700 truncate">{a.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                                {a.capacity} pax
                                            </Badge>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => onEditClassroom(a)}
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>

                                                    <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                                <AlertCircle className="h-5 w-5" />
                                                                ¿Eliminar aula?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription className="text-slate-600">
                                                                Esta acción eliminará permanentemente el aula{" "}
                                                                <span className="font-bold text-slate-900">{a.name}</span>.
                                                                <br />
                                                                ¿Deseas continuar?
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>

                                                        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                                            <AlertDialogCancel className="w-full sm:w-auto rounded-xl border-slate-200">
                                                                Cancelar
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-xl"
                                                                onClick={() => removeClassroom(a)}
                                                            >
                                                                Sí, eliminar
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {classrooms.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center text-slate-300">
                                                <div className="bg-slate-50 p-4 rounded-full mb-3">
                                                    <Building2 className="h-8 w-8 text-slate-300" />
                                                </div>
                                                <p className="text-lg font-medium text-slate-400">Sin aulas registradas</p>
                                                <p className="text-xs text-slate-400">Seleccione una sede o cree una nueva aula.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </Section>
    );
};

// ===============================================================
// Docentes
// ===============================================================
const TeachersSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        document: "",
        full_name: "",
        email: "",
        phone: "",
        specialization: "",
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Teachers.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            if (!form.document?.trim()) return toast.error("Documento es requerido");
            if (!form.full_name?.trim()) return toast.error("Nombre completo es requerido");

            await Teachers.create(form);
            setOpen(false);
            setForm({ document: "", full_name: "", email: "", phone: "", specialization: "" });
            load();
            toast.success("Docente creado");
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const remove = async (id) => {
        try {
            await Teachers.remove(id);
            toast.success("Docente eliminado");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    return (
        <Section
            title={
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-bold text-gray-800">Directorio de Docentes</span>
                </div>
            }
            desc="Gestione el registro de profesores y su información de contacto."
        >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="w-full sm:w-72">
                    <Input
                        placeholder="Buscar docente..."
                        className="rounded-xl bg-white border-slate-200 focus:border-blue-500 transition-all shadow-sm"
                    />
                </div>

                <Dialog
                    open={open}
                    onOpenChange={(v) => {
                        setOpen(v);
                        if (!v) setForm({ document: "", full_name: "", email: "", phone: "", specialization: "" });
                    }}
                >
                    <DialogTrigger asChild>
                        <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md transition-all gap-2">
                            <Plus className="h-4 w-4" /> Nuevo docente
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="sm:max-w-lg rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl text-slate-800 flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-blue-600" />
                                Registrar Docente
                            </DialogTitle>
                            <DialogDescription>Complete la ficha técnica del profesor.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Documento de Identidad *">
                                    <Input
                                        className="rounded-xl"
                                        placeholder="DNI / CE"
                                        value={form.document}
                                        onChange={(e) => setForm({ ...form, document: e.target.value })}
                                    />
                                </Field>
                                <Field label="Nombre Completo *">
                                    <Input
                                        className="rounded-xl"
                                        placeholder="Apellidos y Nombres"
                                        value={form.full_name}
                                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Correo Electrónico">
                                    <Input
                                        type="email"
                                        className="rounded-xl"
                                        placeholder="docente@email.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </Field>
                                <Field label="Teléfono / Celular">
                                    <Input
                                        className="rounded-xl"
                                        placeholder="999 999 999"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    />
                                </Field>
                            </div>

                            <Field label="Especialidad / Área">
                                <Input
                                    className="rounded-xl"
                                    placeholder="Ej. Matemáticas, Ciencias, Historia..."
                                    value={form.specialization}
                                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                                />
                            </Field>

                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <Button onClick={save} className="rounded-xl bg-blue-600 hover:bg-blue-700 w-full sm:w-auto px-8 shadow-md">
                                    Guardar Ficha
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs font-semibold tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4">Docente</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4">Especialidad</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {rows.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                                                    {r.full_name?.charAt(0) || "D"}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800">{r.full_name}</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <CreditCard className="h-3 w-3" /> {r.document}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {r.email ? (
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                        <span>{r.email}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic opacity-50">Sin email</span>
                                                )}

                                                {r.phone ? (
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                        <span>{r.phone}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic opacity-50">Sin teléfono</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            {r.specialization ? (
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal px-3 py-1">
                                                    {r.specialization}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>

                                                <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                                            <AlertCircle className="h-5 w-5" />
                                                            ¿Eliminar docente?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription className="text-slate-600">
                                                            Esta acción eliminará permanentemente a{" "}
                                                            <span className="font-bold text-slate-900">{r.full_name}</span> del sistema.
                                                            <br />
                                                            ¿Está seguro de continuar?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>

                                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                                        <AlertDialogCancel className="w-full sm:w-auto rounded-xl border-slate-200">
                                                            Cancelar
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-xl"
                                                            onClick={() => remove(r.id)}
                                                        >
                                                            Sí, eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </td>
                                    </tr>
                                ))}

                                {rows.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="4" className="py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <div className="bg-slate-50 p-4 rounded-full mb-3">
                                                    <Users className="h-8 w-8 text-slate-300" />
                                                </div>
                                                <p className="text-lg font-medium text-slate-500">No hay docentes registrados</p>
                                                <p className="text-sm">Agregue uno nuevo para comenzar.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {loading && (
                                    <tr>
                                        <td colSpan="4" className="py-16 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-100 border-t-blue-600" />
                                                <span className="text-slate-400 text-sm font-medium">Cargando directorio...</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </Section>
    );
};

// ===============================================================
// Ubigeo + Parámetros de institución (logo/firma)
// ===============================================================
const MediaUpload = ({ label, url, onChange, loading }) => {
    const [localPreview, setLocalPreview] = React.useState("");
    const [imgError, setImgError] = React.useState(false);

    React.useEffect(() => {
        return () => {
            if (localPreview) URL.revokeObjectURL(localPreview);
        };
    }, [localPreview]);

    const src = !imgError ? (localPreview || url) : "";

    return (
        <div className="space-y-1 w-full">
            <Label>{label}</Label>

            <div className="flex items-center gap-3 w-full">
                {src ? (
                    <img
                        src={src}
                        alt={label}
                        className="w-16 h-16 object-contain border rounded bg-white"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-16 h-16 border rounded flex items-center justify-center text-gray-400 bg-white">
                        <ImageIcon className="h-6 w-6" />
                    </div>
                )}

                <div className="w-full space-y-1">
                    <Input
                        type="file"
                        accept="image/*"
                        className="w-full"
                        disabled={!!loading}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            setImgError(false);
                            const objectUrl = URL.createObjectURL(file);
                            setLocalPreview((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return objectUrl;
                            });

                            onChange(file);
                        }}
                    />

                    {loading && (
                        <div className="text-xs text-blue-600 flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
                            Subiendo...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const InstitutionSection = () => {
    const [settings, setSettings] = useState(null);

    const [uploadingKind, setUploadingKind] = useState(null);

    const [dept, setDept] = useState("");
    const [prov, setProv] = useState("");
    const [dist, setDist] = useState("");

    const [deps, setDeps] = useState([]);
    const [provs, setProvs] = useState([]);
    const [dists, setDists] = useState([]);

    const load = useCallback(async () => {
        try {
            const s = await Institution.getSettings();
            setSettings(s ?? {});

            const d = await Ubigeo.deps();
            setDeps(normalizeUbigeoList(d));

            const sDept = String(s?.department || "");
            const sProv = String(s?.province || "");
            const sDist = String(s?.district || "");

            if (sDept) {
                setDept(sDept);

                const pv = await Ubigeo.provs(sDept);
                setProvs(normalizeUbigeoList(pv));

                if (sProv) {
                    setProv(sProv);

                    const ds = await Ubigeo.dists(sDept, sProv);
                    setDists(normalizeUbigeoList(ds));

                    if (sDist) setDist(sDist);
                }
            }
        } catch (e) {
            toast.error(formatApiError(e));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const update = async () => {
        try {
            await Institution.updateSettings({
                ...settings,
                department: dept,
                province: prov,
                district: dist,
            });
            toast.success("Parámetros guardados");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const onUpload = async (kind, file) => {
        try {
            setUploadingKind(kind);

            const r = await Institution.uploadMedia(kind, file);
            toast.success("Archivo subido");

            let url = r?.url || r?.file || r?.file_url;

            const API_BASE = import.meta?.env?.VITE_API_URL || import.meta?.env?.VITE_API_BASE_URL || "";
            if (url && !/^https?:\/\//i.test(url) && API_BASE) {
                url = `${API_BASE.replace(/\/$/, "")}/${String(url).replace(/^\//, "")}`;
            }

            setSettings((s) => ({
                ...s,
                ...(kind === "LOGO"
                    ? { logo_url: url }
                    : kind === "SIGNATURE"
                        ? { signature_url: url }
                        : {}),
            }));
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setUploadingKind(null);
        }
    };

    return (
        <Section
            title={
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Settings className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-bold text-gray-800">Parámetros de institución</span>
                </div>
            }
            desc="Configure la información general, ubicación y elementos de identidad visual."
        >
            {!settings ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-blue-600 mb-4" />
                    <p className="text-slate-400 font-medium">Cargando configuración...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                            <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-500" />
                                Información General
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="p-6 space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identidad Legal</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    <div className="sm:col-span-2">
                                        <Field label="Nombre o Razón Social *">
                                            <Input
                                                className="rounded-xl bg-slate-50 focus:bg-white transition-colors"
                                                value={settings.name || ""}
                                                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                                                placeholder="Ej. Institución Educativa..."
                                            />
                                        </Field>
                                    </div>
                                    <div>
                                        <Field label="RUC / Identificador">
                                            <Input
                                                className="rounded-xl bg-slate-50 focus:bg-white transition-colors font-mono text-sm"
                                                value={settings.ruc || ""}
                                                onChange={(e) => setSettings({ ...settings, ruc: e.target.value })}
                                                placeholder="20123456789"
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ubicación Geográfica</h3>

                                <Field label="Dirección Fiscal">
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="rounded-xl pl-10 bg-slate-50 focus:bg-white transition-colors"
                                            value={settings.address || ""}
                                            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                            placeholder="Av. Principal #123..."
                                        />
                                    </div>
                                </Field>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <Field label="Departamento">
                                        <Select
                                            value={dept}
                                            onValueChange={async (v) => {
                                                setDept(v);
                                                setProv("");
                                                setDist("");
                                                setDists([]);

                                                const pv = await Ubigeo.provs(v);
                                                setProvs(normalizeUbigeoList(pv));
                                            }}
                                        >
                                            <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Seleccionar" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                {deps.map((d) => (
                                                    <SelectItem key={d.code} value={d.code}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field label="Provincia">
                                        <Select
                                            value={prov}
                                            disabled={!dept}
                                            onValueChange={async (v) => {
                                                setProv(v);
                                                setDist("");

                                                const ds = await Ubigeo.dists(dept, v);
                                                setDists(normalizeUbigeoList(ds));
                                            }}
                                        >
                                            <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Seleccionar" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                {provs.map((p) => (
                                                    <SelectItem key={p.code} value={p.code}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field label="Distrito">
                                        <Select value={dist} onValueChange={setDist} disabled={!dept || !prov}>
                                            <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Seleccionar" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                {dists.map((d) => (
                                                    <SelectItem key={d.code} value={d.code}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Canales de Contacto</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    <Field label="Sitio Web">
                                        <Input
                                            className="rounded-xl bg-slate-50 focus:bg-white transition-colors text-sm"
                                            value={settings.website || ""}
                                            onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                                            placeholder="www.ejemplo.edu.pe"
                                        />
                                    </Field>

                                    <Field label="Correo Electrónico">
                                        <Input
                                            className="rounded-xl bg-slate-50 focus:bg-white transition-colors text-sm"
                                            value={settings.email || ""}
                                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                            placeholder="contacto@institucion.com"
                                        />
                                    </Field>

                                    <Field label="Teléfono / Celular">
                                        <Input
                                            className="rounded-xl bg-slate-50 focus:bg-white transition-colors text-sm"
                                            value={settings.phone || ""}
                                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                            placeholder="(01) 123-4567"
                                        />
                                    </Field>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={update} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md w-full sm:w-auto px-8 gap-2">
                                    <Save className="h-4 w-4" />
                                    Guardar Cambios
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                                <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                                    <Image className="h-4 w-4 text-slate-500" />
                                    Activos Digitales
                                </CardTitle>
                                <CardDescription>Logo principal y firma del director.</CardDescription>
                            </CardHeader>

                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase">Logo Principal</Label>
                                    <div className="p-1 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <MediaUpload
                                            label="Subir logo"
                                            url={settings.logo_url}
                                            loading={uploadingKind === "LOGO"}
                                            onChange={(f) => onUpload("LOGO", f)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase">Firma del Director</Label>
                                    <div className="p-1 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <MediaUpload
                                            label="Subir firma"
                                            url={settings.signature_url}
                                            loading={uploadingKind === "SIGNATURE"}
                                            onChange={(f) => onUpload("SIGNATURE", f)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Recomendado: Imagen PNG sin fondo.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </Section>
    );
};

// ===============================================================
// Importadores Excel/CSV (con barra de progreso y advertencia)
// ===============================================================

const ImportersTab = () => {
    const [type, setType] = useState("students");
    const [file, setFile] = useState(null);
    const [job, setJob] = useState(null);
    const [status, setStatus] = useState(null);
    const [poll, setPoll] = useState(null);
    const [isImporting, setIsImporting] = useState(false);

    // Limpieza automática del polling al desmontar
    useEffect(() => {
        return () => {
            if (poll) {
                clearInterval(poll);
            }
        };
    }, [poll]);

    const start = async () => {
        if (!file) {
            toast.error("Debes seleccionar un archivo primero");
            return;
        }

        if (isImporting) {
            toast.info("Ya hay una importación en curso");
            return;
        }

        setIsImporting(true);
        setStatus(null);
        setJob(null);

        try {
            const res = await Imports.start(type, file);
            const jobId = res?.job_id || res?.id || res?.task_id;

            if (!jobId) {
                throw new Error("No se recibió identificador de tarea");
            }

            setJob(jobId);
            toast.success("Importación iniciada");

            // Polling cada ~1.8 segundos
            const timer = setInterval(async () => {
                try {
                    const st = await Imports.status(jobId);
                    setStatus(st);

                    if (st?.state === "COMPLETED" || st?.state === "FAILED" || st?.state === "ERROR") {
                        clearInterval(timer);
                        setPoll(null);
                        setIsImporting(false);

                        if (st.state === "COMPLETED") {
                            toast.success("¡Importación completada con éxito!");
                        } else {
                            toast.error("La importación terminó con error");
                        }
                    }
                } catch (err) {
                    console.error("Error al consultar estado:", err);
                    // No detenemos el polling por errores de consulta
                }
            }, 1800);

            setPoll(timer);
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo iniciar la importación"));
            setIsImporting(false);
        }
    };

    const cancelPolling = () => {
        if (poll) {
            clearInterval(poll);
            setPoll(null);
        }
        setIsImporting(false);
        setStatus(null);
        setJob(null);
        toast.info("Seguimiento de progreso detenido");
    };

    const downloadTemplate = async () => {
        try {
            const res = await Imports.downloadTemplate(type);
            const cd = res.headers?.["content-disposition"];
            const fallback = `${type}_template.xlsx`;
            const filename = filenameFromContentDisposition(cd, fallback);
            const blob = new Blob([res.data], {
                type: res.headers?.["content-type"] || "application/octet-stream",
            });
            saveBlobAsFile(blob, filename);
            toast.success("Plantilla descargada");
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo descargar la plantilla"));
        }
    };

    const progress = status?.progress ?? 0;
    const isProcessing = isImporting || !!job;

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <Section
                title={
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        <span>Importadores Excel/CSV</span>
                    </div>
                }
                desc="Carga masiva de planes de estudios, alumnos, notas históricas y otros catálogos."
            >
                {/* Advertencia visible durante la importación */}
                {isProcessing && (
                    <div className="mb-6 p-5 bg-amber-50 border border-amber-300 rounded-2xl shadow-sm">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="h-6 w-6 text-amber-600 mt-1 shrink-0" />
                            <div>
                                <h3 className="font-semibold text-amber-800 text-base mb-1">
                                    No cambie de pestaña ni cierre esta ventana
                                </h3>
                                <p className="text-sm text-amber-700">
                                    La importación está en proceso. Cambiar de sección o cerrar la página
                                    impedirá que vea el progreso y el resultado final en tiempo real.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Field label="Tipo de importación">
                        <Select
                            value={type}
                            onValueChange={setType}
                            disabled={isProcessing}
                        >
                            <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Seleccione tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="plans">Plan de estudios</SelectItem>
                                <SelectItem value="students">Alumnos</SelectItem>
                                <SelectItem value="grades">Notas históricas</SelectItem>
                                {/* Puedes agregar más tipos si tu backend los soporta */}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field label="Descargar plantilla">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto rounded-xl border-slate-300 hover:bg-slate-50"
                            onClick={downloadTemplate}
                            disabled={isProcessing}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Descargar plantilla
                        </Button>
                    </Field>

                    <Field label="Archivo a importar">
                        <div className="space-y-2">
                            <Input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                disabled={isProcessing}
                                className="rounded-xl"
                            />
                            {file && !isProcessing && (
                                <p className="text-xs text-slate-500">
                                    {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            )}
                        </div>
                    </Field>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                    {isProcessing && (
                        <Button
                            variant="outline"
                            className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={cancelPolling}
                        >
                            Detener seguimiento
                        </Button>
                    )}

                    <Button
                        onClick={start}
                        disabled={isProcessing || !file}
                        className="min-w-[200px] rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="h-4 w-4 mr-2" />
                                Iniciar importación
                            </>
                        )}
                    </Button>
                </div>

                {/* Barra de progreso y estado detallado */}
                {isProcessing && (
                    <Card className="mt-8 rounded-2xl border-blue-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-blue-50/50 pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Progreso de la importación</span>
                                <Badge
                                    variant="outline"
                                    className={
                                        status?.state === "COMPLETED" ? "bg-green-100 text-green-700" :
                                            status?.state === "FAILED" || status?.state === "ERROR" ? "bg-red-100 text-red-700" :
                                                "bg-blue-100 text-blue-700"
                                    }
                                >
                                    {status?.state || "EN PROCESO"}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 space-y-5">
                            <div>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="font-medium">Progreso</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                                    <span>Job ID: {job || "—"}</span>
                                    <span>{status?.processed || 0} / {status?.total || "?"} registros</span>
                                </div>
                            </div>

                            {status?.message && (
                                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    {status.message}
                                </p>
                            )}

                            {Array.isArray(status?.errors) && status.errors.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
                                    <p className="font-medium mb-2 flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        Errores encontrados:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 max-h-48 overflow-y-auto">
                                        {status.errors.map((err, index) => (
                                            <li key={index}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </Section>
        </div>
    );
};

// ===============================================================
// Respaldo / Exportación
// ===============================================================
const BackupTab = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState("FULL");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Backup.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const create = async () => {
        try {
            await Backup.create(scope);
            toast.success("Respaldo programado");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const exportDataset = async (ds) => {
        try {
            const res = await Backup.exportDataset(ds);
            toast.success("Exportación generada");

            await load();

            const id = res?.backup_id;
            if (id) {
                const downloadRes = await Backup.download(id);

                const cd = downloadRes.headers?.["content-disposition"];
                const fallback = `export_${ds.toLowerCase()}_${id}.zip`;
                const filename = filenameFromContentDisposition(cd, fallback);

                const blob = new Blob([downloadRes.data], {
                    type: downloadRes.headers?.["content-type"] || "application/octet-stream",
                });

                saveBlobAsFile(blob, filename);
            }
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const downloadBackup = async (b) => {
        try {
            const res = await Backup.download(b.id);

            const cd = res.headers?.["content-disposition"];
            const fallback = `backup_${b.id}.zip`;
            const filename = filenameFromContentDisposition(cd, fallback);

            const blob = new Blob([res.data], {
                type: res.headers?.["content-type"] || "application/octet-stream",
            });

            saveBlobAsFile(blob, filename);
            toast.success("Backup descargado");
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo descargar el backup"));
        }
    };

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <Section
                title={
                    <>
                        <HardDriveDownload className="h-5 w-5 text-blue-600" />
                        Respaldo & Exportación
                    </>
                }
                desc="Genere respaldos completos o exporte datasets específicos."
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base">Nuevo respaldo</CardTitle>
                            <CardDescription>Archivo comprimido con base de datos y adjuntos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Field label="Ámbito">
                                <Select value={scope} onValueChange={setScope}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FULL">Completo</SelectItem>
                                        <SelectItem value="DATA_ONLY">Solo datos</SelectItem>
                                        <SelectItem value="FILES_ONLY">Solo archivos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Button onClick={create} className="rounded-xl">
                                <DatabaseZap className="h-4 w-4 mr-2" />
                                Crear respaldo
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-base">Historial de respaldos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ámbito</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamaño</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {rows.map((b) => (
                                                <tr key={b.id}>
                                                    <td className="px-6 py-3">{b.created_at ? new Date(b.created_at).toLocaleString() : "-"}</td>
                                                    <td className="px-6 py-3">{b.scope || "-"}</td>
                                                    <td className="px-6 py-3">{b.size ? `${(b.size / (1024 * 1024)).toFixed(2)} MB` : "-"}</td>
                                                    <td className="px-6 py-3">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-xl inline-flex items-center gap-1"
                                                            onClick={() => downloadBackup(b)}
                                                        >
                                                            <Download className="h-4 w-4" /> Descargar
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {rows.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-10 text-gray-500">
                                                        Sin respaldos
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-6 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-base">Exportar datasets</CardTitle>
                        <CardDescription>Archivos CSV/ZIP de conjuntos puntuales.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => exportDataset("STUDENTS")}>
                            <Download className="h-4 w-4 mr-2" /> Alumnos
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => exportDataset("COURSES")}>
                            <Download className="h-4 w-4 mr-2" /> Cursos
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => exportDataset("GRADES")}>
                            <Download className="h-4 w-4 mr-2" /> Notas
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => exportDataset("CATALOGS")}>
                            <Download className="h-4 w-4 mr-2" /> Catálogos
                        </Button>
                    </CardContent>
                </Card>
            </Section>
        </div>
    );
};

// ===============================================================
// MAIN
// ===============================================================
const ConfigCatalogsModule = () => {
    const { user, loading, hasAny } = useAuth();

    const canAccessCatalogs = hasAny(["admin.catalogs.view", "admin.catalogs.manage"]);

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
            </div>
        );
    }

    if (!user || !canAccessCatalogs) {
        return (
            <div className="p-6 text-center">
                <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso restringido</h2>
                <p className="text-gray-600">No tienes permisos para Catálogos.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Tabs defaultValue="catalogs" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
                    <TabsTrigger value="importers">Importadores</TabsTrigger>
                    <TabsTrigger value="backup">Respaldo</TabsTrigger>
                </TabsList>

                <TabsContent value="catalogs">
                    <div className="space-y-6 pb-24 sm:pb-6">
                        <PeriodsSection />
                        <CampusesSection />
                        <TeachersSection />
                        <InstitutionSection />
                    </div>
                </TabsContent>

                <TabsContent value="importers">
                    <ImportersTab />
                </TabsContent>

                <TabsContent value="backup">
                    <BackupTab />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ConfigCatalogsModule;
