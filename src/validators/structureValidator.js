/**
 * Validate document structure according to SAIACS Style Guide
 */

function validateStructure(documentData, documentType) {
    const issues = [];
    const text = documentData.content.text;
    const structure = documentData.structure;

    // Check for required preliminary pages based on document type
    if (documentType === 'assignment') {
        // Assignment requirements

        // Check for proper cover page elements
        const requiredCoverElements = [
            { pattern: /SOUTH ASIA INSTITUTE OF ADVANCED CHRISTIAN STUDIES/i, name: 'SAIACS header' },
            { pattern: /submitted\s+to/i, name: '"Submitted to"' },
            { pattern: /partial\s+fulfillment/i, name: '"In Partial Fulfillment"' },
            { pattern: /due\s+date/i, name: 'Due Date' },
            { pattern: /expected\s+(time|word)/i, name: 'Expected Time/Word Count' },
            { pattern: /actual\s+(time|word)/i, name: 'Actual Time/Word Count' }
        ];

        requiredCoverElements.forEach(({ pattern, name }) => {
            if (!pattern.test(text)) {
                issues.push({
                    category: 'Structure',
                    severity: 'high',
                    rule: 'Cover Page Format',
                    message: `Cover page must include ${name}`,
                    expected: `${name} on cover page`,
                    found: `${name} not found`,
                    location: { section: 'Cover Page' },
                    fix: `Add ${name} to cover page as per sample format`
                });
            }
        });

        // Check for academic honesty declaration (should be ON cover page)
        if (!/(I\s+)?declare\s+that\s+this\s+assignment\s+is\s+(my|our)\s+own\s+unaided\s+work/i.test(text)) {
            issues.push({
                category: 'Structure',
                severity: 'critical',
                rule: 'Academic Honesty Declaration',
                message: 'Cover page must include academic honesty declaration',
                expected: 'Declaration: "I declare that this assignment is my own unaided work. I have not copied it from any person, article, book, website or other form of storage. Every idea or phrase that is not my own has been duly acknowledged."',
                found: 'No declaration found',
                location: { section: 'Cover Page (bottom section)' },
                fix: 'Add required declaration on cover page above signature line'
            });
        }

        // Check for signature line
        if (!/signature\s*:/i.test(text)) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Cover Page Format',
                message: 'Cover page should include signature line',
                expected: 'Signature: _________________',
                found: 'No signature line found',
                location: { section: 'Cover Page' },
                fix: 'Add "Signature: _________________" after declaration'
            });
        }

    } else if (documentType === 'dissertation') {
        // Dissertation requirements

        // Check for Table of Contents
        if (!structure.hasTableOfContents) {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Table of Contents',
                message: 'Dissertation must include Table of Contents',
                expected: 'Table of Contents after Declaration page',
                found: 'No Table of Contents found',
                location: { section: 'Preliminary pages' },
                fix: 'Add Table of Contents'
            });
        }

        // Check for Declaration page
        if (!/(declaration|hereby declare)/i.test(text)) {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Declaration Page',
                message: 'Dissertation must include Declaration page',
                expected: 'Declaration page with required statements',
                found: 'No Declaration page found',
                location: { section: 'Preliminary pages' },
                fix: 'Add Declaration page after Signatory page'
            });
        }

        // Check for proper chapter structure (should have multiple chapters)
        const chapterHeadings = documentData.content.headings.filter(h =>
            h.level === 1 && /chapter|introduction|conclusion/i.test(h.text)
        );

        if (chapterHeadings.length < 3) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Chapter Structure',
                message: 'Dissertation should have at least Introduction + body chapters + Conclusion',
                expected: 'Minimum 3 chapters',
                found: `${chapterHeadings.length} chapters detected`,
                location: { section: 'Document structure' },
                fix: 'Ensure proper chapter division'
            });
        }
    }

    // Check for Bibliography (required for both types with substantial content)
    if (!structure.hasBibliography && structure.wordCount > 1500) {
        issues.push({
            category: 'Structure',
            severity: 'high',
            rule: 'Bibliography',
            message: 'Document must include Bibliography section',
            expected: 'Bibliography at end of document',
            found: 'No Bibliography section found',
            location: { section: 'End of document' },
            fix: 'Add Bibliography section at the end'
        });
    }

    // Check for proper pagination structure
    // Preliminary pages should have Roman numerals, main text should have Arabic
    // This would require deeper analysis of the page numbering

    // Check for line spacing between paragraphs
    let consecutiveNonEmptyParas = 0;
    documentData.content.paragraphs.forEach((para, idx) => {
        if (!para.isEmpty) {
            consecutiveNonEmptyParas++;
            if (consecutiveNonEmptyParas > 1) {
                // Check if there's proper spacing between paragraphs
                // This is simplified - would need actual paragraph spacing data
            }
        } else {
            consecutiveNonEmptyParas = 0;
        }
    });

    // Check for proper section organization
    // Introduction should come before main content
    const introIndex = text.toLowerCase().indexOf('introduction');
    const biblioIndex = text.toLowerCase().indexOf('bibliography');

    if (introIndex > 1000) { // If introduction appears late in document
        issues.push({
            category: 'Structure',
            severity: 'low',
            rule: 'Document Organization',
            message: 'Introduction should appear at the beginning of the document',
            expected: 'Introduction as first section',
            found: 'Introduction appears later in document',
            location: { section: 'Document structure' }
        });
    }

    if (biblioIndex !== -1 && biblioIndex < text.length - 1000) {
        issues.push({
            category: 'Structure',
            severity: 'medium',
            rule: 'Bibliography Placement',
            message: 'Bibliography should be at the end of the document',
            expected: 'Bibliography as final section',
            found: 'Bibliography appears before end',
            location: { section: 'Bibliography' }
        });
    }

    // Check for appendices (if present, should be before bibliography)
    const appendixIndex = text.toLowerCase().indexOf('appendix');
    if (appendixIndex !== -1 && biblioIndex !== -1 && appendixIndex > biblioIndex) {
        issues.push({
            category: 'Structure',
            severity: 'medium',
            rule: 'Appendix Placement',
            message: 'Appendices should come before Bibliography',
            expected: 'Order: Main text → Appendices → Bibliography',
            found: 'Appendix appears after Bibliography',
            location: { section: 'End matter' },
            fix: 'Move appendices before Bibliography'
        });
    }

    return issues;
}

module.exports = { validateStructure };
