let currentResults = null;
let currentFilter = 'all';
let currentCategory = 'all';

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        validateBtn.disabled = false;
    }
});

// Display results
function displayResults(results, filename) {
    const resultsSection = document.getElementById('resultsSection');
    const summaryDiv = document.getElementById('summary');

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    const summary = results.summary;
    summaryDiv.innerHTML = `
        <h3>📄 ${escapeHtml(filename)}</h3>
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

    displayIssues(results.issues);

    // Setup severity filter buttons
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            displayIssues(results.issues);
        };
    });

    // Setup category filter buttons
    document.querySelectorAll('.cat-filter-btn[data-category]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-filter-btn[data-category]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            displayIssues(results.issues);
        };
    });

    // Setup download button
    document.getElementById('downloadReport').onclick = () => {
        downloadReport(results, filename);
    };
}

function displayIssues(issues) {
    const issuesList = document.getElementById('issuesList');

    let filteredIssues = issues;
    if (currentFilter !== 'all') {
        filteredIssues = filteredIssues.filter(issue => issue.severity === currentFilter);
    }
    if (currentCategory !== 'all') {
        filteredIssues = filteredIssues.filter(issue => issue.category === currentCategory);
    }

    if (filteredIssues.length === 0) {
        issuesList.innerHTML = '<div class="success-message">No issues in this filter!</div>';
        return;
    }

    issuesList.innerHTML = filteredIssues.map(issue => `
        <div class="issue-card ${escapeHtml(issue.severity)}">
            <div class="issue-header">
                <div class="issue-title">${escapeHtml(issue.category)}: ${escapeHtml(issue.rule)}</div>
                <span class="severity-badge ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span>
            </div>
            <div class="issue-message">${escapeHtml(issue.message)}</div>
            <div class="issue-details">
                ${issue.expected ? `
                    <div class="detail-item">
                        <div class="detail-label">Expected:</div>
                        <div class="detail-value">${escapeHtml(issue.expected)}</div>
                    </div>
                ` : ''}
                ${issue.found ? `
                    <div class="detail-item">
                        <div class="detail-label">Found:</div>
                        <div class="detail-value">${escapeHtml(issue.found)}</div>
                    </div>
                ` : ''}
                ${issue.location ? `
                    <div class="detail-item">
                        <div class="detail-label">Location:</div>
                        <div class="detail-value">${formatLocationHtml(issue.location)}</div>
                    </div>
                ` : ''}
            </div>
            ${issue.fix ? `
                <div class="issue-fix">
                    <div class="fix-label">💡 How to fix:</div>
                    <div class="fix-text">${escapeHtml(issue.fix)}</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function formatLocationHtml(location) {
    const parts = [];
    if (location.paragraph) {
        parts.push(`Para ${escapeHtml(location.paragraph)}`);
    }
    if (location.footnote) {
        parts.push(`Footnote ${escapeHtml(location.footnote)}`);
    }
    if (location.section) {
        parts.push(escapeHtml(location.section));
    }

    const header = parts.length > 0 ? `<strong>${parts.join(' • ')}</strong>` : '';
    const snippet = location.text
        ? `<div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-left: 3px solid #666; font-family: 'Courier New', monospace; font-size: 0.85em;">"${escapeHtml(location.text)}"</div>`
        : '';

    return (header + snippet) || 'See document';
}

function formatLocationText(location) {
    const parts = [];
    if (location.paragraph) parts.push(`Para ${location.paragraph}`);
    if (location.footnote) parts.push(`Footnote ${location.footnote}`);
    if (location.section) parts.push(location.section);
    if (location.text) parts.push(`"${location.text}"`);
    return parts.length > 0 ? parts.join(' • ') : 'See document';
}

function showError(message) {
    const resultsSection = document.getElementById('resultsSection');
    const summaryDiv = document.getElementById('summary');
    const issuesList = document.getElementById('issuesList');

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    summaryDiv.innerHTML = `<div class="error-message"><strong>❌ Error:</strong> ${escapeHtml(message)}</div>`;
    issuesList.innerHTML = '';
}

function downloadReport(results, filename) {
    const report = generateTextReport(results, filename);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAIACS_Validation_Report_${filename.replace(/\.docx$/i, '')}.txt`;
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
            if (issue.location) report += `   Location: ${formatLocationText(issue.location)}\n`;
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
