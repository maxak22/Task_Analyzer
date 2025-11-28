from datetime import datetime, timedelta
from collections import defaultdict, deque


class DependencyGraph:
    """Graph for managing task dependencies"""
    
    def __init__(self):
        self.graph = {}  
        self.reverse_graph = {} 
    
    def build_graph(self, tasks):
        """Build dependency graph from tasks"""
        self.graph = {}
        self.reverse_graph = {}
        
        for task in tasks:
            self.graph[task.id] = []
            self.reverse_graph[task.id] = []
        
        for task in tasks:
            try:
                deps = task.dependencies.all() if hasattr(task.dependencies, 'all') else (task.dependencies or [])
                for dep in deps:
                    dep_id = dep.id if hasattr(dep, 'id') else dep
                    if dep_id not in self.graph[task.id]:
                        self.graph[task.id].append(dep_id)
                    if task.id not in self.reverse_graph.get(dep_id, []):
                        self.reverse_graph[dep_id].append(task.id)
            except:
                pass
    
    def detect_cycles(self, tasks):
        """Detect circular dependencies using DFS"""
        self.build_graph(tasks)
        visited = set()
        rec_stack = set()
        cycles = []
        
        def dfs(node, path):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in self.graph.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor, path[:]):
                        return True
                elif neighbor in rec_stack:
                    # Found a cycle
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)
                    return True
            
            rec_stack.remove(node)
            return False
        
        for task in tasks:
            if task.id not in visited:
                dfs(task.id, [])
        
        return cycles
    
    def get_dependency_info(self, tasks):
        """Get dependency information for all tasks"""
        self.build_graph(tasks)
        info = {}
        
        for task in tasks:
            info[task.id] = {
                'blocked_by': self.graph.get(task.id, []),
                'blocks': self.reverse_graph.get(task.id, []),
                'blocked_count': len(self.graph.get(task.id, [])),
                'blocking_count': len(self.reverse_graph.get(task.id, []))
            }
        
        return info