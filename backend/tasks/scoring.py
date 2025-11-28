from datetime import datetime, timedelta, date
from .dependencies import DependencyGraph
from .holidays import calculate_business_days, is_indian_holiday, is_weekend, get_urgency_label  # Add this import


class PriorityCalculator:
    
    def __init__(self):
        self.graph = DependencyGraph()
    
    def calculate_urgency_score(self, task):
        """Calculate urgency based on due date"""
        if not task.due_date:
            return 20  # Low urgency if no due date
        
        today = datetime.now().date()
        days_until_due = (task.due_date - today).days
        
        if days_until_due < 0:
            return 100  # Overdue
        elif days_until_due == 0:
            return 95  # Due today
        elif days_until_due <= 1:
            return 90  # Due tomorrow
        elif days_until_due <= 3:
            return 80  # Due soon
        elif days_until_due <= 7:
            return 50  # Due within a week
        else:
            return 20  # Due later
    
    def calculate_importance_score(self, task):
        """Importance is directly from task importance (1-10 scale to 0-100)"""
        return task.importance * 10
    
    def calculate_efficiency_score(self, task):
        """Quick tasks are more efficient (inverse of estimated hours)"""
        if task.estimated_hours <= 0:
            return 50  # Medium if no estimate
        elif task.estimated_hours <= 1:
            return 100  # Very quick
        elif task.estimated_hours <= 2:
            return 80  # Quick
        elif task.estimated_hours <= 4:
            return 60  # Medium
        else:
            return 40  # Time consuming
    
    def calculate_dependency_score(self, task, all_tasks=None):
        """
        Tasks with fewer dependencies are better (unblock others faster)
        - No dependencies = high score (100)
        - Many dependencies = lower score
        """
        if not all_tasks:
            all_tasks = []
        
        self.graph.build_graph(all_tasks)
        
        # Count how many tasks depend on this task (blocking_count)
        # The more tasks this unblocks, the higher the score
        dependents = len(self.graph.reverse_graph.get(task.id, []))
        
        # Also consider tasks that block this task
        dependencies = len(self.graph.graph.get(task.id, []))
        
        # Score: tasks that unblock many others get higher scores
        # Formula: (dependents * 50) - (dependencies * 10)
        score = max(0, min(100, (dependents * 40) - (dependencies * 15) + 40))
        
        return score
    
    def get_task_score_breakdown(self, task, tasks=None):
        """Get individual score components"""
        if tasks is None:
            tasks = []
        
        urgency = self.calculate_urgency_score(task)
        importance = self.calculate_importance_score(task)
        efficiency = self.calculate_efficiency_score(task)
        dependency = self.calculate_dependency_score(task, tasks)
        
        return {
            'urgency_score': urgency,
            'importance_score': importance,
            'efficiency_score': efficiency,
            'dependency_score': dependency
        }
    
    def calculate_priority_score(self, task, strategy='smart_balance', all_tasks=None):
        """
        Calculate final priority score based on strategy
        """
        if all_tasks is None:
            all_tasks = []
        
        urgency = self.calculate_urgency_score(task)
        importance = self.calculate_importance_score(task)
        efficiency = self.calculate_efficiency_score(task)
        dependency = self.calculate_dependency_score(task, all_tasks)
        
        if strategy == 'smart_balance':
            # Balanced approach
            score = (urgency * 0.25) + (importance * 0.35) + (efficiency * 0.25) + (dependency * 0.15)
        
        elif strategy == 'fastest_wins':
            # Prioritize quick, important tasks
            score = (efficiency * 0.40) + (importance * 0.35) + (urgency * 0.15) + (dependency * 0.10)
        
        elif strategy == 'high_impact':
            # Prioritize important tasks that unblock others
            score = (importance * 0.45) + (dependency * 0.25) + (urgency * 0.20) + (efficiency * 0.10)
        
        elif strategy == 'deadline_driven':
            # Prioritize by deadline
            score = (urgency * 0.50) + (importance * 0.25) + (dependency * 0.15) + (efficiency * 0.10)
        
        else:
            score = (urgency * 0.25) + (importance * 0.35) + (efficiency * 0.25) + (dependency * 0.15)
        
        return max(0, min(100, score))
    
    def sort_by_strategy(self, tasks, strategy='smart_balance'):
        """Sort tasks by priority score"""
        scored_tasks = []
        
        for task in tasks:
            score = self.calculate_priority_score(task, strategy, all_tasks=tasks)
            scored_tasks.append((task, score))
        
        # Sort by score descending (highest priority first)
        scored_tasks.sort(key=lambda x: x[1], reverse=True)
        
        return scored_tasks
    
    def detect_circular_dependencies(self, tasks):
        """Detect circular dependencies"""
        self.graph.build_graph(tasks)
        cycles = self.graph.detect_cycles(tasks)
        
        if cycles:
            cycle_strings = []
            for cycle in cycles:
                task_ids = cycle[:-1]  # Remove last item (duplicate)
                task_titles = []
                for task_id in task_ids:
                    task = next((t for t in tasks if t.id == task_id), None)
                    if task:
                        task_titles.append(task.title)
                if task_titles:
                    cycle_strings.append(' → '.join(task_titles))
            return cycle_strings
        
        return None
    
    def get_business_days_until(self, due_date):
        """Calculate business days until due date (excluding weekends and Indian holidays)"""
        if not due_date:
            return None
        
        today = datetime.now().date()
        
        if due_date < today:
            return 0
        
        # Use the new function from holidays.py
        business_days = calculate_business_days(today, due_date)
        
        return business_days
    
    def get_urgency_info(self, task):
        """Get urgency information including holidays"""
        if not task.due_date:
            return {
                'days_until': None,
                'business_days': None,
                'label': '📆 DUE LATER',
                'is_holiday': False,
                'holiday_name': None
            }
        
        today = datetime.now().date()
        due_date = task.due_date if isinstance(task.due_date, date) else task.due_date.date()
        
        days_until = (due_date - today).days
        business_days = self.get_business_days_until(due_date)
        holiday_info = is_indian_holiday(due_date)
        
        return {
            'days_until': days_until,
            'business_days': business_days,
            'label': get_urgency_label(days_until),
            'is_holiday': holiday_info['is_holiday'],
            'holiday_name': holiday_info['name']
        }