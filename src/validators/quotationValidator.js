/**
 * Validate quotations according to SAIACS Style Guide
 */

function validateQuotations(documentData) {
    const issues = [];
    const quotations = documentData.content.quotations;

    quotations.forEach((quote, idx) => {
        const textSnippet = quote.text.substring(0, 80).trim();

        // Check if long quotations (>4 lines) are properly formatted as block quotes
        if (quote.needsBlockFormat) {
            issues.push({
                category: 'Quotations',
                severity: 'high',
                rule: 'Block Quotation Format',
                message: 'Quotations longer than 4 lines must be formatted as block quotes',
                expected: 'Block quote format (11pt, indented, no quotation marks)',
                found: 'Regular quotation with marks',
                location: {
                    text: textSnippet + (quote.text.length > 80 ? '...' : '')
                },
                fix: 'Remove quotation marks, indent, and change to 11pt font'
            });
        }

        // Check for proper quotation mark style
        // Should use double quotes, with single quotes inside
        if (quote.text.includes('"')) {
            const hasNestedSingleQuotes = /"[^"]*'[^']*'[^"]*"/.test(`"${quote.text}"`);
            // This is correct format
        }

        // Check for incorrect apostrophe usage in quotes
        if (quote.text.includes("'") && !quote.text.includes('"')) {
            issues.push({
                category: 'Quotations',
                severity: 'low',
                rule: 'Quotation Marks',
                message: 'Use double quotes for quotations, single quotes only for quotes within quotes',
                expected: 'Double quotation marks ("...")',
                found: 'Single quotation marks',
                location: {
                    text: textSnippet + (quote.text.length > 80 ? '...' : '')
                },
                fix: 'Change to double quotation marks'
            });
        }
    });

    // Check all paragraphs for quotation-related issues
    documentData.content.paragraphs.forEach((para, idx) => {
        if (para.isEmpty) return;

        // Check for footnote placement with quotations
        // Footnote should come after closing quote
        if (/["']\s+\d+/.test(para.text)) {
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Footnote Placement',
                message: 'Footnote number should immediately follow closing quotation mark (no space)',
                expected: 'text"¹ or text."¹',
                found: 'text" ¹ (space before footnote)',
                location: { paragraph: idx + 1 },
                fix: 'Remove space between quote and footnote number'
            });
        }

        // Check for question marks with quotations
        // Should be outside unless part of quoted material
        if (/[?!]"\s/.test(para.text)) {
            // This might be correct - question mark inside quote
        }

        if (/"[^?!]+\?/.test(para.text)) {
            // Question mark inside quote - good
        }

        // Check for comma/period placement (should be outside quotes for UK English)
        // Actually, SAIACS style says "outside full-stops and commas"
        if (/,"|."/.test(para.text)) {
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Punctuation Placement',
                message: 'Place periods and commas outside quotation marks',
                expected: '", or ".',
                found: '," or ."',
                location: { paragraph: idx + 1, text: para.text.substring(0, 100) },
                fix: 'Move period/comma outside closing quote'
            });
        }

        // Check for scripture quotations in proper format
        if (para.text.match(/["'](.*?)[""'].*?\([A-Z][a-z]+\.?\s+\d+:\d+(-\d+)?\)/)) {
            // Scripture quote followed by reference in parentheses - correct format
        }
    });

    return issues;
}

module.exports = { validateQuotations };
