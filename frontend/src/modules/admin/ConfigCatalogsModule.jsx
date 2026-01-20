// src/modules/admin/ConfigCatalogsModule.jsx
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "../../utils/safeToast";
import { useAuth } from "../../context/AuthContext";
import { Courses as AcademicCourses } from "../../services/academic.service";

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
    return arr
        .map((x) => {
            if (typeof x === "string") return { code: x, name: x };
            const code = String(x?.code ?? x?.id ?? x?.value ?? x?.name ?? "");
            const name = String(x?.name ?? x?.label ?? x?.value ?? x?.code ?? "");
            return { code, name };
        })
        .filter((x) => x.code);
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

    useEffect(() => {
        load();
    }, [load]);

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
            {/* (tu CampusesSection original sigue igual; no lo recorto para no cambiarte nada) */}
            {/* ... */}
            {/* IMPORTANTE: aquí no te toco nada por brevedad visual, pero en tu archivo real, deja tu código tal cual */}
            <div className="text-sm text-slate-500">
                (Deja tu CampusesSection igual como lo tienes; aquí no se alteró la lógica)
            </div>
        </Section>
    );
};

// ===============================================================
// Docentes (✅ CREATE + ✅ EDIT + ✅ DELETE)
// ===============================================================
const TeachersSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // modal crear
    const [openCreate, setOpenCreate] = useState(false);

    // modal editar
    const [openEdit, setOpenEdit] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);

    // formulario (reusado en crear/editar)
    const [form, setForm] = useState({
        document: "",
        full_name: "",
        email: "",
        phone: "",
        specialization: "",
    });

    // cursos
    const [courses, setCourses] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);

    // credenciales
    const [creds, setCreds] = useState(null);
    const [openCreds, setOpenCreds] = useState(false);

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

    const resetTeacherForm = () => {
        setForm({ document: "", full_name: "", email: "", phone: "", specialization: "" });
        setSelectedCourses([]);
    };

    const fetchAcademicCourses = async () => {
        const res = await AcademicCourses.list();
        setCourses(res?.items ?? []);
    };

    // ----- CREATE -----
    const openCreateTeacher = async () => {
        try {
            await fetchAcademicCourses();
            resetTeacherForm();
            setOpenCreate(true);
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo cargar cursos"));
        }
    };

    const saveCreate = async () => {
        try {
            if (!form.document?.trim()) return toast.error("Documento es requerido");
            if (!form.full_name?.trim()) return toast.error("Nombre completo es requerido");

            const payload = { ...form, courses: selectedCourses.map((x) => Number(x)) };
            const created = await Teachers.create(payload);

            if (created?.username && created?.temporary_password) {
                setCreds({ username: created.username, temporary_password: created.temporary_password });
                setOpenCreds(true);
            }

            toast.success("Docente creado");
            setOpenCreate(false);
            resetTeacherForm();
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    // ----- EDIT -----
    const openEditTeacher = async (t) => {
        try {
            await fetchAcademicCourses();

            setEditingTeacher(t);
            setForm({
                document: t.document || "",
                full_name: t.full_name || "",
                email: t.email || "",
                phone: t.phone || "",
                specialization: t.specialization || "",
            });

            setSelectedCourses((t.courses || []).map(String));
            setOpenEdit(true);
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo abrir edición"));
        }
    };

    const saveEdit = async () => {
        try {
            if (!editingTeacher?.id) return;

            if (!form.document?.trim()) return toast.error("Documento es requerido");
            if (!form.full_name?.trim()) return toast.error("Nombre completo es requerido");

            const payload = { ...form, courses: selectedCourses.map((x) => Number(x)) };
            await Teachers.update(editingTeacher.id, payload);

            toast.success("Docente actualizado");
            setOpenEdit(false);
            setEditingTeacher(null);
            resetTeacherForm();
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    // ----- DELETE -----
    const removeTeacher = async (id) => {
        try {
            await Teachers.remove(id);
            toast.success("Docente eliminado");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const CoursesChecklist = () => (
        <div className="space-y-2">
            <Label>Asignar cursos (opcional)</Label>
            <div className="max-h-52 overflow-y-auto border rounded-xl p-3 bg-slate-50">
                {courses.map((c) => {
                    const checked = selectedCourses.includes(String(c.id));
                    return (
                        <label key={c.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                    const id = String(c.id);
                                    setSelectedCourses((prev) => {
                                        const s = new Set(prev);
                                        if (e.target.checked) s.add(id);
                                        else s.delete(id);
                                        return Array.from(s);
                                    });
                                }}
                            />
                            <span className="font-mono text-xs text-slate-500">{c.code}</span>
                            <span className="text-slate-700">{c.name}</span>
                        </label>
                    );
                })}

                {courses.length === 0 && (
                    <div className="text-xs text-slate-400">No hay cursos disponibles</div>
                )}
            </div>
        </div>
    );

    const TeacherFormFields = () => (
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

            <CoursesChecklist />
        </div>
    );

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

                <Button
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md transition-all gap-2"
                    onClick={openCreateTeacher}
                >
                    <Plus className="h-4 w-4" /> Nuevo docente
                </Button>
            </div>

            {/* LISTA */}
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
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* ✅ EDIT */}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => openEditTeacher(r)}
                                                    title="Editar"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                </Button>

                                                {/* ✅ DELETE */}
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            title="Eliminar"
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
                                                                onClick={() => removeTeacher(r.id)}
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

            {/* MODAL CREATE */}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-slate-800 flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            Registrar Docente
                        </DialogTitle>
                        <DialogDescription>Complete la ficha técnica del profesor.</DialogDescription>
                    </DialogHeader>

                    {TeacherFormFields()}

                    <div className="flex justify-end pt-4 border-t border-slate-100 gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setOpenCreate(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={saveCreate} className="rounded-xl bg-blue-600 hover:bg-blue-700 px-8 shadow-md">
                            Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL EDIT */}
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-slate-800 flex items-center gap-2">
                            <Settings className="h-5 w-5 text-blue-600" />
                            Editar Docente
                        </DialogTitle>
                        <DialogDescription>Actualiza datos y cursos asignados.</DialogDescription>
                    </DialogHeader>

                    {TeacherFormFields()}

                    <div className="flex justify-end pt-4 border-t border-slate-100 gap-2">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                                setOpenEdit(false);
                                setEditingTeacher(null);
                                resetTeacherForm();
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={saveEdit} className="rounded-xl bg-blue-600 hover:bg-blue-700 px-8 shadow-md">
                            Guardar cambios
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL CREDENCIALES */}
            <Dialog open={openCreds} onOpenChange={setOpenCreds}>
                <DialogContent className="rounded-2xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Credenciales del docente</DialogTitle>
                        <DialogDescription>
                            Copia esto ahora. Si se pierde, se puede resetear desde Usuarios (ya tienes endpoint).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 text-sm">
                        <div className="p-3 rounded-xl bg-slate-50 border">
                            <div><b>Usuario:</b> <span className="font-mono">{creds?.username}</span></div>
                            <div><b>Contraseña temporal:</b> <span className="font-mono">{creds?.temporary_password}</span></div>
                        </div>

                        <Button
                            className="rounded-xl w-full"
                            onClick={() => {
                                navigator.clipboard.writeText(
                                    `Usuario: ${creds?.username}\nPassword: ${creds?.temporary_password}`
                                );
                                toast.success("Copiado");
                            }}
                        >
                            Copiar credenciales
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Section>
    );
};

// ===============================================================
// Ubigeo + Parámetros de institución (logo/firma)
// (Deja tu implementación tal cual la tienes; no la toqué.)
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
                        accept="image/png,image/jpeg"
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
    // deja tu sección igual
    return (
        <Section title="Institución" desc="(Deja tu código tal cual; no se alteró para este cambio)">
            <div className="text-sm text-slate-500">
                Pega aquí tu InstitutionSection original sin cambios.
            </div>
        </Section>
    );
};

// ===============================================================
// ImportersTab y BackupTab (Deja tal cual)
// ===============================================================
const ImportersTab = () => {
    return (
        <div className="text-sm text-slate-500">
            (Deja tu ImportersTab original tal cual)
        </div>
    );
};

const BackupTab = () => {
    return (
        <div className="text-sm text-slate-500">
            (Deja tu BackupTab original tal cual)
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
