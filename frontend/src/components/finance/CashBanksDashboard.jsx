// src/modules/finance/CashBanksDashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CashBanks } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "../../utils/safeToast";
import { Plus, Save, RefreshCw, Loader2 } from "lucide-react"; // Agregué Loader2 para feedback visual
import { fmtCurrency, formatApiError, toLimaDateTime } from "../../utils/format";
import { clampVariant, optVal, safeText } from "../../utils/ui";

// CONFIGURACIONES CONSTANTES
const STATUS_CFG = {
  OPEN: { label: "Abierta", variant: "default" },
  CLOSED: { label: "Cerrada", variant: "secondary" },
};

const TYPE_CFG = {
  IN: { label: "Ingreso", variant: "default" },
  OUT: { label: "Egreso", variant: "secondary" },
};

const normStatus = (status) => {
  if (status == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof status === "object" ? (status.code ?? status.value ?? "") : status || "").toUpperCase();
  const cfg = STATUS_CFG[code];
  return { code, label: cfg?.label || (code || "-"), variant: clampVariant(cfg?.variant || "secondary") };
};

const normType = (type) => {
  if (type == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof type === "object" ? (type.code ?? type.value ?? "") : type || "").toUpperCase();
  const cfg = TYPE_CFG[code];
  return {
    code,
    label: cfg?.label || (code || "-"),
    variant: clampVariant(cfg?.variant || (code === "IN" ? "default" : "secondary")),
  };
};

const showApiError = (e, fallbackMsg) => toast.error(formatApiError(e, fallbackMsg));

export default function CashBanksDashboard() {
  const [sessions, setSessions] = useState([]);
  const [currentId, setCurrentId] = useState(undefined);
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de modales
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  // Formularios
  const [openForm, setOpenForm] = useState({ opening_amount: "", note: "" });
  const [closeForm, setCloseForm] = useState({ closing_amount: "", note: "" });
  const [newMov, setNewMov] = useState({ type: "IN", amount: "", concept: "" });

  // Estados de carga
  const [busyOpen, setBusyOpen] = useState(false);
  const [busyClose, setBusyClose] = useState(false);
  const [busyMov, setBusyMov] = useState(false);

  const current = useMemo(
    () => sessions.find((s) => String(s.id) === String(currentId)),
    [sessions, currentId]
  );

  const statusMeta = normStatus(current?.status);

  const totals = useMemo(() => {
    const ins = movs
      .filter((m) => normType(m.type).code === "IN")
      .reduce((a, m) => a + Number(m.amount || 0), 0);
    const outs = movs
      .filter((m) => normType(m.type).code === "OUT")
      .reduce((a, m) => a + Number(m.amount || 0), 0);
    const opening = Number(current?.opening_amount || 0);
    return { ins, outs, opening, balance: opening + ins - outs };
  }, [movs, current]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let alive = true;
    try {
      const d = await CashBanks.sessions();
      const list = d?.items ?? d ?? [];
      if (!alive) return;

      setSessions(list);
      // Lógica mejorada para seleccionar sesión
      const open = list.find((s) => normStatus(s.status).code === "OPEN" && optVal(s.id));
      const firstValid = list.find((s) => optVal(s.id));
      
      // Si ya hay ID seleccionado, manténlo, sino usa el abierto o el primero
      if (!currentId) {
          const initial = open?.id ?? firstValid?.id;
          setCurrentId(initial != null ? String(initial) : undefined);
          if (!initial && list.length === 0) setOpenDlg(true);
      }
    } catch (e) {
      if (alive) showApiError(e, "Error cargando sesiones");
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
  }, [currentId]);

  const loadMovs = useCallback(async () => {
    if (!currentId) return;
    const myId = currentId;
    try {
      // console.log("Cargando movimientos para ID:", myId); 
      const d = await CashBanks.movements(myId);
      // Asegurar que actualizamos solo si seguimos en la misma sesión
      setMovs((prev) => (currentId === myId ? (d?.items ?? d ?? []) : prev));
    } catch (e) {
        console.error("Error cargando movs:", e);
    }
  }, [currentId]);

  useEffect(() => {
    let cleanup;
    (async () => { cleanup = await loadSessions(); })();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [loadSessions]);

  useEffect(() => { loadMovs(); }, [loadMovs]);

  // --- HANDLERS ---
  const openSession = async () => {
    try {
      setBusyOpen(true);
      const payload = {
        opening_amount: Number(openForm.opening_amount || 0),
        note: openForm.note || undefined,
      };
      const r = await CashBanks.openSession(payload);
      toast.success("Sesión abierta correctamente");
      setOpenForm({ opening_amount: "", note: "" });
      setOpenDlg(false);
      
      // Recargar todo y seleccionar la nueva sesión
      await loadSessions();
      if (r?.id) setCurrentId(String(r.id));
      
    } catch (e) {
      showApiError(e, "No se pudo abrir la sesión");
    } finally {
      setBusyOpen(false);
    }
  };

  const closeSession = async () => {
    if (!current?.id) return;
    try {
      setBusyClose(true);
      const closingValue = closeForm.closing_amount === "" ? totals.balance : Number(closeForm.closing_amount);
      const payload = {
        closing_amount: Number.isFinite(closingValue) ? closingValue : totals.balance,
        note: closeForm.note || undefined,
      };
      await CashBanks.closeSession(current.id, payload);
      toast.success("Sesión cerrada correctamente");
      setCloseForm({ closing_amount: "", note: "" });
      setCloseDlg(false);
      await loadSessions();
      // No borramos movs, dejamos que se recarguen con estado cerrado
    } catch (e) {
      showApiError(e, "No se pudo cerrar la sesión");
    } finally {
      setBusyClose(false);
    }
  };

  const addMovement = async () => {
    if (!current?.id) return toast.error("Error: Sesión no válida");
    
    const amountNum = parseFloat(newMov.amount);
    const conceptVal = newMov.concept?.trim();

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
        return toast.error("Ingresa un monto válido");
    }
    if (!conceptVal) {
        return toast.error("Ingresa un concepto");
    }

    try {
      setBusyMov(true);
      
      // 1. Enviar al Backend (Esperamos a que el servidor confirme)
      await CashBanks.addMovement(current.id, {
        type: newMov.type, // "IN" o "OUT"
        amount: Number(amountNum), 
        concept: conceptVal,
      });

      toast.success("Movimiento registrado");

      // 2. Limpiar formulario
      setNewMov({ type: "IN", amount: "", concept: "" });

      // 3. RECARGA OBLIGATORIA (Sin timeout para asegurar datos reales)
      await loadMovs();     // Actualiza la tabla
      await loadSessions(); // Actualiza los saldos generales

    } catch (e) {
      console.error("Error al guardar:", e);
      const msg = e.response?.data?.message || e.message || "Error interno";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setBusyMov(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
  <div className="flex flex-col w-full min-h-screen bg-[#1E2F49] pb-12 animate-in fade-in duration-500">

    {/* 1. CABECERA - Se mantiene integrada al fondo azul */}
    <div className="flex-none px-6 sm:px-10 py-5 border-b border-white/10 bg-[#1E2F49]
                    flex flex-col sm:flex-row items-start sm:items-center
                    justify-between gap-4 shadow-md sticky top-0 z-30">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2.5 bg-white/10 rounded-lg hidden sm:block border border-white/5">
          <RefreshCw className="h-6 w-6 text-blue-200" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Caja y Bancos
          </h2>
          <p className="text-xs text-blue-100/60 font-medium uppercase tracking-widest">
            Gestión de Flujo de Efectivo
          </p>
        </div>
      </div>

      <div className="w-full sm:w-auto flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { loadSessions(); loadMovs(); }}
          className="h-10 flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white border-white/10 px-5"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>

        <Button
          size="sm"
          onClick={() => setOpenDlg(true)}
          className="h-10 flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 px-6 font-semibold shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" /> Abrir Caja
        </Button>

        {statusMeta.code === "OPEN" && (
          <Button
            size="sm"
            onClick={() => setCloseDlg(true)}
            variant="destructive"
            className="h-10 flex-1 sm:flex-none px-6 font-semibold shadow-sm"
          >
            <Save className="h-4 w-4 mr-2" /> Cerrar Caja
          </Button>
        )}
      </div>
    </div>

    {/* 2. CONTENIDO PRINCIPAL - Sobre el nuevo fondo azul */}
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-1 shadow-lg border-none bg-white/95 backdrop-blur-sm">
          <div className="h-1 bg-slate-400 w-full" />
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Sesión de Caja</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <Select value={currentId ? String(currentId) : undefined} onValueChange={setCurrentId}>
              <SelectTrigger className="w-full h-11 border-slate-200 text-base font-medium">
                <SelectValue placeholder="Seleccionar sesión..." />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => optVal(s.id) && (
                  <SelectItem key={s.id} value={String(s.id)} className="py-2.5">
                    <span className="font-bold text-blue-700">#{s.id}</span> — {toLimaDateTime(s.opened_at).split(",")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Badge variant={statusMeta.variant} className="text-[10px] font-bold uppercase tracking-wider">
                {statusMeta.label}
              </Badge>
              <div className="flex flex-col items-end text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Apertura</span>
                <span className="text-sm font-mono font-semibold text-slate-700">
                  {current ? toLimaDateTime(current.opened_at).split(",")[1] : "--:--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {current && (
          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="bg-white/95 border-none shadow-lg border-b-4 border-b-emerald-500 flex flex-col justify-center">
              <CardContent className="p-6">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ingresos</p>
                <h3 className="text-3xl font-semibold text-emerald-600 tracking-tight">{fmtCurrency(totals.ins)}</h3>
              </CardContent>
            </Card>

            <Card className="bg-white/95 border-none shadow-lg border-b-4 border-b-rose-500 flex flex-col justify-center">
              <CardContent className="p-6">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Egresos</p>
                <h3 className="text-3xl font-semibold text-rose-600 tracking-tight">{fmtCurrency(totals.outs)}</h3>
              </CardContent>
            </Card>

            <Card className="bg-white border-none shadow-xl ring-2 ring-blue-500/20 border-b-4 border-b-blue-600 flex flex-col justify-center">
              <CardContent className="p-6">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Saldo Neto</p>
                <h3 className="text-4xl font-bold text-blue-900 tracking-tight">{fmtCurrency(totals.balance)}</h3>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {statusMeta.code === "OPEN" && current && (
        <Card className="border-l-4 border-l-blue-400 shadow-lg bg-white/95 w-full">
          <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-end">
            <div className="w-full md:w-52">
              <Label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Tipo Operación</Label>
              <Select value={newMov.type} onValueChange={(v) => setNewMov({ ...newMov, type: v })}>
                <SelectTrigger className="h-11 font-medium border-slate-300 focus:ring-blue-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN" className="py-2"><span className="text-green-600 font-semibold">Ingreso (+)</span></SelectItem>
                  <SelectItem value="OUT" className="py-2"><span className="text-red-600 font-semibold">Egreso (-)</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-56">
              <Label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Monto (S/)</Label>
              <Input
                type="number"
                className="h-11 font-semibold text-lg text-right border-slate-300"
                placeholder="0.00"
                value={newMov.amount}
                onChange={(e) => setNewMov({ ...newMov, amount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addMovement()}
              />
            </div>

            <div className="w-full flex-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Concepto o Descripción</Label>
              <Input
                className="h-11 font-medium border-slate-300"
                placeholder="Ej. Pago de matrícula, servicios, etc."
                value={newMov.concept}
                onChange={(e) => setNewMov({ ...newMov, concept: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addMovement()}
              />
            </div>

            <Button
              className="w-full md:w-auto h-11 px-10 bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm"
              onClick={addMovement}
              disabled={busyMov}
            >
              {busyMov ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar Movimiento"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TABLA - EXPANDIDA CON FONDO CONTRASTADO */}
      <Card className="shadow-2xl border-none bg-white overflow-hidden w-full">
        <div className="px-6 py-4 flex justify-between items-center bg-slate-50 border-b">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
            Historial de Movimientos — <span className="text-blue-600 font-bold">{movs.length} registros</span>
          </h3>
          <Badge variant="outline" className="bg-white text-slate-400 font-bold text-[9px] uppercase border-slate-200">Libro Diario</Badge>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="w-full max-h-[650px] overflow-y-auto relative custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 sticky top-0 z-20 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-32">Hora</th>
                  <th className="px-6 py-4 w-44">Operación</th>
                  <th className="px-6 py-4">Concepto</th>
                  <th className="px-6 py-4 text-right w-64 font-bold">Monto</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 bg-white text-slate-600">
                {movs.map((m, index) => {
                  const tmeta = normType(m.type);
                  let timeStr = "--:--";
                  try { timeStr = toLimaDateTime(m.date).split(" ")[1]; } catch (e) {}

                  return (
                    <tr key={m.id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400 font-medium">
                        {timeStr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <Badge
                          variant="outline"
                          className={`font-bold px-3 py-1 border ${
                            tmeta.code === "IN"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}
                        >
                          {tmeta.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium uppercase text-[11px] tracking-tight text-slate-700">
                        {safeText(m.concept)}
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold text-lg tabular-nums ${tmeta.code === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                        {tmeta.code === "IN" ? "+" : "-"} {fmtCurrency(m.amount)}
                      </td>
                    </tr>
                  );
                })}

                {movs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="h-48 text-center text-slate-400 italic font-medium">
                      No se han registrado movimientos en esta sesión de caja.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  </div>
);
};