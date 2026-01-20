from rest_framework import serializers
from .models import (
    Career, AdmissionCall, AdmissionScheduleItem, Applicant,
    Application, ApplicationPreference, ApplicationDocument,
    Payment, EvaluationScore, AdmissionParam
)


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"


class AdmissionCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionCall
        fields = "__all__"


class AdmissionScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionScheduleItem
        fields = "__all__"


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Applicant
        fields = "__all__"


class ApplicationPreferenceSerializer(serializers.ModelSerializer):
    career_id = serializers.IntegerField(source="career.id", read_only=True)
    career_name = serializers.CharField(source="career.name", read_only=True)

    class Meta:
        model = ApplicationPreference
        fields = ["id", "career_id", "career_name", "rank"]


class ApplicationSerializer(serializers.ModelSerializer):
    # ✅ input: [1,2,3]
    career_preferences = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )

    # ✅ output: [{career_id, career_name, rank}, ...]
    preferences = ApplicationPreferenceSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "call", "applicant", "career_name", "status", "data",
            "career_preferences", "preferences",
        ]

    def validate(self, attrs):
        prefs = attrs.get("career_preferences") or []
        if not attrs.get("career_name") and not prefs:
            raise serializers.ValidationError({"career_name": "Se requiere career_name o career_preferences."})
        return attrs

    def create(self, validated_data):
        prefs = validated_data.pop("career_preferences", []) or []

        # si viene prefs, setea career_name con la 1era carrera
        if prefs and not validated_data.get("career_name"):
            first = Career.objects.filter(id=prefs[0]).first()
            validated_data["career_name"] = first.name if first else "Sin carrera"

        app = Application.objects.create(**validated_data)

        # guardar preferencias ordenadas
        if prefs:
            careers = {c.id: c for c in Career.objects.filter(id__in=prefs)}
            rows = []
            rank = 1
            for cid in prefs:
                c = careers.get(cid)
                if not c:
                    continue
                rows.append(ApplicationPreference(application=app, career=c, rank=rank))
                rank += 1
            ApplicationPreference.objects.bulk_create(rows)

        # guarda lo que mandó el FE dentro de data por si quieres auditar
        app.data = {**(app.data or {}), "career_preferences": prefs}
        app.save(update_fields=["data"])

        return app


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class EvaluationScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationScore
        fields = "__all__"


class AdmissionParamSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionParam
        fields = "__all__"
