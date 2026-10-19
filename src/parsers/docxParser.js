const mammoth = require('mammoth');
const fs = require('fs').promises;
const PizZip = require('pizzip');
const xml2js = require('xml2js');

/**
 * Parse DOCX file and extract content, formatting, styles, footnotes, and structure
 * @param {string} filePath - Path to DOCX file
 * @returns {Object} Parsed document data
 */
async function parseDocx(filePath) {
    try {
        const data = await fs.readFile(filePath);
        const zip = new PizZip(data);

        // Extract XML files from DOCX archive
        const documentXml = zip.file('word/document.xml')?.asText() || '';
        const stylesXml = zip.file('word/styles.xml')?.asText() || '';
        const footnotesXml = zip.file('word/footnotes.xml')?.asText() || '';
        const settingsXml = zip.file('word/settings.xml')?.asText() || '';

        // Collect all header and footer XMLs for page numbering analysis
        const headerXmls = [];
        const footerXmls = [];
        Object.keys(zip.files).forEach(name => {
            if (/^word\/header\d*\.xml$/i.test(name)) {
                headerXmls.push({ name, xml: zip.file(name).asText() });
            } else if (/^word\/footer\d*\.xml$/i.test(name)) {
                footerXmls.push({ name, xml: zip.file(name).asText() });
            }
        });

        // Parse XMLs
        const parser = new xml2js.Parser();
        const documentData = documentXml ? await parser.parseStringPromise(documentXml) : null;
        const stylesData = stylesXml ? await parser.parseStringPromise(stylesXml) : null;
        const footnotesData = footnotesXml ? await parser.parseStringPromise(footnotesXml) : null;
        const settingsData = settingsXml ? await parser.parseStringPromise(settingsXml) : null;

        const parsedHeaders = await Promise.all(
            headerXmls.map(async h => ({ name: h.name, xml: h.xml, data: await parser.parseStringPromise(h.xml) }))
        );
        const parsedFooters = await Promise.all(
            footerXmls.map(async f => ({ name: f.name, xml: f.xml, data: await parser.parseStringPromise(f.xml) }))
        );

        // Build style map for accurate inheritance resolution
        const styleMap = buildStyleMap(stylesData);

        // Extract paragraphs with style inheritance and footnote reference tracking
        const paragraphs = extractParagraphs(documentData, styleMap);
        classifyParagraphSections(paragraphs);

        // Reconstruct full text from paragraphs (preserving tabs and line breaks)
        const textContent = paragraphs
            .filter(p => !p.isEmpty)
            .map(p => p.text)
            .join('\n');

        const footnotes = extractFootnotes(footnotesData, styleMap);
        const headings = extractHeadings(paragraphs);
        const quotations = extractQuotations(paragraphs);

        // Extract raw text with Mammoth as fallback
        let mammothText = textContent;
        try {
            const result = await mammoth.extractRawText({ buffer: data });
            if (result?.value && !textContent) {
                mammothText = result.value;
            }
        } catch (_) {
            // Ignore mammoth fallback errors
        }

        const bodyWordCount = paragraphs
            .filter(p => !p.isEmpty && (p.section === 'body' || p.section === 'preliminary'))
            .reduce((acc, p) => acc + p.text.trim().split(/\s+/).filter(Boolean).length, 0);
        const totalWordCount = textContent.trim().split(/\s+/).filter(Boolean).length;

        const parsedDoc = {
            raw: {
                document: documentData,
                styles: stylesData,
                footnotes: footnotesData,
                settings: settingsData
            },
            content: {
                text: textContent || mammothText,
                paragraphs,
                footnotes,
                headings,
                quotations
            },
            formatting: {
                font: extractFontInfo(paragraphs, styleMap),
                margins: extractMargins(documentData),
                spacing: extractSpacing(paragraphs),
                pageNumbers: extractPageNumbering(documentData, parsedHeaders, parsedFooters),
                defaultLanguage: styleMap.defaults.lang || null
            },
            structure: {
                pageCount: estimatePageCount(textContent),
                wordCount: totalWordCount,
                bodyWordCount,
                hasTableOfContents: checkForTableOfContents(paragraphs),
                hasBibliography: checkForBibliography(paragraphs)
            }
        };

        return parsedDoc;

    } catch (error) {
        console.error('Error parsing DOCX:', error);
        throw new Error(`Failed to parse document: ${error.message}`);
    }
}

/**
 * Build a map of style definitions and document defaults from word/styles.xml
 */
function buildStyleMap(stylesData) {
    const map = {
        defaults: {
            font: 'Times New Roman',
            fontSize: 12,
            lineSpacing: null,
            alignment: 'left',
            lang: null
        },
        styles: {}
    };

    if (!stylesData || !stylesData['w:styles']) return map;

    try {
        const root = stylesData['w:styles'];

        // 1. Extract docDefaults
        const docDefaults = root['w:docDefaults']?.[0];
        const rPrDefault = docDefaults?.['w:rPrDefault']?.[0]?.['w:rPr']?.[0];
        if (rPrDefault) {
            const fonts = rPrDefault['w:rFonts']?.[0]?.$;
            if (fonts) {
                map.defaults.font = fonts['w:ascii'] || fonts['w:hAnsi'] || fonts['w:cs'] || map.defaults.font;
            }
            if (rPrDefault['w:sz']?.[0]?.$?.['w:val']) {
                map.defaults.fontSize = parseInt(rPrDefault['w:sz'][0].$['w:val'], 10) / 2;
            }
            if (rPrDefault['w:lang']?.[0]?.$?.['w:val']) {
                map.defaults.lang = rPrDefault['w:lang'][0].$['w:val'];
            }
        }

        const pPrDefault = docDefaults?.['w:pPrDefault']?.[0]?.['w:pPr']?.[0];
        if (pPrDefault?.['w:spacing']?.[0]?.$?.['w:line']) {
            map.defaults.lineSpacing = parseInt(pPrDefault['w:spacing'][0].$['w:line'], 10) / 240;
        }

        // 2. Extract individual styles
        const styleNodes = root['w:style'] || [];
        styleNodes.forEach(s => {
            const styleId = s.$?.['w:styleId'];
            if (!styleId) return;

            const name = s['w:name']?.[0]?.$?.['w:val'] || styleId;
            const basedOn = s['w:basedOn']?.[0]?.$?.['w:val'] || null;
            const isDefault = s.$?.['w:default'] === '1' && s.$?.['w:type'] === 'paragraph';
            const rPr = s['w:rPr']?.[0];
            const pPr = s['w:pPr']?.[0];

            let font = null;
            let fontSize = null;
            let bold = null;
            let italic = null;

            if (rPr) {
                const fonts = rPr['w:rFonts']?.[0]?.$;
                if (fonts) {
                    font = fonts['w:ascii'] || fonts['w:hAnsi'] || fonts['w:cs'] || null;
                }
                if (rPr['w:sz']?.[0]?.$?.['w:val']) {
                    fontSize = parseInt(rPr['w:sz'][0].$['w:val'], 10) / 2;
                }
                if (rPr['w:b']) {
                    const val = rPr['w:b'][0]?.$?.['w:val'];
                    bold = val !== '0' && val !== 'false';
                }
                if (rPr['w:i']) {
                    const val = rPr['w:i'][0]?.$?.['w:val'];
                    italic = val !== '0' && val !== 'false';
                }
            }

            let alignment = null;
            let indentation = null;
            let spacing = null;
            if (pPr) {
                if (pPr['w:jc']?.[0]?.$?.['w:val']) {
                    alignment = pPr['w:jc'][0].$['w:val'];
                }
                if (pPr['w:ind']?.[0]?.$) {
                    indentation = pPr['w:ind'][0].$;
                }
                if (pPr['w:spacing']?.[0]?.$) {
                    spacing = pPr['w:spacing'][0].$;
                }
            }

            map.styles[styleId] = {
                styleId,
                name,
                basedOn,
                isDefault,
                font,
                fontSize,
                bold,
                italic,
                alignment,
                indentation,
                spacing
            };

            if (isDefault) {
                if (font) map.defaults.font = font;
                if (fontSize) map.defaults.fontSize = fontSize;
            }
        });
    } catch (error) {
        // Fallback to defaults on error
    }

    return map;
}

/**
 * Resolve inherited style properties for a given styleId
 */
function resolveStyle(styleId, styleMap, defaultFontSize = 12) {
    const resolved = {
        font: styleMap?.defaults?.font || 'Times New Roman',
        fontSize: defaultFontSize || styleMap?.defaults?.fontSize || 12,
        bold: false,
        italic: false,
        alignment: null,
        indentation: null,
        spacing: null
    };

    if (!styleId || !styleMap?.styles) return resolved;

    const chain = [];
    let curr = styleId;
    const visited = new Set();
    while (curr && styleMap.styles[curr] && !visited.has(curr)) {
        visited.add(curr);
        chain.unshift(styleMap.styles[curr]);
        curr = styleMap.styles[curr].basedOn;
    }

    chain.forEach(s => {
        if (s.font) resolved.font = s.font;
        if (s.fontSize) resolved.fontSize = s.fontSize;
        if (s.bold !== null) resolved.bold = s.bold;
        if (s.italic !== null) resolved.italic = s.italic;
        if (s.alignment) resolved.alignment = s.alignment;
        if (s.indentation) resolved.indentation = { ...(resolved.indentation || {}), ...s.indentation };
        if (s.spacing) resolved.spacing = { ...(resolved.spacing || {}), ...s.spacing };
    });

    return resolved;
}

/**
 * Collect all w:r (run) elements inside a paragraph (including inside hyperlinks, fields, smartTags, insertions)
 */
function collectRunsFromParagraph(para) {
    const runs = [];

    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        // If this object is a w:r node directly
        for (const key of Object.keys(node)) {
            if (key === 'w:pPr') continue;
            if (key === 'w:r') {
                const rArray = Array.isArray(node[key]) ? node[key] : [node[key]];
                rArray.forEach(r => runs.push(r));
            } else if (['w:hyperlink', 'w:fldSimple', 'w:smartTag', 'w:ins', 'w:sdt', 'w:sdtContent'].includes(key)) {
                walk(node[key]);
            }
        }
    }

    walk(para);
    return runs;
}

/**
 * Extract text, footnote references, and rich run details from a paragraph element
 */
function extractParagraphDetails(para, styleMap, defaultFontSize = 12) {
    const pPr = para['w:pPr']?.[0];
    const styleId = pPr?.['w:pStyle']?.[0]?.$?.['w:val'] || null;
    const styleName = (styleId && styleMap?.styles?.[styleId]?.name) || styleId || null;
    const inherited = resolveStyle(styleId, styleMap, defaultFontSize);

    // Paragraph-level rPr override
    const pRPr = pPr?.['w:rPr']?.[0];
    const paraFont = pRPr?.['w:rFonts']?.[0]?.$?.['w:ascii'] ||
                     pRPr?.['w:rFonts']?.[0]?.$?.['w:hAnsi'] ||
                     inherited.font;
    const paraSize = pRPr?.['w:sz']?.[0]?.$?.['w:val']
        ? parseInt(pRPr['w:sz'][0].$['w:val'], 10) / 2
        : inherited.fontSize;

    const formatting = {
        styleId,
        styleName,
        alignment: pPr?.['w:jc']?.[0]?.$?.['w:val'] || inherited.alignment || null,
        indentation: pPr?.['w:ind']?.[0]?.$ || inherited.indentation || null,
        spacing: pPr?.['w:spacing']?.[0]?.$ || inherited.spacing || null,
        hasPageBreakBefore: Boolean(pPr?.['w:pageBreakBefore']),
        fonts: [],
        fontSizes: [],
        bold: false,
        italic: false,
        hasItalicRun: false,
        hasBoldRun: false,
        runs: []
    };

    let text = '';
    let textWithFootnotes = '';
    const footnoteRefs = [];

    const rawRuns = collectRunsFromParagraph(para);
    let totalTextLength = 0;
    let boldTextLength = 0;
    let italicTextLength = 0;

    rawRuns.forEach(run => {
        const rPr = run['w:rPr']?.[0];
        const rFonts = rPr?.['w:rFonts']?.[0]?.$;
        const font = rFonts?.['w:ascii'] || rFonts?.['w:hAnsi'] || rFonts?.['w:cs'] || rFonts?.['w:eastAsia'] || paraFont;
        const size = rPr?.['w:sz']?.[0]?.$?.['w:val']
            ? parseInt(rPr['w:sz'][0].$['w:val'], 10) / 2
            : paraSize;

        let isBold = inherited.bold;
        if (rPr?.['w:b']) {
            const val = rPr['w:b'][0]?.$?.['w:val'];
            isBold = val !== '0' && val !== 'false';
        }
        let isItalic = inherited.italic;
        if (rPr?.['w:i']) {
            const val = rPr['w:i'][0]?.$?.['w:val'];
            isItalic = val !== '0' && val !== 'false';
        }
        const vertAlign = rPr?.['w:vertAlign']?.[0]?.$?.['w:val'] || null;

        // Check for footnote references in this run
        if (run['w:footnoteReference']) {
            run['w:footnoteReference'].forEach(fnRef => {
                const fnId = fnRef.$?.['w:id'];
                if (fnId && fnId !== '0' && fnId !== '-1') {
                    footnoteRefs.push({
                        id: fnId,
                        offsetInText: text.length
                    });
                    textWithFootnotes += `[FN:${fnId}]`;
                    formatting.runs.push({
                        text: `[FN:${fnId}]`,
                        isFootnoteRef: true,
                        footnoteId: fnId,
                        font,
                        fontSize: size,
                        bold: isBold,
                        italic: isItalic
                    });
                }
            });
        }

        // Check for tabs or breaks
        let runText = '';
        if (run['w:tab']) {
            runText += '\t';
        }
        if (run['w:t']) {
            run['w:t'].forEach(t => {
                if (typeof t === 'string') {
                    runText += t;
                } else if (t && typeof t._ === 'string') {
                    runText += t._;
                }
            });
        }
        if (run['w:br']) {
            run['w:br'].forEach(br => {
                const brType = br.$?.['w:type'];
                if (brType === 'page') {
                    formatting.hasPageBreakBefore = true;
                } else {
                    runText += '\n';
                }
            });
        }

        if (runText.length > 0) {
            text += runText;
            textWithFootnotes += runText;

            const trimmed = runText.trim();
            if (trimmed.length > 0 && vertAlign !== 'superscript') {
                if (font && !formatting.fonts.includes(font)) {
                    formatting.fonts.push(font);
                }
                if (size && !formatting.fontSizes.includes(size)) {
                    formatting.fontSizes.push(size);
                }
                totalTextLength += trimmed.length;
                if (isBold) {
                    formatting.hasBoldRun = true;
                    boldTextLength += trimmed.length;
                }
                if (isItalic) {
                    formatting.hasItalicRun = true;
                    italicTextLength += trimmed.length;
                }
            }

            formatting.runs.push({
                text: runText,
                isFootnoteRef: false,
                font,
                fontSize: size,
                bold: isBold,
                italic: isItalic,
                vertAlign
            });
        }
    });

    if (totalTextLength > 0) {
        formatting.bold = boldTextLength >= totalTextLength * 0.8;
        formatting.italic = italicTextLength >= totalTextLength * 0.8;
    }

    // Annotate each footnote reference with surrounding text context (before/after)
    footnoteRefs.forEach(ref => {
        const before = text.substring(Math.max(0, ref.offsetInText - 30), ref.offsetInText);
        const after = text.substring(ref.offsetInText, Math.min(text.length, ref.offsetInText + 30));
        ref.charBefore = before.slice(-1) || '';
        ref.charAfter = after.slice(0, 1) || '';
        ref.contextBefore = before;
        ref.contextAfter = after;
    });

    return {
        text,
        textWithFootnotes,
        footnoteRefs,
        formatting
    };
}

/**
 * Extract paragraph information from document XML
 */
function extractParagraphs(documentData, styleMap) {
    const paragraphs = [];
    if (!documentData) return paragraphs;

    try {
        const body = documentData['w:document']?.['w:body']?.[0];
        const elements = body?.['w:p'] || [];

        elements.forEach((para, index) => {
            const details = extractParagraphDetails(para, styleMap, 12);
            paragraphs.push({
                index: index + 1,
                text: details.text,
                textWithFootnotes: details.textWithFootnotes,
                footnoteRefs: details.footnoteRefs,
                formatting: details.formatting,
                isEmpty: details.text.trim().length === 0,
                section: 'body'
            });
        });
    } catch (error) {
        console.error('Error extracting paragraphs:', error);
    }

    return paragraphs;
}

/**
 * Classify paragraphs into logical document sections:
 * 'cover' | 'preliminary' | 'body' | 'declaration' | 'appendix' | 'bibliography'
 */
function classifyParagraphSections(paragraphs) {
    let currentSection = 'cover';
    let seenCoverEnd = false;

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const trimmed = p.text.trim();
        if (!trimmed) {
            p.section = currentSection;
            continue;
        }

        // Detect Bibliography section header
        if (/^(bibliography|references|works\s+cited|selected\s+bibliography)$/i.test(trimmed)) {
            currentSection = 'bibliography';
            p.section = 'bibliographyHeader';
            continue;
        }

        // Detect Appendix section header
        if (/^appendix(\s+\d+|\s+[A-Z])?\b/i.test(trimmed) && trimmed.length < 100) {
            currentSection = 'appendix';
            p.section = 'appendix';
            continue;
        }

        // Detect end-of-paper Student / AI / Academic Honesty Declaration section (after body)
        if (
            seenCoverEnd &&
            currentSection !== 'bibliography' &&
            /^(student\s+declaration|declaration\s+of\s+academic\s+honesty|ai\s+usage\s+declaration)$/i.test(trimmed)
        ) {
            currentSection = 'declaration';
            p.section = 'declaration';
            continue;
        }

        // While in cover page at start of document, detect transition to body or preliminary pages
        if (currentSection === 'cover') {
            const isCoverLine =
                /south\s+asia\s+institute/i.test(trimmed) ||
                /^submitted\s+to$/i.test(trimmed) ||
                /partial\s+fulfil+ment/i.test(trimmed) ||
                /requirements\s+of\s+the/i.test(trimmed) ||
                /due\s+date\s*:/i.test(trimmed) ||
                /expected\s+(time|word)/i.test(trimmed) ||
                /actual\s+(time|word)/i.test(trimmed) ||
                /declare\s+that\s+this\s+(assignment|thesis)/i.test(trimmed) ||
                /copied\s+it\s+from\s+any\s+person/i.test(trimmed) ||
                /duly\s+acknowledged/i.test(trimmed) ||
                /^signature\s*:/i.test(trimmed) ||
                /^by$/i.test(trimmed) ||
                /^(registration|admission)\s*(#|no\.?|number)/i.test(trimmed) ||
                /^\d{1,2}[\s/-][A-Za-z]+[\s/-]\d{4}$|^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$|^[A-Za-z]+\s+\d{4}$/.test(trimmed);

            if (isCoverLine || (i < 35 && p.formatting.alignment === 'center' && trimmed.length < 120)) {
                p.section = 'cover';
                continue;
            }

            // Check if we passed the signature/registration/date block at the bottom of the cover page
            const hasSeenSignatureOrReg = paragraphs
                .slice(0, i)
                .some(prev => !prev.isEmpty && (/^signature\s*:/i.test(prev.text.trim()) || /^(registration|admission)\s*(#|no)/i.test(prev.text.trim())));

            if (hasSeenSignatureOrReg || i > 35 || trimmed.length > 180) {
                seenCoverEnd = true;
                currentSection = 'body';
            }
        }

        p.section = currentSection;
    }
}

/**
 * Extract footnotes from word/footnotes.xml
 */
function extractFootnotes(footnotesData, styleMap) {
    const footnotes = [];
    if (!footnotesData) return footnotes;

    try {
        const notes = footnotesData['w:footnotes']?.['w:footnote'] || [];
        notes.forEach(note => {
            const id = note.$?.['w:id'];
            const type = note.$?.['w:type'];
            if (id && id !== '-1' && id !== '0' && type !== 'separator' && type !== 'continuationSeparator') {
                const paras = note['w:p'] || [];
                const paraDetails = paras.map(p => extractParagraphDetails(p, styleMap, 10));
                const fullText = paraDetails.map(d => d.text).join(' ').replace(/\s+/g, ' ').trim();
                const primaryFormatting = paraDetails[0]?.formatting || {
                    alignment: null,
                    indentation: null,
                    spacing: null,
                    fonts: [],
                    fontSizes: [],
                    runs: []
                };

                footnotes.push({
                    id: String(id),
                    text: fullText,
                    formatting: primaryFormatting
                });
            }
        });
    } catch (error) {
        console.error('Error extracting footnotes:', error);
    }

    return footnotes;
}

/**
 * Extract headings (both Word Heading styles and decimal-numbered section headings like 1. / 1.1 / 1.1.1)
 */
function extractHeadings(paragraphs) {
    const headings = [];

    paragraphs.forEach(para => {
        if (para.isEmpty) return;
        if (['cover', 'bibliography', 'bibliographyHeader', 'declaration'].includes(para.section)) return;

        const trimmed = para.text.trim();
        const styleId = para.formatting.styleId || '';
        const styleName = para.formatting.styleName || '';

        const isHeadingStyle = /heading/i.test(styleId) || /heading/i.test(styleName);
        const decimalMatch = trimmed.match(/^(\d+(?:\.\d+)*)\.?\s+\S+/);

        // Exclude long body paragraphs that happen to start with a number
        if (isHeadingStyle || (decimalMatch && trimmed.length <= 140)) {
            let level = 1;
            if (decimalMatch) {
                level = decimalMatch[1].split('.').length;
            } else if (isHeadingStyle) {
                const m = (styleId + ' ' + styleName).match(/\d+/);
                level = m ? parseInt(m[0], 10) : 1;
            }

            headings.push({
                index: para.index,
                text: trimmed,
                level,
                styleId: styleId || 'normal',
                formatting: para.formatting
            });
        }
    });

    return headings;
}

/**
 * Extract quotations (both inline quoted strings and indented block quotations)
 */
function extractQuotations(paragraphs) {
    const quotations = [];

    // Match both curly quotes (“...”) and straight quotes ("...")
    const quoteRegex = /(?:“([^”]+)”|"([^"]+)")/g;

    paragraphs.forEach(para => {
        if (para.isEmpty) return;
        if (['cover', 'bibliography', 'bibliographyHeader', 'declaration'].includes(para.section)) return;

        // 1. Check if this paragraph itself is formatted as an indented block quotation
        const leftIndent = parseInt(para.formatting.indentation?.['w:left'] || '0', 10);
        const hangingIndent = parseInt(para.formatting.indentation?.['w:hanging'] || '0', 10);
        const isBlockQuoteParagraph = leftIndent >= 500 && hangingIndent === 0 && para.text.trim().length > 100;

        if (isBlockQuoteParagraph) {
            quotations.push({
                text: para.text.trim(),
                paragraphIndex: para.index,
                lines: Math.ceil(para.text.trim().length / 80),
                isBlockQuoteParagraph: true,
                needsBlockFormat: false,
                hasEnclosingQuotes: /^[“"‘']/.test(para.text.trim()) && /[”"’']\.?$/.test(para.text.trim()),
                formatting: para.formatting,
                footnoteRefs: para.footnoteRefs
            });
            return;
        }

        // 2. Extract inline quotations from body paragraphs
        let match;
        quoteRegex.lastIndex = 0;
        while ((match = quoteRegex.exec(para.text)) !== null) {
            const quotedText = match[1] || match[2] || '';
            if (quotedText.trim().length < 3) continue;

            const actualLines = quotedText.split('\n').length;
            const estimatedLines = Math.ceil(quotedText.length / 85);
            const lineCount = Math.max(actualLines, estimatedLines);

            const quoteStart = match.index;
            const quoteEnd = match.index + match[0].length;

            // Check if there is a footnote reference in this paragraph at or after this quote, or parenthetical reference
            const hasFootnoteInParagraph = para.footnoteRefs && para.footnoteRefs.length > 0;
            const afterQuoteText = para.text.substring(quoteEnd, Math.min(para.text.length, quoteEnd + 60));
            const hasParentheticalCitation = /^\s*\([^)]+\)/.test(afterQuoteText);

            quotations.push({
                text: quotedText,
                rawMatch: match[0],
                paragraphIndex: para.index,
                startInParagraph: quoteStart,
                endInParagraph: quoteEnd,
                afterQuoteText,
                lines: lineCount,
                isBlockQuoteParagraph: false,
                needsBlockFormat: lineCount > 4,
                hasCitation: hasFootnoteInParagraph || hasParentheticalCitation,
                formatting: para.formatting
            });
        }
    });

    return quotations;
}

/**
 * Extract overall font information across body paragraphs
 */
function extractFontInfo(paragraphs, styleMap) {
    const fonts = new Set();
    const fontSizes = new Set();

    paragraphs.forEach(para => {
        if (para.isEmpty) return;
        (para.formatting.fonts || []).forEach(f => {
            if (f && f !== '_inherit_') fonts.add(f);
        });
        (para.formatting.fontSizes || []).forEach(s => {
            if (s && s > 0) fontSizes.add(s);
        });
    });

    if (fonts.size === 0 && styleMap?.defaults?.font) {
        fonts.add(styleMap.defaults.font);
    }
    if (fontSizes.size === 0 && styleMap?.defaults?.fontSize) {
        fontSizes.add(styleMap.defaults.fontSize);
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
        const body = documentData?.['w:document']?.['w:body']?.[0];
        let sectPr = body?.['w:sectPr']?.[0];
        if (!sectPr && body?.['w:p']) {
            for (const p of body['w:p']) {
                if (p['w:pPr']?.[0]?.['w:sectPr']?.[0]) {
                    sectPr = p['w:pPr'][0]['w:sectPr'][0];
                    break;
                }
            }
        }
        if (sectPr?.['w:pgMar']) {
            const margins = sectPr['w:pgMar'][0].$;
            return {
                top: twipsToInches(parseInt(margins['w:top'], 10)),
                bottom: twipsToInches(parseInt(margins['w:bottom'], 10)),
                left: twipsToInches(parseInt(margins['w:left'], 10)),
                right: twipsToInches(parseInt(margins['w:right'], 10))
            };
        }
    } catch (error) {
        // Silent fail
    }

    return null;
}

/**
 * Extract spacing information from body paragraphs
 */
function extractSpacing(paragraphs) {
    const spacings = [];

    paragraphs.forEach(para => {
        if (para.isEmpty || para.section !== 'body') return;
        const line = para.formatting.spacing?.['w:line'];
        if (line) {
            spacings.push(parseInt(line, 10) / 240);
        }
    });

    return spacings;
}

/**
 * Extract page numbering from section properties, headers, and footers
 */
function extractPageNumbering(documentData, parsedHeaders = [], parsedFooters = []) {
    const result = {
        present: false,
        inFooter: false,
        inHeader: false,
        alignment: null,
        hasTitlePg: false,
        location: null
    };

    try {
        const body = documentData?.['w:document']?.['w:body']?.[0];
        const sectPr = body?.['w:sectPr']?.[0];
        if (sectPr?.['w:titlePg']) {
            result.hasTitlePg = true;
        }

        const hasPageField = (xmlStr) =>
            /w:instr="[^"]*\bPAGE\b/i.test(xmlStr) ||
            /<w:instrText[^>]*>\s*PAGE\b/i.test(xmlStr);

        parsedFooters.forEach(f => {
            if (hasPageField(f.xml)) {
                result.present = true;
                result.inFooter = true;
                const jcMatch = f.xml.match(/<w:jc\s+w:val="([^"]+)"/i);
                result.alignment = jcMatch ? jcMatch[1] : 'left';
                result.location = `footer (${result.alignment})`;
            }
        });

        parsedHeaders.forEach(h => {
            if (hasPageField(h.xml)) {
                result.present = true;
                result.inHeader = true;
                const jcMatch = h.xml.match(/<w:jc\s+w:val="([^"]+)"/i);
                if (!result.alignment) {
                    result.alignment = jcMatch ? jcMatch[1] : 'left';
                }
                if (!result.location) {
                    result.location = `header (${result.alignment})`;
                }
            }
        });
    } catch (error) {
        // Silent fail
    }

    return result;
}

/**
 * Estimate page count based on word count
 */
function estimatePageCount(text) {
    const wordsPerPage = 250;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.ceil(wordCount / wordsPerPage);
}

/**
 * Check for table of contents
 */
function checkForTableOfContents(paragraphs) {
    return paragraphs.some(p => /^table\s+of\s+contents$/i.test(p.text.trim()));
}

/**
 * Check for bibliography
 */
function checkForBibliography(paragraphs) {
    return paragraphs.some(p => /^(bibliography|references|works\s+cited|selected\s+bibliography)$/i.test(p.text.trim()));
}

/**
 * Convert twips to inches
 */
function twipsToInches(twips) {
    return Math.round((twips / 1440) * 100) / 100;
}

module.exports = { parseDocx };
