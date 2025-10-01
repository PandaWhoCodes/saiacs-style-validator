let currentResults = null;
let currentFilter = 'all';

// File input handling
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadForm = document.getElementById('uploadForm');
const validateBtn = document.getElementById('validateBtn');
const btnText = validateBtn.querySelector('.btn-text');
const btnSpinner = validateBtn.querySelector('.btn-spinner');

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileName.textContent = `✓ Selected: ${e.target.files[0].name}`;
    }
});

// Drag and drop
const fileLabel = document.querySelector('.file-label');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileLabel.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => {
        fileLabel.style.borderColor = 'var(--secondary-color)';
        fileLabel.style.background = '#e3f2fd';
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => {
        fileLabel.style.borderColor = '';
        fileLabel.style.background = '';
    }, false);
});

fileLabel.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        fileName.textContent = `✓ Selected: ${files[0].name}`;
    }
});

// Form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(uploadForm);

    // Show loading state
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline';
    validateBtn.disabled = true;

    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentResults = data.results;
            displayResults(data.results, data.filename);
        } else {
            showError(data.error || 'Validation failed');
        }

    } catch (error) {
        showError('Error connecting to server: ' + error.message);
    } finally {
        // Reset button
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        validateBtn.disabled = false;
    }
});

// Display results
function displayResults(results, filename) {
    const resultsSection = document.getElementById('resultsSection');
    const summaryDiv = document.getElementById('summary');
    const issuesList = document.getElementById('issuesList');

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    // Display summary
    const summary = results.summary;
    summaryDiv.innerHTML = `
        <h3>📄 ${filename}</h3>
        <p>Document Type: <strong>${results.documentType === 'dissertation' ? 'Dissertation' : 'Assignment'}</strong></p>
        <div class="summary-stats">
            <div class="stat-box">
                <div class="stat-number">${summary.totalIssues}</div>
                <div class="stat-label">Total Issues</div>
            </div>
            <div class="stat-box critical">
                <div class="stat-number">${summary.critical}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box high">
                <div class="stat-number">${summary.high}</div>
                <div class="stat-label">High</div>
            </div>
            <div class="stat-box medium">
                <div class="stat-number">${summary.medium}</div>
                <div class="stat-label">Medium</div>
            </div>
            <div class="stat-box low">
                <div class="stat-number">${summary.low}</div>
                <div class="stat-label">Low</div>
            </div>
        </div>
        ${summary.totalIssues === 0 ? '<div class="success-message"><strong>✓ Excellent!</strong> No issues found. Your document follows the SAIACS Style Guide.</div>' : ''}
    `;

    // Display issues
    displayIssues(results.issues);

    // Setup filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            displayIssues(results.issues);
        });
    });

    // Setup download button
    document.getElementById('downloadReport').addEventListener('click', () => {
        downloadReport(results, filename);
    });
}

function displayIssues(issues) {
    const issuesList = document.getElementById('issuesList');

    let filteredIssues = issues;
    if (currentFilter !== 'all') {
        filteredIssues = issues.filter(issue => issue.severity === currentFilter);
    }

    if (filteredIssues.length === 0) {
        issuesList.innerHTML = '<div class="success-message">No issues in this category!</div>';
        return;
    }

    issuesList.innerHTML = filteredIssues.map(issue => `
        <div class="issue-card ${issue.severity}">
            <div class="issue-header">
                <div class="issue-title">${issue.category}: ${issue.rule}</div>
                <span class="severity-badge ${issue.severity}">${issue.severity}</span>
            </div>
            <div class="issue-message">${issue.message}</div>
            <div class="issue-details">
                ${issue.expected ? `
                    <div class="detail-item">
                        <div class="detail-label">Expected:</div>
                        <div class="detail-value">${issue.expected}</div>
                    </div>
                ` : ''}
                ${issue.found ? `
                    <div class="detail-item">
                        <div class="detail-label">Found:</div>
                        <div class="detail-value">${issue.found}</div>
                    </div>
                ` : ''}
                ${issue.location ? `
                    <div class="detail-item">
                        <div class="detail-label">Location:</div>
                        <div class="detail-value">${formatLocation(issue.location)}</div>
                    </div>
                ` : ''}
            </div>
            ${issue.fix ? `
                <div class="issue-fix">
                    <div class="fix-label">💡 How to fix:</div>
                    <div class="fix-text">${issue.fix}</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function formatLocation(location) {
    let result = [];

    if (location.paragraph) {
        result.push(`Para ${location.paragraph}`);
    }
    if (location.footnote) {
        result.push(`Footnote ${location.footnote}`);
    }
    if (location.section) {
        result.push(location.section);
    }
    if (location.text) {
        // Show text snippet prominently
        return `<div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-left: 3px solid #666; font-family: 'Courier New', monospace; font-size: 0.85em;">"${location.text}"</div>`;
    }

    return result.length > 0 ? result.join(' • ') : 'See document';
}

function showError(message) {
    const resultsSection = document.getElementById('resultsSection');
    const summaryDiv = document.getElementById('summary');
    const issuesList = document.getElementById('issuesList');

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    summaryDiv.innerHTML = `<div class="error-message"><strong>❌ Error:</strong> ${message}</div>`;
    issuesList.innerHTML = '';
}

function downloadReport(results, filename) {
    const report = generateTextReport(results, filename);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAIACS_Validation_Report_${filename.replace('.docx', '')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateTextReport(results, filename) {
    let report = '';
    report += '═══════════════════════════════════════════════════════════════\n';
    report += '   SAIACS STYLE GUIDE VALIDATION REPORT\n';
    report += '═══════════════════════════════════════════════════════════════\n\n';
    report += `Document: ${filename}\n`;
    report += `Document Type: ${results.documentType}\n`;
    report += `Validation Date: ${new Date().toLocaleString()}\n\n`;

    report += '───────────────────────────────────────────────────────────────\n';
    report += 'SUMMARY\n';
    report += '───────────────────────────────────────────────────────────────\n\n';
    report += `Total Issues: ${results.summary.totalIssues}\n`;
    report += `  Critical: ${results.summary.critical}\n`;
    report += `  High:     ${results.summary.high}\n`;
    report += `  Medium:   ${results.summary.medium}\n`;
    report += `  Low:      ${results.summary.low}\n\n`;

    if (results.summary.totalIssues === 0) {
        report += '✓ Excellent! No issues found.\n';
        report += 'Your document follows the SAIACS Style Guide.\n\n';
    } else {
        report += '───────────────────────────────────────────────────────────────\n';
        report += 'ISSUES FOUND\n';
        report += '───────────────────────────────────────────────────────────────\n\n';

        results.issues.forEach((issue, index) => {
            report += `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.rule}\n`;
            report += `   ${issue.message}\n`;
            if (issue.expected) report += `   Expected: ${issue.expected}\n`;
            if (issue.found) report += `   Found: ${issue.found}\n`;
            if (issue.location) report += `   Location: ${formatLocation(issue.location)}\n`;
            if (issue.fix) report += `   Fix: ${issue.fix}\n`;
            report += '\n';
        });
    }

    report += '───────────────────────────────────────────────────────────────\n';
    report += 'END OF REPORT\n';
    report += '───────────────────────────────────────────────────────────────\n';
    report += '\nGenerated by SAIACS Style Guide Validator\n';
    report += 'Based on The SAIACS Style Guide for Research and Writing (2020-2021)\n';

    return report;
}
