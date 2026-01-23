import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { 
  Calendar,
  Clock,
  FileText,
  Search,
  Award,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  School,
  ArrowLeft 
} from "lucide-react";

import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

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

const PublicAdmissionCalls = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [admissionCalls, setAdmissionCalls] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchData, setSearchData] = useState({ admissionCallId: "", documentNumber: "" });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchPublicAdmissionCalls = useCallback(async () => {
    try {
      setLoading(true);
      const calls = await AdmissionCalls.listPublic();
      setAdmissionCalls(Array.isArray(calls) ? calls : []);
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error, "Error al cargar convocatorias"));
      setAdmissionCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicAdmissionCalls();
  }, [fetchPublicAdmissionCalls]);

  const handleResultSearch = useCallback(
  async (e) => {
    e.preventDefault();

    const { admissionCallId, documentNumber } = searchData;

    if (!admissionCallId || !documentNumber) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    setSearchLoading(true);
    setSearchResults(null);

    try {
      const { data } = await api.get(
        `/admission-results/public/${admissionCallId}/${documentNumber}`
      );
      setSearchResults(data);
    } catch (error) {
      if (error?.response?.status === 404) {
        setSearchResults({
          error: "No se encontraron resultados para los datos ingresados.",
        });
      } else {
        setSearchResults({
          error: formatApiError(
            error,
            "Error al consultar resultados."
          ),
        });
      }
    } finally {
      setSearchLoading(false);
    }
  },
  [api, searchData]
);


  const getCallStatusBadge = (call) => {
    const now = new Date();
    const regStart = call?.registration_start ? new Date(call.registration_start) : null;
    const regEnd = call?.registration_end ? new Date(call.registration_end) : null;

    const badgeClass = "rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm";

    if (!regStart || !regEnd) {
      return (
        <Badge variant="secondary" className={badgeClass}>
          POR CONFIRMAR
        </Badge>
      );
    }

    if (now < regStart) {
      return (
        <Badge variant="secondary" className={`bg-blue-50 text-blue-700 hover:bg-blue-100 ${badgeClass}`}>
          PRÓXIMAMENTE
        </Badge>
      );
    }

    if (now >= regStart && now <= regEnd) {
      return (
        <Badge className={`bg-emerald-600 hover:bg-emerald-700 ${badgeClass}`}>
          INSCRIPCIONES ABIERTAS
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className={`text-gray-500 border-gray-300 ${badgeClass}`}>
        CERRADA
      </Badge>
    );
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  const getReglamentoUrl = (call) => {
    const candidate =
      call?.regulation_url ||
      call?.reglamento_url ||
      call?.rules_url ||
      call?.regulationPdf ||
      call?.regulation_pdf ||
      call?.reglamento_pdf ||
      call?.documents?.reglamento ||
      call?.documents?.rules ||
      null;

    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
  };

  const handleOpenReglamento = (call) => {
    const url = getReglamentoUrl(call);
    if (!url) return toast.error("Esta convocatoria no tiene reglamento cargado.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleViewDetails = (call) => {
    if (!call?.id) return toast.error("No se pudo abrir el detalle: falta el ID.");
    navigate(`/public/admission/${call.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Cargando portal...</p>
        </div>
      </div>
    );
  }

return (
  <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-800 antialiased">
    {/* --- HEADER --- */}
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 transition-all">
      {/* Ajuste de padding: px-4 en móvil, px-6 en tablet, px-12 en escritorio */}
      <div className="w-full px-4 py-3 md:px-6 md:py-4 lg:px-12 flex items-center justify-between">

        {/* IZQUIERDA: Logo + Título + Volver */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
          <img
            src="/logo.png"
            alt="Logo Institucional"
            // Logo más pequeño en móvil (h-10) y normal en escritorio (h-14)
            className="h-10 md:h-14 w-auto object-contain shrink-0 transition-transform hover:scale-105"
          />

          <div className="hidden md:block h-10 w-px bg-gray-200"></div>

          <div className="min-w-0 flex flex-col justify-center">
            {/* Texto adaptable: text-lg en móvil, text-2xl en escritorio */}
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight leading-tight truncate">
              Portal de Admisión
            </h1>
            {/* Ocultamos el subtítulo en pantallas muy pequeñas si es necesario, o reducimos la letra */}
            <p className="text-xs md:text-sm text-slate-500 font-medium tracking-wide truncate">
              IESPP "Gustavo Allende Llavería"
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ml-1 md:ml-2 p-1.5 md:p-2 rounded-xl bg-gray-50 hover:bg-gray-200 text-slate-700 transition-colors border border-gray-100 shrink-0"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>

        {/* DERECHA: Acceso al sistema */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => (window.location.href = "/login")}
          // Texto más pequeño en móvil y ocultamos "al Sistema" si falta espacio
          className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-bold shrink-0 transition-all rounded-xl text-xs md:text-base px-3 py-2 md:px-4"
        >
          <span className="md:hidden">Acceder</span>
          <span className="hidden md:inline">Acceso al Sistema</span>
        </Button>
      </div>
    </header>

    {/* --- CONTENIDO PRINCIPAL --- */}
    <div className="w-full px-4 py-6 md:px-8 md:py-10 lg:px-12 flex-1 max-w-[1440px] mx-auto">
      {/* Grid Layout: 
          - Móvil/Tablet: 1 columna 
          - Laptop (lg) y Desktop (xl): 3 columnas (2 contenido + 1 sidebar) 
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10 h-full">
        
        {/* COLUMNA IZQUIERDA (LISTA DE CONVOCATORIAS) */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="border-l-4 border-blue-600 pl-4 py-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Admisión</h2>
            <p className="text-slate-500 mt-1 text-sm md:text-lg">Explore nuestras oportunidades académicas y postule hoy mismo.</p>
          </div>

          {admissionCalls.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 bg-white/50 shadow-none rounded-2xl">
              <CardContent className="p-8 md:p-12 text-center">
                <div className="bg-gray-100 rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Calendar className="h-8 w-8 md:h-10 md:w-10" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">No hay convocatorias activas</h3>
                <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto">
                  Actualmente no contamos con procesos de admisión abiertos. Revise nuevamente más tarde.
                </p>
                <div className="mt-6">
                  <Button type="button" variant="outline" className="rounded-xl w-full sm:w-auto" onClick={fetchPublicAdmissionCalls}>
                    Reintentar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              {admissionCalls.map((call) => (
                <Card key={call.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-all rounded-xl md:rounded-2xl overflow-hidden bg-white ring-1 ring-gray-100/50">
                  
                  {/* Card Header: Flex columna en móvil, Fila en Tablet/Desktop */}
                  <div className="px-5 py-4 md:px-8 md:py-6 border-b border-gray-50 bg-gradient-to-r from-white to-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{call.name}</CardTitle>
                      {call.description && <CardDescription className="text-slate-500 text-sm md:text-base line-clamp-2 md:line-clamp-none">{call.description}</CardDescription>}
                    </div>
                    <div className="shrink-0 self-start md:self-center">{getCallStatusBadge(call)}</div>
                  </div>

                  {/* Card Body */}
                  <CardContent className="px-5 py-5 md:px-8 md:py-8 space-y-6 md:space-y-8">
                    {/* Grid de Información: 
                        - Móvil: 1 columna 
                        - Móvil Grande (sm): 2 columnas 
                        - Laptop (lg): 4 columnas 
                    */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-4 md:gap-x-6">
                      <div className="flex items-start gap-3 group">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Calendar className="h-4 w-4" /></div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Inscripción</p>
                          <p className="text-sm font-semibold text-slate-700">{fmtDate(call.registration_start)} - {fmtDate(call.registration_end)}</p>
                        </div>
                      </div>

                      {call.exam_date && (
                        <div className="flex items-start gap-3 group">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Clock className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Examen</p>
                            <p className="text-sm font-semibold text-slate-700">{fmtDate(call.exam_date)}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3 group">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><School className="h-4 w-4" /></div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Periodo</p>
                          <p className="text-sm font-semibold text-slate-700">
                            {call.academic_year}{call.academic_period ? `-${call.academic_period}` : ""}
                          </p>
                        </div>
                      </div>

                      {Number(call.application_fee) > 0 && (
                        <div className="flex items-start gap-3 group">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText className="h-4 w-4" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Costo</p>
                            <p className="text-sm font-semibold text-slate-700">S/ {Number(call.application_fee).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {!!(call.careers || []).length && (
                      <div className="pt-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                          <Award className="h-4 w-4 text-blue-600" />
                          Programas Disponibles
                        </h4>

                        <div className="flex flex-wrap gap-2">
                          {call.careers.map((career) => (
                            <div
                              key={String(career.id ?? career.career_id)}
                              className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-slate-50 text-slate-700 text-xs md:text-sm font-bold border border-slate-200 transition-all hover:bg-white hover:border-blue-200 shadow-sm"
                            >
                              {career.name}
                              {career.vacancies != null && (
                                <span className="ml-2 md:ml-3 text-slate-400 text-[10px] md:text-xs border-l border-slate-300 pl-2 md:pl-3">
                                  {career.vacancies} vacantes
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botones de acción: Stack en móvil (w-full), fila en desktop */}
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                      <Button type="button" variant="outline" className="w-full sm:w-auto h-11 px-8 rounded-xl font-bold border-gray-300 hover:bg-gray-50 transition-all" onClick={() => handleOpenReglamento(call)}>
                        Reglamento
                      </Button>
                      <Button type="button" className="w-full sm:w-auto h-11 px-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95" onClick={() => handleViewDetails(call)}>
                        Ver Detalles <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* --- SIDEBAR: CONSULTA --- */}
        {/* En móvil: margin-top. En laptop (lg): margin 0 */}
        <div className="space-y-6 md:space-y-8 mt-4 lg:mt-0">
          
          {/* Card sticky solo funciona bien si el contenedor padre tiene altura. 
              En móvil es irrelevante porque está al final. */}
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white sticky top-24 ring-1 ring-gray-100">
            <CardHeader className="bg-slate-900 text-white p-6 md:p-8">
              <CardTitle className="flex items-center space-x-3 text-lg md:text-xl font-bold">
                <Search className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
                <span>Mis Resultados</span>
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2 font-medium text-sm md:text-base">
                Verifique el estado de su postulación ingresando sus datos.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 md:p-8 space-y-6">
              <form onSubmit={handleResultSearch} className="space-y-5 md:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="admissionCall" className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Convocatoria</Label>
                  <div className="relative group">
                    <select
                      id="admissionCall"
                      className="w-full h-11 md:h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl font-medium appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer text-sm md:text-base"
                      value={searchData.admissionCallId}
                      onChange={(e) => setSearchData((prev) => ({ ...prev, admissionCallId: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {admissionCalls.map((call) => (
                        <option key={call.id} value={call.id}>{call.name}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-3.5 md:top-4 h-4 w-4 text-gray-400 rotate-90 pointer-events-none transition-transform group-focus-within:rotate-0" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentNumber" className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">N° de Documento</Label>
                  <Input
                    id="documentNumber"
                    inputMode="numeric"
                    pattern="[0-9]{8,12}"
                    maxLength={12}
                    placeholder="Ej. 70123456"
                    className="h-11 md:h-12 bg-gray-50 border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 transition-all text-sm md:text-base"
                    value={searchData.documentNumber}
                    onChange={(e) => setSearchData((prev) => ({ ...prev, documentNumber: e.target.value.trim() }))}
                    required
                  />
                </div>

                <Button type="submit" disabled={searchLoading} className="w-full h-11 md:h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm md:text-base">
                  {searchLoading ? "Buscando..." : "Consultar Resultados"}
                </Button>
              </form>

              {searchResults && (
                <div className={`mt-2 p-4 md:p-5 rounded-xl border animate-in zoom-in-95 duration-300 ${searchResults.error ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <p className={`text-sm font-bold text-center ${searchResults.error ? "text-red-700" : "text-emerald-700"}`}>
                    {searchResults.error || "¡Datos encontrados! Revisa los detalles abajo."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CONTACTO */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-widest border-b border-gray-50 pb-4">Información de Contacto</h4>
            <div className="space-y-4 md:space-y-5">
              <div className="flex items-start gap-4 text-sm font-medium text-slate-600 group">
                <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" /> 
                <span className="leading-snug">Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-medium text-slate-600 group">
                <Phone className="h-5 w-5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" /> 
                <span>+51 64 621199</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-medium text-slate-600 group">
                <Mail className="h-5 w-5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" /> 
                <span className="truncate">admin@iesppallende.edu.pe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default PublicAdmissionCalls;
