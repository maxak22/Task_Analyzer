from datetime import datetime, timedelta, date
from .holidays import is_indian_holiday, get_urgency_label, calculate_business_days
from .dependencies import DependencyGraph

def check_circular_dependencies(tasks):
    """
    Check if there are any circular dependencies among tasks
    Returns: dict with cycle detection results
    """
    graph = DependencyGraph(tasks)
    cycles = graph.get_all_cycles()
    
    return {
        'has_cycles': len(cycles) > 0,
        'cycle_count': len(cycles),
        'cycles': cycles,
        'affected_task_ids': graph.has_cycle()
    }


def get_task_dependency_info(task, all_tasks):
    """
    Get detailed dependency information for a task
    Returns: dict with blocking and blocked task info
    """
    graph = DependencyGraph(all_tasks)
    
    blocking_ids = graph.get_blocking_tasks(task.id)
    blocked_ids = graph.get_blocked_tasks(task.id)
    
    blocking_tasks = [t for t in all_tasks if t.id in blocking_ids]
    blocked_tasks = [t for t in all_tasks if t.id in blocked_ids]
    
    return {
        'task_id': task.id,
        'task_title': task.title,
        'direct_dependencies': list(task.dependencies.values_list('id', flat=True)),
        'blocking_count': len(blocking_ids),
        'blocked_count': len(blocked_ids),
        'all_blocking_tasks': [{'id': t.id, 'title': t.title} for t in blocking_tasks],
        'all_blocked_tasks': [{'id': t.id, 'title': t.title} for t in blocked_tasks]
    }


def flag_circular_dependencies(tasks):
    """
    Flag tasks that are part of circular dependencies
    Returns: dict mapping task_id to bool (True if in cycle)
    """
    graph = DependencyGraph(tasks)
    cycle_nodes = graph.has_cycle()
    
    flagged = {}
    for task in tasks:
        flagged[task.id] = task.id in cycle_nodes
    
    return flagged


def generate_explanation(task, priority_score):
    """Generate a human-readable explanation for task priority with holiday awareness"""
    explanations = []

    if hasattr(task, 'due_date') and task.due_date:
        try:
            due_date = task.due_date
            if isinstance(due_date, str):
                due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
            else:
                due_date = due_date.date() if hasattr(due_date, 'date') else due_date
            
            today = datetime.now().date()
            days_until = (due_date - today).days
        
            holiday_info = is_indian_holiday(due_date)
            
            if holiday_info['is_holiday']:
                explanations.append(f"🎉 Due on {holiday_info['name']}")
            else:
                explanations.append(get_urgency_label(days_until))
            
            
            business_days = calculate_business_days(today, due_date)
            if business_days is not None:
                explanations.append(f"({business_days} business days)")
        
        except Exception:
            pass
    
  
    if hasattr(task, 'importance'):
        importance = task.importance
        if importance >= 8:
            explanations.append("⭐ High importance")
        elif importance >= 5:
            explanations.append("⭐ Medium importance")
        else:
            explanations.append("⭐ Low importance")
    
    
    if hasattr(task, 'estimated_hours'):
        hours = task.estimated_hours
        if hours <= 1:
            explanations.append("⚡ Quick win")
        elif hours <= 4:
            explanations.append("📌 Medium effort")
        else:
            explanations.append("📊 Time-intensive")
    
    if priority_score >= 80:
        explanations.append("🎯 High priority")
    elif priority_score >= 50:
        explanations.append("🎯 Medium priority")
    else:
        explanations.append("🎯 Low priority")
    
    return " • ".join(explanations)


def validate_task_data(data):
    """Validate task data before creation/update"""
    errors = {}
    
    if 'title' in data:
        if not data['title'] or not isinstance(data['title'], str):
            errors['title'] = 'Title must be a non-empty string'
        elif len(data['title']) > 255:
            errors['title'] = 'Title must be less than 255 characters'
    
    if 'due_date' in data:
        if data['due_date']:
            try:
                if isinstance(data['due_date'], str):
                    datetime.strptime(data['due_date'], '%Y-%m-%d')
            except (ValueError, TypeError):
                errors['due_date'] = 'Due date must be in YYYY-MM-DD format'
    
    if 'estimated_hours' in data:
        try:
            hours = float(data['estimated_hours'])
            if hours < 0:
                errors['estimated_hours'] = 'Estimated hours must be non-negative'
        except (ValueError, TypeError):
            errors['estimated_hours'] = 'Estimated hours must be a number'
    
    if 'importance' in data:
        try:
            importance = int(data['importance'])
            if importance < 1 or importance > 10:
                errors['importance'] = 'Importance must be between 1 and 10'
        except (ValueError, TypeError):
            errors['importance'] = 'Importance must be an integer between 1 and 10'
    
    return errors


def format_task_response(task, priority_score=None, all_tasks=None):
    """Format task data for API response with holiday and dependency info"""
    
    due_date = task.due_date
    response = {
        'id': task.id,
        'title': task.title,
        'due_date': str(due_date) if due_date else None,
        'estimated_hours': float(task.estimated_hours) if task.estimated_hours else 0,
        'importance': task.importance,
        'dependencies': list(task.dependencies.values_list('id', flat=True)),
        'created_at': task.created_at.isoformat() if hasattr(task, 'created_at') else None,
        'updated_at': task.updated_at.isoformat() if hasattr(task, 'updated_at') else None,
    }
    
    if due_date:
        due_date_obj = due_date if isinstance(due_date, date) else due_date.date()
        holiday_info = is_indian_holiday(due_date_obj)
        today = datetime.now().date()
        
        response['is_holiday'] = holiday_info['is_holiday']
        response['holiday_name'] = holiday_info['name']
        response['business_days_until_due'] = calculate_business_days(today, due_date_obj)
    
    if all_tasks:
        dep_info = get_task_dependency_info(task, all_tasks)
        response['blocking_count'] = dep_info['blocking_count']
        response['blocked_count'] = dep_info['blocked_count']
        flagged = flag_circular_dependencies(all_tasks)
        response['is_in_circular_dependency'] = flagged.get(task.id, False)
    
    if priority_score is not None:
        response['priority_score'] = round(priority_score, 2)
        response['explanation'] = generate_explanation(task, priority_score)
    
    return response