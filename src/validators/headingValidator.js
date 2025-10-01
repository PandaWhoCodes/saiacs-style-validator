/**
 * Validate headings structure according to SAIACS Style Guide
 */

function validateHeadings(documentData, documentType) {
    const issues = [];
    const headings = documentData.content.headings;

    if (headings.length === 0) {
        if (documentType === 'dissertation') {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Headings',
                message: 'Dissertation should have chapter headings',
                expected: 'Chapter headings present',
                found: 'No headings detected',
                location: { section: 'Document' },
                fix: 'Add chapter and section headings'
            });
        }
        return issues;
    }

    let previousLevel = 0;

    headings.forEach((heading, idx) => {
        // Check heading level progression (shouldn't skip levels)
        if (heading.level > previousLevel + 1 && previousLevel > 0) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Heading Hierarchy',
                message: `Heading level skipped (went from ${previousLevel} to ${heading.level})`,
                expected: `Level ${previousLevel + 1}`,
                found: `Level ${heading.level}`,
                location: { paragraph: heading.index, text: heading.text },
                fix: 'Use consecutive heading levels without skipping'
            });
        }

        // Check max heading depth (should not exceed 4 levels)
        if (heading.level > 4) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Heading Depth',
                message: 'Heading depth should not exceed 4 levels',
                expected: 'Maximum level 4',
                found: `Level ${heading.level}`,
                location: { paragraph: heading.index, text: heading.text },
                fix: 'Use "firstly", "secondly" etc. instead of deeper levels'
            });
        }

        // Check heading format based on level
        switch (heading.level) {
            case 1:
                // Should be ALL CAPS and bold
                if (heading.text !== heading.text.toUpperCase()) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'high',
                        rule: 'Level 1 Heading Format',
                        message: 'Level 1 headings must be in ALL CAPS',
                        expected: heading.text.toUpperCase(),
                        found: heading.text,
                        location: { paragraph: heading.index },
                        fix: 'Change to ALL CAPS'
                    });
                }

                // Should have numbering like "1. SECTION HEADING"
                if (!/^\d+\.\s+[A-Z\s]+$/.test(heading.text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 1 Heading Format',
                        message: 'Level 1 headings should follow format: "1. HEADING TEXT"',
                        expected: 'Number. HEADING',
                        found: heading.text,
                        location: { paragraph: heading.index }
                    });
                }
                break;

            case 2:
                // Should be Title Case and bold
                if (!/^\d+\.\d+\s+/.test(heading.text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 2 Heading Format',
                        message: 'Level 2 headings should follow format: "1.1 Heading Text"',
                        expected: 'Number.Number Heading',
                        found: heading.text,
                        location: { paragraph: heading.index }
                    });
                }
                break;

            case 3:
                // Should be Title Case and bold
                if (!/^\d+\.\d+\.\d+\s+/.test(heading.text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 3 Heading Format',
                        message: 'Level 3 headings should follow format: "1.1.1 Heading Text"',
                        expected: 'Number.Number.Number Heading',
                        found: heading.text,
                        location: { paragraph: heading.index }
                    });
                }
                break;

            case 4:
                // Should be italic and Title Case
                if (!/^\d+\.\d+\.\d+\.\d+\s+/.test(heading.text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'low',
                        rule: 'Level 4 Heading Format',
                        message: 'Level 4 headings should follow format: "1.1.1.1 Heading Text" (italic)',
                        expected: 'Number.Number.Number.Number Heading',
                        found: heading.text,
                        location: { paragraph: heading.index }
                    });
                }
                break;
        }

        // Check for dissertation chapter format
        if (documentType === 'dissertation' && heading.level === 1) {
            // Should be "1. CHAPTER ONE HEADING" or similar
            if (!/^\d+\.\s+(CHAPTER\s+)?[A-Z\s]+$/.test(heading.text)) {
                issues.push({
                    category: 'Structure',
                    severity: 'medium',
                    rule: 'Chapter Heading Format',
                    message: 'Dissertation chapter headings should include "CHAPTER" (optional) followed by chapter title',
                    expected: '1. CHAPTER ONE HEADING or 1. HEADING',
                    found: heading.text,
                    location: { paragraph: heading.index }
                });
            }
        }

        previousLevel = heading.level;
    });

    return issues;
}

module.exports = { validateHeadings };
