/**
 * Validate citations and footnotes according to Chicago Manual of Style 17 (SAIACS adaptation)
 */

function validateCitations(documentData) {
    const issues = [];
    const footnotes = documentData.content.footnotes;
    const text = documentData.content.text;
    const paragraphs = documentData.content.paragraphs;

    // Check for prohibited Latin abbreviations
    const prohibitedTerms = [
        { term: 'ibid', full: 'ibidem', replacement: 'abbreviated footnote style' },
        { term: 'et al', full: 'et alii', replacement: '"and others"' },
        { term: 'op. cit.', full: 'opere citato', replacement: 'full abbreviated reference' },
        { term: 'loc. cit.', full: 'loco citato', replacement: 'full abbreviated reference' }
    ];

    footnotes.forEach((footnote, idx) => {
        const noteText = footnote.text.toLowerCase();
        const textSnippet = footnote.text.substring(0, 100).trim();

        prohibitedTerms.forEach(({ term, replacement }) => {
            if (noteText.includes(term.toLowerCase())) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'Latin Abbreviations',
                    message: `Do not use "${term}" in citations. Use ${replacement} instead.`,
                    expected: replacement,
                    found: term,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet + (footnote.text.length > 100 ? '...' : '')
                    },
                    fix: `Replace "${term}" with ${replacement}`
                });
            }
        });

        // Check for "f." or "ff." (should use exact page numbers)
        if (/\bp\.\s*\d+\s*f{1,2}\b/i.test(footnote.text)) {
            issues.push({
                category: 'Citations',
                severity: 'high',
                rule: 'Page References',
                message: 'Use exact page ranges instead of "f." or "ff."',
                expected: 'Exact page numbers (e.g., 45-47)',
                found: 'f. or ff. notation',
                location: {
                    footnote: footnote.id,
                    text: textSnippet + (footnote.text.length > 100 ? '...' : '')
                },
                fix: 'Replace with exact page range'
            });
        }

        // Check for proper shortened form in subsequent citations
        // This is a simplified check
        if (footnote.text.length < 30 && /\d+$/.test(footnote.text.trim())) {
            // Might be properly shortened - good
        }

        // Check for URL without access date for informal sources
        if (footnote.text.includes('http') && !footnote.text.includes('accessed')) {
            // Check if it looks like a blog, personal site, etc.
            if (/blog|wordpress|medium|personal/i.test(footnote.text)) {
                issues.push({
                    category: 'Citations',
                    severity: 'medium',
                    rule: 'Web Citations',
                    message: 'Informal online sources should include access date',
                    expected: 'Include "accessed [date]" before URL',
                    found: 'URL without access date',
                    location: { footnote: footnote.id },
                    fix: 'Add access date before URL'
                });
            }
        }

        // Check for proper title formatting in citations
        // Book titles should be italicized, article titles in quotes
        // This is complex and would need deeper analysis of the XML
    });

    // Check for quotations without citations
    const quotations = documentData.content.quotations;

    quotations.forEach((quote, idx) => {
        // Look for nearby footnote indicator in text
        const contextStart = Math.max(0, quote.start - 50);
        const contextEnd = Math.min(text.length, quote.start + quote.text.length + 50);
        const context = text.substring(contextStart, contextEnd);

        // Simple check: if there's no number after the quote, might be missing citation
        if (!/["']\s*\d+/.test(context)) {
            issues.push({
                category: 'Citations',
                severity: 'critical',
                rule: 'Missing Citations',
                message: 'Quotation appears to lack a citation',
                expected: 'Footnote number after quotation',
                found: 'No footnote indicator found',
                location: { text: quote.text.substring(0, 100) },
                fix: 'Add footnote citation'
            });
        }
    });

    // Check for bibliography presence in longer documents
    if (documentData.structure.wordCount > 2000 && !documentData.structure.hasBibliography) {
        issues.push({
            category: 'Citations',
            severity: 'high',
            rule: 'Bibliography',
            message: 'Document should include a Bibliography section',
            expected: 'Bibliography at end of document',
            found: 'No Bibliography section detected',
            location: { section: 'End of document' },
            fix: 'Add Bibliography section at the end'
        });
    }

    // Check for proper scripture citation format
    const scripturePattern = /\b(Gen|Exod|Lev|Num|Deut|Josh|Judg|Ruth|Sam|Kings|Chron|Ezra|Neh|Esther|Job|Ps|Prov|Eccles|Song|Isa|Jer|Lam|Ezek|Dan|Hosea|Joel|Amos|Obad|Jon|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt|Mark|Luke|John|Acts|Rom|Cor|Gal|Eph|Phil|Col|Thess|Tim|Titus|Philem|Heb|James|Pet|John|Jude|Rev)\s*\d+:\d+/g;

    documentData.content.paragraphs.forEach((para, idx) => {
        const matches = para.text.match(scripturePattern);
        if (matches) {
            // Check if scripture references have footnotes (they shouldn't)
            const hasFootnoteNearby = /\d+:\d+\s*\d+/.test(para.text);

            if (hasFootnoteNearby) {
                issues.push({
                    category: 'Citations',
                    severity: 'low',
                    rule: 'Scripture Citations',
                    message: 'Scripture references should not have footnotes',
                    expected: 'Scripture reference without footnote',
                    found: 'Footnote after scripture',
                    location: { paragraph: idx + 1, text: para.text.substring(0, 100) },
                    fix: 'Remove footnote from scripture reference'
                });
            }
        }
    });

    // 5. Check Bibliography Alphabetization
    // Look for a bibliography section
    const bibliographyStart = paragraphs.findIndex(para =>
        /^(bibliography|references|works cited)/i.test(para.text.trim())
    );

    if (bibliographyStart !== -1) {
        // Extract bibliography entries (typically entries that start with author names)
        const bibliographyEntries = [];
        for (let i = bibliographyStart + 1; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            if (para.isEmpty) continue;

            // Bibliography entries typically start with author surname
            // and contain publication years
            if (/^[A-Z][a-z]+/.test(para.text.trim()) &&
                /\d{4}/.test(para.text)) {
                bibliographyEntries.push({
                    text: para.text.trim(),
                    index: i + 1
                });
            }
        }

        // Check alphabetical order
        if (bibliographyEntries.length > 1) {
            let previousEntry = bibliographyEntries[0];
            for (let i = 1; i < bibliographyEntries.length; i++) {
                const currentEntry = bibliographyEntries[i];

                // Extract surname (first word of entry)
                const prevSurname = previousEntry.text.split(/[,\s]/)[0].toLowerCase();
                const currSurname = currentEntry.text.split(/[,\s]/)[0].toLowerCase();

                if (prevSurname > currSurname) {
                    issues.push({
                        category: 'Citations',
                        severity: 'high',
                        rule: 'Bibliography Order',
                        message: `Bibliography entries not in alphabetical order`,
                        expected: `"${currSurname}" should come before "${prevSurname}"`,
                        found: `"${prevSurname}" appears before "${currSurname}"`,
                        location: {
                            paragraph: currentEntry.index,
                            text: currentEntry.text.substring(0, 80) + (currentEntry.text.length > 80 ? '...' : '')
                        },
                        fix: 'Arrange bibliography entries alphabetically by author surname'
                    });
                }
                previousEntry = currentEntry;
            }
        }
    }

    return issues;
}

module.exports = { validateCitations };
