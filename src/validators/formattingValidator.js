/**
 * Validate formatting according to SAIACS Style Guide
 * Rules: Font, margins, spacing, alignment, etc.
 */

function validateFormatting(documentData, documentType) {
    const issues = [];

    // Expected values based on document type
    const expectedFont = 'Times New Roman';
    const expectedFontSize = 12;
    const expectedSpacing = 1.5;
    const expectedMargins = documentType === 'dissertation'
        ? { top: 1, bottom: 1, left: 1.5, right: 1 }
        : { top: 1, bottom: 1, left: 1, right: 1 };

    // 1. Validate Font
    const { fonts, fontSizes } = documentData.formatting.font;

    if (!fonts.includes(expectedFont)) {
        issues.push({
            category: 'Formatting',
            severity: 'critical',
            rule: 'Font Style',
            message: `Font must be "${expectedFont}". Found: ${fonts.join(', ') || 'Unknown'}`,
            expected: expectedFont,
            found: fonts.join(', ') || 'Unknown',
            location: { section: 'Document' },
            fix: `Change all text to ${expectedFont}`
        });
    }

    // Check for multiple fonts (should be consistent)
    if (fonts.length > 2) { // Allow for one alternate (e.g., for code or special text)
        issues.push({
            category: 'Formatting',
            severity: 'medium',
            rule: 'Font Consistency',
            message: `Multiple fonts used: ${fonts.join(', ')}. Should use primarily "${expectedFont}"`,
            expected: `Primarily ${expectedFont}`,
            found: `${fonts.length} different fonts`,
            location: { section: 'Document' }
        });
    }

    // 2. Validate Font Size
    const mainFontSizes = fontSizes.filter(size => size >= 10 && size <= 13);

    if (!mainFontSizes.includes(expectedFontSize)) {
        issues.push({
            category: 'Formatting',
            severity: 'critical',
            rule: 'Font Size',
            message: `Main text must be ${expectedFontSize}pt. Found: ${mainFontSizes.join(', ') || 'Unknown'}`,
            expected: `${expectedFontSize}pt`,
            found: `${mainFontSizes.join(', ') || 'Unknown'}pt`,
            location: { section: 'Document' },
            fix: `Change main text to ${expectedFontSize}pt`
        });
    }

    // 3. Validate Margins
    if (documentData.formatting.margins) {
        const margins = documentData.formatting.margins;

        Object.keys(expectedMargins).forEach(side => {
            const expected = expectedMargins[side];
            const actual = margins[side];

            if (actual && Math.abs(actual - expected) > 0.1) { // Allow 0.1 inch tolerance
                issues.push({
                    category: 'Formatting',
                    severity: 'critical',
                    rule: 'Page Margins',
                    message: `${side.charAt(0).toUpperCase() + side.slice(1)} margin must be ${expected}" (found ${actual}")`,
                    expected: `${expected}"`,
                    found: `${actual}"`,
                    location: { section: 'Page Setup' },
                    fix: `Set ${side} margin to ${expected} inch${expected !== 1 ? 'es' : ''}`
                });
            }
        });
    }

    // 4. Validate Line Spacing
    const spacings = documentData.formatting.spacing;

    if (spacings.length > 0) {
        const mainSpacing = Math.round(spacings[0] * 10) / 10; // Round to 1 decimal

        if (Math.abs(mainSpacing - expectedSpacing) > 0.2) {
            issues.push({
                category: 'Formatting',
                severity: 'high',
                rule: 'Line Spacing',
                message: `Main text spacing must be ${expectedSpacing} (found ${mainSpacing})`,
                expected: expectedSpacing.toString(),
                found: mainSpacing.toString(),
                location: { section: 'Document' },
                fix: `Set line spacing to ${expectedSpacing}`
            });
        }
    }

    // 5. Validate Paragraph Formatting
    const paragraphs = documentData.content.paragraphs;
    let indentedParasCount = 0;
    let firstFontIssue = true;
    let firstSizeIssue = true;

    paragraphs.forEach((para, idx) => {
        if (para.isEmpty) return;

        // Check fonts in this paragraph
        if (para.formatting.fonts && para.formatting.fonts.length > 0) {
            const wrongFonts = para.formatting.fonts.filter(font =>
                font !== expectedFont && font !== 'Symbol' && font !== 'Courier New'
            );

            if (wrongFonts.length > 0) {
                const textSnippet = para.text.substring(0, 80).trim();
                issues.push({
                    category: 'Formatting',
                    severity: 'critical',
                    rule: 'Font Style',
                    message: `Paragraph ${idx + 1} uses incorrect font: ${wrongFonts.join(', ')}. Must be "${expectedFont}"`,
                    expected: expectedFont,
                    found: wrongFonts.join(', '),
                    location: {
                        paragraph: idx + 1,
                        text: textSnippet + (para.text.length > 80 ? '...' : '')
                    },
                    fix: `Change text to ${expectedFont}`
                });
            }
        }

        // Check font sizes in this paragraph
        if (para.formatting.fontSizes && para.formatting.fontSizes.length > 0) {
            const wrongSizes = para.formatting.fontSizes.filter(size =>
                size !== expectedFontSize && size !== 10 // Allow 10pt for footnotes
            );

            if (wrongSizes.length > 0) {
                const textSnippet = para.text.substring(0, 80).trim();
                issues.push({
                    category: 'Formatting',
                    severity: 'critical',
                    rule: 'Font Size',
                    message: `Paragraph ${idx + 1} uses incorrect font size: ${wrongSizes.join(', ')}pt. Must be ${expectedFontSize}pt`,
                    expected: `${expectedFontSize}pt`,
                    found: `${wrongSizes.join(', ')}pt`,
                    location: {
                        paragraph: idx + 1,
                        text: textSnippet + (para.text.length > 80 ? '...' : '')
                    },
                    fix: `Change text size to ${expectedFontSize}pt`
                });
            }
        }

        // Check for paragraph indentation (should be flush left)
        if (para.formatting.indentation?.['w:firstLine']) {
            indentedParasCount++;

            if (indentedParasCount === 1) { // Report once
                const textSnippet = para.text.substring(0, 80).trim();
                issues.push({
                    category: 'Formatting',
                    severity: 'medium',
                    rule: 'Paragraph Indentation',
                    message: 'Paragraphs should be flush with left margin (no first-line indent)',
                    expected: 'No indentation',
                    found: 'First-line indentation present',
                    location: {
                        paragraph: idx + 1,
                        text: textSnippet + (para.text.length > 80 ? '...' : '')
                    },
                    fix: 'Remove first-line indentation and add line space between paragraphs'
                });
            }
        }

        // Check alignment (should be left) - Skip cover page content
        // Cover page typically contains: SAIACS header, title, submitted to, dates, declaration, signature
        const isCoverPageContent =
            para.text.toLowerCase().includes('south asia institute') ||
            para.text.toLowerCase().includes('submitted to') ||
            para.text.toLowerCase().includes('partial fulfillment') ||
            para.text.toLowerCase().includes('due date') ||
            para.text.toLowerCase().includes('expected time') ||
            para.text.toLowerCase().includes('actual time') ||
            para.text.toLowerCase().includes('expected word') ||
            para.text.toLowerCase().includes('actual word') ||
            para.text.toLowerCase().includes('academic honesty') ||
            para.text.toLowerCase().includes('signature:') ||
            para.text.toLowerCase().includes('admission no') ||
            (idx < 30 && (para.text.trim().length < 100)); // Short lines in first 30 paragraphs are likely cover page

        if (!isCoverPageContent && para.formatting.alignment && para.formatting.alignment !== 'left' && para.formatting.alignment !== 'start') {
            const textSnippet = para.text.substring(0, 80).trim();
            issues.push({
                category: 'Formatting',
                severity: 'low',
                rule: 'Text Alignment',
                message: `Text should be left-aligned (found ${para.formatting.alignment})`,
                expected: 'Left alignment',
                found: para.formatting.alignment,
                location: {
                    paragraph: idx + 1,
                    text: textSnippet + (para.text.length > 80 ? '...' : '')
                }
            });
        }
    });

    // 6. Validate Footnote Formatting
    const footnotes = documentData.content.footnotes;

    footnotes.forEach((footnote, idx) => {
        if (footnote.text.length > 0) {
            const textSnippet = footnote.text.substring(0, 100).trim();

            // Check footnote font
            if (footnote.formatting && footnote.formatting.fonts) {
                const wrongFonts = footnote.formatting.fonts.filter(font =>
                    font !== expectedFont && font !== 'Symbol'
                );

                if (wrongFonts.length > 0) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'high',
                        rule: 'Footnote Font',
                        message: `Footnote ${footnote.id} uses incorrect font: ${wrongFonts.join(', ')}. Must be "${expectedFont}"`,
                        expected: expectedFont,
                        found: wrongFonts.join(', '),
                        location: {
                            footnote: footnote.id,
                            text: textSnippet + (footnote.text.length > 100 ? '...' : '')
                        },
                        fix: `Change footnote font to ${expectedFont}`
                    });
                }
            }

            // Check footnote size (should be 10pt)
            if (footnote.formatting && footnote.formatting.fontSizes) {
                const wrongSizes = footnote.formatting.fontSizes.filter(size =>
                    size !== 10
                );

                if (wrongSizes.length > 0) {
                    issues.push({
                        category: 'Formatting',
                        severity: 'high',
                        rule: 'Footnote Size',
                        message: `Footnote ${footnote.id} uses incorrect font size: ${wrongSizes.join(', ')}pt. Must be 10pt`,
                        expected: '10pt',
                        found: `${wrongSizes.join(', ')}pt`,
                        location: {
                            footnote: footnote.id,
                            text: textSnippet + (footnote.text.length > 100 ? '...' : '')
                        },
                        fix: 'Change footnote size to 10pt'
                    });
                }
            }

            // Check if footnote seems too long (might indicate wrong formatting)
            if (footnote.text.length > 500) {
                issues.push({
                    category: 'Formatting',
                    severity: 'low',
                    rule: 'Footnote Length',
                    message: `Footnote ${footnote.id} is very long. Check formatting.`,
                    expected: 'Concise footnote',
                    found: `${footnote.text.length} characters`,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet + (footnote.text.length > 100 ? '...' : '')
                    }
                });
            }
        }
    });

    // 7. Check for page numbering
    if (!documentData.formatting.pageNumbers.present && documentData.structure.pageCount > 1) {
        issues.push({
            category: 'Formatting',
            severity: 'medium',
            rule: 'Page Numbering',
            message: 'Page numbers should be at bottom center',
            expected: 'Page numbers at bottom center',
            found: 'No page numbers detected',
            location: { section: 'Page Setup' },
            fix: 'Add page numbers at bottom center'
        });
    }

    return issues;
}

module.exports = { validateFormatting };
