import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { 
  Calendar, Clock, FileText, ChevronLeft, 
  Award, School, ExternalLink, ArrowRight 
} from "lucide-react";
import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "-";

// Sub-componente para organizar los datos técnicos
const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100 transition-all hover:bg-white hover:shadow-md group">
        <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm transition-colors group-hover:bg-blue-600 group-hover:text-white shrink-0">
            <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                {label}
            </p>
            <p className="text-sm font-black text-slate-700 leading-tight">
                {value}
            </p>
        </div>
    </div>
);

export default function PublicAdmissionCallDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);

    const status = useMemo(() => {
        if (!call) return "UNKNOWN";
        const now = new Date();
        const regStart = call?.registration_start ? new Date(call.registration_start) : null;
        const regEnd = call?.registration_end ? new Date(call.registration_end) : null;

        if (!regStart || !regEnd) return "POR_CONFIRMAR";
        if (now < regStart) return "PROXIMAMENTE";
        if (now >= regStart && now <= regEnd) return "ABIERTA";
        return "CERRADA";
    }, [call]);

    const badge = useMemo(() => {
        const base = "rounded-full px-4 py-1.5 text-[10px] font-black tracking-widest uppercase border-0 shadow-sm";
        if (status === "ABIERTA") return <Badge className={`bg-emerald-600 text-white ${base}`}>INSCRIPCIONES ABIERTAS</Badge>;
        if (status === "PROXIMAMENTE") return <Badge className={`bg-blue-50 text-blue-700 ${base}`}>PRÓXIMAMENTE</Badge>;
        if (status === "CERRADA") return <Badge variant="outline" className={`text-gray-400 border-gray-200 bg-white ${base}`}>CERRADA</Badge>;
        return <Badge variant="secondary" className={`bg-gray-100 text-gray-600 ${base}`}>POR CONFIRMAR</Badge>;
    }, [status]);

    const getReglamentoUrl = (c) => {
        const candidate = c?.regulation_url || c?.reglamento_url || c?.rules_url || c?.regulationPdf || 
                         c?.regulation_pdf || c?.reglamento_pdf || c?.documents?.reglamento || c?.documents?.rules || null;
        return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
    };

    const openReglamento = () => {
        const url = getReglamentoUrl(call);
        if (!url) return toast.error("Esta convocatoria no tiene reglamento cargado.");
        window.open(url, "_blank", "noopener,noreferrer");
    };

    useEffect(() => {
        let mounted = true;
        const run = async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!mounted) return;
                if (!data) {
                    toast.error("No se encontró la convocatoria.");
                    navigate("/public/admission", { replace: true });
                    return;
                }
                setCall(data);
            } catch (e) {
                console.error(e);
                toast.error("Error al cargar el detalle de la convocatoria.");
                navigate("/public/admission", { replace: true });
            } finally {
                if (mounted) setLoading(false);
            }
        };
        run();
        return () => { mounted = false; };
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando detalles...</p>
            </div>
        );
    }

    if (!call) return null;

    return (
        <div className="min-h-screen bg-[#F8F9FA] px-4 py-10 sm:px-6 md:px-12 animate-in fade-in duration-500">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* --- HEADER: Back Button & Badge --- */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        className="h-11 px-4 rounded-2xl bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition-all font-bold text-slate-600"
                        onClick={() => navigate("/public/admission")}
                    >
                        <ChevronLeft className="h-5 w-5 mr-2 text-blue-600" />
                        Portal de Admisión
                    </Button>
                    <div>{badge}</div>
                </div>

                {/* --- MAIN CONTENT CARD --- */}
                <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-gray-100">
                    <CardHeader className="p-8 sm:p-12 border-b border-gray-50 bg-gradient-to-br from-white to-gray-50/50">
                        <div className="space-y-4">
                            <div className="inline-flex p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
                                <School className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                                    {call.name}
                                </CardTitle>
                                <CardDescription className="text-slate-500 text-lg font-medium mt-3 leading-relaxed max-w-2xl">
                                    {call.description || "Esta convocatoria no cuenta con una descripción detallada en este momento."}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 sm:p-12 space-y-10">
                        {/* Grid de Información Técnica */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <InfoItem 
                                icon={Calendar} 
                                label="Periodo de Inscripción" 
                                value={`${fmtDate(call.registration_start)} - ${fmtDate(call.registration_end)}`} 
                            />
                            <InfoItem 
                                icon={Clock} 
                                label="Fecha de Examen" 
                                value={call.exam_date ? fmtDate(call.exam_date) : "Por definir"} 
                            />
                            <InfoItem 
                                icon={School} 
                                label="Año Académico" 
                                value={`${call.academic_year}${call.academic_period ? `-${call.academic_period}` : ""}`} 
                            />
                            <InfoItem 
                                icon={FileText} 
                                label="Costo del Proceso" 
                                value={Number(call.application_fee) > 0 ? `S/ ${Number(call.application_fee).toFixed(2)}` : "Inscripción Gratuita"} 
                            />
                        </div>

                        {/* Sección de Carreras */}
                        {!!(call.careers || []).length && (
                            <div className="space-y-6 pt-6 border-t border-gray-50">
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Award className="h-4 w-4 text-blue-600" /> Carreras Disponibles
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {call.careers.map((career) => (
                                        <div 
                                            key={String(career.id ?? career.career_id)}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-700 shadow-sm"
                                        >
                                            <span className="text-sm truncate">{career.name}</span>
                                            {career.vacancies != null && (
                                                <Badge className="bg-white border-slate-200 text-blue-600 text-[10px] font-black px-3 rounded-lg">
                                                    {career.vacancies} VAC
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Botones de Acción */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 pt-10">
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="w-full sm:w-auto h-14 px-8 rounded-2xl font-black text-slate-600 border-gray-200 hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2"
                                onClick={openReglamento}
                            >
                                <FileText className="h-5 w-5 text-blue-600" />
                                Reglamento de Admisión
                                <ExternalLink className="h-4 w-4 opacity-50" />
                            </Button>

                            <Button
                                type="button"
                                className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                                onClick={() => navigate(`/public/admission/${id}/apply`)}
                            >
                                Iniciar Inscripción
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* --- FOOTER SUTIL --- */}
                <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] pb-10">
                    IESPP Gustavo Allende Llavería - Admisión 2026
                </p>
            </div>
        </div>
    );
}