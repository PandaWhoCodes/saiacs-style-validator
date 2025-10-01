const { parseDocx } = require('./parsers/docxParser');
const { validateFormatting } = require('./validators/formattingValidator');
const { validateCitations } = require('./validators/citationValidator');
const { validateStructure } = require('./validators/structureValidator');
const { validateQuotations } = require('./validators/quotationValidator');
const { validateHeadings } = require('./validators/headingValidator');

/**
 * Main validation function
 * @param {string} filePath - Path to the DOCX file
 * @param {string} documentType - 'assignment' or 'dissertation'
 * @returns {Object} Validation results with errors, warnings, and suggestions
 */
async function validateDocument(filePath, documentType = 'assignment') {
    try {
        // Parse the DOCX file
        const documentData = await parseDocx(filePath);

        // Run all validators
        const results = {
            documentType,
            fileName: filePath,
            summary: {
                totalIssues: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            },
            issues: []
        };

        // 1. Validate formatting
        const formattingIssues = validateFormatting(documentData, documentType);
        results.issues.push(...formattingIssues);

        // 2. Validate citations and footnotes
        const citationIssues = validateCitations(documentData);
        results.issues.push(...citationIssues);

        // 3. Validate document structure
        const structureIssues = validateStructure(documentData, documentType);
        results.issues.push(...structureIssues);

        // 4. Validate quotations
        const quotationIssues = validateQuotations(documentData);
        results.issues.push(...quotationIssues);

        // 5. Validate headings
        const headingIssues = validateHeadings(documentData, documentType);
        results.issues.push(...headingIssues);

        // Calculate summary
        results.issues.forEach(issue => {
            results.summary.totalIssues++;
            results.summary[issue.severity]++;
        });

        // Sort issues by severity and location
        results.issues.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return (a.location?.paragraph || 0) - (b.location?.paragraph || 0);
        });

        return results;

    } catch (error) {
        console.error('Error validating document:', error);
        throw new Error(`Validation failed: ${error.message}`);
    }
}

module.exports = { validateDocument };
