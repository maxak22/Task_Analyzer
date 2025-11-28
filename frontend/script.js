const API_URL = 'http://localhost:8000/api/tasks/';
let allTasks = [];

async function loadTasks() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to load tasks');
        
        const data = await response.json();
        
        if (data.results) {
            allTasks = data.results;  
        } else if (Array.isArray(data)) {
            allTasks = data; 
        } else {
            throw new Error('Unexpected response format');
        }
        
        displayTasksList();
        updateDependenciesSelect();
        updateAnalyzeButton();
    } catch (error) {
        console.error('Error loading tasks:', error);
        showError('Failed to load tasks');
    }
}

function displayTasksList() {
    const tasksList = document.getElementById('tasksList');
    
    if (!allTasks || allTasks.length === 0) {
        tasksList.innerHTML = '<div class="empty-state">📭 No tasks yet. Add one to get started!</div>';
        document.getElementById('taskCount').textContent = '0';
        return;
    }
    
    document.getElementById('taskCount').textContent = allTasks.length;
    
    tasksList.innerHTML = allTasks.map(task => {
        const dependsOn = task.dependencies && task.dependencies.length > 0
            ? allTasks.filter(t => task.dependencies.includes(t.id))
            : [];
        
        const blockedBy = allTasks.filter(t => 
            t.dependencies && t.dependencies.includes(task.id)
        );
        
        let dependencyInfo = '';
        
        if (dependsOn.length > 0) {
            dependencyInfo += `
                <div class="dependency-info blocked">
                    <strong>⛓️ Blocked by:</strong>
                    <div class="dependency-list">
                        ${dependsOn.map(t => `<span class="dep-tag">${t.title}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (blockedBy.length > 0) {
            dependencyInfo += `
                <div class="dependency-info blocking">
                    <strong>🔗 Blocks:</strong>
                    <div class="dependency-list">
                        ${blockedBy.map(t => `<span class="dep-tag">${t.title}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="task-item" data-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${task.title}</h3>
                    <button class="btn-delete" onclick="deleteTask(${task.id})" title="Delete task">🗑️</button>
                </div>
                <div class="task-meta">
                    ${task.due_date ? `<span>📅 ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                    ${task.estimated_hours ? `<span>⏱️ ${task.estimated_hours}h</span>` : ''}
                    <span>⭐ ${task.importance}/10</span>
                </div>
                ${dependencyInfo}
            </div>
        `;
    }).join('');
}

function updateDependenciesSelect() {
    const container = document.getElementById('dependenciesContainer');
    container.innerHTML = '';
    
    if (!allTasks || allTasks.length === 0) {
        container.innerHTML = '<div class="dependencies-empty">📭 Add at least one task first</div>';
        displaySelectedDependencies([]);
        return;
    }
    
    allTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'dependency-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `dep-${task.id}`;
        checkbox.value = task.id;
        checkbox.className = 'dependency-input';
        checkbox.addEventListener('change', () => {
            displaySelectedDependencies(getDependencies());
        });
        
        const label = document.createElement('label');
        label.htmlFor = `dep-${task.id}`;
        label.textContent = task.title;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
    
    displaySelectedDependencies(getDependencies());
}

function getDependencies() {
    const checkboxes = document.querySelectorAll('.dependency-input:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function displaySelectedDependencies(depIds) {
    const selectedDiv = document.getElementById('selectedDeps');
    
    if (!depIds || depIds.length === 0) {
        selectedDiv.innerHTML = '';
        return;
    }
    
    let html = '<div class="selected-dependencies-label">✅ Selected dependencies:</div>';
    html += '<div>';
    
    depIds.forEach(depId => {
        const task = allTasks.find(t => t.id === depId);
        if (task) {
            html += `
                <div class="dep-badge">
                    ${task.title}
                    <button type="button" onclick="removeDependency(${depId})" title="Remove">✕</button>
                </div>
            `;
        }
    });
    
    html += '</div>';
    selectedDiv.innerHTML = html;
}

function removeDependency(depId) {
    const checkbox = document.getElementById(`dep-${depId}`);
    if (checkbox) {
        checkbox.checked = false;
        displaySelectedDependencies(getDependencies());
    }
}

async function createTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value.trim();
    const dueDate = document.getElementById('dueDate').value;
    const effort = document.getElementById('effort').value;
    const importance = document.getElementById('importance').value;
    const dependencies = getDependencies();
    
    if (!title) {
        showError('❌ Please enter a task title');
        return;
    }
    
    showLoader(true);
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                due_date: dueDate || null,
                estimated_hours: effort ? parseFloat(effort) : 0,
                importance: parseInt(importance),
                dependencies: dependencies
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.title ? error.title[0] : 'Failed to create task');
        }
        
        document.getElementById('taskForm').reset();
        document.getElementById('importance').value = '5';
        await loadTasks();
        showSuccess('✅ Task added successfully!');
    } catch (error) {
        console.error('Error creating task:', error);
        showError(`❌ Failed to create task: ${error.message}`);
    } finally {
        showLoader(false);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    showLoader(true);
    
    try {
        const response = await fetch(`${API_URL}${id}/`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
        await loadTasks();
        showSuccess('✅ Task deleted successfully');
    } catch (error) {
        console.error('Error deleting task:', error);
        showError('❌ Failed to delete task');
    } finally {
        showLoader(false);
    }
}

async function checkForCircularDependencies() {
    try {
        const response = await fetch(`${API_URL}check_cycles/`);
        const data = await response.json();
        
        if (data.has_cycles) {
            showCircularDependencyAlert(data);
            return false; 
        }
        return true; 
    } catch (error) {
        console.error('Error checking cycles:', error);
        return true; 
    }
}

function showCircularDependencyAlert(cycleData) {
    const alertContainer = document.createElement('div');
    alertContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee2e2;
        border: 2px solid #dc2626;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    `;
    
    let cycleHtml = `
        <div style="color: #7f1d1d;">
            <h3 style="margin: 0 0 12px 0; color: #dc2626;">
                🚨 Circular Dependencies Detected!
            </h3>
            <p style="margin: 8px 0; font-weight: 600;">
                Found ${cycleData.cycle_count} cycle(s) involving ${cycleData.affected_tasks.length} task(s)
            </p>
    `;
    
    cycleData.cycles.forEach((cycle, index) => {
        cycleHtml += `
            <div style="margin: 10px 0; padding: 8px; background: rgba(255,0,0,0.05); border-radius: 4px; font-size: 0.9em;">
                <strong>Cycle ${index + 1}:</strong><br>
                ${cycle.tasks.join(' → ')}
            </div>
        `;
    });
    
    cycleHtml += `
        <p style="margin: 12px 0 0 0; font-size: 0.85em; color: #991b1b;">
            ⚠️ Please resolve these circular dependencies before analyzing tasks.
        </p>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="margin-top: 10px; padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Dismiss
        </button>
    `;
    
    alertContainer.innerHTML = cycleHtml;
    document.body.appendChild(alertContainer);
    setTimeout(() => {
        if (alertContainer.parentElement) {
            alertContainer.remove();
        }
    }, 8000);
}

function flagTasksWithCircularDependencies(results) {
    if (results.circular_dependencies) {
        const taskCards = document.querySelectorAll('.result-card');
        taskCards.forEach((card, index) => {
            const taskId = results.tasks[index].id;
            if (results.circular_dependencies[taskId]) {
                card.style.borderLeftColor = '#dc2626';
                card.style.background = '#fef2f2';
                
                const header = card.querySelector('.result-header');
                const alert = document.createElement('div');
                alert.style.cssText = `
                    display: inline-block;
                    background: #fca5a5;
                    color: #991b1b;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.85em;
                    font-weight: 600;
                    margin-left: 8px;
                `;
                alert.textContent = '⚠️ CIRCULAR';
                header.appendChild(alert);
            }
        });
    }
}

async function analyzeTasks(e) {
    e.preventDefault();
    const strategySelect = document.getElementById('strategySelect') || document.getElementById('strategy');
    
    if (!strategySelect) {
        showError('❌ Strategy selector not found. Check your HTML.');
        console.error('Strategy select element not found. Looking for #strategySelect or #strategy');
        return;
    }
    
    const strategy = strategySelect.value || 'smart_balance';
    const resultsDiv = document.getElementById('results');
    
    if (!resultsDiv) {
        showError('❌ Results container not found. Check your HTML.');
        return;
    }
    
    resultsDiv.innerHTML = '<div class="loading">🔄 Checking for circular dependencies...</div>';
    
    try {
        const hasCycles = await checkForCircularDependencies();
        
        if (!hasCycles) {
            resultsDiv.innerHTML = '<div style="color: #dc2626; padding: 20px; text-align: center;">❌ Cannot analyze tasks with circular dependencies. Please fix them first.</div>';
            return;
        }
        
        resultsDiv.innerHTML = '<div class="loading">⏳ Analyzing tasks...</div>';
        const response = await fetch(`${API_URL}analyze/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategy })
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Analysis failed');
        }
        
        displayResults(data);
        flagTasksWithCircularDependencies(data);
        
    } catch (error) {
        console.error('Error analyzing tasks:', error);
        resultsDiv.innerHTML = `<div style="color: #dc2626; padding: 20px;">❌ ${error.message}</div>`;
    }
}

function getIndianHolidaysForYear(year) {
    return [
        { date: new Date(year, 0, 26), name: 'Republic Day', emoji: '🇮🇳' },
        { date: new Date(year, 2, 8), name: 'Maha Shivaratri', emoji: '🙏' },
        { date: new Date(year, 2, 25), name: 'Holi', emoji: '🎨' },
        { date: new Date(year, 2, 29), name: 'Good Friday', emoji: '✝️' },
        { date: new Date(year, 3, 17), name: 'Ram Navami', emoji: '🙏' },
        { date: new Date(year, 3, 21), name: 'Mahavir Jayanti', emoji: '🙏' },
        { date: new Date(year, 4, 1), name: 'May Day', emoji: '💼' },
        { date: new Date(year, 4, 23), name: 'Buddha Purnima', emoji: '🧘' },
        { date: new Date(year, 5, 28), name: 'Eid ul-Fitr', emoji: '🌙' },
        { date: new Date(year, 6, 17), name: 'Muharram', emoji: '🌙' },
        { date: new Date(year, 7, 15), name: 'Independence Day', emoji: '🇮🇳' },
        { date: new Date(year, 8, 16), name: 'Milad un-Nabi', emoji: '🌙' },
        { date: new Date(year, 9, 2), name: 'Gandhi Jayanti', emoji: '🕯️' },
        { date: new Date(year, 9, 12), name: 'Dussehra', emoji: '🎉' },
        { date: new Date(year, 9, 20), name: 'Diwali', emoji: '🪔' },
        { date: new Date(year, 10, 1), name: 'Diwali (Day 2)', emoji: '🪔' },
        { date: new Date(year, 10, 15), name: 'Guru Nanak Jayanti', emoji: '🙏' },
        { date: new Date(year, 11, 25), name: 'Christmas', emoji: '🎄' },
    ];
}

function isIndianHoliday(date) {
    const holidays = getIndianHolidaysForYear(date.getFullYear());
    const holidayInfo = holidays.find(holiday => 
        holiday.date.getDate() === date.getDate() &&
        holiday.date.getMonth() === date.getMonth() &&
        holiday.date.getFullYear() === date.getFullYear()
    );
    return holidayInfo || null;
}

function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

function calculateSmartBusinessDays(dueDate) {
    if (!dueDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    if (due < today) return 0;
    
    let businessDays = 0;
    let currentDate = new Date(today);
    
    while (currentDate < due) {
        const holiday = isIndianHoliday(currentDate);
        if (!isWeekend(currentDate) && !holiday) {
            businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return businessDays;
}

function getUrgencyLabel(daysUntilDue) {
    if (daysUntilDue < 0) return '🚨 OVERDUE';
    if (daysUntilDue === 0) return '⏰ DUE TODAY';
    if (daysUntilDue === 1) return '📍 DUE TOMORROW';
    if (daysUntilDue <= 3) return '⚡ DUE SOON';
    if (daysUntilDue <= 7) return '📅 DUE THIS WEEK';
    return '📆 DUE LATER';
}

function formatDateWithContext(date) {
    if (!date) return 'No deadline';
    
    const due = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const daysUntilDue = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    const businessDaysUntilDue = calculateSmartBusinessDays(date);
    
    const dateStr = due.toLocaleDateString('en-IN', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    const holiday = isIndianHoliday(due);
    let contextStr = '';
    
    if (holiday) {
        contextStr = ` (${holiday.emoji} ${holiday.name})`;
    } else if (businessDaysUntilDue !== null) {
        contextStr = ` (${businessDaysUntilDue} business days)`;
    }
    
    const label = getUrgencyLabel(daysUntilDue);
    
    return `${dateStr} ${label} ${contextStr}`;
}


function drawArrow(svg, from, to, color, width) {
    if (!from || !to || isNaN(from.x) || isNaN(from.y) || isNaN(to.x) || isNaN(to.y)) {
        console.warn('Invalid arrow coordinates:', from, to);
        return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;
    const startX = from.x + (dx / distance) * 40;
    const startY = from.y + (dy / distance) * 40;
    const endX = to.x - (dx / distance) * 40;
    const endY = to.y - (dy / distance) * 40;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const controlX = midX + dy * 0.1;
    const controlY = midY - dx * 0.1;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('opacity', '0.6');
    
    svg.appendChild(path);
}

function calculateForceDirectedLayout(tasks) {
    if (tasks.length === 0) return {};
    
    const positions = {};
    const velocity = {};
    const width = 900;
    const height = 450;
    const padding = 50;
    
    tasks.forEach((task) => {
        positions[task.id] = {
            x: padding + 50 + Math.random() * (width - 2 * padding - 100),
            y: padding + 50 + Math.random() * (height - 2 * padding - 100)
        };
        velocity[task.id] = { x: 0, y: 0 };
    });
    
   
    const iterations = 50;
    const k = 100; 
    const c = 0.5; 
    const repelForce = 500;
    
    for (let iter = 0; iter < iterations; iter++) {
        tasks.forEach((task) => {
            velocity[task.id] = { x: 0, y: 0 };
        });
        
        for (let i = 0; i < tasks.length; i++) {
            for (let j = i + 1; j < tasks.length; j++) {
                const task1 = tasks[i];
                const task2 = tasks[j];
                
                const dx = positions[task2.id].x - positions[task1.id].x;
                const dy = positions[task2.id].y - positions[task1.id].y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 1) dist = 1;
                
                const force = repelForce / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                velocity[task1.id].x -= fx;
                velocity[task1.id].y -= fy;
                velocity[task2.id].x += fx;
                velocity[task2.id].y += fy;
            }
        }
        
        tasks.forEach((task) => {
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies.forEach(depId => {
                    const source = tasks.find(t => t.id === depId);
                    if (source && positions[depId]) {
                        const dx = positions[depId].x - positions[task.id].x;
                        const dy = positions[depId].y - positions[task.id].y;
                        let dist = Math.sqrt(dx * dx + dy * dy);
                    
                        if (dist < 1) dist = 1;
                        
                        const force = (dist * dist) / k;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        
                        velocity[task.id].x += fx;
                        velocity[task.id].y += fy;
                        velocity[depId].x -= fx;
                        velocity[depId].y -= fy;
                    }
                });
            }
        });
        
        tasks.forEach((task) => {
            velocity[task.id].x *= c;
            velocity[task.id].y *= c;
            
            positions[task.id].x += velocity[task.id].x;
            positions[task.id].y += velocity[task.id].y;
            
           
            positions[task.id].x = Math.max(padding + 40, Math.min(width - padding - 40, positions[task.id].x));
            positions[task.id].y = Math.max(padding + 40, Math.min(height - padding - 40, positions[task.id].y));
            
            
            if (isNaN(positions[task.id].x)) positions[task.id].x = width / 2;
            if (isNaN(positions[task.id].y)) positions[task.id].y = height / 2;
        });
    }
    
    return positions;
}

function visualizeDependencyGraph(tasks) {
    
    if (!tasks || tasks.length === 0) {
        const container = document.createElement('div');
        container.innerHTML = '<p style="text-align: center; color: #999;">No tasks with dependencies to visualize</p>';
        return container;
    }
    
    const container = document.createElement('div');
    container.id = 'graphContainer';
    container.style.cssText = `
        margin: 20px 0;
        padding: 20px;
        background: linear-gradient(135deg, #f0f4ff 0%, #fff7ed 100%);
        border-radius: 8px;
        border: 2px solid #e5e7eb;
    `;
    

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '500');
    svg.setAttribute('viewBox', '0 0 1000 500');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('style', 'background: white; border-radius: 6px; border: 1px solid #d1d5db;');
    
    const title = document.createElement('h3');
    title.textContent = '📊 Task Dependency Map';
    title.style.cssText = 'margin: 0 0 15px 0; color: #1f2937; font-size: 1.1em;';
    
    container.appendChild(title);
    container.appendChild(svg);
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('fill', '#94a3b8');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
    
    const positions = calculateForceDirectedLayout(tasks);
    
    
    const validTasks = tasks.filter(task => positions[task.id] && !isNaN(positions[task.id].x) && !isNaN(positions[task.id].y));
    
    if (validTasks.length === 0) {
        svg.innerHTML = '<text x="500" y="250" text-anchor="middle" fill="#999">Unable to calculate positions</text>';
        return container;
    }
    
    
    validTasks.forEach((task) => {
        if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
                const source = validTasks.find(t => t.id === depId);
                if (source && positions[task.id] && positions[depId]) {
                    try {
                        drawArrow(svg, positions[depId], positions[task.id], '#cbd5e1', 2);
                    } catch (e) {
                        console.warn('Error drawing arrow:', e);
                    }
                }
            });
        }
    });
    

    validTasks.forEach((task) => {
        if (positions[task.id]) {
            const isInCycle = detectCycleForTask(task, validTasks);
            drawNode(svg, task, positions[task.id].x, positions[task.id].y, 40, isInCycle);
        }
    });
    
    return container;
}

function drawNode(svg, task, x, y, radius, isInCycle) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    const shadowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    shadowCircle.setAttribute('cx', x + 2);
    shadowCircle.setAttribute('cy', y + 2);
    shadowCircle.setAttribute('r', radius);
    shadowCircle.setAttribute('fill', 'rgba(0, 0, 0, 0.1)');
    svg.appendChild(shadowCircle);
    
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', isInCycle ? '#fee2e2' : '#667eea');
    circle.setAttribute('stroke', isInCycle ? '#dc2626' : '#4f46e5');
    circle.setAttribute('stroke-width', isInCycle ? '3' : '2');
    circle.setAttribute('style', 'cursor: pointer; transition: all 0.3s;');
    
    circle.addEventListener('mouseover', () => {
        circle.setAttribute('r', radius + 8);
        circle.setAttribute('stroke-width', isInCycle ? '4' : '3');
        circle.setAttribute('filter', 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))');
    });
    
    circle.addEventListener('mouseout', () => {
        circle.setAttribute('r', radius);
        circle.setAttribute('stroke-width', isInCycle ? '3' : '2');
        circle.setAttribute('filter', 'none');
    });
    
    
    const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    textBg.setAttribute('x', x - radius + 5);
    textBg.setAttribute('y', y - 12);
    textBg.setAttribute('width', 2 * radius - 10);
    textBg.setAttribute('height', 24);
    textBg.setAttribute('rx', '4');
    textBg.setAttribute('fill', isInCycle ? '#fecaca' : 'rgba(255, 255, 255, 0.2)');
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 6);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', isInCycle ? '#dc2626' : 'white');
    
    const title = task.title.length > 14 ? task.title.substring(0, 14) + '...' : task.title;
    text.textContent = title;
 
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    tooltip.textContent = task.title + (isInCycle ? ' ⚠️ CIRCULAR DEPENDENCY' : '');
    group.appendChild(tooltip);
    
    group.appendChild(circle);
    group.appendChild(textBg);
    group.appendChild(text);
    svg.appendChild(group);
}

function calculateTaskDepth(tasks) {
    const depths = {};
    
    function getDepth(taskId, visited = new Set()) {
        if (visited.has(taskId)) return 0;
        if (depths[taskId] !== undefined) return depths[taskId];
        
        visited.add(taskId);
        const task = tasks.find(t => t.id === taskId);
        
        if (!task || !task.dependencies || task.dependencies.length === 0) {
            depths[taskId] = 0;
            return 0;
        }
        
        const maxDepth = Math.max(
            ...task.dependencies.map(depId => getDepth(depId, new Set(visited)))
        );
        depths[taskId] = maxDepth + 1;
        return depths[taskId];
    }
    
    tasks.forEach(task => getDepth(task.id));
    return depths;
}

function detectCycleForTask(task, allTasks) {
    const visited = new Set();
    const recursionStack = new Set();
    
    function hasCycle(taskId) {
        visited.add(taskId);
        recursionStack.add(taskId);
        
        const currentTask = allTasks.find(t => t.id === taskId);
        if (currentTask && currentTask.dependencies) {
            for (const depId of currentTask.dependencies) {
                if (!visited.has(depId)) {
                    if (hasCycle(depId)) return true;
                } else if (recursionStack.has(depId)) {
                    return true;
                }
            }
        }
        
        recursionStack.delete(taskId);
        return false;
    }
    
    return hasCycle(task.id);
}


function displayResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsDiv = document.getElementById('results');
    
    const strategyNames = {
        'smart_balance': '⚖️ Smart Balance',
        'fastest_wins': '⚡ Fastest Wins',
        'high_impact': '💎 High Impact',
        'deadline_driven': '📅 Deadline Driven'
    };
    
    let resultsHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f0f4ff; border-radius: 8px;">
            <strong>${strategyNames[result.strategy] || 'Analysis Results'}</strong> • ${result.count} tasks analyzed
        </div>
    `;
    
    resultsHTML += result.tasks.map((task, index) => {
        const scoreColor = getColorByScore(task.priority_score);
        const breakdown = task.score_breakdown || {};
        
        let dependencyHTML = '';
        
        if (task.blocked_count > 0) {
            dependencyHTML += `
                <div class="result-dependency blocked">
                    <strong>⛓️ Blocked by ${task.blocked_count} task(s)</strong>
                </div>
            `;
        }
        
        if (task.blocking_count > 0) {
            dependencyHTML += `
                <div class="result-dependency blocking">
                    <strong>🔗 Blocks ${task.blocking_count} task(s)</strong>
                </div>
            `;
        }
        
        return `
            <div class="result-card" style="border-left-color: ${scoreColor}">
                <div class="result-header">
                    <span class="rank">#${index + 1}</span>
                    <h3>${task.title}</h3>
                    <span class="score">${task.priority_score.toFixed(1)}/100</span>
                </div>
                
                <div class="result-explanation">
                    ${task.explanation || 'Task analysis complete'}
                </div>
                
                <div class="result-meta">
                    ${task.due_date ? `<span>📅 ${formatDateWithContext(task.due_date)}</span>` : ''}
                    ${task.estimated_hours ? `<span>⏱️ ${task.estimated_hours}h</span>` : ''}
                    <span>⭐ ${task.importance}/10</span>
                    ${task.is_critical ? `<span class="badge critical-badge">🚨 Critical</span>` : ''}
                </div>
                
                ${dependencyHTML}
                
                <div class="score-breakdown">
                    <div class="score-item">
                        <span>Urgency:</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, breakdown.urgency_score || 0)}%; background: linear-gradient(90deg, #ef4444, #dc2626);"></div>
                        </div>
                        <span>${(breakdown.urgency_score || 0).toFixed(0)}</span>
                    </div>
                    <div class="score-item">
                        <span>Importance:</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, breakdown.importance_score || 0)}%; background: linear-gradient(90deg, #f59e0b, #f97316);"></div>
                        </div>
                        <span>${(breakdown.importance_score || 0).toFixed(0)}</span>
                    </div>
                    <div class="score-item">
                        <span>Efficiency:</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, breakdown.efficiency_score || 0)}%; background: linear-gradient(90deg, #10b981, #059669);"></div>
                        </div>
                        <span>${(breakdown.efficiency_score || 0).toFixed(0)}</span>
                    </div>
                    <div class="score-item">
                        <span>Dependencies:</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(100, breakdown.dependency_score || 0)}%; background: linear-gradient(90deg, #8b5cf6, #6d28d9);"></div>
                        </div>
                        <span>${(breakdown.dependency_score || 0).toFixed(0)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsDiv.innerHTML = resultsHTML;
    

    const graphContainer = visualizeDependencyGraph(result.tasks);
    resultsDiv.appendChild(graphContainer);
    
    const holidayInfo = getHolidayInfo(result.tasks);
    if (holidayInfo) {
        resultsDiv.appendChild(holidayInfo);
    }
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function getHolidayInfo(tasks) {
    const holidays = [];
    
    tasks.forEach(task => {
        if (task.due_date) {
            const due = new Date(task.due_date);
            const holiday = isIndianHoliday(due);
            if (holiday) {
                holidays.push({
                    task: task.title,
                    holiday: holiday.name,
                    emoji: holiday.emoji,
                    date: due.toLocaleDateString('en-IN')
                });
            }
        }
    });
    
    if (holidays.length === 0) return null;
    
    const container = document.createElement('div');
    container.style.cssText = `
        margin: 20px 0;
        padding: 15px;
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        border-radius: 6px;
    `;
    
    const title = document.createElement('h4');
    title.textContent = '🎉 Holiday Alerts - Indian Festivals';
    title.style.margin = '0 0 10px 0';
    
    const list = document.createElement('ul');
    list.style.margin = '0';
    
    holidays.forEach(h => {
        const li = document.createElement('li');
        li.textContent = `${h.emoji} ${h.task} is due on ${h.date} (${h.holiday})`;
        list.appendChild(li);
    });
    
    container.appendChild(title);
    container.appendChild(list);
    
    return container;
}

function getColorByScore(score) {
    if (score >= 80) return '#ef4444';  
    if (score >= 60) return '#f97316';  
    if (score >= 40) return '#eab308';  
    return '#10b981';                   
}

function updateAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = !allTasks || allTasks.length === 0;
    btn.textContent = (!allTasks || allTasks.length === 0) ? '➕ Add tasks first' : '🚀 Analyze Tasks';
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    
    console.error(message);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showSuccess(message) {
    
    const toast = document.createElement('div');
    toast.className = 'toast success-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

document.getElementById('taskForm').addEventListener('submit', createTask);

const analyzeBtn = document.getElementById('analyzeBtn');
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzeTasks);
}

const strategySelectElement = document.getElementById('strategySelect') || document.getElementById('strategy');
if (strategySelectElement) {
    strategySelectElement.addEventListener('change', (e) => {
        const descriptions = {
            'smart_balance': '⚖️ Balances urgency, importance, and efficiency. Best overall approach.',
            'fastest_wins': '⚡ Prioritizes quick wins with high impact. Do easy important tasks first.',
            'high_impact': '💎 Focuses on most important tasks regardless of time. High value first.',
            'deadline_driven': '📅 Sort by deadline first. Time-sensitive tasks first.'
        };
        const descDiv = document.getElementById('strategyDescription');
        if (descDiv) {
            descDiv.textContent = descriptions[e.target.value] || '';
        }
    });
}
const importanceSlider = document.getElementById('importance');
if (importanceSlider) {
    importanceSlider.addEventListener('input', (e) => {
        const valueDisplay = document.getElementById('importanceValue');
        if (valueDisplay) {
            valueDisplay.textContent = e.target.value;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    console.log('🎯 Task Analyzer loaded');
    
    const requiredElements = ['taskForm', 'analyzeBtn', 'strategySelect', 'results', 'tasksList', 'title', 'dueDate', 'effort', 'importance'];
    const missing = requiredElements.filter(id => !document.getElementById(id));
    
    if (missing.length > 0) {
        console.warn('⚠️ Missing HTML elements:', missing);
        console.warn('Make sure your HTML has these IDs:', missing.join(', '));
    }
});
async function validateAndImportTasks() {
    const jsonInput = document.getElementById('bulkImportJson').value.trim();
    const statusDiv = document.getElementById('bulkImportStatus');
    
    if (!jsonInput) {
        showError('❌ Please paste JSON array of tasks');
        return;
    }
    
    try {
        let tasksData;
        try {
            tasksData = JSON.parse(jsonInput);
        } catch (e) {
            statusDiv.className = 'bulk-import-status show import-error';
            statusDiv.innerHTML = `
                <h4>❌ JSON Parse Error</h4>
                <div class="status-item status-error">${e.message}</div>
                <p>Make sure your JSON is properly formatted</p>
            `;
            return;
        }
        
        if (!Array.isArray(tasksData)) {
            statusDiv.className = 'bulk-import-status show import-error';
            statusDiv.innerHTML = `
                <h4>❌ Invalid Format</h4>
                <div class="status-item status-error">Root must be an array of tasks</div>
            `;
            return;
        }
        
        if (tasksData.length === 0) {
            statusDiv.className = 'bulk-import-status show import-error';
            statusDiv.innerHTML = `
                <h4>❌ Empty Array</h4>
                <div class="status-item status-error">Please provide at least one task</div>
            `;
            return;
        }
        
        if (tasksData.length > 100) {
            statusDiv.className = 'bulk-import-status show import-error';
            statusDiv.innerHTML = `
                <h4>❌ Too Many Tasks</h4>
                <div class="status-item status-error">Maximum 100 tasks per import (you provided ${tasksData.length})</div>
            `;
            return;
        }
        
        showLoader(true);
        statusDiv.innerHTML = '<div class="loading">🔄 Importing tasks...</div>';
        statusDiv.className = 'bulk-import-status show';
        
        const response = await fetch(`${API_URL}bulk_import/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: tasksData })
        });
        
        const result = await response.json();
        showLoader(false);
        
        if (!response.ok) {
            statusDiv.className = 'bulk-import-status show import-error';
            statusDiv.innerHTML = `
                <h4>❌ Import Failed</h4>
                <div class="status-item status-error">${result.message || result.error}</div>
            `;
            showError(`❌ Import failed: ${result.message || result.error}`);
            return;
        }
        
        let html = `<h4>✅ Import Successful</h4>`;
        html += `<div class="status-item status-success">✓ Created ${result.created_count} of ${tasksData.length} tasks</div>`;
        
        if (result.created_tasks && result.created_tasks.length > 0) {
            html += '<div style="margin-top: 10px;"><strong>Created tasks:</strong><ul style="margin: 5px 0 0 20px;">';
            result.created_tasks.slice(0, 5).forEach(task => {
                html += `<li>${task.title}</li>`;
            });
            if (result.created_tasks.length > 5) {
                html += `<li>... and ${result.created_tasks.length - 5} more</li>`;
            }
            html += '</ul></div>';
        }
        
        if (result.failed_tasks && result.failed_tasks.length > 0) {
            statusDiv.className = 'bulk-import-status show import-warning';
            html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.1);"><strong>⚠️ Failed to import:</strong><ul style="margin: 5px 0 0 20px;">';
            result.failed_tasks.slice(0, 3).forEach(failed => {
                html += `<li>"${failed.title}" (Row ${failed.index + 1}): ${failed.error}</li>`;
            });
            if (result.failed_tasks.length > 3) {
                html += `<li>... and ${result.failed_tasks.length - 3} more failures</li>`;
            }
            html += '</ul></div>';
        } else {
            statusDiv.className = 'bulk-import-status show import-success';
        }
        
        statusDiv.innerHTML = html;
        
        document.getElementById('bulkImportJson').value = '';
        await loadTasks();
        
        showSuccess(`✅ Successfully imported ${result.created_count} tasks!`);
        
    } catch (error) {
        showLoader(false);
        statusDiv.className = 'bulk-import-status show import-error';
        statusDiv.innerHTML = `
            <h4>❌ Error</h4>
            <div class="status-item status-error">${error.message}</div>
        `;
        showError(`❌ Import error: ${error.message}`);
    }
}

function loadTemplateExample() {
    const template = [
        {
            "title": "Research Project Requirements",
            "due_date": "2025-12-15",
            "estimated_hours": 4,
            "importance": 8
        },
        {
            "title": "Design System Architecture",
            "due_date": "2025-12-22",
            "estimated_hours": 8,
            "importance": 9,
            "dependencies": []
        },
        {
            "title": "Implement Database Schema",
            "due_date": "2026-01-05",
            "estimated_hours": 12,
            "importance": 9
        },
        {
            "title": "Build REST API",
            "due_date": "2026-01-15",
            "estimated_hours": 16,
            "importance": 9
        },
        {
            "title": "Create Frontend UI",
            "due_date": "2026-01-20",
            "estimated_hours": 20,
            "importance": 8
        },
        {
            "title": "Write Unit Tests",
            "due_date": "2026-01-25",
            "estimated_hours": 10,
            "importance": 7
        },
        {
            "title": "Deploy to Production",
            "due_date": "2026-02-01",
            "estimated_hours": 3,
            "importance": 10
        }
    ];
    
    document.getElementById('bulkImportJson').value = JSON.stringify(template, null, 2);
    showSuccess('📋 Example template loaded');
}

async function exportAllTasks() {
    try {
        showLoader(true);
        
        const response = await fetch(`${API_URL}export/?format=json&include_dependencies=true`);
        const result = await response.json();
        
        showLoader(false);
        
        if (!response.ok) {
            showError('❌ Export failed');
            return;
        }
        
        const jsonString = JSON.stringify(result.tasks, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            showSuccess(`✅ Exported ${result.count} tasks to clipboard!`);
            
            document.getElementById('bulkImportJson').value = jsonString;
        }).catch(() => {
            document.getElementById('bulkImportJson').value = jsonString;
            showSuccess(`✅ Exported ${result.count} tasks`);
        });
        
    } catch (error) {
        showLoader(false);
        showError(`❌ Export error: ${error.message}`);
    }
}

async function bulkDeleteTasks() {
    const selectedCheckboxes = document.querySelectorAll('.task-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        showError('❌ Please select tasks to delete');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedCheckboxes.length} task(s)?`)) {
        return;
    }
    
    try {
        const taskIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.taskId));
        
        showLoader(true);
        
        const response = await fetch(`${API_URL}bulk_delete/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_ids: taskIds })
        });
        
        const result = await response.json();
        showLoader(false);
        
        if (!response.ok) {
            showError(`❌ Delete failed: ${result.error}`);
            return;
        }
        
        showSuccess(`✅ Deleted ${result.deleted_count} task(s)`);
        await loadTasks();
        
    } catch (error) {
        showLoader(false);
        showError(`❌ Delete error: ${error.message}`);
    }
}