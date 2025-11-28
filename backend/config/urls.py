from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({
        'message': 'Task Analyzer API',
        'version': '1.0.0',
        'endpoints': {
            'tasks': '/api/tasks/',
            'analyze': '/api/tasks/analyze/',
            'suggest': '/api/tasks/suggest/',
            'health': '/api/tasks/health/',
        }
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api_root, name='api_root'),
    path('api/tasks/', include('tasks.urls')),
]