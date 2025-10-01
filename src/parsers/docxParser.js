const mammoth = require('mammoth');
const fs = require('fs').promises;
const PizZip = require('pizzip');
const xml2js = require('xml2js');

/**
 * Parse DOCX file and extract content, formatting, and structure
 * @param {string} filePath - Path to DOCX file
 * @returns {Object} Parsed document data
 */
async function parseDocx(filePath) {
    try {
        const data = await fs.readFile(filePath);
        const zip = new PizZip(data);

        // Extract document.xml for detailed analysis
        const documentXml = zip.file('word/document.xml').asText();
        const stylesXml = zip.file('word/styles.xml')?.asText() || '';
        const footnotesXml = zip.file('word/footnotes.xml')?.asText() || '';
        const numberingXml = zip.file('word/numbering.xml')?.asText() || '';

        // Parse XMLs
        const parser = new xml2js.Parser();
        const documentData = await parser.parseStringPromise(documentXml);
        const stylesData = stylesXml ? await parser.parseStringPromise(stylesXml) : null;
        const footnotesData = footnotesXml ? await parser.parseStringPromise(footnotesXml) : null;

        // Extract text content with Mammoth for easier reading
        const result = await mammoth.extractRawText({ buffer: data });
        const textContent = result.value;

        // Parse the document structure
        const parsedDoc = {
            raw: {
                document: documentData,
                styles: stylesData,
                footnotes: footnotesData
            },
            content: {
                text: textContent,
                paragraphs: extractParagraphs(documentData),
                footnotes: extractFootnotes(footnotesData),
                headings: extractHeadings(documentData),
                quotations: extractQuotations(documentData, textContent)
            },
            formatting: {
                font: extractFontInfo(documentData, stylesData),
                margins: extractMargins(documentData),
                spacing: extractSpacing(documentData),
                pageNumbers: extractPageNumbering(documentData)
            },
            structure: {
                pageCount: estimatePageCount(textContent),
                wordCount: textContent.split(/\s+/).length,
                hasTableOfContents: checkForTableOfContents(textContent),
                hasBibliography: checkForBibliography(textContent)
            }
        };

        return parsedDoc;

    } catch (error) {
        console.error('Error parsing DOCX:', error);
        throw new Error(`Failed to parse document: ${error.message}`);
    }
}

/**
 * Extract paragraph information from document XML
 */
function extractParagraphs(documentData) {
    const paragraphs = [];

    try {
        const body = documentData['w:document']['w:body'][0];
        const elements = body['w:p'] || [];

        elements.forEach((para, index) => {
            const text = extractTextFromParagraph(para);
            const formatting = extractParagraphFormatting(para);

            paragraphs.push({
                index: index + 1,
                text: text,
                formatting: formatting,
                isEmpty: text.trim().length === 0
            });
        });
    } catch (error) {
        console.error('Error extracting paragraphs:', error);
    }

    return paragraphs;
}

/**
 * Extract text from a paragraph element
 */
function extractTextFromParagraph(para) {
    let text = '';

    try {
        const runs = para['w:r'] || [];
        runs.forEach(run => {
            const texts = run['w:t'] || [];
            texts.forEach(t => {
                if (typeof t === 'string') {
                    text += t;
                } else if (t._) {
                    text += t._;
                }
            });
        });
    } catch (error) {
        // Silent fail for complex structures
    }

    return text;
}

/**
 * Extract paragraph formatting
 */
function extractParagraphFormatting(para) {
    const formatting = {
        alignment: null,
        indentation: null,
        spacing: null,
        fonts: [],  // Changed to array to track all fonts in paragraph
        fontSizes: [],  // Changed to array to track all sizes in paragraph
        bold: false,
        italic: false
    };

    try {
        const pPr = para['w:pPr']?.[0];
        if (pPr) {
            // Alignment
            if (pPr['w:jc']) {
                formatting.alignment = pPr['w:jc'][0].$?.['w:val'];
            }

            // Indentation
            if (pPr['w:ind']) {
                formatting.indentation = pPr['w:ind'][0].$;
            }

            // Spacing
            if (pPr['w:spacing']) {
                formatting.spacing = pPr['w:spacing'][0].$;
            }
        }

        // Get formatting from ALL runs, not just first
        const runs = para['w:r'] || [];
        let hasExplicitFont = false;
        let hasExplicitSize = false;

        runs.forEach(run => {
            const rPr = run['w:rPr']?.[0];

            // Check if run has text content
            const hasText = run['w:t'] && run['w:t'].length > 0;
            if (!hasText) return; // Skip runs without text

            if (rPr) {
                if (rPr['w:rFonts']) {
                    // Check all font attributes
                    const font = rPr['w:rFonts'][0].$?.['w:ascii'] ||
                                rPr['w:rFonts'][0].$?.['w:hAnsi'] ||
                                rPr['w:rFonts'][0].$?.['w:cs'] ||
                                rPr['w:rFonts'][0].$?.['w:eastAsia'];
                    if (font && !formatting.fonts.includes(font)) {
                        formatting.fonts.push(font);
                        hasExplicitFont = true;
                    }
                }
                if (rPr['w:sz']) {
                    const size = parseInt(rPr['w:sz'][0].$?.['w:val']) / 2; // Convert half-points to points
                    if (size && !formatting.fontSizes.includes(size)) {
                        formatting.fontSizes.push(size);
                        hasExplicitSize = true;
                    }
                }
                if (rPr['w:b']) formatting.bold = true;
                if (rPr['w:i']) formatting.italic = true;
            } else if (hasText) {
                // Run has text but no explicit formatting - mark as needing style inheritance
                if (!hasExplicitFont) formatting.fonts.push('_inherit_');
                if (!hasExplicitSize) formatting.fontSizes.push(0); // 0 indicates inheritance needed
            }
        });

        // Don't assume defaults - leave empty if no explicit formatting found
        // This allows the validator to detect missing formatting
    } catch (error) {
        // Silent fail
    }

    return formatting;
}

/**
 * Extract footnotes
 */
function extractFootnotes(footnotesData) {
    const footnotes = [];

    if (!footnotesData) return footnotes;

    try {
        const notes = footnotesData['w:footnotes']?.['w:footnote'] || [];
        notes.forEach(note => {
            const id = note.$?.['w:id'];
            if (id && id !== '-1' && id !== '0') { // Skip separator and continuation separator
                const para = note['w:p']?.[0] || {};
                const text = extractTextFromParagraph(para);
                const formatting = extractParagraphFormatting(para);

                footnotes.push({
                    id: id,
                    text: text,
                    formatting: formatting
                });
            }
        });
    } catch (error) {
        console.error('Error extracting footnotes:', error);
    }

    return footnotes;
}

/**
 * Extract headings
 */
function extractHeadings(documentData) {
    const headings = [];

    try {
        const body = documentData['w:document']['w:body'][0];
        const elements = body['w:p'] || [];

        elements.forEach((para, index) => {
            const pPr = para['w:pPr']?.[0];
            if (pPr?.['w:pStyle']) {
                const styleId = pPr['w:pStyle'][0].$?.['w:val'];
                if (styleId && styleId.toLowerCase().includes('heading')) {
                    const text = extractTextFromParagraph(para);
                    const level = extractHeadingLevel(styleId);

                    headings.push({
                        index: index + 1,
                        text: text,
                        level: level,
                        styleId: styleId
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error extracting headings:', error);
    }

    return headings;
}

/**
 * Extract heading level from style ID
 */
function extractHeadingLevel(styleId) {
    const match = styleId.match(/\d+/);
    return match ? parseInt(match[0]) : 1;
}

/**
 * Extract quotations (blocks longer than 4 lines or in quotes)
 */
function extractQuotations(documentData, textContent) {
    const quotations = [];

    // Find ALL quoted text, then check line count
    const quotePattern = /"([^"]+)"/g;
    let match;
    while ((match = quotePattern.exec(textContent)) !== null) {
        const quotedText = match[1];

        // Count actual lines in the quote
        const lines = quotedText.split('\n').length;

        // Also estimate lines based on character count (avg 80 chars per line)
        const estimatedLines = Math.ceil(quotedText.length / 80);

        // Use the maximum of actual lines or estimated lines
        const lineCount = Math.max(lines, estimatedLines);

        quotations.push({
            text: quotedText,
            start: match.index,
            lines: lineCount,
            needsBlockFormat: lineCount > 4
        });
    }

    return quotations;
}

/**
 * Extract font information
 */
function extractFontInfo(documentData, stylesData) {
    const fonts = new Set();
    const fontSizes = new Set();

    try {
        const body = documentData['w:document']['w:body'][0];
        const elements = body['w:p'] || [];

        elements.forEach(para => {
            const runs = para['w:r'] || [];
            runs.forEach(run => {
                const rPr = run['w:rPr']?.[0];
                if (rPr) {
                    if (rPr['w:rFonts']) {
                        const font = rPr['w:rFonts'][0].$?.['w:ascii'];
                        if (font) fonts.add(font);
                    }
                    if (rPr['w:sz']) {
                        const size = parseInt(rPr['w:sz'][0].$?.['w:val']) / 2;
                        if (size) fontSizes.add(size);
                    }
                }
            });
        });
    } catch (error) {
        // Silent fail
    }

    return {
        fonts: Array.from(fonts),
        fontSizes: Array.from(fontSizes)
    };
}

/**
 * Extract margin information
 */
function extractMargins(documentData) {
    try {
        const sectPr = documentData['w:document']['w:body'][0]['w:sectPr']?.[0];
        if (sectPr?.['w:pgMar']) {
            const margins = sectPr['w:pgMar'][0].$;
            return {
                top: twipsToInches(parseInt(margins['w:top'])),
                bottom: twipsToInches(parseInt(margins['w:bottom'])),
                left: twipsToInches(parseInt(margins['w:left'])),
                right: twipsToInches(parseInt(margins['w:right']))
            };
        }
    } catch (error) {
        // Silent fail
    }

    return null;
}

/**
 * Extract spacing information
 */
function extractSpacing(documentData) {
    const spacings = [];

    try {
        const body = documentData['w:document']['w:body'][0];
        const elements = body['w:p'] || [];

        elements.forEach(para => {
            const pPr = para['w:pPr']?.[0];
            if (pPr?.['w:spacing']) {
                const spacing = pPr['w:spacing'][0].$;
                if (spacing['w:line']) {
                    spacings.push(parseInt(spacing['w:line']) / 240); // Convert to line spacing
                }
            }
        });
    } catch (error) {
        // Silent fail
    }

    return spacings;
}

/**
 * Extract page numbering
 */
function extractPageNumbering(documentData) {
    // This is complex and may require additional analysis
    return {
        present: false,
        location: null
    };
}

/**
 * Estimate page count based on word count
 */
function estimatePageCount(text) {
    const wordsPerPage = 250;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerPage);
}

/**
 * Check for table of contents
 */
function checkForTableOfContents(text) {
    return /table\s+of\s+contents/i.test(text);
}

/**
 * Check for bibliography
 */
function checkForBibliography(text) {
    return /bibliography|references/i.test(text);
}

/**
 * Convert twips to inches
 */
function twipsToInches(twips) {
    return Math.round((twips / 1440) * 100) / 100;
}

module.exports = { parseDocx };
