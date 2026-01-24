// src/modules/admission/PublicAdmissionCallDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Calendar, Clock, FileText, ChevronLeft,
    Award, School, ExternalLink, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("es-PE", {
        day: "2-digit", month: "short", year: "numeric"
    }) : "-";

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border">
        <div className="p-3 bg-white rounded-xl text-blue-600">
            <Icon className="h-5 w-5" />
        </div>
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
            <p className="text-sm font-bold text-slate-700">{value}</p>
        </div>
    </div>
);

export default function PublicAdmissionCallDetails({
    call: callProp,
    onApply,
    onOpenReglamento,
}) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [call, setCall] = useState(callProp || null);
    const [loading, setLoading] = useState(!callProp);

    useEffect(() => {
        if (callProp) {
            setCall(callProp);
            setLoading(false);
            return;
        }
        if (!id) return;

        (async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!data) {
                    toast.error("Convocatoria no encontrada");
                    navigate("/public/admission", { replace: true });
                    return;
                }
                setCall(data);
            } catch {
                toast.error("Error al cargar convocatoria");
                navigate("/public/admission", { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, callProp, navigate]);

    const status = useMemo(() => {
        if (!call) return "UNKNOWN";
        const now = new Date();
        const s = call.registration_start && new Date(call.registration_start);
        const e = call.registration_end && new Date(call.registration_end);
        if (!s || !e) return "POR_CONFIRMAR";
        if (now < s) return "PROXIMAMENTE";
        if (now <= e) return "ABIERTA";
        return "CERRADA";
    }, [call]);

    const badge = {
        ABIERTA: <Badge className="bg-emerald-600 text-white">ABIERTA</Badge>,
        PROXIMAMENTE: <Badge className="bg-blue-100 text-blue-700">PRÓXIMAMENTE</Badge>,
        CERRADA: <Badge variant="outline">CERRADA</Badge>,
        POR_CONFIRMAR: <Badge variant="secondary">POR CONFIRMAR</Badge>,
    }[status];

    if (loading) return <div className="p-10 text-center">Cargando...</div>;
    if (!call) return null;

    return (
        <div className="space-y-6">
            {!callProp && (
                <Button variant="ghost" onClick={() => navigate("/public/admission")}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <CardTitle className="text-2xl">{call.name}</CardTitle>
                            <CardDescription>{call.description}</CardDescription>
                        </div>
                        {badge}
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <InfoItem icon={Calendar} label="Inscripción"
                            value={`${fmtDate(call.registration_start)} - ${fmtDate(call.registration_end)}`} />
                        <InfoItem icon={Clock} label="Examen"
                            value={call.exam_date ? fmtDate(call.exam_date) : "Por definir"} />
                        <InfoItem icon={School} label="Periodo"
                            value={`${call.academic_year}${call.academic_period ? "-" + call.academic_period : ""}`} />
                        <InfoItem icon={FileText} label="Costo"
                            value={call.application_fee > 0 ? `S/ ${call.application_fee}` : "Gratis"} />
                    </div>

                    {!!call.careers?.length && (
                        <div className="space-y-2">
                            <h4 className="font-bold flex items-center gap-2">
                                <Award className="h-4 w-4 text-blue-600" /> Carreras
                            </h4>
                            <div className="grid sm:grid-cols-2 gap-2">
                                {call.careers.map(c => (
                                    <div key={c.id} className="flex justify-between p-3 border rounded">
                                        <span>{c.name}</span>
                                        <Badge>{c.vacancies} vac</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 flex-wrap">
                        <Button variant="outline" onClick={onOpenReglamento}>
                            <FileText className="mr-2 h-4 w-4" /> Reglamento
                            <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>

                        <Button
                            onClick={() =>
                                onApply ? onApply() : navigate(`/public/admission/${call.id}/apply`)
                            }
                        >
                            Postular <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
