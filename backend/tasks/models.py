from django.db import models
from django.utils import timezone

class Task(models.Model):
    title = models.CharField(max_length=255)
    due_date = models.DateField(null=True, blank=True)
    estimated_hours = models.FloatField(default=0)
    importance = models.IntegerField(default=5)
    description = models.TextField(blank=True, null=True, default='')
    
    dependencies = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='dependent_tasks',
        blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
    
    def is_overdue(self):
        if not self.due_date:
            return False
        return self.due_date < timezone.now().date()
    
    def is_due_today(self):
        if not self.due_date:
            return False
        return self.due_date == timezone.now().date()