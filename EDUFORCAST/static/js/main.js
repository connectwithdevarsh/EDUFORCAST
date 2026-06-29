// Global state
let analyticsData = null;
let studentsData = [];
let filteredStudents = [];
let currentPage = 1;
const recordsPerPage = 10;

// Chart instances
let demoChartInstance = null;
let attendanceChartInstance = null;
let studyChartInstance = null;
let engagementChartInstance = null;

// Chart.js Theme Configuration
const chartTheme = {
    textColor: '#9ca3af',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    colors: {
        math: '#3b82f6',      // Blue
        reading: '#8b5cf6',   // Violet
        writing: '#ec4899',   // Pink
        overall: '#10b981',   // Emerald
        highRisk: '#ef4444',  // Red
        mediumRisk: '#f59e0b',// Amber
        lowRisk: '#10b981'    // Emerald
    }
};

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Navigation
    initTabs();

    // 2. Sliders
    initSliders();

    // 3. Load Dashboard Data
    loadDashboardData();

    // 4. Load Student Directory
    loadStudentDirectory();

    // 5. Predictor Form Submit
    document.getElementById('prediction-form').addEventListener('submit', handlePrediction);

    // 6. Retrain Model Button
    document.getElementById('btn-retrain').addEventListener('click', handleRetrainModel);

    // 7. Directory Search and Filter
    document.getElementById('directory-search').addEventListener('input', handleDirectorySearch);
    document.getElementById('filter-risk').addEventListener('change', handleDirectorySearch);

    // 8. Pagination Buttons
    document.getElementById('btn-prev').addEventListener('click', () => changePage(-1));
    document.getElementById('btn-next').addEventListener('click', () => changePage(1));

    // 9. Educator Profile Modal
    initProfileModal();
});

/* ==========================================================================
   Tab Navigation Logic
   ========================================================================== */
function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const tabMetaData = {
        dashboard: {
            title: "Academic Dashboard",
            subtitle: "Overview of student performance metrics and AI predictions"
        },
        predictor: {
            title: "Student Predictor",
            subtitle: "Use the AI model to predict score distributions and academic risk"
        },
        directory: {
            title: "Student Directory",
            subtitle: "Detailed list of all students and their risk classifications"
        },
        insights: {
            title: "AI Insights",
            subtitle: "Key trends and correlations discovered by the machine learning engine"
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');

            // Set active class on nav items
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Show target panel
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === target) {
                    panel.classList.add('active');
                }
            });

            // Update Header
            if (tabMetaData[target]) {
                pageTitle.textContent = tabMetaData[target].title;
                pageSubtitle.textContent = tabMetaData[target].subtitle;
            }
        });
    });
}

/* ==========================================================================
   Slider Input Logic
   ========================================================================== */
function initSliders() {
    const attendanceSlider = document.getElementById('attendance');
    const attendanceVal = document.getElementById('attendance-val');
    
    attendanceSlider.addEventListener('input', () => {
        attendanceVal.textContent = `${attendanceSlider.value}%`;
    });

    const studySlider = document.getElementById('study-hours');
    const studyVal = document.getElementById('study-hours-val');

    studySlider.addEventListener('input', () => {
        studyVal.textContent = `${studySlider.value} hours`;
    });
}

/* ==========================================================================
   Dashboard Data Fetching & Chart Rendering
   ========================================================================== */
async function loadDashboardData() {
    try {
        const response = await fetch('/api/analytics');
        if (!response.ok) throw new Error("Failed to fetch analytics data");
        
        analyticsData = await response.json();
        
        // 1. Update Metric Cards
        document.getElementById('metric-total-students').textContent = analyticsData.metrics.total_students.toLocaleString();
        document.getElementById('metric-avg-math').textContent = analyticsData.metrics.avg_math;
        document.getElementById('metric-avg-reading').textContent = analyticsData.metrics.avg_reading;
        document.getElementById('metric-avg-writing').textContent = analyticsData.metrics.avg_writing;
        
        const atRiskMetric = document.getElementById('metric-at-risk');
        atRiskMetric.textContent = `${analyticsData.metrics.high_risk_count} (${analyticsData.metrics.high_risk_pct}%)`;

        // 2. Render Charts
        renderDemographicsChart('parental');
        renderAttendanceChart();
        renderStudyChart();
        renderEngagementRiskChart();

        // Add event listeners to demographic toggle buttons
        const demoButtons = document.querySelectorAll('[data-demo]');
        demoButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                demoButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderDemographicsChart(btn.getAttribute('data-demo'));
            });
        });

    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

// Chart 1: Demographics (Parental Education, Gender, Test Prep)
function renderDemographicsChart(type) {
    if (demoChartInstance) {
        demoChartInstance.destroy();
    }

    let labels = [];
    let mathData = [];
    let readingData = [];
    let writingData = [];
    let title = '';

    if (type === 'parental') {
        const data = analyticsData.parental_analytics;
        labels = Object.keys(data);
        mathData = labels.map(l => data[l]['math score']);
        readingData = labels.map(l => data[l]['reading score']);
        writingData = labels.map(l => data[l]['writing score']);
        title = 'Parental Level of Education';
    } else if (type === 'gender') {
        const data = analyticsData.gender_analytics;
        labels = Object.keys(data).map(l => l.charAt(0).toUpperCase() + l.slice(1));
        mathData = Object.keys(data).map(l => data[l]['math score']);
        readingData = Object.keys(data).map(l => data[l]['reading score']);
        writingData = Object.keys(data).map(l => data[l]['writing score']);
        title = 'Gender';
    } else if (type === 'testprep') {
        const data = analyticsData.test_prep_analytics;
        labels = Object.keys(data).map(l => l === 'none' ? 'None' : 'Completed');
        mathData = Object.keys(data).map(l => data[l]['math score']);
        readingData = Object.keys(data).map(l => data[l]['reading score']);
        writingData = Object.keys(data).map(l => data[l]['writing score']);
        title = 'Test Preparation Course';
    }

    const ctx = document.getElementById('demoChart').getContext('2d');
    demoChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Math Score',
                    data: mathData,
                    backgroundColor: chartTheme.colors.math,
                    borderRadius: 6
                },
                {
                    label: 'Reading Score',
                    data: readingData,
                    backgroundColor: chartTheme.colors.reading,
                    borderRadius: 6
                },
                {
                    label: 'Writing Score',
                    data: writingData,
                    backgroundColor: chartTheme.colors.writing,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                tooltip: { padding: 10 }
            },
            scales: {
                x: {
                    grid: { color: 'transparent' },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: chartTheme.gridColor },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                }
            }
        }
    });
}

// Chart 2: Attendance vs Performance
function renderAttendanceChart() {
    if (attendanceChartInstance) {
        attendanceChartInstance.destroy();
    }

    const data = analyticsData.attendance_analytics;
    const labels = Object.keys(data);
    const scores = Object.values(data);

    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    attendanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Overall Grade',
                data: scores,
                borderColor: chartTheme.colors.overall,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: chartTheme.colors.overall,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { padding: 10 }
            },
            scales: {
                x: {
                    grid: { color: 'transparent' },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                y: {
                    min: 40,
                    max: 100,
                    grid: { color: chartTheme.gridColor },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                }
            }
        }
    });
}

// Chart 3: Study Hours vs Performance
function renderStudyChart() {
    if (studyChartInstance) {
        studyChartInstance.destroy();
    }

    const data = analyticsData.study_analytics;
    const labels = Object.keys(data);
    const scores = Object.values(data);

    const ctx = document.getElementById('studyChart').getContext('2d');
    
    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    studyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Overall Grade',
                data: scores,
                borderColor: chartTheme.colors.math,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: chartTheme.colors.math,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { padding: 10 }
            },
            scales: {
                x: {
                    grid: { color: 'transparent' },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                y: {
                    min: 40,
                    max: 100,
                    grid: { color: chartTheme.gridColor },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                }
            }
        }
    });
}

// Chart 4: Risk by Engagement
function renderEngagementRiskChart() {
    if (engagementChartInstance) {
        engagementChartInstance.destroy();
    }

    const data = analyticsData.behavior_risk_analytics;
    const labels = Object.keys(data); // High, Moderate, Low Engagement
    
    const lowRiskData = labels.map(l => data[l]['Low Risk'] || 0);
    const medRiskData = labels.map(l => data[l]['Medium Risk'] || 0);
    const highRiskData = labels.map(l => data[l]['High Risk'] || 0);

    const ctx = document.getElementById('engagementRiskChart').getContext('2d');
    
    engagementChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Low Risk',
                    data: lowRiskData,
                    backgroundColor: chartTheme.colors.lowRisk,
                    borderRadius: 6
                },
                {
                    label: 'Medium Risk',
                    data: medRiskData,
                    backgroundColor: chartTheme.colors.mediumRisk,
                    borderRadius: 6
                },
                {
                    label: 'High Risk',
                    data: highRiskData,
                    backgroundColor: chartTheme.colors.highRisk,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                tooltip: { padding: 10 }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'transparent' },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                },
                y: {
                    stacked: true,
                    grid: { color: chartTheme.gridColor },
                    ticks: { color: chartTheme.textColor, font: { family: chartTheme.fontFamily } }
                }
            }
        }
    });
}

/* ==========================================================================
   AI Prediction Form Handler
   ========================================================================== */
async function handlePrediction(e) {
    e.preventDefault();

    const btnPredict = document.getElementById('btn-predict');
    const loader = document.getElementById('predict-loader');
    const btnText = btnPredict.querySelector('.btn-text');
    
    // Show loading state
    btnPredict.disabled = true;
    loader.style.display = 'inline-block';
    btnText.style.opacity = '0.5';

    const payload = {
        gender: document.getElementById('gender').value,
        'race/ethnicity': document.getElementById('race').value,
        'parental level of education': document.getElementById('parental-edu').value,
        lunch: document.getElementById('lunch').value,
        'test preparation course': document.getElementById('test-prep').value,
        Attendance_Rate: parseFloat(document.getElementById('attendance').value),
        Study_Hours: parseInt(document.getElementById('study-hours').value),
        Learning_Behavior: document.getElementById('behavior').value
    };

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Prediction request failed");
        
        const result = await response.json();

        // Update UI with results
        displayPredictionResult(result, payload);

    } catch (error) {
        console.error("Prediction error:", error);
        alert("An error occurred during prediction. Please try again.");
    } finally {
        // Reset button state
        btnPredict.disabled = false;
        loader.style.display = 'none';
        btnText.style.opacity = '1';
    }
}

function displayPredictionResult(result, inputData) {
    // Hide placeholder, show content
    document.getElementById('result-placeholder').classList.add('hidden');
    document.getElementById('result-content').classList.remove('hidden');

    // 1. Overall Avg
    document.getElementById('pred-avg-score').textContent = result.predicted_average;

    // 2. Score Progress Bars
    const mathFill = document.getElementById('pred-math-fill');
    const mathVal = document.getElementById('pred-math-val');
    mathFill.style.width = `${result.predicted_math}%`;
    mathVal.textContent = `${result.predicted_math}/100`;

    const readingFill = document.getElementById('pred-reading-fill');
    const readingVal = document.getElementById('pred-reading-val');
    readingFill.style.width = `${result.predicted_reading}%`;
    readingVal.textContent = `${result.predicted_reading}/100`;

    const writingFill = document.getElementById('pred-writing-fill');
    const writingVal = document.getElementById('pred-writing-val');
    writingFill.style.width = `${result.predicted_writing}%`;
    writingVal.textContent = `${result.predicted_writing}/100`;

    // 3. Risk Badge
    const riskBadge = document.getElementById('risk-badge');
    riskBadge.textContent = result.predicted_risk;
    riskBadge.className = 'risk-badge'; // reset
    if (result.predicted_risk === 'Low Risk') riskBadge.classList.add('low');
    else if (result.predicted_risk === 'Medium Risk') riskBadge.classList.add('medium');
    else riskBadge.classList.add('high');

    // 4. Probability Bars
    const highProb = result.risk_probabilities['High Risk'] || 0;
    const medProb = result.risk_probabilities['Medium Risk'] || 0;
    const lowProb = result.risk_probabilities['Low Risk'] || 0;

    document.getElementById('prob-high-fill').style.width = `${highProb}%`;
    document.getElementById('prob-high-val').textContent = `${highProb}%`;
    
    document.getElementById('prob-med-fill').style.width = `${medProb}%`;
    document.getElementById('prob-med-val').textContent = `${medProb}%`;

    document.getElementById('prob-low-fill').style.width = `${lowProb}%`;
    document.getElementById('prob-low-val').textContent = `${lowProb}%`;

    // 5. AI Recommendations
    generateRecommendations(result, inputData);
}

function generateRecommendations(result, inputData) {
    const list = document.getElementById('recommendation-list');
    list.innerHTML = ''; // Clear old

    const recs = [];

    // Core Risk Status
    if (result.predicted_risk === 'High Risk') {
        recs.push("<strong>Critical Intervention</strong>: Place student on an Academic Support Contract immediately and assign an academic advisor.");
    }

    // Attendance issues
    if (inputData.Attendance_Rate < 75) {
        recs.push("<i class='fa-solid fa-calendar-times text-red'></i> <strong>Attendance Review</strong>: Schedule an immediate review with parents. Student's attendance is below the 75% threshold, which is highly correlated with academic failure.");
    } else if (inputData.Attendance_Rate < 85) {
        recs.push("<i class='fa-solid fa-calendar-minus text-amber'></i> <strong>Attendance Warning</strong>: Monitor weekly attendance. Reach out to the student to check if any support is needed to avoid chronic absenteeism.");
    }

    // Study habits
    if (inputData.Study_Hours < 8) {
        recs.push("<i class='fa-solid fa-clock text-amber'></i> <strong>Study Habit Improvement</strong>: Recommend enrolling in the supervised after-school study hall (target: at least 12-15 study hours weekly).");
    }

    // Specific Subject Interventions
    if (result.predicted_math < 60) {
        recs.push("<i class='fa-solid fa-square-root-variable text-blue'></i> <strong>Mathematics Support</strong>: Enroll in peer math tutoring and assign remedial numeracy modules.");
    }
    if (result.predicted_reading < 60 || result.predicted_writing < 60) {
        recs.push("<i class='fa-solid fa-book text-pink'></i> <strong>Literacy Support</strong>: Enroll in English/Writing workshops and provide additional reading comprehension exercises.");
    }

    // Prep course advice
    if (inputData['test preparation course'] === 'none') {
        recs.push("<i class='fa-solid fa-clipboard-list text-purple'></i> <strong>Test Preparation</strong>: Enroll in the upcoming Test Preparation Course. Analytics indicate that students completing this course score on average 8 points higher.");
    }

    // Learning Engagement
    if (inputData.Learning_Behavior === 'Low Engagement') {
        recs.push("<i class='fa-solid fa-user-clock text-amber'></i> <strong>Engagement Coaching</strong>: Set up monthly mentorship sessions to boost learning motivation and in-class participation.");
    }

    // If student is doing excellent
    if (result.predicted_average >= 85 && result.predicted_risk === 'Low Risk') {
        recs.push("<i class='fa-solid fa-star text-green'></i> <strong>Advanced Placement</strong>: Encourage enrollment in Advanced Placement (AP) courses or invite the student to act as a peer tutor.");
    }

    // Default recommendation if list is empty
    if (recs.length === 0) {
        recs.push("No immediate action required. Continue routine monitoring. Student exhibits solid performance indicators.");
    }

    // Append to list
    recs.forEach(rec => {
        const li = document.createElement('li');
        li.innerHTML = rec;
        list.appendChild(li);
    });
}

/* ==========================================================================
   Student Directory (Search, Filter, Pagination)
   ========================================================================== */
async function loadStudentDirectory() {
    try {
        const response = await fetch('/api/students');
        if (!response.ok) throw new Error("Failed to fetch students");
        
        studentsData = await response.json();
        filteredStudents = [...studentsData];
        
        renderTable();

    } catch (error) {
        console.error("Error loading directory:", error);
    }
}

function renderTable() {
    const tableBody = document.getElementById('students-table-body');
    tableBody.innerHTML = '';

    if (filteredStudents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No student records found matching the criteria.</td></tr>';
        document.getElementById('pagination-info').textContent = 'Showing 0-0 of 0 students';
        document.getElementById('btn-prev').disabled = true;
        document.getElementById('btn-next').disabled = true;
        return;
    }

    // Pagination bounds
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = Math.min(startIndex + recordsPerPage, filteredStudents.length);
    const pageRecords = filteredStudents.slice(startIndex, endIndex);

    pageRecords.forEach(student => {
        const tr = document.createElement('tr');
        
        let riskClass = 'low-risk';
        if (student.Risk_Level === 'High Risk') riskClass = 'high-risk';
        else if (student.Risk_Level === 'Medium Risk') riskClass = 'medium-risk';

        tr.innerHTML = `
            <td><strong>${student.student_id}</strong></td>
            <td>${student.gender.charAt(0).toUpperCase() + student.gender.slice(1)}</td>
            <td>${student.parental_level_of_education || student['parental level of education']}</td>
            <td>${student.Attendance_Rate}%</td>
            <td>${student.Study_Hours} hrs/wk</td>
            <td>${student.Learning_Behavior}</td>
            <td><strong>${student.Average_Score}</strong></td>
            <td><span class="badge ${riskClass}">${student.Risk_Level}</span></td>
        `;
        tableBody.appendChild(tr);
    });

    // Update pagination footer
    document.getElementById('pagination-info').textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredStudents.length} students`;
    
    // Button states
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = endIndex >= filteredStudents.length;
}

function handleDirectorySearch() {
    const query = document.getElementById('directory-search').value.toLowerCase().trim();
    const riskFilter = document.getElementById('filter-risk').value;

    filteredStudents = studentsData.filter(student => {
        // 1. Search Query
        const matchesQuery = 
            student.student_id.toLowerCase().includes(query) ||
            student.gender.toLowerCase().includes(query) ||
            (student['parental level of education'] || student.parental_level_of_education).toLowerCase().includes(query) ||
            student.Learning_Behavior.toLowerCase().includes(query);

        // 2. Risk Filter
        const matchesRisk = riskFilter === 'all' || student.Risk_Level === riskFilter;

        return matchesQuery && matchesRisk;
    });

    currentPage = 1; // Reset to page 1 on filter/search
    renderTable();
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredStudents.length / recordsPerPage);
    currentPage += direction;
    
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    renderTable();
}

/* ==========================================================================
   Model Retraining Handler
   ========================================================================== */
async function handleRetrainModel() {
    const btn = document.getElementById('btn-retrain');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Retraining...";

    try {
        const response = await fetch('/api/retrain', { method: 'POST' });
        if (!response.ok) throw new Error("Failed to retrain model");
        
        const data = await response.json();
        alert(data.message || "Model retrained successfully.");
        
        // Reload page to refresh everything
        window.location.reload();

    } catch (error) {
        console.error("Retrain error:", error);
        alert("An error occurred during model retraining.");
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

/* ==========================================================================
   Educator Profile Modal Logic
   ========================================================================== */
function initProfileModal() {
    const headerProfile = document.getElementById('header-user-profile');
    const modal = document.getElementById('profile-modal');
    const btnClose = document.getElementById('btn-close-profile');
    const btnCancel = document.getElementById('btn-cancel-profile');
    const btnSave = document.getElementById('btn-save-profile');
    
    // Inputs
    const nameInput = document.getElementById('profile-name-input');
    const roleInput = document.getElementById('profile-role-input');
    
    // Previews
    const previewName = document.getElementById('profile-preview-name');
    const previewRole = document.getElementById('profile-preview-role');
    
    // Header elements
    const headerName = document.getElementById('header-profile-name');
    const headerRole = document.getElementById('header-profile-role');

    // Default Profile Values
    const defaults = {
        name: "Dr. Devarsh",
        role: "Academic Director"
    };

    // Load Profile on startup
    function loadProfile() {
        const savedName = localStorage.getItem('edu_name') || defaults.name;
        const savedRole = localStorage.getItem('edu_role') || defaults.role;

        headerName.textContent = savedName;
        headerRole.textContent = savedRole;
    }

    loadProfile();

    // Open Modal
    headerProfile.addEventListener('click', () => {
        const currentName = headerName.textContent;
        const currentRole = headerRole.textContent;

        // Set inputs
        nameInput.value = currentName;
        roleInput.value = currentRole;

        // Set previews
        previewName.textContent = currentName;
        previewRole.textContent = currentRole;

        modal.classList.remove('hidden');
    });

    // Close Modal
    function closeModal() {
        modal.classList.add('hidden');
    }

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    
    // Close on click outside card
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Live Previews
    nameInput.addEventListener('input', () => {
        previewName.textContent = nameInput.value || defaults.name;
    });

    roleInput.addEventListener('input', () => {
        previewRole.textContent = roleInput.value || defaults.role;
    });

    // Save Changes
    btnSave.addEventListener('click', () => {
        const newName = nameInput.value.trim() || defaults.name;
        const newRole = roleInput.value.trim() || defaults.role;

        // Save to localStorage
        localStorage.setItem('edu_name', newName);
        localStorage.setItem('edu_role', newRole);

        // Update Header
        headerName.textContent = newName;
        headerRole.textContent = newRole;

        closeModal();
    });
}

