/**
 * Validate formatting according to SAIACS Style Guide (2020-2021)
 * Rules: Font, font size, margins, line spacing, alignment, indentation, bibliography hanging indent, dashes/hyphens, pagination
 */

function validateFormatting(documentData, documentType) {
    const issues = [];

    const expectedFont = 'Times New Roman';
    const expectedFontSize = 12;
    const expectedSpacing = 1.5;
    const expectedMargins = documentType === 'dissertation'
        ? { top: 1, bottom: 1, left: 1.5, right: 1 }
        : { top: 1, bottom: 1, left: 1, right: 1 };

    // 1. Validate Document-Level Font
    const { fonts } = documentData.formatting.font;
    if (fonts.length > 0 && !fonts.includes(expectedFont)) {
        issues.push({
            category: 'Formatting',
            severity: 'critical',
            rule: 'Font Style (Section 1.1.1)',
            message: `Document font must be "${expectedFont}". Found: ${fonts.join(', ')}`,
            expected: expectedFont,
            found: fonts.join(', '),
            location: { section: 'Document' },
            fix: `Change all text to ${expectedFont}`
        });
    }

    // 2. Validate Page Margins (Section 1.1.1 & 1.1.2)
    if (documentData.formatting.margins) {
        const margins = documentData.formatting.margins;

        Object.keys(expectedMargins).forEach(side => {
            const expected = expectedMargins[side];
            const actual = margins[side];

            if (actual !== undefined && actual !== null && Math.abs(actual - expected) > 0.1) {
                issues.push({
                    category: 'Formatting',
                    severity: 'critical',
                    rule: 'Page Margins (Section 1.1)',
                    message: `${side.charAt(0).toUpperCase() + side.slice(1)} margin must be ${expected}" for a ${documentType} (found ${actual}")`,
                    expected: `${expected}"`,
                    found: `${actual}"`,
                    location: { section: 'Page Setup' },
                    fix: `Set ${side} margin to ${expected} inch${expected !== 1 ? 'es' : ''}`
                });
            }
        });
    }

    // 3. Validate Paragraphs by Section (Body, Bibliography, Cover)
    const paragraphs = documentData.content.paragraphs;
    let firstLineIndentReported = false;
    let bibSpacingReported = false;
    let bibHangingIndentReported = false;

    paragraphs.forEach((para) => {
        if (para.isEmpty) return;

        const idx = para.index;
        const section = para.section;
        const textTrimmed = para.text.trim();
        const textSnippet = textTrimmed.substring(0, 90) + (textTrimmed.length > 90 ? '...' : '');

        // Skip formatting checks on the Generative AI declaration form if present
        if (section === 'declaration') return;

        // Check if this is an indented block quotation in the body
        const leftIndent = parseInt(para.formatting.indentation?.['w:left'] || '0', 10);
        const hangingIndent = parseInt(para.formatting.indentation?.['w:hanging'] || '0', 10);
        const isBlockQuote = section === 'body' && leftIndent >= 500 && hangingIndent === 0 && textTrimmed.length > 100;

        // 3a. Font family check per paragraph
        if (para.formatting.fonts && para.formatting.fonts.length > 0) {
            const wrongFonts = para.formatting.fonts.filter(font =>
                font !== expectedFont &&
                font !== 'Symbol' &&
                font !== '_inherit_' &&
                !/sbl|gentium|galatia|ezra|cardinal/i.test(font) // Allow standard Unicode Greek/Hebrew fonts (Section 1.5)
            );

            if (wrongFonts.length > 0) {
                issues.push({
                    category: 'Formatting',
                    severity: 'critical',
                    rule: 'Font Style (Section 1.1.1)',
                    message: `Paragraph ${idx} uses incorrect font: ${wrongFonts.join(', ')}. Must be "${expectedFont}".`,
                    expected: expectedFont,
                    found: wrongFonts.join(', '),
                    location: {
                        paragraph: idx,
                        text: textSnippet
                    },
                    fix: `Change font to ${expectedFont}`
                });
            }
        }

        // 3b. Font size check per paragraph
        if (para.formatting.fontSizes && para.formatting.fontSizes.length > 0) {
            if (isBlockQuote) {
                // Block quotations must be 11pt (Section 2.5.4)
                const wrongSizes = para.formatting.fontSizes.filter(s => s !== 11 && s > 0);
                if (wrongSizes.length > 0) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'high',
                        rule: 'Block Quotation Font Size (Section 2.5.4)',
                        message: `Block quotation in Paragraph ${idx} must use 11pt font (found ${wrongSizes.join(', ')}pt).`,
                        expected: '11pt',
                        found: `${wrongSizes.join(', ')}pt`,
                        location: {
                            paragraph: idx,
                            text: textSnippet
                        },
                        fix: 'Change block quotation font size to 11pt while keeping 1.5 line spacing'
                    });
                }
            } else if (section === 'bibliography' || section === 'bibliographyHeader' || section === 'body' || section === 'cover') {
                // Main text, cover page, and Bibliography must be 12pt (Sections 1.1.1 & 1.4)
                const wrongSizes = para.formatting.fontSizes.filter(s => s !== expectedFontSize && s > 0);
                if (wrongSizes.length > 0) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'critical',
                        rule: section === 'bibliography' ? 'Bibliography Font Size (Section 1.4)' : 'Font Size (Section 1.1.1)',
                        message: `Paragraph ${idx} uses ${wrongSizes.join(', ')}pt font. ${section === 'bibliography' ? 'Bibliography' : 'Main text'} must be ${expectedFontSize}pt.`,
                        expected: `${expectedFontSize}pt`,
                        found: `${wrongSizes.join(', ')}pt`,
                        location: {
                            paragraph: idx,
                            text: textSnippet
                        },
                        fix: `Change font size to ${expectedFontSize}pt`
                    });
                }
            }
        }

        // 3c. Line spacing checks for Body and Bibliography (Sections 1.1.1 & 1.4)
        const lineVal = para.formatting.spacing?.['w:line'];
        if (lineVal) {
            const spacing = Math.round((parseInt(lineVal, 10) / 240) * 100) / 100;
            if (section === 'body' && Math.abs(spacing - expectedSpacing) > 0.15) {
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Line Spacing (Section 1.1.1)',
                    message: `Body paragraph ${idx} has ${spacing} line spacing instead of ${expectedSpacing}.`,
                    expected: '1.5 line spacing',
                    found: `${spacing} line spacing`,
                    location: {
                        paragraph: idx,
                        text: textSnippet
                    },
                    fix: 'Set paragraph line spacing to 1.5'
                });
            } else if (section === 'bibliography' && Math.abs(spacing - expectedSpacing) > 0.15 && !bibSpacingReported) {
                bibSpacingReported = true;
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Bibliography Line Spacing (Section 1.4)',
                    message: `Bibliography entries use ${spacing} line spacing. Section 1.4 requires 1.5 line spacing for the Bibliography.`,
                    expected: '1.5 line spacing (12pt font)',
                    found: `${spacing} line spacing`,
                    location: {
                        paragraph: idx,
                        section: 'Bibliography',
                        text: textSnippet
                    },
                    fix: 'Set Bibliography line spacing to 1.5'
                });
            }
        }

        // 3d. Bibliography Hanging Indent check (Section 1.4)
        if (section === 'bibliography' && /\d{4}/.test(textTrimmed)) {
            const hasHanging = hangingIndent > 0;
            if (!hasHanging && !bibHangingIndentReported) {
                bibHangingIndentReported = true;
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Bibliography Hanging Indent (Section 1.4)',
                    message: 'Bibliography entries must use a hanging indent (first line flush left, subsequent lines indented).',
                    expected: 'Hanging indent (e.g., 0.5" hanging)',
                    found: leftIndent > 0 ? 'Full block left indent (no hanging indent)' : 'No hanging indent',
                    location: {
                        paragraph: idx,
                        section: 'Bibliography',
                        text: textSnippet
                    },
                    fix: 'Format Bibliography paragraphs with a Hanging Indent (Paragraph → Indentation → Special: Hanging)'
                });
            }
        }

        // 3e. Body Paragraph First-Line Indentation check (Section 1.1.1)
        if (section === 'body' && !isBlockQuote) {
            const firstLineIndent = parseInt(para.formatting.indentation?.['w:firstLine'] || '0', 10);
            if (firstLineIndent > 0 && !firstLineIndentReported) {
                firstLineIndentReported = true;
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Paragraph Indentation (Section 1.1.1)',
                    message: 'Body paragraphs must start flush with the left margin (no first-line indent) with a line space between paragraphs.',
                    expected: 'Flush left (0" first-line indent)',
                    found: 'First-line indentation present',
                    location: {
                        paragraph: idx,
                        text: textSnippet
                    },
                    fix: 'Remove first-line indentation and leave a line space between paragraphs'
                });
            }

            // Alignment check (must be left-aligned, not justified or centered)
            if (
                para.formatting.alignment &&
                para.formatting.alignment !== 'left' &&
                para.formatting.alignment !== 'start'
            ) {
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Text Alignment (Section 1.1.1)',
                    message: `Paragraph ${idx} is "${para.formatting.alignment}"-aligned. Main text must be left-aligned (ragged right, not justified or centered).`,
                    expected: 'Left alignment',
                    found: para.formatting.alignment === 'both' ? 'Justified (both)' : para.formatting.alignment,
                    location: {
                        paragraph: idx,
                        text: textSnippet
                    },
                    fix: 'Align body text to the left margin'
                });
            }
        }

        // 3f. Dashes and Hyphens Spacing Check (Section 2.8)
        if (section === 'body') {
            // Spaced en-dash, em-dash, or hyphen between words (e.g., "Hebrews – the" or "word — word" or "word - word")
            const spacedDashMatch = para.text.match(/\b\w+\s+[–—-]\s+\w+\b/);
            if (spacedDashMatch) {
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Dashes and Hyphens (Section 2.8)',
                    message: `Do not put spaces around dashes or hyphens (found "${spacedDashMatch[0]}"). Use an unspaced em-dash (—) for dashes or unspaced hyphen (-) for compound words.`,
                    expected: spacedDashMatch[0].replace(/\s+[–—-]\s+/, '—'),
                    found: spacedDashMatch[0],
                    location: {
                        paragraph: idx,
                        text: textSnippet
                    },
                    fix: 'Remove spaces on both sides of the dash and use an em-dash (—)'
                });
            }
        }
    });

    // 4. Validate Footnote Formatting (Section 1.3)
    const footnotes = documentData.content.footnotes;
    footnotes.forEach(footnote => {
        if (!footnote.text || footnote.text.trim().length === 0) return;

        const textSnippet = footnote.text.substring(0, 100).trim() + (footnote.text.length > 100 ? '...' : '');

        // 4a. Footnote font family
        if (footnote.formatting?.fonts?.length > 0) {
            const wrongFonts = footnote.formatting.fonts.filter(font =>
                font !== expectedFont && font !== 'Symbol' && font !== '_inherit_'
            );
            if (wrongFonts.length > 0) {
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Footnote Font (Section 1.3)',
                    message: `Footnote ${footnote.id} uses incorrect font: ${wrongFonts.join(', ')}. Must be "${expectedFont}".`,
                    expected: expectedFont,
                    found: wrongFonts.join(', '),
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: `Change Footnote ${footnote.id} font to ${expectedFont}`
                });
            }
        }

        // 4b. Footnote font size (must be 10pt)
        if (footnote.formatting?.fontSizes?.length > 0) {
            const wrongSizes = footnote.formatting.fontSizes.filter(size => size !== 10 && size > 0);
            if (wrongSizes.length > 0) {
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Footnote Font Size (Section 1.3)',
                    message: `Footnote ${footnote.id} uses ${wrongSizes.join(', ')}pt font. Footnotes must be 10pt.`,
                    expected: '10pt',
                    found: `${wrongSizes.join(', ')}pt`,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: `Change Footnote ${footnote.id} font size to 10pt`
                });
            }
        }

        // 4c. Footnote spacing (must be single spacing 1.0)
        if (footnote.formatting?.spacing?.['w:line']) {
            const spacing = parseInt(footnote.formatting.spacing['w:line'], 10) / 240;
            if (Math.abs(spacing - 1.0) > 0.1) {
                issues.push({
                    category: 'Formatting',
                    severity: 'high',
                    rule: 'Footnote Spacing (Section 1.3)',
                    message: `Footnote ${footnote.id} must be single-spaced (found ${spacing.toFixed(1)}).`,
                    expected: 'Single spacing (1.0)',
                    found: `${spacing.toFixed(1)} spacing`,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: 'Set footnote line spacing to single (1.0) with no space between entries'
                });
            }
        }

        // 4d. Footnote indentation & alignment (must be flush left, left-aligned)
        if (footnote.formatting) {
            const firstLine = parseInt(footnote.formatting.indentation?.['w:firstLine'] || '0', 10);
            const left = parseInt(footnote.formatting.indentation?.['w:left'] || '0', 10);
            if (firstLine > 0 || left > 0) {
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Footnote Indentation (Section 1.3)',
                    message: `Footnote ${footnote.id} must be flush against the left margin (no indentation).`,
                    expected: 'Flush left (0" indent)',
                    found: 'Indented footnote',
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: 'Remove indentation from footnotes'
                });
            }

            if (
                footnote.formatting.alignment &&
                footnote.formatting.alignment !== 'left' &&
                footnote.formatting.alignment !== 'start'
            ) {
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Footnote Alignment (Section 1.3)',
                    message: `Footnote ${footnote.id} must be left-aligned (found ${footnote.formatting.alignment}).`,
                    expected: 'Left alignment',
                    found: footnote.formatting.alignment,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: 'Set footnote text alignment to left'
                });
            }
        }
    });

    // 5. Validate Page Numbering (Section 1.1.1 & Appendix 1)
    const pageNums = documentData.formatting.pageNumbers;
    if (documentData.structure.pageCount > 1) {
        if (!pageNums.present) {
            issues.push({
                category: 'Formatting',
                severity: 'medium',
                rule: 'Pagination (Section 1.1.1)',
                message: 'Page numbers must be placed at the bottom centre of the page (none detected in footer).',
                expected: 'Page numbers at bottom centre (hidden on cover page)',
                found: 'No page numbers detected',
                location: { section: 'Page Setup / Footer' },
                fix: 'Insert page numbers at the bottom centre (Footer) and enable "Different First Page" to hide on cover page'
            });
        } else if (!pageNums.inFooter || pageNums.alignment !== 'center') {
            issues.push({
                category: 'Formatting',
                severity: 'medium',
                rule: 'Pagination Placement (Section 1.1.1)',
                message: `Page numbers must be placed at the bottom centre (found in ${pageNums.location}).`,
                expected: 'footer (center)',
                found: pageNums.location || 'non-centered page number',
                location: { section: 'Page Setup / Footer' },
                fix: 'Move page numbers to the bottom centre of the footer'
            });
        }
    }

    return issues;
}

module.exports = { validateFormatting };
