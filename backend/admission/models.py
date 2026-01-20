from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()


class AdmissionParam(models.Model):
    data = models.JSONField(default=dict)


class Career(models.Model):
    DEGREE_CHOICES = [
        ("BACHELOR", "Bachiller"),
        ("TECHNICAL", "Técnico"),
        ("PROFESSIONAL", "Profesional"),
    ]
    MODALITY_CHOICES = [
        ("PRESENCIAL", "Presencial"),
        ("VIRTUAL", "Virtual"),
        ("SEMIPRESENCIAL", "Semipresencial"),
    ]

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    duration_semesters = models.PositiveIntegerField(default=0)
    vacancies = models.PositiveIntegerField(default=0)
    degree_type = models.CharField(max_length=20, choices=DEGREE_CHOICES, default="BACHELOR")
    modality = models.CharField(max_length=20, choices=MODALITY_CHOICES, default="PRESENCIAL")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AdmissionCall(models.Model):
    title = models.CharField(max_length=160)
    period = models.CharField(max_length=20)
    published = models.BooleanField(default=False)
    vacants_total = models.PositiveIntegerField(default=0)
    meta = models.JSONField(default=dict)


class AdmissionScheduleItem(models.Model):
    call = models.ForeignKey(AdmissionCall, on_delete=models.CASCADE, related_name="schedule")
    label = models.CharField(max_length=140)
    start = models.DateTimeField()
    end = models.DateTimeField()
    kind = models.CharField(max_length=40, blank=True, default="")


class Applicant(models.Model):
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True)
    dni = models.CharField(max_length=12, unique=True)
    names = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")


class Application(models.Model):
    call = models.ForeignKey(AdmissionCall, on_delete=models.CASCADE, related_name="applications")
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="applications")

    # lo mantenemos como texto por tu decisión (pero ahora lo llenamos bien)
    career_name = models.CharField(max_length=140)

    status = models.CharField(max_length=20, default="CREATED")  # CREATED/PAID/EVALUATED/PUBLISHED
    data = models.JSONField(default=dict)


class ApplicationPreference(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="preferences")
    career = models.ForeignKey(Career, on_delete=models.PROTECT)
    rank = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("application", "career")
        ordering = ["rank", "id"]


class ApplicationDocument(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=60)
    file = models.FileField(upload_to="admission/docs/")
    status = models.CharField(max_length=20, default="PENDING")  # PENDING/APPROVED/REJECTED
    note = models.CharField(max_length=200, blank=True, default="")


class Payment(models.Model):
    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name="payment")
    method = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="STARTED")  # STARTED/CONFIRMED/VOID
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    meta = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class EvaluationScore(models.Model):
    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name="score")
    rubric = models.JSONField(default=dict)
    total = models.DecimalField(max_digits=6, decimal_places=2, default=0)


class ResultPublication(models.Model):
    call = models.OneToOneField(AdmissionCall, on_delete=models.CASCADE, related_name="result_pub")
    published = models.BooleanField(default=False)
    payload = models.JSONField(default=dict)
