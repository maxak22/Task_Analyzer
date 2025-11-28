from rest_framework import serializers
from .models import Task

class TaskSerializer(serializers.ModelSerializer):
    blocking_count = serializers.SerializerMethodField()
    blocked_by_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Task
        fields = ['id', 'title', 'due_date', 'estimated_hours', 'importance', 'description', 'blocking_count', 'blocked_by_count', 'created_at', 'updated_at']
    
    def get_blocking_count(self, obj):
        # Tasks that depend on this task (tasks waiting for this one)
        return obj.dependent_tasks.count()
    
    def get_blocked_by_count(self, obj):
        # Tasks this one depends on (tasks blocking this one)
        return obj.dependencies.count()