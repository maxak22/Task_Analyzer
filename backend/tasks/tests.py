import pytest
from datetime import datetime, date
from django.test import TestCase
from tasks.models import Task
from tasks.scoring import PriorityCalculator

class PriorityCalculatorTestCase(TestCase):
    """Test cases for the PriorityCalculator scoring algorithm"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.calculator = PriorityCalculator(current_date=datetime(2025, 11, 28))
        
   
        self.task1 = Task.objects.create(
            title="Fix login bug",
            due_date=date(2025, 11, 30),
            estimated_hours=3,
            importance=8
        )
        
        self.task2 = Task.objects.create(
            title="Update docs",
            due_date=date(2025, 12, 15),
            estimated_hours=1,
            importance=5
        )
        self.task2.dependencies.add(self.task1)
        
        self.task3 = Task.objects.create(
            title="Design new feature",
            due_date=date(2025, 12, 1),
            estimated_hours=8,
            importance=9
        )
    
    def test_urgency_past_due(self):
        """Test urgency score for past due tasks"""
        past_task = Task.objects.create(
            title="Overdue task",
            due_date=date(2025, 11, 25),
            estimated_hours=2,
            importance=5
        )
        score = self.calculator._calculate_urgency(past_task)
        self.assertEqual(score, 100, "Past due task should have urgency score of 100")
    
    def test_urgency_due_today(self):
        """Test urgency score for tasks due today"""
        today_task = Task.objects.create(
            title="Due today",
            due_date=date(2025, 11, 28),
            estimated_hours=2,
            importance=5
        )
        score = self.calculator._calculate_urgency(today_task)
        self.assertEqual(score, 95, "Task due today should have urgency score of 95")
    
    def test_urgency_due_tomorrow(self):
        """Test urgency score for tasks due tomorrow"""
        tomorrow_task = Task.objects.create(
            title="Due tomorrow",
            due_date=date(2025, 11, 29),
            estimated_hours=2,
            importance=5
        )
        score = self.calculator._calculate_urgency(tomorrow_task)
        self.assertEqual(score, 85, "Task due tomorrow should have urgency score of 85")
    
    def test_importance_calculation(self):
        """Test importance score calculation"""
        score = self.calculator._calculate_importance(self.task1)
        self.assertEqual(score, 80, "Importance 8 should map to score 80")
    
    def test_effort_quick_win(self):
        """Test effort score for quick win tasks (<=1 hour)"""
        quick_task = Task.objects.create(
            title="Quick task",
            due_date=date(2025, 12, 15),
            estimated_hours=0.5,
            importance=3
        )
        score = self.calculator._calculate_effort(quick_task)
        self.assertEqual(score, 100, "Task with 0.5 hours should have effort score of 100")
    
    def test_effort_short_task(self):
        """Test effort score for short tasks (1-2 hours)"""
        short_task = Task.objects.create(
            title="Short task",
            due_date=date(2025, 12, 15),
            estimated_hours=1.5,
            importance=3
        )
        score = self.calculator._calculate_effort(short_task)
        self.assertEqual(score, 80, "Task with 1.5 hours should have effort score of 80")
    
    def test_priority_sorting(self):
        """Test that tasks are sorted by priority correctly"""
        tasks = [self.task1, self.task2, self.task3]
        sorted_tasks = self.calculator.sort_by_priority(tasks)
        
        self.assertEqual(len(sorted_tasks), 3, "Should return 3 tasks")
        self.assertGreaterEqual(sorted_tasks[0][1], sorted_tasks[1][1], 
                               "First task should have higher or equal priority than second")
        self.assertGreaterEqual(sorted_tasks[1][1], sorted_tasks[2][1],
                               "Second task should have higher or equal priority than third")
    
    def test_circular_dependency_detection(self):
        """Test detection of circular dependencies"""
        circular_task1 = Task.objects.create(
            title="Circular 1",
            due_date=date(2025, 12, 1),
            estimated_hours=1,
            importance=5
        )
        circular_task2 = Task.objects.create(
            title="Circular 2",
            due_date=date(2025, 12, 2),
            estimated_hours=1,
            importance=5
        )
        
       
        circular_task1.dependencies.add(circular_task2)
        circular_task2.dependencies.add(circular_task1)
        
        tasks = [circular_task1, circular_task2]
        cycles = self.calculator.detect_circular_dependencies(tasks)
        
        self.assertGreater(len(cycles), 0, "Should detect circular dependency")
        self.assertTrue(any('1' in cycle and '2' in cycle for cycle in cycles),
                       "Cycle should include both tasks")
    
    def test_dependency_impact_score(self):
        """Test dependency impact scoring"""
       
        score = self.calculator._calculate_dependency_impact(self.task1, [self.task1, self.task2])
        self.assertGreater(score, 0, "Task with dependents should have positive dependency score")
    
    def test_get_top_tasks(self):
        """Test getting top N tasks"""
        tasks = [self.task1, self.task2, self.task3]
        top_tasks = self.calculator.get_top_tasks(tasks, count=2)
        
        self.assertEqual(len(top_tasks), 2, "Should return 2 tasks")
    
    def test_priority_score_range(self):
        """Test that priority scores are within valid range (0-100)"""
        tasks = [self.task1, self.task2, self.task3]
        sorted_tasks = self.calculator.sort_by_priority(tasks)
        
        for task, score in sorted_tasks:
            self.assertGreaterEqual(score, 0, f"Score should be >= 0, got {score}")
            self.assertLessEqual(score, 100, f"Score should be <= 100, got {score}")
    
    def test_weight_validation(self):
        """Test that weight validation works"""
        invalid_weights = {
            "urgency": 0.4,
            "importance": 0.3,
            "effort": 0.2,
            "dependencies": 0.2
        }
        
        with self.assertRaises(ValueError):
            PriorityCalculator(weights=invalid_weights)
    
    def test_custom_weights(self):
        """Test calculator with custom weights"""
        custom_weights = {
            "urgency": 0.5,
            "importance": 0.2,
            "effort": 0.15,
            "dependencies": 0.15
        }
        
        calculator = PriorityCalculator(weights=custom_weights)
        self.assertEqual(calculator.weights, custom_weights, "Custom weights should be set")