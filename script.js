// Employee Timesheet Management System
class TimesheetApp {
    constructor() {
        this.currentUser = null;
        this.employees = new Map();
        this.schedules = new Map();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFromStorage();
        if (this.employees.size === 0) {
            this.loadSampleData();
            this.saveToStorage();
        }
        this.updateCurrentWeek();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout buttons
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('adminLogoutBtn').addEventListener('click', () => this.logout());
        
        // Tab navigation
        this.setupTabNavigation();
        
        // Google Sheets config
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => this.downloadTemplate());
        document.getElementById('saveSheetConfigBtn').addEventListener('click', () => this.saveSheetConfig());
        document.getElementById('syncFromSheetBtn').addEventListener('click', () => this.syncFromGoogleSheet());
        
        // Modal functionality
        document.getElementById('closeModal').addEventListener('click', () => this.closeEmployeeModal());
        document.getElementById('addShiftBtn').addEventListener('click', () => this.addShift());
        
        // Close modal when clicking outside
        document.getElementById('employeeModal').addEventListener('click', (e) => {
            if (e.target.id === 'employeeModal') {
                this.closeEmployeeModal();
            }
        });
    }

    getSheetConfig() {
        const id = localStorage.getItem('tw_sheet_id') || '';
        const name = localStorage.getItem('tw_sheet_name') || '';
        return { id, name };
    }

    populateSheetConfigInputs() {
        const { id, name } = this.getSheetConfig();
        const idInput = document.getElementById('sheetIdInput');
        const nameInput = document.getElementById('sheetNameInput');
        if (idInput) idInput.value = id;
        if (nameInput) nameInput.value = name || 'Schedule';
    }

    saveSheetConfig() {
        const id = document.getElementById('sheetIdInput').value.trim();
        const name = document.getElementById('sheetNameInput').value.trim();
        localStorage.setItem('tw_sheet_id', id);
        localStorage.setItem('tw_sheet_name', name);
        this.showToast('Google Sheets settings saved');
    }

    async syncFromGoogleSheet() {
        const { id, name } = this.getSheetConfig();
        if (!id || !name) {
            this.showConfirm('Please enter Sheet ID and Worksheet Name, then click Save Settings.');
            return;
        }
        try {
            // Use OpenSheet (public CORS-friendly JSON) first to avoid CORS blocks
            // Docs: https://opensheet.elk.sh
            const urlJson = `https://opensheet.elk.sh/${id}/${encodeURIComponent(name)}`;
            let rows;
            try {
                const resJson = await fetch(urlJson, { cache: 'no-store' });
                if (!resJson.ok) throw new Error('OpenSheet fetch failed');
                rows = await resJson.json();
            } catch (e) {
                // Fallback to published CSV if OpenSheet not available
                const urlCsv = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
                const resCsv = await fetch(urlCsv, { cache: 'no-store' });
                if (!resCsv.ok) throw new Error('Failed to fetch sheet');
                const csv = await resCsv.text();
                rows = this.parseCsv(csv);
            }
            this.ingestRows(rows);
            this.saveToStorage();
            this.displayAllEmployees();
            this.showConfirm('Sync complete');
        } catch (e) {
            console.error(e);
            this.showMessage('Failed to sync from Google Sheets. Check that the sheet is published and the name is correct.', 'error');
        }
    }

    parseCsv(csv) {
        // Simple CSV parser for headers: Employee,Site,Day,StartTime,EndTime
        const lines = csv.split(/\r?\n/).filter(l => l.trim().length);
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = this.splitCsvLine(lines[i]);
            const row = {};
            headers.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
            data.push(row);
        }
        return data;
    }

    splitCsvLine(line) {
        // Handle quoted commas
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (ch === ',' && !inQuotes) {
                result.push(current); current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    ingestRows(rows) {
        this.schedules.clear();
        rows.forEach(row => {
            const { Employee, Site, Day, StartTime, EndTime } = row;
            if (!Employee || !Site || !Day || !StartTime || !EndTime) return;
            const employeeId = String(Employee).toLowerCase().replace(/\s+/g, '_');
            if (!this.employees.has(employeeId)) {
                this.employees.set(employeeId, { id: employeeId, name: Employee, password: 'password123', role: 'employee' });
            }
            if (!this.schedules.has(employeeId)) {
                this.schedules.set(employeeId, { employeeId, employeeName: Employee, schedule: [] });
            }
            this.schedules.get(employeeId).schedule.push({ day: Day, site: Site, startTime: StartTime, endTime: EndTime });
        });
    }

    setupTabNavigation() {
        // Employee tabs
        const employeeTabs = document.querySelectorAll('#employeeScreen .tab-btn');
        employeeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e, 'employee'));
        });
        
        // Admin tabs
        const adminTabs = document.querySelectorAll('#adminScreen .tab-btn');
        adminTabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e, 'admin'));
        });
    }

    switchTab(e, screen) {
        const clickedTab = e.currentTarget;
        const tabName = clickedTab.getAttribute('data-tab');
        
        // Remove active class from all tabs and content
        const screenElement = document.getElementById(screen + 'Screen');
        const allTabs = screenElement.querySelectorAll('.tab-btn');
        const allContents = screenElement.querySelectorAll('.tab-content');
        
        allTabs.forEach(tab => tab.classList.remove('active'));
        allContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        clickedTab.classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
        
        // Update content based on tab
        if (screen === 'employee') {
            if (tabName === 'timesheet') {
                this.displayEmployeeSchedule();
            } else if (tabName === 'schedule') {
                this.displayDetailedSchedule();
            }
        } else if (screen === 'admin') {
            if (tabName === 'employees') {
                this.displayAllEmployees();
            }
        }
    }

    loadSampleData() {
        // Sample employees
        this.employees.set('test', {
            id: 'test',
            name: 'Barret',
            password: 'test',
            role: 'employee'
        });
        
        this.employees.set('cloud', {
            id: 'cloud',
            name: 'Cloud',
            password: 'password',
            role: 'employee'
        });
        
        this.employees.set('admin', {
            id: 'admin',
            name: 'Admin',
            password: 'admin',
            role: 'admin'
        });

        // Sample schedules
        this.schedules.set('test', {
            employeeId: 'test',
            employeeName: 'Barret',
            schedule: [
                { day: 'Monday', site: 'Site 1', startTime: '3:00 PM', endTime: '12:00 AM' },
                { day: 'Wednesday', site: 'Site 1', startTime: '3:00 PM', endTime: '12:00 AM' },
                { day: 'Thursday', site: 'Site 1', startTime: '3:00 PM', endTime: '12:00 AM' }
            ]
        });

        this.schedules.set('cloud', {
            employeeId: 'cloud',
            employeeName: 'Cloud',
            schedule: [
                { day: 'Tuesday', site: 'Site 2', startTime: '9:00 AM', endTime: '5:00 PM' },
                { day: 'Friday', site: 'Site 2', startTime: '9:00 AM', endTime: '5:00 PM' }
            ]
        });
    }

    saveToStorage() {
        try {
            const employeesArr = Array.from(this.employees.values());
            const schedulesObj = {};
            this.schedules.forEach((v, k) => schedulesObj[k] = v);
            localStorage.setItem('tw_employees', JSON.stringify(employeesArr));
            localStorage.setItem('tw_schedules', JSON.stringify(schedulesObj));
        } catch (e) {
            console.error('Failed saving to storage', e);
        }
    }

    loadFromStorage() {
        try {
            const empStr = localStorage.getItem('tw_employees');
            const schStr = localStorage.getItem('tw_schedules');
            if (empStr) {
                const arr = JSON.parse(empStr);
                arr.forEach(u => this.employees.set(u.id, u));
            }
            if (schStr) {
                const obj = JSON.parse(schStr);
                Object.keys(obj).forEach(k => this.schedules.set(k, obj[k]));
            }
        } catch (e) {
            console.error('Failed loading from storage', e);
        }
    }

    handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const role = document.getElementById('role').value;
        
        if (!username || !password || !role) {
            this.showLoginError('Please fill in all fields.');
            return;
        }
        
        const user = this.employees.get(username);
        
        if (user && user.password === password && user.role === role) {
            this.currentUser = user;
            this.showScreen(role === 'admin' ? 'adminScreen' : 'employeeScreen');
            this.updateEmployeeDisplay();
            this.clearLoginForm();
        } else {
            this.showLoginError('Invalid credentials. Please try again.');
        }
    }

    logout() {
        this.currentUser = null;
        this.showScreen('loginScreen');
        this.clearLoginForm();
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    clearLoginForm() {
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').style.display = 'none';
    }

    updateEmployeeDisplay() {
        if (this.currentUser.role === 'employee') {
            document.getElementById('employeeName').textContent = this.currentUser.name;
            // Default to Schedule tab first
            const empScreen = document.getElementById('employeeScreen');
            empScreen.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            empScreen.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            empScreen.querySelector('[data-tab="schedule"]').classList.add('active');
            document.getElementById('scheduleTab').classList.add('active');
            this.displayDetailedSchedule();
        } else if (this.currentUser.role === 'admin') {
            this.populateSheetConfigInputs();
            this.displayAllEmployees();
        }
    }

    displayEmployeeSchedule() {
        const schedule = this.schedules.get(this.currentUser.id);
        const timesheetContent = document.getElementById('timesheetContent');
        
        if (schedule && schedule.schedule.length > 0) {
            const scheduleHtml = this.generateScheduleHTML(schedule.schedule);
            timesheetContent.innerHTML = scheduleHtml;
        } else {
            timesheetContent.innerHTML = '<div class="no-schedule">No schedule available. Please contact your supervisor.</div>';
        }
    }

    displayDetailedSchedule() {
        const schedule = this.schedules.get(this.currentUser.id);
        const scheduleContent = document.getElementById('scheduleContent');
        
        if (schedule && schedule.schedule.length > 0) {
            const scheduleHtml = this.generateDetailedScheduleHTML(schedule.schedule);
            scheduleContent.innerHTML = scheduleHtml;
        } else {
            scheduleContent.innerHTML = '<div class="no-schedule">No schedule available. Please contact your supervisor.</div>';
        }
    }

    generateScheduleHTML(schedule) {
        const groupedSchedule = this.groupScheduleBySite(schedule);
        
        let html = '<div class="schedule-grid">';
        
        for (const [site, shifts] of groupedSchedule) {
            html += `
                <div class="schedule-card">
                    <h3><i class="fas fa-map-marker-alt"></i> ${site}</h3>
                    <div class="schedule-details">
            `;
            
            shifts.forEach(shift => {
                html += `
                    <div class="schedule-item">
                        <span class="day">${shift.day}</span>
                        <span class="time">${this.formatDurationHours(this.calculateDurationHours(shift.startTime, shift.endTime))}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    }

    generateDetailedScheduleHTML(schedule) {
        // Sort schedule by day of week
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const sortedSchedule = schedule.sort((a, b) => {
            return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        });
        
        let html = '<div class="schedule-list">';
        
        sortedSchedule.forEach(shift => {
            html += `
                <div class="schedule-entry">
                    <div class="site-info">
                        <i class="fas fa-map-marker-alt" style="color: #27ae60;"></i>
                        <span class="site-name">${shift.site}</span>
                    </div>
                    <div class="day-time">
                        <div class="day">${shift.day}</div>
                        <div class="time">${shift.startTime} - ${shift.endTime}</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    groupScheduleBySite(schedule) {
        const grouped = new Map();
        
        schedule.forEach(shift => {
            if (!grouped.has(shift.site)) {
                grouped.set(shift.site, []);
            }
            grouped.get(shift.site).push(shift);
        });
        
        return grouped;
    }

    calculateDurationHours(startTimeStr, endTimeStr) {
        // Parse 12-hour times like "3:00 PM" to minutes since start of day
        const parse = (t) => {
            const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (!match) return 0;
            let hours = parseInt(match[1], 10) % 12;
            const minutes = parseInt(match[2], 10);
            const ampm = match[3].toUpperCase();
            if (ampm === 'PM') hours += 12;
            return hours * 60 + minutes;
        };
        let startMin = parse(startTimeStr);
        let endMin = parse(endTimeStr);
        if (endMin <= startMin) {
            // Crosses midnight
            endMin += 24 * 60;
        }
        const diffMin = endMin - startMin;
        return diffMin / 60; // hours as float
    }

    formatDurationHours(hoursFloat) {
        // Round to nearest quarter hour if needed
        const rounded = Math.round(hoursFloat * 4) / 4;
        // If integer, no decimals
        const isInt = Math.abs(rounded - Math.round(rounded)) < 1e-9;
        const label = isInt ? `${Math.round(rounded)}` : `${rounded}`;
        return `${label} Hour${rounded === 1 ? '' : 's'}`;
    }

    displayAllEmployees() {
        const employeesList = document.getElementById('employeesList');
        let html = '';
        
        if (this.schedules.size === 0) {
            html = '<div class="no-schedule">No employee schedules found. Upload an Excel file to get started.</div>';
        } else {
            this.schedules.forEach(schedule => {
                const scheduleText = schedule.schedule.length > 0 
                    ? `${schedule.schedule.length} shifts scheduled`
                    : 'No schedule';
                
                // Get unique sites for this employee
                const sites = [...new Set(schedule.schedule.map(shift => shift.site))];
                const sitesText = sites.length > 0 ? `Sites: ${sites.join(', ')}` : 'No sites assigned';
                
                html += `
                    <div class="employee-item" data-employee-id="${schedule.employeeId}">
                        <div>
                            <div class="employee-name">${schedule.employeeName}</div>
                            <div class="employee-schedule">${scheduleText}</div>
                            <div class="employee-sites">${sitesText}</div>
                        </div>
                        <div class="employee-actions">
                            <button class="edit-employee-btn" data-employee-id="${schedule.employeeId}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        employeesList.innerHTML = html;
        
        // Remove existing handler before attaching a new one to avoid stacking
        employeesList.onclick = null;
        // Delegated click: open modal when Edit button is clicked
        employeesList.onclick = (event) => {
            const editBtn = event.target.closest('.edit-employee-btn');
            if (editBtn && employeesList.contains(editBtn)) {
                const employeeId = editBtn.getAttribute('data-employee-id');
                this.showEmployeeModal(employeeId);
            }
        };
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadArea = document.getElementById('uploadArea');
        
        if (this.isValidFile(file)) {
            uploadBtn.disabled = false;
            uploadArea.innerHTML = `
                <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                <p>File ready: ${file.name}</p>
                <p class="upload-hint">Click upload to process</p>
            `;
            this.selectedFile = file;
        } else {
            this.showMessage('Please select a valid Excel or CSV file.', 'error');
        }
    }

    isValidFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        return validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
    }

    uploadFile() {
        if (!this.selectedFile) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                this.processScheduleData(jsonData);
                this.showMessage('Schedule uploaded successfully!', 'success');
                this.showToast('Upload successful');
                this.showConfirm('Upload successful');
                this.resetUploadArea();
            } catch (error) {
                this.showMessage('Error processing file. Please check the format.', 'error');
                console.error('File processing error:', error);
            }
        };
        
        reader.readAsArrayBuffer(this.selectedFile);
    }

    processScheduleData(data) {
        // Clear existing schedules
        this.schedules.clear();
        
        // Process the uploaded data and update schedules
        data.forEach(row => {
            if (row.Employee && row.Site && row.Day && row.StartTime && row.EndTime) {
                const employeeId = row.Employee.toLowerCase().replace(/\s+/g, '_');
                
                // Create employee if they don't exist
                if (!this.employees.has(employeeId)) {
                    this.employees.set(employeeId, {
                        id: employeeId,
                        name: row.Employee,
                        password: 'password123', // Default password
                        role: 'employee'
                    });
                }
                
                // Create or update schedule
                if (!this.schedules.has(employeeId)) {
                    this.schedules.set(employeeId, {
                        employeeId: employeeId,
                        employeeName: row.Employee,
                        schedule: []
                    });
                }
                
                this.schedules.get(employeeId).schedule.push({
                    day: row.Day,
                    site: row.Site,
                    startTime: row.StartTime,
                    endTime: row.EndTime
                });
            }
        });
        
        this.displayAllEmployees();
        this.showMessage(`Successfully processed ${this.schedules.size} employee schedules!`, 'success');
        this.showToast('Upload complete: schedules updated');
        this.saveToStorage();
    }

    downloadTemplate() {
        // Build template from current schedules in storage
        const templateData = [];
        this.schedules.forEach(record => {
            record.schedule.forEach(shift => {
                templateData.push({
                    Employee: record.employeeName,
                    Site: shift.site,
                    Day: shift.day,
                    StartTime: shift.startTime,
                    EndTime: shift.endTime
                });
            });
        });
        
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');
        XLSX.writeFile(workbook, 'schedule_template.xlsx');
    }

    resetUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadBtn = document.getElementById('uploadBtn');
        
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Drop your Excel or CSV file here</p>
            <p class="upload-hint">or click to browse</p>
        `;
        uploadBtn.disabled = true;
        this.selectedFile = null;
    }

    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        const container = document.querySelector('.admin-container');
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    showToast(text) {
        let toast = document.getElementById('globalToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'globalToast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    showConfirm(message) {
        let backdrop = document.getElementById('confirmBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'confirmBackdrop';
            backdrop.className = 'confirm-backdrop';
            backdrop.innerHTML = `
                <div class="confirm-card">
                    <div class="confirm-title">Notification</div>
                    <div class="confirm-message" id="confirmMessage"></div>
                    <div class="confirm-actions">
                        <button id="confirmOkBtn" class="confirm-ok">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', (e) => {
                if (e.target.id === 'confirmBackdrop') backdrop.classList.remove('show');
            });
            document.getElementById('confirmOkBtn').addEventListener('click', () => {
                backdrop.classList.remove('show');
            });
        }
        document.getElementById('confirmMessage').textContent = message;
        backdrop.classList.add('show');
    }

    updateCurrentWeek() {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        
        const options = { month: 'long', day: 'numeric' };
        const startStr = startOfWeek.toLocaleDateString('en-US', options);
        const endStr = endOfWeek.toLocaleDateString('en-US', options);
        
        const weekText = `Week of ${startStr} - ${endStr}`;
        document.getElementById('currentWeek').textContent = weekText;
        document.getElementById('currentWeekSchedule').textContent = weekText;
    }

    showEmployeeModal(employeeId) {
        this.currentEditingEmployee = employeeId;
        const employee = this.employees.get(employeeId);
        const schedule = this.schedules.get(employeeId);
        
        document.getElementById('modalEmployeeName').textContent = `${employee.name}'s Schedule`;
        document.getElementById('employeeModal').classList.add('active');
        
        this.displayShiftsList(schedule ? schedule.schedule : []);
    }

    closeEmployeeModal() {
        document.getElementById('employeeModal').classList.remove('active');
        this.currentEditingEmployee = null;
        this.clearShiftForm();
    }

    displayShiftsList(shifts) {
        const shiftsList = document.getElementById('shiftsList');
        
        if (shifts.length === 0) {
            shiftsList.innerHTML = '<div class="no-schedule">No shifts scheduled</div>';
            return;
        }
        
        let html = '';
        shifts.forEach((shift, index) => {
            html += `
                <div class="shift-item">
                    <div class="shift-details">
                        <div class="shift-day">${shift.day}</div>
                        <div class="shift-time-site">${shift.site} • ${shift.startTime} - ${shift.endTime}</div>
                    </div>
                    <div class="shift-actions">
                        <button class="edit-shift-btn" data-index="${index}"><i class="fas fa-pen"></i> Edit</button>
                        <button class="delete-shift-btn" data-index="${index}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        });
        
        shiftsList.innerHTML = html;
        
        // Add delete listeners
        document.querySelectorAll('.delete-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                this.deleteShift(index);
            });
        });

        // Add edit listeners
        document.querySelectorAll('.edit-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                this.prefillShiftForm(index);
            });
        });
    }

    addShift() {
        const day = document.getElementById('shiftDay').value;
        const site = document.getElementById('shiftSite').value.trim();
        const startTime = document.getElementById('shiftStartTime').value.trim();
        const endTime = document.getElementById('shiftEndTime').value.trim();
        
        if (!day || !site || !startTime || !endTime) {
            alert('Please fill in all fields');
            return;
        }
        
        const employeeId = this.currentEditingEmployee;
        if (!this.schedules.has(employeeId)) {
            const employee = this.employees.get(employeeId);
            this.schedules.set(employeeId, {
                employeeId: employeeId,
                employeeName: employee.name,
                schedule: []
            });
        }
        
        const newShift = { day, site, startTime, endTime };
        const editingIndex = this.currentEditingShiftIndex;
        if (typeof editingIndex === 'number') {
            // Update existing shift
            this.schedules.get(employeeId).schedule[editingIndex] = newShift;
            this.currentEditingShiftIndex = undefined;
            document.getElementById('addShiftBtn').textContent = 'Add Shift';
        } else {
            // Create new shift
            this.schedules.get(employeeId).schedule.push(newShift);
        }
        
        this.displayShiftsList(this.schedules.get(employeeId).schedule);
        this.clearShiftForm();
        this.displayAllEmployees(); // Refresh the employee list
        this.saveToStorage();
    }

    prefillShiftForm(index) {
        const employeeId = this.currentEditingEmployee;
        const shift = this.schedules.get(employeeId).schedule[index];
        if (!shift) return;
        document.getElementById('shiftDay').value = shift.day;
        document.getElementById('shiftSite').value = shift.site;
        document.getElementById('shiftStartTime').value = shift.startTime;
        document.getElementById('shiftEndTime').value = shift.endTime;
        this.currentEditingShiftIndex = index;
        document.getElementById('addShiftBtn').textContent = 'Update Shift';
    }

    deleteShift(index) {
        const employeeId = this.currentEditingEmployee;
        const schedule = this.schedules.get(employeeId);
        
        if (schedule && schedule.schedule[index]) {
            schedule.schedule.splice(index, 1);
            this.displayShiftsList(schedule.schedule);
            this.displayAllEmployees(); // Refresh the employee list
            this.saveToStorage();
        }
    }

    clearShiftForm() {
        document.getElementById('shiftDay').value = 'Monday';
        document.getElementById('shiftSite').value = '';
        document.getElementById('shiftStartTime').value = '';
        document.getElementById('shiftEndTime').value = '';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new TimesheetApp();
});
