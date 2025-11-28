from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from .models import Task
from .serializers import TaskSerializer
from .scoring import PriorityCalculator
from .dependencies import DependencyGraph
from .utils import check_circular_dependencies, flag_circular_dependencies, get_task_dependency_info
from .holidays import is_indian_holiday, calculate_business_days
import traceback
import json


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'healthy',
        'message': 'Task Analyzer API is running'
    }, status=status.HTTP_200_OK)


def generate_explanation(task, score, calculator):
    urgency = calculator.calculate_urgency_score(task)
    importance = calculator.calculate_importance_score(task)
    efficiency = calculator.calculate_efficiency_score(task)
    
    explanations = []
    
    if urgency > 80:
        explanations.append("⏰ Due very soon")
    elif urgency > 60:
        explanations.append("📅 Due soon")
    
    if importance > 80:
        explanations.append("🔥 Very important")
    elif importance > 60:
        explanations.append("⭐ Important")
    
    if efficiency > 80:
        explanations.append("⚡ Quick win")
    elif efficiency > 60:
        explanations.append("💡 Good ROI")
    
    return " • ".join(explanations) if explanations else "Task ready to start"


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            data = request.data.copy()
            
            dependencies = data.pop('dependencies', [])
            
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            task = serializer.save()
            
            if dependencies:
                task.dependencies.set(dependencies)
            
            output_serializer = self.get_serializer(task)
            headers = self.get_success_headers(output_serializer.data)
            return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            
            data = request.data.copy()
            dependencies = data.pop('dependencies', None)
            
            serializer = self.get_serializer(instance, data=data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            if dependencies is not None:
                instance.dependencies.set(dependencies)
            
            return Response(serializer.data)
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def analyze(self, request):
        try:
            strategy = request.data.get('strategy', 'smart_balance')
            valid_strategies = ['smart_balance', 'fastest_wins', 'high_impact', 'deadline_driven']
            if strategy not in valid_strategies:
                return Response(
                    {'message': f'Invalid strategy. Choose from: {", ".join(valid_strategies)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            tasks = list(Task.objects.all())
            if not tasks:
                return Response({
                    'strategy': strategy,
                    'count': 0,
                    'tasks': [],
                    'message': 'No tasks to analyze'
                })
        
            calculator = PriorityCalculator()
            scored_tasks = calculator.sort_by_strategy(tasks, strategy)
        
            response_tasks = []
            for task, score in scored_tasks:
                score_breakdown = calculator.get_task_score_breakdown(task, tasks)
                urgency_info = calculator.get_urgency_info(task)
            
                try:
                    blocked_count = task.dependencies.count()
                except:
                    blocked_count = 0
                blocking_count = Task.objects.filter(dependencies=task).count()
                
                task_data = TaskSerializer(task).data
                task_data.update({
                    'priority_score': score,
                    'score_breakdown': score_breakdown,
                    'blocked_count': blocked_count,
                    'blocking_count': blocking_count,
                    'is_critical': score >= 80,
                    'explanation': f'{urgency_info["label"]} • Importance: {task.importance}/10 • Effort: {task.estimated_hours}h'
                })
                
                response_tasks.append(task_data)
            
            return Response({
                'strategy': strategy,
                'count': len(response_tasks),
                'tasks': response_tasks,
                'circular_dependencies': {}
            })
            
        except Exception as e:
            print(f"Error in analyze endpoint: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'message': f'Analysis failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def suggest(self, request):
        try:
            count = request.data.get('count', 3)
            strategy = request.data.get('strategy', 'smart_balance')
            
            all_tasks = list(Task.objects.all())
            
            if not all_tasks:
                return Response({
                    'success': True,
                    'suggested_tasks': [],
                    'message': 'No tasks available'
                }, status=status.HTTP_200_OK)
            
            calculator = PriorityCalculator()
            graph = DependencyGraph()
            dependency_info = graph.get_dependency_info(all_tasks)
            sorted_tasks = calculator.sort_by_strategy(all_tasks, strategy)
            top_tasks = sorted_tasks[:count]
            
            tasks_data = []
            for task, score in top_tasks:
                breakdown = calculator.get_task_score_breakdown(task, tasks=all_tasks)
                
                tasks_data.append({
                    'id': task.id,
                    'title': task.title,
                    'due_date': str(task.due_date) if task.due_date else None,
                    'estimated_hours': float(task.estimated_hours),
                    'importance': task.importance,
                    'priority_score': float(score),
                    'explanation': generate_explanation(task, score, calculator),
                    'blocking_count': dependency_info[task.id]['blocking_count'],
                    'blocked_count': dependency_info[task.id]['blocked_count'],
                    'is_critical': dependency_info[task.id]['blocked_count'] > 0,
                    'business_days_until_due': calculator.get_business_days_until(task.due_date),
                    'score_breakdown': {
                        'urgency_score': float(breakdown['urgency_score']),
                        'importance_score': float(breakdown['importance_score']),
                        'efficiency_score': float(breakdown['efficiency_score']),
                        'dependency_score': float(breakdown['dependency_score'])
                    }
                })
            
            return Response({
                'success': True,
                'strategy': strategy,
                'suggested_tasks': tasks_data
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def check_cycles(self, request):
        try:
            tasks = list(Task.objects.all())
            
            if not tasks:
                return Response({
                    'has_cycles': False,
                    'cycle_count': 0,
                    'cycles': [],
                    'affected_tasks': []
                })
        
            calculator = PriorityCalculator()
            cycles = calculator.detect_circular_dependencies(tasks)
            
            affected_task_ids = []
            cycle_data = []
            
            if cycles:
                for cycle in cycles:
                    cycle_data.append({'tasks': cycle.split(' → ')})
                    for task_id in Task.objects.filter(
                        title__in=cycle.split(' → ')
                    ).values_list('id', flat=True):
                        if task_id not in affected_task_ids:
                            affected_task_ids.append(task_id)
            
            return Response({
                'has_cycles': len(cycles) > 0 if cycles else False,
                'cycle_count': len(cycle_data),
                'cycles': cycle_data,
                'affected_tasks': affected_task_ids
            })
            
        except Exception as e:
            print(f"Error in check_cycles endpoint: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'message': f'Cycle check failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def dependency_info(self, request, pk=None):
        task = self.get_object()
        all_tasks = self.get_queryset()
        
        dep_info = get_task_dependency_info(task, all_tasks)
        
        return Response(dep_info)

    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        try:
            tasks_data = request.data.get('tasks', [])
            
            if not isinstance(tasks_data, list):
                return Response(
                    {'success': False, 'message': 'Tasks must be an array'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not tasks_data:
                return Response(
                    {'success': False, 'message': 'No tasks provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if len(tasks_data) > 100:
                return Response(
                    {'success': False, 'message': 'Maximum 100 tasks per import'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            created_tasks = []
            failed_tasks = []
            
            for index, task_data in enumerate(tasks_data):
                try:
                    if 'title' not in task_data or not task_data['title'].strip():
                        failed_tasks.append({
                            'index': index,
                            'title': task_data.get('title', 'Untitled'),
                            'error': 'Title is required'
                        })
                        continue
                    
                    dependencies = task_data.pop('dependencies', [])
                    task_data.pop('description', None)
                    
                    cleaned_data = {
                        'title': task_data.get('title', '').strip(),
                        'due_date': task_data.get('due_date') or None,
                        'estimated_hours': float(task_data.get('estimated_hours', 0)) if task_data.get('estimated_hours') else 0,
                        'importance': int(task_data.get('importance', 5)) if task_data.get('importance') else 5,
                    }
                    
                    if not (1 <= cleaned_data['importance'] <= 10):
                        cleaned_data['importance'] = max(1, min(10, cleaned_data['importance']))
                    
                    task = Task.objects.create(**cleaned_data)
                    
                    if dependencies:
                        valid_deps = Task.objects.filter(id__in=dependencies).values_list('id', flat=True)
                        if valid_deps:
                            task.dependencies.set(valid_deps)
                    
                    created_tasks.append({
                        'id': task.id,
                        'title': task.title,
                        'created': True
                    })
                
                except ValueError as e:
                    failed_tasks.append({
                        'index': index,
                        'title': task_data.get('title', 'Untitled'),
                        'error': f'Invalid data type: {str(e)}'
                    })
                except Exception as e:
                    failed_tasks.append({
                        'index': index,
                        'title': task_data.get('title', 'Untitled'),
                        'error': str(e)
                    })
        
            return Response({
                'success': True,
                'created_count': len(created_tasks),
                'failed_count': len(failed_tasks),
                'created_tasks': created_tasks,
                'failed_tasks': failed_tasks if failed_tasks else None,
                'message': f'Successfully imported {len(created_tasks)} of {len(tasks_data)} tasks'
            }, status=status.HTTP_200_OK)
    
        except json.JSONDecodeError:
            return Response(
                {'success': False, 'message': 'Invalid JSON format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def export(self, request):
        try:
            format_type = request.query_params.get('format', 'json').lower()
            include_deps = request.query_params.get('include_dependencies', 'true').lower() == 'true'
            
            tasks = self.get_queryset()
            
            if format_type == 'json':
                tasks_data = []
                for task in tasks:
                    task_dict = {
                        'title': task.title,
                        'due_date': str(task.due_date) if task.due_date else None,
                        'estimated_hours': float(task.estimated_hours) if task.estimated_hours else 0,
                        'importance': int(task.importance)
                    }
                    
                    if include_deps:
                        task_dict['dependencies'] = list(
                            task.dependencies.values_list('id', flat=True)
                        )
                    
                    tasks_data.append(task_dict)
                
                return Response({
                    'success': True,
                    'format': 'json',
                    'count': len(tasks_data),
                    'tasks': tasks_data
                }, status=status.HTTP_200_OK)
            
            else:
                return Response(
                    {'success': False, 'message': 'Format not supported'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        try:
            task_ids = request.data.get('task_ids', [])
            
            if not isinstance(task_ids, list) or not task_ids:
                return Response(
                    {'success': False, 'message': 'task_ids must be a non-empty array'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if len(task_ids) > 100:
                return Response(
                    {'success': False, 'message': 'Maximum 100 tasks per bulk delete'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            deleted_count, _ = Task.objects.filter(id__in=task_ids).delete()
            
            return Response({
                'success': True,
                'deleted_count': deleted_count,
                'message': f'Successfully deleted {deleted_count} tasks'
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            traceback.print_exc()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def format_task_for_analysis(task, priority_score, calculator):
        from datetime import datetime, date
        
        due_date = task.due_date
        if isinstance(due_date, str):
            due_date = datetime.strptime(due_date, '%Y-%m-%d').date()
        elif hasattr(due_date, 'date'):
            due_date = due_date.date()
        urgency_info = calculator.get_urgency_info(task)
        
        holiday_info = is_indian_holiday(due_date) if due_date else {'is_holiday': False, 'name': None}
        
        return {
            'id': task.id,
            'title': task.title,
            'due_date': str(due_date) if due_date else None,
            'estimated_hours': float(task.estimated_hours) if task.estimated_hours else 0,
            'importance': task.importance,
            'priority_score': round(priority_score, 2),
            'explanation': generate_explanation(task, priority_score),
            'score_breakdown': {
                'urgency_score': urgency_info.get('urgency_score', 0),
                'importance_score': urgency_info.get('importance_score', 0),
                'efficiency_score': urgency_info.get('efficiency_score', 0),
                'dependency_score': urgency_info.get('dependency_score', 0),
            },
            'business_days_until_due': urgency_info['business_days'],
            'is_holiday': holiday_info['is_holiday'],
            'holiday_name': holiday_info['name'],
            'is_critical': priority_score >= 85,
            'blocked_count': len([t for t in Task.objects.all() if task.id in (t.dependencies.values_list('id', flat=True))]),
            'blocking_count': task.dependencies.count(),
        }