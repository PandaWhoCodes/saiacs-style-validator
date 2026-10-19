/**
 * Validate document structure and preliminary pages according to SAIACS Style Guide (Sections 1.2, 2.1, 2.2, Appendices 1 & 2)
 */

function validateStructure(documentData, documentType) {
    const issues = [];
    const text = documentData.content.text;
    const paragraphs = documentData.content.paragraphs;
    const structure = documentData.structure;

    const coverParagraphs = paragraphs.filter(p => p.section === 'cover' && !p.isEmpty);
    const coverText = coverParagraphs.map(p => p.text).join('\n') || text.substring(0, 1500);

    // 1. Validate Preliminary Pages by Document Type
    if (documentType === 'assignment') {
        const requiredCoverElements = [
            { pattern: /SOUTH\s+ASIA\s+INSTITUTE\s+OF\s+ADVANCED\s+CHRISTIAN\s+STUDIES/i, name: 'SAIACS institution header' },
            { pattern: /submitted\s+to/i, name: '"Submitted to"' },
            { pattern: /partial\s+fulfil+ment/i, name: '"in partial fulfilment of the requirements..."' },
            { pattern: /due\s+date/i, name: 'Due Date' },
            { pattern: /date\s+submitted/i, name: 'Date Submitted' },
            { pattern: /expected\s+time/i, name: 'Expected Time' },
            { pattern: /actual\s+time/i, name: 'Actual Time' },
            { pattern: /expected\s+word\s+count/i, name: 'Expected Word count' },
            { pattern: /actual\s+word\s+count/i, name: 'Actual Word Count' }
        ];

        requiredCoverElements.forEach(({ pattern, name }) => {
            if (!pattern.test(coverText)) {
                issues.push({
                    category: 'Structure',
                    severity: 'high',
                    rule: 'Assignment Cover Page (Appendix 1)',
                    message: `Cover page is missing ${name}.`,
                    expected: `${name} on cover page`,
                    found: `${name} not found`,
                    location: { section: 'Cover Page' },
                    fix: `Add ${name} to the cover page following Appendix 1 (p. 32)`
                });
            }
        });

        // Check for Academic Honesty Declaration
        if (!/declare\s+that\s+this\s+assignment\s+is\s+(my|our)\s+own\s+unaided\s+work/i.test(text)) {
            issues.push({
                category: 'Structure',
                severity: 'critical',
                rule: 'Academic Honesty Declaration (Section 1.2.1 & Appendix 1)',
                message: 'Assignment must include the Academic Honesty declaration.',
                expected: '"I declare that this assignment is my own unaided work. I have not copied it from any person, article, book, website or other form of storage. Every idea or phrase that is not my own has been duly acknowledged."',
                found: 'No academic honesty declaration found',
                location: { section: 'Cover Page / End of Assignment' },
                fix: 'Add the required Academic Honesty declaration paragraph'
            });
        } else {
            // Check for the common "is no my own" typo
            const typoPara = paragraphs.find(p => /phrase\s+that\s+is\s+no\s+my\s+own/i.test(p.text));
            if (typoPara) {
                issues.push({
                    category: 'Structure',
                    severity: 'low',
                    rule: 'Declaration Wording (Section 1.2.1)',
                    message: `Academic honesty declaration in Paragraph ${typoPara.index} contains a typo ("is no my own" instead of "is not my own").`,
                    expected: '"Every idea or phrase that is not my own has been duly acknowledged."',
                    found: '"...Every idea or phrase that is no my own..."',
                    location: {
                        paragraph: typoPara.index,
                        text: typoPara.text.trim()
                    },
                    fix: 'Change "no my own" to "not my own"'
                });
            }
        }

        // Check for Signature line
        if (!/signature\s*:/i.test(coverText)) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Assignment Cover Page (Appendix 1)',
                message: 'Cover page should include a Signature line.',
                expected: 'Signature: _________________',
                found: 'No signature line found',
                location: { section: 'Cover Page' },
                fix: 'Add "Signature: _________________" on the cover page'
            });
        }

        // Check for Registration / Admission number
        if (!/(registration|admission)\s*(#|no\.?|number)/i.test(coverText)) {
            issues.push({
                category: 'Structure',
                severity: 'low',
                rule: 'Assignment Cover Page (Appendix 1)',
                message: 'Cover page should include your Registration # (e.g., "Registration #2091").',
                expected: 'Registration #[number]',
                found: 'No Registration # found',
                location: { section: 'Cover Page' },
                fix: 'Add your Registration # below your name on the cover page'
            });
        }

    } else if (documentType === 'dissertation') {
        if (!structure.hasTableOfContents) {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Table of Contents (Section 2.2)',
                message: 'Dissertation must include a Table of Contents.',
                expected: 'Table of Contents after Declaration page',
                found: 'No Table of Contents found',
                location: { section: 'Preliminary Pages' },
                fix: 'Add a Table of Contents page in the preliminary pages (Appendix 2)'
            });
        }

        if (!/(declaration|hereby\s+declare)/i.test(text)) {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Declaration Page (Appendix 2)',
                message: 'Dissertation must include the signed Declaration page.',
                expected: 'Declaration page with the 3 required statements (Appendix 2, p. 35)',
                found: 'No Declaration page found',
                location: { section: 'Preliminary Pages' },
                fix: 'Add the Declaration page after the Signatory page'
            });
        }

        const chapterHeadings = documentData.content.headings.filter(h => h.level === 1);
        if (chapterHeadings.length < 3) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Dissertation Chapter Structure (Section 2.2)',
                message: 'Dissertation should include an Introductory Chapter, main study chapters, and a Summary Chapter.',
                expected: 'At least 3 Level-1 chapter headings',
                found: `${chapterHeadings.length} Level-1 chapter headings detected`,
                location: { section: 'Document Structure' },
                fix: 'Ensure all chapters use Level 1 headings (e.g., "1. CHAPTER ONE HEADING")'
            });
        }
    }

    // 2. Check for Impossible Calendar Dates (e.g. "Sep 31, 2025" or "31-Sep-2025")
    const thirtyDayMonths = /(?:(?:\b(?:sep|sept|september|apr|april|jun|june|nov|november)\b\.?\s+31\b)|(?:\b31[\s/-](?:sep|sept|september|apr|april|jun|june|nov|november)\b)|(?:\b(?:feb|february)\b\.?\s+(?:30|31)\b)|(?:\b(?:30|31)[\s/-](?:feb|february)\b))/i;
    paragraphs.forEach(para => {
        if (para.isEmpty) return;
        const m = para.text.match(thirtyDayMonths);
        if (m) {
            issues.push({
                category: 'Structure',
                severity: 'low',
                rule: 'Invalid Date on Cover/Declaration',
                message: `Paragraph ${para.index} contains a non-existent calendar date ("${m[0]}").`,
                expected: 'Valid calendar date (e.g., Sep 30, 2025)',
                found: m[0],
                location: {
                    paragraph: para.index,
                    text: para.text.trim()
                },
                fix: `Correct the date "${m[0]}"`
            });
        }
    });

    // 3. Validate Bibliography Presence and Ordering (Sections 2.1 & 2.2)
    const bibHeaderPara = paragraphs.find(p => p.section === 'bibliographyHeader');
    if (!bibHeaderPara && structure.wordCount > 500) {
        issues.push({
            category: 'Structure',
            severity: 'high',
            rule: 'Bibliography Section (Section 2.1)',
            message: 'Document must include a Bibliography section at the end.',
            expected: 'Bibliography section at end of document',
            found: 'No Bibliography section found',
            location: { section: 'End of Document' },
            fix: 'Add a "Bibliography" section at the end of the paper'
        });
    } else if (bibHeaderPara) {
        // Check that no body or appendix paragraphs appear after the Bibliography
        const appendixPara = paragraphs.find(p => p.section === 'appendix');
        if (appendixPara && appendixPara.index > bibHeaderPara.index) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Appendix Placement (Section 2.1)',
                message: 'Appendices must be placed before the Bibliography.',
                expected: 'Main Text → Appendices → Bibliography',
                found: 'Appendix appears after Bibliography',
                location: {
                    paragraph: appendixPara.index,
                    text: appendixPara.text.trim()
                },
                fix: 'Move the Appendix section before the Bibliography'
            });
        }
    }

    return issues;
}

module.exports = { validateStructure };
