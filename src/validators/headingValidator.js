/**
 * Validate headings structure and formatting according to SAIACS Style Guide (Sections 2.3 & 2.4)
 */

function validateHeadings(documentData, documentType) {
    const issues = [];
    const headings = documentData.content.headings;
    const paragraphs = documentData.content.paragraphs;

    // 1. Check if document has decimal-numbered headings
    if (headings.length === 0) {
        if (documentType === 'dissertation') {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Headings (Section 2.4)',
                message: 'Dissertation must include numbered chapter and section headings (e.g., "1. CHAPTER ONE HEADING", "1.1 Sub-heading").',
                expected: 'Decimal outline headings (1., 1.1, 1.1.1)',
                found: 'No numbered headings detected',
                location: { section: 'Document Body' },
                fix: 'Add decimal-numbered chapter and section headings'
            });
        } else {
            // Look for unnumbered bold standalone lines in body
            const unnumberedBoldHeadings = paragraphs.filter(p =>
                p.section === 'body' &&
                !p.isEmpty &&
                p.formatting.bold &&
                p.text.trim().length < 100 &&
                !/^\d+\./.test(p.text.trim())
            );

            if (unnumberedBoldHeadings.length > 0 || documentData.structure.bodyWordCount > 1500) {
                issues.push({
                    category: 'Structure',
                    severity: 'medium',
                    rule: 'Section Headings (Section 2.3)',
                    message: 'Research paper does not use decimal outline section headings (e.g., "1. INTRODUCTION", "1.1 Sub-heading").',
                    expected: 'Decimal outline system: "1. SECTION HEADING", "1.1 Sub-heading of the First Degree"',
                    found: unnumberedBoldHeadings.length > 0
                        ? `Unnumbered bold heading: "${unnumberedBoldHeadings[0].text.trim()}"`
                        : 'No decimal-numbered section headings found',
                    location: unnumberedBoldHeadings.length > 0
                        ? { paragraph: unnumberedBoldHeadings[0].index, text: unnumberedBoldHeadings[0].text.trim() }
                        : { section: 'Document Body' },
                    fix: 'Divide the research paper into numbered sections using the decimal outline system (1. SECTION HEADING, 1.1 Sub-heading)'
                });
            }
        }
        return issues;
    }

    let previousLevel = 0;

    headings.forEach(heading => {
        const text = heading.text.trim();

        // Check heading level progression (should not skip levels)
        if (heading.level > previousLevel + 1 && previousLevel > 0) {
            issues.push({
                category: 'Structure',
                severity: 'medium',
                rule: 'Heading Hierarchy (Section 2.3)',
                message: `Heading level skipped from Level ${previousLevel} to Level ${heading.level} ("${text}").`,
                expected: `Level ${previousLevel + 1}`,
                found: `Level ${heading.level}`,
                location: { paragraph: heading.index, text },
                fix: 'Use consecutive heading levels without skipping'
            });
        }

        // Check max heading depth (must not exceed 4 levels, Section 2.4)
        if (heading.level > 4) {
            issues.push({
                category: 'Structure',
                severity: 'high',
                rule: 'Heading Depth (Section 2.4)',
                message: `Heading "${text}" is at Level ${heading.level}. Do not move beyond the fourth level (1.1.1.1).`,
                expected: 'Maximum 4 heading levels (1.1.1.1)',
                found: `Level ${heading.level}`,
                location: { paragraph: heading.index, text },
                fix: 'Restrict headings to 4 levels; beyond four levels, use "firstly," "secondly," etc. in text'
            });
        } else if (documentType === 'assignment' && heading.level === 4) {
            issues.push({
                category: 'Structure',
                severity: 'low',
                rule: 'Research Paper Heading Depth (Section 2.3)',
                message: `For a research paper, SAIACS recommends restricting sub-headings to three levels (1.1.1); found fourth-level heading "${text}".`,
                expected: 'Up to 3 levels (1.1.1) for a research paper',
                found: `Level 4 heading (${text})`,
                location: { paragraph: heading.index, text },
                fix: 'Consider restricting research paper headings to 3 levels (1.1.1)'
            });
        }

        // Check heading format based on level
        const titleWithoutNumber = text.replace(/^\d+(?:\.\d+)*\.?\s*/, '');

        switch (heading.level) {
            case 1:
                // Level 1: 1. SECTION HEADING (ALL CAPS, Bold)
                if (titleWithoutNumber !== titleWithoutNumber.toUpperCase()) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'high',
                        rule: 'Level 1 Heading Format (Section 2.3)',
                        message: `Level 1 heading "${text}" must be in ALL CAPS and Bold.`,
                        expected: text.toUpperCase(),
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Change Level 1 heading to ALL CAPS and Bold (e.g., "1. SECTION HEADING")'
                    });
                }
                if (!/^\d+\.\s+/.test(text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 1 Heading Numbering (Section 2.3)',
                        message: `Level 1 heading "${text}" must start with a number and period (e.g., "1. SECTION HEADING").`,
                        expected: '1. SECTION HEADING',
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Add decimal numbering ("1. ", "2. ") before the Level 1 heading'
                    });
                }
                if (heading.formatting && !heading.formatting.bold) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 1 Heading Bold (Section 2.3)',
                        message: `Level 1 heading "${text}" must be Bold.`,
                        expected: 'Bold text',
                        found: 'Non-bold text',
                        location: { paragraph: heading.index, text },
                        fix: 'Make the Level 1 heading Bold'
                    });
                }
                break;

            case 2:
                // Level 2: 1.1 Sub-heading of the First Degree (Bold, Title Case)
                if (!/^\d+\.\d+\s+/.test(text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 2 Heading Numbering (Section 2.3)',
                        message: `Level 2 heading "${text}" should follow the format "1.1 Sub-heading of the First Degree".`,
                        expected: '1.1 Sub-heading Title',
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Use two-level decimal numbering (e.g., "1.1 ") and Bold Title Case'
                    });
                }
                if (titleWithoutNumber === titleWithoutNumber.toUpperCase() && titleWithoutNumber.length > 4) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'low',
                        rule: 'Level 2 Heading Case (Section 2.3)',
                        message: `Level 2 heading "${text}" should be in Title Case, not ALL CAPS.`,
                        expected: '1.1 Sub-heading in Title Case (Bold)',
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Change Level 2 heading from ALL CAPS to Title Case'
                    });
                }
                if (heading.formatting && !heading.formatting.bold) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 2 Heading Bold (Section 2.3)',
                        message: `Level 2 heading "${text}" must be Bold.`,
                        expected: 'Bold text',
                        found: 'Non-bold text',
                        location: { paragraph: heading.index, text },
                        fix: 'Make the Level 2 heading Bold'
                    });
                }
                break;

            case 3:
                // Level 3: 1.1.1 Sub-heading of the Second Degree (Regular/Roman, Title Case)
                if (!/^\d+\.\d+\.\d+\s+/.test(text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'medium',
                        rule: 'Level 3 Heading Numbering (Section 2.3)',
                        message: `Level 3 heading "${text}" should follow the format "1.1.1 Sub-heading of the Second Degree".`,
                        expected: '1.1.1 Sub-heading Title',
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Use three-level decimal numbering (e.g., "1.1.1 ")'
                    });
                }
                break;

            case 4:
                // Level 4: 1.1.1.1 Sub-heading of the Third Degree (Italic, Title Case)
                if (!/^\d+\.\d+\.\d+\.\d+\s+/.test(text)) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'low',
                        rule: 'Level 4 Heading Numbering (Section 2.4)',
                        message: `Level 4 heading "${text}" should follow the format "1.1.1.1 Sub-heading of the Third Degree" (italicized).`,
                        expected: '1.1.1.1 Sub-heading Title (italic)',
                        found: text,
                        location: { paragraph: heading.index, text },
                        fix: 'Use four-level decimal numbering (e.g., "1.1.1.1 ") and italicize'
                    });
                }
                if (heading.formatting && !heading.formatting.italic) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'low',
                        rule: 'Level 4 Heading Italics (Section 2.4)',
                        message: `Level 4 heading "${text}" must be italicized.`,
                        expected: 'Italicized heading',
                        found: 'Non-italicized heading',
                        location: { paragraph: heading.index, text },
                        fix: 'Italicize the Level 4 heading (keeping any Greek/Hebrew words non-italicized)'
                    });
                }
                break;
        }

        previousLevel = heading.level;
    });

    return issues;
}

module.exports = { validateHeadings };
