/**
 * Validate quotations and footnote number placement according to SAIACS Style Guide (Section 2.5)
 */

function validateQuotations(documentData) {
    const issues = [];
    const quotations = documentData.content.quotations;
    const paragraphs = documentData.content.paragraphs;

    // 1. Validate Extracted Quotations (Block Quotes & Inline Quotes)
    quotations.forEach(quote => {
        const textSnippet = quote.text.substring(0, 85).trim() + (quote.text.length > 85 ? '...' : '');

        // 1a. Inline quote > 4 lines must be formatted as a block quotation (Section 2.5.4)
        if (quote.needsBlockFormat) {
            issues.push({
                category: 'Quotations',
                severity: 'high',
                rule: 'Block Quotation Format (Section 2.5.4)',
                message: `Quotation in Paragraph ${quote.paragraphIndex} exceeds 4 lines (~${quote.lines} lines) and must be formatted as an indented block quotation.`,
                expected: 'Block quotation (11pt font, 1.5 spacing, indented 0.5", no enclosing quotation marks)',
                found: `Inline quotation with quotation marks (${quote.lines} lines)`,
                location: {
                    paragraph: quote.paragraphIndex,
                    text: textSnippet
                },
                fix: 'Set off the quotation as an indented block (1.27 cm / 0.5" indent), reduce font size to 11pt, keep 1.5 spacing, and remove outer quotation marks'
            });
        }

        // 1b. Block quote paragraph should NOT have enclosing quotation marks (Section 2.5.4.i)
        if (quote.isBlockQuoteParagraph && quote.hasEnclosingQuotes) {
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Block Quotation Marks (Section 2.5.4.i)',
                message: `Block quotation in Paragraph ${quote.paragraphIndex} has enclosing quotation marks. Quotation marks must not be used around block quotations.`,
                expected: 'No enclosing quotation marks on block quotation',
                found: 'Block quotation enclosed in quotation marks',
                location: {
                    paragraph: quote.paragraphIndex,
                    text: textSnippet
                },
                fix: 'Remove the opening and closing quotation marks from the block quotation'
            });
        }

        // 1c. Double quotes inside double quotes (should use single quotes ‘...’ inside “...”) (Section 2.5.1)
        if (!quote.isBlockQuoteParagraph && /[“"][^”"]*[“"]/.test(quote.text)) {
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Nested Quotation Marks (Section 2.5.1)',
                message: `Quotation in Paragraph ${quote.paragraphIndex} appears to contain nested double quotation marks. Use single quotation marks ('...') for quotes within double quotes.`,
                expected: '“... ‘nested quote’ ...”',
                found: textSnippet,
                location: {
                    paragraph: quote.paragraphIndex,
                    text: textSnippet
                },
                fix: 'Use single quotation marks (‘ ’) for quotations inside double quotation marks'
            });
        }
    });

    // 2. Validate Paragraph-Level Quotation Marks, Punctuation, and Footnote Placement
    paragraphs.forEach(para => {
        if (para.isEmpty || para.section !== 'body') return;

        const idx = para.index;
        const text = para.text;
        const textWithFn = para.textWithFootnotes || text;
        const snippet = text.trim().substring(0, 90) + (text.trim().length > 90 ? '...' : '');

        // 2a. Check Footnote Number Placement Relative to Punctuation (Section 2.5.2, p. 29)
        // "The footnote number immediately follows punctuation, whether comma, semi-colon, colon or full stop."
        const fnBeforePunctRegex = /([^\s]{0,25})\[FN:(\d+)\]\s*([.,;:])/g;
        let fnMatch;
        while ((fnMatch = fnBeforePunctRegex.exec(textWithFn)) !== null) {
            const wordBefore = fnMatch[1];
            const fnId = fnMatch[2];
            const punct = fnMatch[3];
            const ctxStart = Math.max(0, fnMatch.index - 45);
            const ctxEnd = Math.min(textWithFn.length, fnMatch.index + fnMatch[0].length + 35);
            const localSnippet = textWithFn.substring(ctxStart, ctxEnd).replace(/\[FN:(\d+)\]/g, '[$1]').trim();
            issues.push({
                category: 'Quotations',
                severity: 'high',
                rule: 'Footnote Number Placement (Section 2.5.2)',
                message: `In Paragraph ${idx}, Footnote ${fnId} is placed BEFORE the punctuation mark ("${wordBefore}[${fnId}]${punct}"). The footnote number must immediately follow punctuation.`,
                expected: `${wordBefore}${punct}[${fnId}]`,
                found: `${wordBefore}[${fnId}]${punct}`,
                location: {
                    paragraph: idx,
                    footnote: fnId,
                    text: (ctxStart > 0 ? '...' : '') + localSnippet + (ctxEnd < textWithFn.length ? '...' : '')
                },
                fix: `Move Footnote ${fnId} immediately after the "${punct}"`
            });
        }

        // Also check if a footnote is placed at the very start of a paragraph before a word
        const fnAtStartMatch = textWithFn.match(/^\s*\[FN:(\d+)\]\s*(\S+)/);
        if (fnAtStartMatch) {
            const fnId = fnAtStartMatch[1];
            const wordAfter = fnAtStartMatch[2];
            const localSnippet = textWithFn.substring(0, Math.min(textWithFn.length, 70)).replace(/\[FN:(\d+)\]/g, '[$1]').trim();
            issues.push({
                category: 'Quotations',
                severity: 'high',
                rule: 'Footnote Number Placement (Section 2.5.2)',
                message: `In Paragraph ${idx}, Footnote ${fnId} is placed at the start of the paragraph before "${wordAfter}". Footnote numbers must be placed at the end of a clause or sentence immediately following punctuation.`,
                expected: `Place [${fnId}] at the end of the cited sentence after the period`,
                found: `[${fnId}]${wordAfter}`,
                location: {
                    paragraph: idx,
                    footnote: fnId,
                    text: localSnippet + (textWithFn.length > 70 ? '...' : '')
                },
                fix: `Move Footnote ${fnId} to the end of the relevant sentence after the punctuation mark`
            });
        }

        // 2b. Check for space before Footnote Number (Section 2.5.2)
        const spaceBeforeFnRegex = /(\S+)\s+\[FN:(\d+)\]/g;
        let spMatch;
        while ((spMatch = spaceBeforeFnRegex.exec(textWithFn)) !== null) {
            const wordBefore = spMatch[1];
            const fnId = spMatch[2];
            const ctxStart = Math.max(0, spMatch.index - 45);
            const ctxEnd = Math.min(textWithFn.length, spMatch.index + spMatch[0].length + 35);
            const localSnippet = textWithFn.substring(ctxStart, ctxEnd).replace(/\[FN:(\d+)\]/g, '[$1]').trim();
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Space Before Footnote Number (Section 2.5.2)',
                message: `In Paragraph ${idx}, there is a space before Footnote ${fnId} ("${wordBefore} [${fnId}]"). Footnote numbers must immediately follow punctuation or closing quotes with no space.`,
                expected: `${wordBefore}[${fnId}]`,
                found: `${wordBefore} [${fnId}]`,
                location: {
                    paragraph: idx,
                    footnote: fnId,
                    text: (ctxStart > 0 ? '...' : '') + localSnippet + (ctxEnd < textWithFn.length ? '...' : '')
                },
                fix: `Remove the space before Footnote ${fnId}`
            });
        }

        // 2c. Check Semicolons and Colons Inside Closing Quotation Marks (Section 2.5.1, p. 29)
        // "Semi-colons and colons belong outside quotation marks."
        const semiColonInsideMatch = text.match(/[^“"”]{2,}[;:][”"]/);
        if (semiColonInsideMatch) {
            const matched = semiColonInsideMatch[0];
            const punct = matched.slice(-2, -1);
            const quoteChar = matched.slice(-1);
            issues.push({
                category: 'Quotations',
                severity: 'medium',
                rule: 'Semicolons and Colons with Quotes (Section 2.5.1)',
                message: `In Paragraph ${idx}, a ${punct === ';' ? 'semicolon' : 'colon'} is placed inside the closing quotation mark ("${matched}"). Semi-colons and colons belong outside quotation marks.`,
                expected: `${matched.slice(0, -2)}${quoteChar}${punct}`,
                found: matched,
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: `Move the "${punct}" outside the closing quotation mark`
            });
        }

        // 2e. Check for Unclosed / Unmatched Double Quotation Marks in Paragraph
        const openCurlyCount = (text.match(/“/g) || []).length;
        const closeCurlyCount = (text.match(/”/g) || []).length;
        const straightCount = (text.match(/"/g) || []).length;

        if (openCurlyCount !== closeCurlyCount || straightCount % 2 !== 0) {
            issues.push({
                category: 'Quotations',
                severity: 'high',
                rule: 'Unclosed Quotation Mark (Section 2.5.1)',
                message: `Paragraph ${idx} has an unmatched/unclosed double quotation mark (${openCurlyCount} opening “, ${closeCurlyCount} closing ”${straightCount ? `, ${straightCount} straight "` : ''}).`,
                expected: 'Matching opening (“) and closing (”) double quotation marks',
                found: `Unbalanced quotation marks in paragraph`,
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: 'Find the missing opening or closing double quotation mark in this paragraph'
            });
        }
    });

    return issues;
}

module.exports = { validateQuotations };
