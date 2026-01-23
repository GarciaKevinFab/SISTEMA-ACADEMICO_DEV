// src/modules/admission/AdmissionParams.jsx
import React, { useEffect, useState } from "react";
import { AdmissionParams } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

const ALL_DOCS = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY", "CONADIS_COPY"];

const DEFAULT_PARAMS = {
    min_age: 16,
    max_age: 35,
    required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
};

const normalize = (raw) => {
    const rd = Array.isArray(raw?.required_documents) ? raw.required_documents : DEFAULT_PARAMS.required_documents;
    return {
        ...DEFAULT_PARAMS,
        ...raw,
        required_documents: rd,
    };
};

export default function AdmissionParamsModule() {
    const [params, setParams] = useState(DEFAULT_PARAMS);

    useEffect(() => {
        AdmissionParams.get()
            .then((d) => setParams((prev) => normalize({ ...prev, ...(d || {}) })))
            .catch(() => setParams((prev) => normalize(prev)));
        // eslint-disable-next-line
    }, []);

    const toggleDoc = (d) => {
        setParams((p) => {
            const list = Array.isArray(p?.required_documents) ? p.required_documents : [];
            return {
                ...p,
                required_documents: list.includes(d) ? list.filter((x) => x !== d) : [...list, d],
            };
        });
    };

    const save = async () => {
        await AdmissionParams.save(normalize(params));
        // usa tu propio toast si quieres; lo quité para que el snippet quede autocontenible
        // toast.success("Parámetros guardados");
    };

    const reqDocs = Array.isArray(params?.required_documents) ? params.required_documents : [];

    return (
    <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden bg-white ring-1 ring-gray-100 animate-in fade-in duration-500">
        <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-xl font-bold text-gray-900 tracking-tight">
                Parámetros de Admisión
            </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6 sm:p-8 space-y-8">
            {/* --- SECCIÓN: RANGOS DE EDAD --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Edad Mínima
                    </Label>
                    <Input
                        type="number"
                        className="h-11 rounded-xl border-gray-200 focus:ring-1 focus:ring-gray-200 font-medium"
                        value={params?.min_age ?? DEFAULT_PARAMS.min_age}
                        onChange={(e) => setParams((p) => ({ ...p, min_age: parseInt(e.target.value) || 0 }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Edad Máxima
                    </Label>
                    <Input
                        type="number"
                        className="h-11 rounded-xl border-gray-200 focus:ring-1 focus:ring-gray-200 font-medium"
                        value={params?.max_age ?? DEFAULT_PARAMS.max_age}
                        onChange={(e) => setParams((p) => ({ ...p, max_age: parseInt(e.target.value) || 0 }))}
                    />
                </div>
            </div>

            {/* --- SECCIÓN: PLANTILLA DE DOCUMENTOS --- */}
            <div className="space-y-4">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                    Documentos Requeridos (Plantilla General)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {ALL_DOCS.map((d) => {
                        const isChecked = reqDocs.includes(d);
                        return (
                            <label 
                                key={d} 
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                                    isChecked 
                                    ? "border-gray-900 bg-white shadow-sm" 
                                    : "border-gray-100 bg-gray-50/30 hover:border-gray-200"
                                }`}
                            >
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                                    checked={isChecked} 
                                    onChange={() => toggleDoc(d)} 
                                />
                                <span className={`text-sm font-medium transition-colors ${isChecked ? "text-gray-900" : "text-gray-600"}`}>
                                    {d}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* --- ACCIONES --- */}
            <div className="flex justify-end pt-6 border-t border-gray-50">
                <Button 
                    onClick={save}
                    className="h-12 px-10 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-sm transition-transform active:scale-95"
                >
                    Guardar Configuración
                </Button>
            </div>
        </CardContent>
    </Card>
);
 }
