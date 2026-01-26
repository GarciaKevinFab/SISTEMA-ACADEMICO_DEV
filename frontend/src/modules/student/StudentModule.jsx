// src/modules/student/StudentModule.jsx
import "../academic/styles.css";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    Search,
    RefreshCw,
    GraduationCap,
    ShieldAlert,
    FileText,
    User,
    Users,
    Info,
    ChevronRight,
} from "lucide-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

// ✅ Tabs (shadcn)
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

import { StudentsService } from "../../services/students.service";
import { UsersService } from "../../services/users.service";
import StudentProfileForm from "./StudentProfileForm";
import StudentKardexCard from "./StudentKardexCard";

import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

/* ---------- Anim ---------- */
const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
};

/* ---------- Debounce ---------- */
const useDebounce = (value, delay = 400) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};

const normalizeStudentsPayload = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.students)) return data.students;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const getStudentLabel = (s) => {
    if (!s) return "";
    const ap = `${s.apellidoPaterno || ""} ${s.apellidoMaterno || ""}`.trim();
    const nm = `${s.nombres || ""}`.trim();
    const full = `${ap} ${nm}`.trim();
    return full || s.full_name || s.display_name || "Estudiante";
};

export default function StudentModule() {
    // ✅ ahora sí traemos refreshMe para evitar reload
    const { hasPerm, roles = [], user, refreshMe } = useAuth();

    const isAdminSystem = roles.some((r) =>
        String(r).toUpperCase().includes("ADMIN_SYSTEM")
    );

    const isStudentRole = roles.some((r) =>
        String(r).toUpperCase().includes("STUDENT")
    );

    const canManageStudents =
        isAdminSystem ||
        hasPerm(PERMS["student.manage.list"]) ||
        hasPerm(PERMS["student.manage.view"]) ||
        hasPerm(PERMS["student.manage.edit"]);

    const canSelf =
        isStudentRole ||
        hasPerm(PERMS["student.self.dashboard.view"]) ||
        hasPerm(PERMS["student.self.profile.view"]) ||
        hasPerm(PERMS["student.self.profile.edit"]) ||
        hasPerm(PERMS["student.self.kardex.view"]) ||
        hasPerm(PERMS["student.self.enrollment.view"]);

    const mode = canManageStudents ? "admin" : "student";

    const canViewKardex =
        canManageStudents ||
        hasPerm(PERMS["student.self.kardex.view"]) ||
        isStudentRole;

    // ✅ GATE: obliga cambio solo si es student role y flag true
    const mustChangePassword = isStudentRole && !!user?.must_change_password;

    /* ===================== STATE ===================== */
    const [loading, setLoading] = useState(true);

    // admin picker
    const [q, setQ] = useState("");
    const dq = useDebounce(q, 450);
    const [candidates, setCandidates] = useState([]);
    const [selectedId, setSelectedId] = useState("");

    // current student record
    const [student, setStudent] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);

    // Tabs
    const [tab, setTab] = useState("profile");

    // ✅ FORM cambio contraseña temporal
    const [pwd, setPwd] = useState({
        current_password: "",
        new_password: "",
        confirm_password: "",
    });
    const [pwdSaving, setPwdSaving] = useState(false);

    /* ===================== LOADERS ===================== */
    const loadMyProfile = useCallback(async () => {
        try {
            setLoading(true);
            const data = await StudentsService.me();
            setStudent(data);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar tu perfil");
            setStudent(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadCandidates = useCallback(async () => {
        if (mode !== "admin") return;
        try {
            setLoading(true);
            const data = await StudentsService.list(dq ? { q: dq } : undefined);
            setCandidates(normalizeStudentsPayload(data));
        } catch {
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    }, [dq, mode]);

    const loadSelectedStudent = useCallback(async (id) => {
        if (!id) return;
        try {
            setStudent(null);
            setStudentLoading(true);
            const data = await StudentsService.get(id);
            setStudent(data);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar el estudiante");
            setStudent(null);
        } finally {
            setStudentLoading(false);
        }
    }, []);

    /* ===================== EFFECTS ===================== */
    useEffect(() => {
        if (mode === "student") loadMyProfile();
        else loadCandidates();
    }, [mode, loadMyProfile, loadCandidates]);

    useEffect(() => {
        if (mode === "admin" && selectedId) loadSelectedStudent(selectedId);
    }, [mode, selectedId, loadSelectedStudent]);

    useEffect(() => {
        if (mode === "admin" && !selectedId) {
            setStudent(null);
            setStudentLoading(false);
        }
    }, [mode, selectedId]);

    // ✅ UX: en admin, cuando selecciona otro, vuelve a Perfil
    useEffect(() => {
        if (mode === "admin" && selectedId) setTab("profile");
    }, [mode, selectedId]);

    // ✅ UX: si se está en kardex pero admin deselecciona, vuelve a perfil
    useEffect(() => {
        if (mode === "admin" && !selectedId && tab === "kardex") setTab("profile");
    }, [mode, selectedId, tab]);

    /* ===================== ACTIONS ===================== */
    const onSave = async (payload) => {
        try {
            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                const res = await StudentsService.update(selectedId, payload);
                toast.success("Estudiante actualizado");
                setStudent(res);
            } else {
                const res = await StudentsService.updateMe(payload);
                toast.success("Perfil actualizado");
                setStudent(res);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        }
    };

    const onUploadPhoto = async (file) => {
        try {
            if (!file) return;

            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                const res = await StudentsService.uploadPhoto(selectedId, file);
                toast.success("Foto actualizada");
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadSelectedStudent(selectedId);
            } else {
                const res = await StudentsService.uploadMyPhoto(file);
                toast.success("Foto actualizada");
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadMyProfile();
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir la foto");
        }
    };

    // ✅ CAMBIAR CONTRASEÑA TEMPORAL (sin reload)
    const onChangeTempPassword = async (e) => {
        e.preventDefault();
        if (pwdSaving) return;

        const cur = String(pwd.current_password || "").trim();
        const np = String(pwd.new_password || "").trim();
        const cp = String(pwd.confirm_password || "").trim();

        if (!cur || !np || !cp) return toast.error("Completa todos los campos.");
        if (np !== cp) return toast.error("La confirmación no coincide.");
        if (np.length < 8)
            return toast.error("La nueva contraseña debe tener al menos 8 caracteres.");

        try {
            setPwdSaving(true);

            await UsersService.changeMyPassword({
                current_password: cur,
                new_password: np,
            });

            // ✅ refresca /auth/me y desbloquea sin recargar
            if (refreshMe) await refreshMe();

            // limpia form
            setPwd({ current_password: "", new_password: "", confirm_password: "" });

            toast.success("Contraseña actualizada. Ya puedes continuar.");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "No se pudo actualizar la contraseña");
        } finally {
            setPwdSaving(false);
        }
    };

    /* ===================== KÁRDEX KEY ===================== */
    const kardexKey = useMemo(() => {
        if (!canViewKardex) return "";

        if (mode === "admin") return selectedId || "";

        return (
            student?.id ||
            student?._id ||
            student?.student_id ||
            student?.numDocumento ||
            student?.dni ||
            ""
        );
    }, [mode, selectedId, student, canViewKardex]);

    /* ===================== RENDER ===================== */
    const title = mode === "admin" ? "Estudiantes (Gestión)" : "Mi Perfil";

    const selectedLabel = useMemo(() => {
        if (mode !== "admin") return "";
        if (!student) return "";
        const doc = student?.numDocumento ? ` · DOC ${student.numDocumento}` : "";
        return `${getStudentLabel(student)}${doc}`;
    }, [mode, student]);

    if (!canManageStudents && !canSelf) {
        return (
            <div className="h-full p-4 md:p-6">
                <Card className="rounded-2xl border-t-4 border-t-rose-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5" /> Sin acceso
                        </CardTitle>
                        <CardDescription>No tienes permisos para ver este módulo.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 p-4 md:p-6 pb-40 space-y-6">
            <motion.div {...fade}>
                <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-slate-700 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5" /> {title}
                                </CardTitle>
                                <CardDescription>
                                    {mode === "admin"
                                        ? "Busca, selecciona y gestiona la ficha. El kárdex va en su pestaña."
                                        : "Revisa tus datos y actualiza lo permitido (contacto/dirección/foto)."}
                                </CardDescription>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl gap-2"
                                    onClick={() => (mode === "admin" ? loadCandidates() : loadMyProfile())}
                                    disabled={loading || studentLoading || pwdSaving}
                                >
                                    <RefreshCw className={`h-4 w-4 ${(loading || studentLoading) ? "animate-spin" : ""}`} />
                                    Recargar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* ✅ BLOQUE: CAMBIO DE CONTRASEÑA TEMPORAL */}
                        {mustChangePassword && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-900/10 p-5">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-amber-800 dark:text-amber-200">
                                            Primer ingreso: cambia tu contraseña
                                        </p>
                                        <p className="text-sm text-amber-700/80 dark:text-amber-200/70">
                                            Estás usando una contraseña temporal. Cámbiala para continuar.
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={onChangeTempPassword} className="mt-4 grid gap-3">
                                    <div>
                                        <Label>Contraseña temporal</Label>
                                        <Input
                                            type="password"
                                            className="rounded-xl"
                                            value={pwd.current_password}
                                            onChange={(e) =>
                                                setPwd((s) => ({ ...s, current_password: e.target.value }))
                                            }
                                            required
                                            disabled={pwdSaving}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <Label>Nueva contraseña</Label>
                                            <Input
                                                type="password"
                                                className="rounded-xl"
                                                value={pwd.new_password}
                                                onChange={(e) =>
                                                    setPwd((s) => ({ ...s, new_password: e.target.value }))
                                                }
                                                required
                                                disabled={pwdSaving}
                                            />
                                            <p className="text-[11px] text-amber-700/70 mt-1">
                                                Tip: mínimo 8 caracteres (ideal: mayúscula, número y símbolo).
                                            </p>
                                        </div>

                                        <div>
                                            <Label>Confirmar nueva contraseña</Label>
                                            <Input
                                                type="password"
                                                className="rounded-xl"
                                                value={pwd.confirm_password}
                                                onChange={(e) =>
                                                    setPwd((s) => ({ ...s, confirm_password: e.target.value }))
                                                }
                                                required
                                                disabled={pwdSaving}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600"
                                            disabled={pwdSaving}
                                        >
                                            {pwdSaving ? "Actualizando..." : "Actualizar contraseña"}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* ADMIN: picker */}
                        {mode === "admin" && (
                            <div className="rounded-2xl border border-white/50 dark:border-white/10 p-5 bg-white/60 dark:bg-neutral-900/40 shadow-sm transition-all hover:shadow-md">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                    <div className="md:col-span-7 space-y-2">
                                        <Label className="flex items-center gap-2 text-muted-foreground font-semibold">
                                            <Search className="h-4 w-4 text-indigo-500" />
                                            Buscar estudiante
                                        </Label>
                                        <div className="relative group">
                                            {!q && (
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100 pointer-events-none" />
                                            )}

                                            <Input
                                                className={`${!q ? "pl-10" : "pl-3"} rounded-xl bg-white/80 dark:bg-black/20 border-white/20 focus:ring-2 transition-all duration-300`}
                                                placeholder="       Documento, apellidos, nombres..."
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 pl-1">
                                            <Info className="h-3 w-3" />
                                            <span>Filtro por DNI o Apellidos (Backend 'q')</span>
                                        </div>
                                    </div>

                                    <div className="md:col-span-5 space-y-2">
                                        <Label className="flex items-center gap-2 text-muted-foreground font-semibold">
                                            <Users className="h-4 w-4 text-emerald-500" />
                                            Resultados ({candidates.length})
                                        </Label>
                                        <div className="relative group">
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none rotate-90" />
                                            <select
                                                className="w-full rounded-xl border border-input bg-white/80 dark:bg-black/20 px-3 py-2 text-sm shadow-sm transition-all focus:ring-2 outline-none appearance-none cursor-pointer hover:bg-white dark:hover:bg-black/40"
                                                value={selectedId}
                                                onChange={(e) => setSelectedId(e.target.value)}
                                            >
                                                <option value="">— Selecciona un resultado —</option>
                                                {candidates.map((s) => {
                                                    const id = s.id || s._id;
                                                    const ap = `${s.apellidoPaterno || ""} ${s.apellidoMaterno || ""}`.trim();
                                                    const name = `${ap} ${s.nombres || ""}`.trim() || "—";
                                                    const doc = s.numDocumento ? `DOC ${s.numDocumento}` : "";
                                                    return (
                                                        <option key={id} value={id}>
                                                            {name} {doc ? `• ${doc}` : ""}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {studentLoading ? (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground py-2 animate-pulse">
                                        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando ficha...
                                    </div>
                                ) : selectedId && student ? (
                                    <motion.div
                                        {...fade}
                                        className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm flex flex-col sm:flex-row items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 w-full overflow-hidden">
                                            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                                                <User className="h-4 w-4" />
                                            </div>

                                            <div className="min-w-0 flex-1 overflow-hidden">
                                                <span className="block font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                                                    Estudiante Activo
                                                </span>
                                                <span className="block text-muted-foreground truncate text-xs">
                                                    {selectedLabel}
                                                </span>
                                            </div>
                                        </div>

                                        {canViewKardex && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg border-emerald-200 hover:bg-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition-colors shrink-0"
                                                onClick={() => setTab("kardex")}
                                            >
                                                <FileText className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                                Ir a Notas
                                            </Button>
                                        )}
                                    </motion.div>
                                ) : null}
                            </div>
                        )}

                        {/* Tabs */}
                        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                            <TabsList className="w-full grid grid-cols-2 gap-3 sm:gap-4 bg-transparent p-0 mb-6">
                                <TabsTrigger
                                    value="profile"
                                    className="
                    w-full min-w-0
                    rounded-xl border border-transparent
                    data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800
                    data-[state=active]:bg-white dark:data-[state=active]:bg-black/40
                    data-[state=active]:shadow-sm
                    py-3 px-2 sm:px-4
                    transition-all duration-300
                  "
                                >
                                    <div className="flex items-center justify-center gap-2 min-w-0 w-full overflow-hidden">
                                        <User className="h-4 w-4 opacity-70 shrink-0" />
                                        <span className="min-w-0 truncate">Ficha de Perfil</span>
                                    </div>
                                </TabsTrigger>

                                {canViewKardex && (
                                    <TabsTrigger
                                        value="kardex"
                                        disabled={(mode === "admin" && !selectedId) || mustChangePassword}
                                        className="
                      w-full min-w-0
                      rounded-xl border border-transparent
                      data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800
                      data-[state=active]:bg-white dark:data-[state=active]:bg-black/40
                      data-[state=active]:shadow-sm
                      py-3 px-2 sm:px-4
                      transition-all duration-300
                      data-[disabled]:opacity-40
                    "
                                    >
                                        <div className="flex items-center justify-center gap-2 min-w-0 w-full overflow-hidden">
                                            <GraduationCap className="h-4 w-4 opacity-70 shrink-0" />
                                            <span className="min-w-0 truncate">Historial Académico</span>
                                        </div>
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            {/* PERFIL */}
                            <TabsContent value="profile" className="mt-0">
                                {mustChangePassword ? (
                                    <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                        <p className="text-sm text-muted-foreground">
                                            Acceso bloqueado hasta cambiar la contraseña temporal.
                                        </p>
                                    </div>
                                ) : mode === "student" ? (
                                    <StudentProfileForm
                                        mode={mode}
                                        student={student}
                                        loading={loading}
                                        onSave={onSave}
                                        onUploadPhoto={onUploadPhoto}
                                    />
                                ) : selectedId ? (
                                    <StudentProfileForm
                                        mode={mode}
                                        student={student}
                                        loading={loading || studentLoading}
                                        onSave={onSave}
                                        onUploadPhoto={onUploadPhoto}
                                    />
                                ) : (
                                    <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                        <p className="text-sm text-muted-foreground">
                                            Selecciona un estudiante para ver y editar su ficha.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* KÁRDEX */}
                            {canViewKardex ? (
                                <TabsContent value="kardex" className="mt-0">
                                    {mustChangePassword ? (
                                        <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                            <p className="text-sm text-muted-foreground">
                                                Acceso bloqueado hasta cambiar la contraseña temporal.
                                            </p>
                                        </div>
                                    ) : mode === "admin" && !selectedId ? (
                                        <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                            <p className="text-sm text-muted-foreground">
                                                Selecciona un estudiante para ver su kárdex.
                                            </p>
                                        </div>
                                    ) : (
                                        <StudentKardexCard
                                            mode={mode}
                                            studentKey={kardexKey}
                                            titlePrefix="Kárdex / Notas"
                                        />
                                    )}
                                </TabsContent>
                            ) : null}
                        </Tabs>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
