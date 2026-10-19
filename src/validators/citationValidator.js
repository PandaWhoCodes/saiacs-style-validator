/**
 * Validate citations, footnotes, bibliography, and abbreviations
 * according to Chicago Manual of Style 17th ed. (SAIACS Style Guide 2020-2021 adaptation)
 */

const FULL_BIBLE_BOOKS_MAP = {
    'genesis': 'Gen.',
    'exodus': 'Exod.',
    'leviticus': 'Lev.',
    'numbers': 'Num.',
    'deuteronomy': 'Deut.',
    'joshua': 'Josh.',
    'judges': 'Judg.',
    '1 samuel': '1 Sam.',
    '2 samuel': '2 Sam.',
    '1 chronicles': '1 Chron.',
    '2 chronicles': '2 Chron.',
    'nehemiah': 'Neh.',
    'psalms': 'Ps. / Pss.',
    'psalm': 'Ps.',
    'proverbs': 'Prov.',
    'ecclesiastes': 'Eccles.',
    'song of solomon': 'Song of Sol.',
    'isaiah': 'Isa.',
    'jeremiah': 'Jer.',
    'lamentations': 'Lam.',
    'ezekiel': 'Ezek.',
    'daniel': 'Dan.',
    'obadiah': 'Obad.',
    'jonah': 'Jon.',
    'micah': 'Mic.',
    'nahum': 'Nah.',
    'habakkuk': 'Hab.',
    'zephaniah': 'Zeph.',
    'haggai': 'Hag.',
    'zechariah': 'Zech.',
    'malachi': 'Mal.',
    'matthew': 'Matt.',
    'romans': 'Rom.',
    '1 corinthians': '1 Cor.',
    '2 corinthians': '2 Cor.',
    'galatians': 'Gal.',
    'ephesians': 'Eph.',
    'philippians': 'Phil.',
    'colossians': 'Col.',
    '1 thessalonians': '1 Thess.',
    '2 thessalonians': '2 Thess.',
    '1 timothy': '1 Tim.',
    '2 timothy': '2 Tim.',
    'philemon': 'Philem.',
    'hebrews': 'Heb.',
    '1 peter': '1 Pet.',
    '2 peter': '2 Pet.',
    'revelation': 'Rev.'
};

function validateCitations(documentData) {
    const issues = [];
    const footnotes = documentData.content.footnotes;
    const paragraphs = documentData.content.paragraphs;

    // Prohibited Latin abbreviations (Section 2.iii & 4.2.1)
    const prohibitedTerms = [
        { regex: /\bibid\.?(?=\W|$)/i, label: 'ibid.', replacement: 'shortened footnote style (Surname, Short Title, page)' },
        { regex: /\bibidem\b/i, label: 'ibidem', replacement: 'shortened footnote style (Surname, Short Title, page)' },
        { regex: /\bet\s+al\.?(?=\W|$)/i, label: 'et al.', replacement: '"and others"' },
        { regex: /\bop\.\s*cit\.?(?=\W|$)/i, label: 'op. cit.', replacement: 'shortened footnote style (Surname, Short Title, page)' },
        { regex: /\bloc\.\s*cit\.?(?=\W|$)/i, label: 'loc. cit.', replacement: 'shortened footnote style (Surname, Short Title, page)' },
        { regex: /\bidem\b/i, label: 'idem', replacement: 'the author’s surname and shortened title' }
    ];

    // Track authors introduced with full citations in footnotes
    const seenAuthorSurnames = new Set();

    // 1. Validate Footnotes
    footnotes.forEach(footnote => {
        const rawText = footnote.text.trim();
        if (!rawText) return;

        // Strip leading footnote number if embedded in text
        const cleanText = rawText.replace(/^\d+\.?\s*/, '').trim();
        const textSnippet = cleanText.substring(0, 110) + (cleanText.length > 110 ? '...' : '');

        // Skip footnotes that merely declare Bible version (Section 6.2 Footnote 13)
        if (/bible|translation|niv|esv|nrsv|kjv|nasb/i.test(cleanText) && cleanText.length < 120 && !/\(\d{4}\)/.test(cleanText)) {
            return;
        }

        // 1a. Prohibited Latin terms
        prohibitedTerms.forEach(({ regex, label, replacement }) => {
            if (regex.test(cleanText)) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'Prohibited Latin Abbreviations (Section 2.iii)',
                    message: `Footnote ${footnote.id} uses prohibited Latin notation "${label}". Use ${replacement} instead.`,
                    expected: replacement,
                    found: label,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: `Replace "${label}" with ${replacement}`
                });
            }
        });

        // 1b. "f." or "ff." or "p." / "pp." in footnotes (Section 4.2.1)
        if (/\b\d+\s*f{1,2}\.?(?=\W|$)/i.test(cleanText)) {
            issues.push({
                category: 'Citations',
                severity: 'high',
                rule: 'Exact Page Numbers (Section 4.2.1)',
                message: `Footnote ${footnote.id} uses "f." or "ff." instead of exact page numbers.`,
                expected: 'Exact page numbers or page range (e.g., 45-47)',
                found: 'f. / ff. notation',
                location: {
                    footnote: footnote.id,
                    text: textSnippet
                },
                fix: 'Replace "f." or "ff." with the exact page number or range'
            });
        }

        if (/\bpp?\.\s*\d+/i.test(cleanText)) {
            issues.push({
                category: 'Citations',
                severity: 'medium',
                rule: 'Page Number Prefix (Section 3.1)',
                message: `Footnote ${footnote.id} uses "p." or "pp." before page numbers. Chicago/SAIACS style uses bare page numbers.`,
                expected: 'Bare page numbers (e.g., 316 or 241-251)',
                found: cleanText.match(/\bpp?\.\s*\d+/i)[0],
                location: {
                    footnote: footnote.id,
                    text: textSnippet
                },
                fix: 'Remove "p." / "pp." and give the page numbers directly'
            });
        }

        // 1c. Roman numerals for volume numbers (Section 2.ii)
        const romanVolMatch = cleanText.match(/\b(?:vol\.?|volume)\s+([IVXLCDM]+)\b/i);
        if (romanVolMatch) {
            issues.push({
                category: 'Citations',
                severity: 'medium',
                rule: 'Arabic Volume Numbers (Section 2.ii)',
                message: `Footnote ${footnote.id} uses Roman numeral "${romanVolMatch[0]}" for volume number. Convert to Arabic numerals.`,
                expected: 'Arabic volume number (e.g., vol. 4)',
                found: romanVolMatch[0],
                location: {
                    footnote: footnote.id,
                    text: textSnippet
                },
                fix: 'Convert Roman volume numerals to Arabic numbers (e.g., XXXV → 35)'
            });
        }

        // Classify whether this footnote is a full citation or a shortened citation
        const hasParenPublication = /\([^)]*\d{4}[^)]*\)/.test(cleanText);
        const hasUrlOrDoi = /https?:\/\/|doi\.org/i.test(cleanText);
        const isOnlineOrMedia = /youtube|website|web\s+log|blog|podcast|interview|lecture|presentation/i.test(cleanText) || hasUrlOrDoi;
        const hasPublicationYear = /\b(?:1[89]\d{2}|20\d{2}|n\.d\.)\b/i.test(cleanText);
        const isFullCitation = hasParenPublication || hasUrlOrDoi || isOnlineOrMedia || hasPublicationYear;
        const commaParts = cleanText.split(',').map(s => s.trim()).filter(Boolean);

        // Extract likely author surname(s) from the first comma segment
        const firstSegment = commaParts[0]?.replace(/\.$/, '').trim() || '';
        const authorWords = firstSegment.split(/\s+/).filter(Boolean);
        const lastWordSurname = authorWords[authorWords.length - 1]?.replace(/[^A-Za-z'-]/g, '').toLowerCase() || '';

        // 1d. Author-only footnote check (e.g. "Delbert Royce Burkett.")
        if (commaParts.length === 1 && !isFullCitation) {
            issues.push({
                category: 'Citations',
                severity: 'high',
                rule: 'Incomplete Shortened Footnote (Section 2.i)',
                message: `Footnote ${footnote.id} contains only "${cleanText}". Subsequent footnotes must include the author's surname and a shortened form of the title.`,
                expected: 'Surname, Shortened Title, page (e.g., Burkett, Introduction to the New Testament, 45.)',
                found: cleanText,
                location: {
                    footnote: footnote.id,
                    text: textSnippet
                },
                fix: 'Use surname only and add the shortened work title'
            });
            return;
        }

        // 1e. Check Book Footnote for missing Place of Publication (City: Publisher, Year) (Section 3.1)
        const parenMatch = cleanText.match(/\(([^()]*\b(?:1[89]\d{2}|20\d{2})\b[^()]*)\)/);
        if (parenMatch) {
            const pubInside = parenMatch[1].trim();
            const isJournalIssue = /^\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|fall|winter|\d{4})\b/i.test(pubInside);
            const isThesisOrLecture = /thesis|diss\.|lecture|presentation|paper\s+presented/i.test(pubInside);

            if (!isJournalIssue && !isThesisOrLecture && !isOnlineOrMedia && !pubInside.includes(':')) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'Missing Place of Publication in Footnote (Section 3.1)',
                    message: `Footnote ${footnote.id} has "(${pubInside})" without the city of publication. SAIACS uses Chicago 17th ed., which requires "(City: Publisher, Year)".`,
                    expected: '(City: Publisher, Year) — e.g., (Grand Rapids, MI: Zondervan, 2005)',
                    found: `(${pubInside})`,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: 'Add the city of publication followed by a colon before the publisher name'
                });
            }
        }

        // 1f. Check if first citation of an author was given in shortened form instead of full form (Section 2.i)
        const isShortenedNote = !isFullCitation && commaParts.length <= 3;
        if (isFullCitation) {
            // Record all surnames and full names mentioned in the author segment
            firstSegment
                .split(/\band\b|,/i)
                .map(part => part.trim())
                .filter(Boolean)
                .forEach(part => {
                    const surname = part.split(/\s+/).pop()?.replace(/[^A-Za-z'-]/g, '').toLowerCase();
                    if (surname) seenAuthorSurnames.add(surname);
                    if (part.split(/\s+/).length >= 2) {
                        seenAuthorSurnames.add(`full:${part.toLowerCase()}`);
                    }
                });
        } else if (isShortenedNote && lastWordSurname) {
            if (!seenAuthorSurnames.has(lastWordSurname)) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'First Footnote Must Be Full Citation (Section 2.i)',
                    message: `Footnote ${footnote.id} uses a shortened citation for "${firstSegment}", but this source has not been introduced with a full footnote yet.`,
                    expected: 'Full citation on first reference: Author Full Name, Title (City: Publisher, Year), page.',
                    found: cleanText,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: 'Provide full publication details in the first footnote for this source'
                });
                seenAuthorSurnames.add(lastWordSurname);
            } else if (
                authorWords.length >= 2 &&
                seenAuthorSurnames.has(`full:${firstSegment.toLowerCase()}`) &&
                !/\band\b/i.test(firstSegment) &&
                !/society|church|institute|committee|association|council|ministry|press|university|board|organization/i.test(firstSegment)
            ) {
                const expectedSurname = authorWords[authorWords.length - 1];
                issues.push({
                    category: 'Citations',
                    severity: 'medium',
                    rule: 'Shortened Footnote Author Format (Section 2.i)',
                    message: `Footnote ${footnote.id} uses the author's full name ("${firstSegment}") in a shortened citation. Subsequent footnotes should use only the author's last name ("${expectedSurname}").`,
                    expected: `${expectedSurname}, ${commaParts.slice(1).join(', ')}`,
                    found: cleanText,
                    location: {
                        footnote: footnote.id,
                        text: textSnippet
                    },
                    fix: `Replace "${firstSegment}" with "${expectedSurname}" in the shortened footnote`
                });
            }
        }
    });

    // 2. Check Quotations Without Citations (Section 2.5.2)
    const quotations = documentData.content.quotations;
    quotations.forEach(quote => {
        if (!quote.isBlockQuoteParagraph && !quote.hasCitation && quote.text.split(/\s+/).length >= 6) {
            const snippet = quote.text.substring(0, 90) + (quote.text.length > 90 ? '...' : '');
            issues.push({
                category: 'Citations',
                severity: 'high',
                rule: 'Uncited Quotation (Section 2.5.2)',
                message: `Direct quotation in Paragraph ${quote.paragraphIndex} does not have a footnote or parenthetical Scripture reference.`,
                expected: 'Footnote reference or (Book chap:verse) after quotation',
                found: `“${snippet}”`,
                location: {
                    paragraph: quote.paragraphIndex,
                    text: snippet
                },
                fix: 'Add a footnote reference or Scripture citation for this quotation'
            });
        }
    });

    // 3. Validate Scripture Citations & Era/Area Abbreviations in Body Text (Sections 2.7, 6.2 & Appendix 3)
    const abbrevBiblePattern = /\b(?:1|2|3)?\s*(?:Gen|Exod|Lev|Num|Deut|Josh|Judg|Ruth|Sam|Kings|Chron|Ezra|Neh|Esther|Job|Pss?|Prov|Eccles|Qoh|Song\s+of\s+Sol|Cant|Isa|Jer|Lam|Ezek|Dan|Hosea|Joel|Amos|Obad|Jon|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt|Mark|Luke|John|Acts|Rom|Cor|Gal|Eph|Phil|Col|Thess|Tim|Titus|Philem|Heb|James|Pet|Jude|Rev)\.?\s+\d+:\d+/g;

    paragraphs.forEach(para => {
        if (para.isEmpty || para.section !== 'body') return;

        const idx = para.index;
        const snippet = para.text.trim().substring(0, 90) + (para.text.trim().length > 90 ? '...' : '');

        // 3a. Check if a footnote is attached directly to a Scripture citation (Section 6.2)
        if (/(\([A-Za-z0-9.\s]+:\d+(?:-\d+)?\))\[FN:\d+\]/.test(para.textWithFootnotes)) {
            issues.push({
                category: 'Citations',
                severity: 'medium',
                rule: 'Scripture References (Section 6.2)',
                message: `Paragraph ${idx} places a footnote on a Bible reference. SAIACS does not use footnotes for Bible verses (use inline parentheses instead).`,
                expected: 'Inline parenthetical reference without footnote, e.g., (Heb. 11:1)',
                found: para.textWithFootnotes.match(/(\([A-Za-z0-9.\s]+:\d+(?:-\d+)?\))\[FN:\d+\]/)[0],
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: 'Remove the footnote from the Scripture reference'
            });
        }

        // 3b. Check parenthetical Scripture references for unabbreviated book names or extra spaces (Section 2.7 & Appendix 3)
        const parenScriptureRegex = /\(\s*([1-3]?\s*[A-Za-z]+)\s+(\d+:\d+(?:[–-]\d+)?)\s*\)/g;
        let pMatch;
        while ((pMatch = parenScriptureRegex.exec(para.text)) !== null) {
            const fullMatch = pMatch[0];
            const bookName = pMatch[1].trim().replace(/\s+/g, ' ');
            const bookLower = bookName.toLowerCase();

            if (/^\(\s+|\s+\)$/.test(fullMatch)) {
                issues.push({
                    category: 'Citations',
                    severity: 'low',
                    rule: 'Scripture Parentheses Spacing (Section 2.7)',
                    message: `Remove extra spaces inside parentheses in Scripture reference "${fullMatch}".`,
                    expected: `(${bookName} ${pMatch[2]})`,
                    found: fullMatch,
                    location: {
                        paragraph: idx,
                        text: snippet
                    },
                    fix: 'Remove spaces immediately inside the opening or closing parenthesis'
                });
            }

            if (FULL_BIBLE_BOOKS_MAP[bookLower]) {
                const expectedAbbrev = FULL_BIBLE_BOOKS_MAP[bookLower];
                issues.push({
                    category: 'Citations',
                    severity: 'medium',
                    rule: 'Biblical Book Abbreviations (Appendix 3.1)',
                    message: `Use the standard SAIACS abbreviation "${expectedAbbrev}" instead of "${bookName}" inside parenthetical Scripture citations.`,
                    expected: `(${expectedAbbrev} ${pMatch[2]})`,
                    found: fullMatch,
                    location: {
                        paragraph: idx,
                        text: snippet
                    },
                    fix: `Abbreviate "${bookName}" as "${expectedAbbrev}" inside parentheses (spell out book names only in running text)`
                });
            }
        }

        // 3c. Check for abbreviated Biblical book names in running text (not inside parentheses) (Section 2.7, p. 31)
        const textWithoutParens = para.text.replace(/\([^)]*\)/g, '');
        const runningAbbrevMatch = textWithoutParens.match(abbrevBiblePattern);
        if (runningAbbrevMatch && runningAbbrevMatch.length === 1) {
            issues.push({
                category: 'Citations',
                severity: 'low',
                rule: 'Biblical Books in Running Text (Section 2.7)',
                message: `Spell out the name of the Biblical book in running text ("${runningAbbrevMatch[0]}"), or place the abbreviated reference in parentheses.`,
                expected: 'Spelled-out book name in running text, or abbreviated inside parentheses',
                found: runningAbbrevMatch[0],
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: 'Spell out the book name in the sentence or enclose the abbreviated citation in parentheses'
            });
        }

        // 3d. Check for BC/AD instead of BCE/CE and ANE instead of AWA (Appendix 3, Section 4.1, p. 39)
        const bcAdMatch = para.text.match(/\b(?:\d+\s*(?:BC|B\.C\.)|(?:AD|A\.D\.)\s*\d+|\d+\s*(?:AD|A\.D\.))\b/);
        if (bcAdMatch) {
            issues.push({
                category: 'Citations',
                severity: 'low',
                rule: 'Eras and Areas (Appendix 3, Section 4.1)',
                message: `SAIACS prefers "BCE" and "CE" rather than "BC" and "AD" (found "${bcAdMatch[0]}").`,
                expected: 'BCE / CE',
                found: bcAdMatch[0],
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: 'Replace BC/AD with BCE/CE'
            });
        }

        if (/\bANE\b|Ancient\s+Near\s+East/i.test(para.text)) {
            issues.push({
                category: 'Citations',
                severity: 'low',
                rule: 'Eras and Areas (Appendix 3, Section 4.1)',
                message: 'SAIACS prefers "AWA" (Ancient West Asia) rather than the Eurocentric "ANE" (Ancient Near East).',
                expected: 'AWA (Ancient West Asia)',
                found: para.text.match(/\bANE\b|Ancient\s+Near\s+East/i)[0],
                location: {
                    paragraph: idx,
                    text: snippet
                },
                fix: 'Use "Ancient West Asia (AWA)" instead of "Ancient Near East (ANE)"'
            });
        }
    });

    // 4. Validate Bibliography Entries (Sections 1.4, 2.iv, 2.vii, 3)
    const bibParagraphs = paragraphs.filter(p => p.section === 'bibliography' && !p.isEmpty);

    if (bibParagraphs.length > 0) {
        const currentCategoryEntries = [];

        bibParagraphs.forEach(para => {
            const raw = para.text.trim();
            const snippet = raw.substring(0, 100) + (raw.length > 100 ? '...' : '');

            // Check if this is a sub-category heading (Books, Articles, Unpublished Works, Electronic/Online Sources)
            if (/^(books|articles|unpublished\s+works|electronic\/online\s+sources|online\s+sources|primary\s+sources|secondary\s+sources)$/i.test(raw)) {
                currentCategoryEntries.length = 0; // Reset alphabetical check per category
                return;
            }

            // 4a. Check for 3-em dash (———.) at start of bibliography entry (Section 2.vii, Footnote 4)
            if (/^(?:—{2,}|-{3,}|_{3,})/.test(raw)) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'Repeated Author in Bibliography (Section 2.vii)',
                    message: `Bibliography entry in Paragraph ${para.index} uses a 3-em dash instead of repeating the author's name.`,
                    expected: 'Repeat the full author name (Surname, Firstname.)',
                    found: raw.match(/^(?:—{2,}|-{3,}|_{3,})\.?/)[0],
                    location: {
                        paragraph: para.index,
                        section: 'Bibliography',
                        text: snippet
                    },
                    fix: 'Replace the 3-em dash (———.) with the author’s full inverted name'
                });
            }

            // 4b. Check for prohibited Latin terms in Bibliography
            prohibitedTerms.forEach(({ regex, label, replacement }) => {
                if (regex.test(raw)) {
                    issues.push({
                        category: 'Citations',
                        severity: 'high',
                        rule: 'Prohibited Latin Abbreviations (Section 2.iii)',
                        message: `Bibliography entry in Paragraph ${para.index} uses "${label}".`,
                        expected: replacement,
                        found: label,
                        location: {
                            paragraph: para.index,
                            section: 'Bibliography',
                            text: snippet
                        },
                        fix: `Replace "${label}" with ${replacement}`
                    });
                }
            });

            // 4c. Check book entries in Bibliography for missing Place of Publication (City: Publisher, Year) (Section 3.1)
            const isJournalOrWebOrVideo =
                /https?:\/\/|doi\.org/i.test(raw) ||
                /\b\d+\s*,\s*no\.\s*\d+/i.test(raw) ||
                /youtube\s+video|podcast|thesis|diss\.|lecture|presentation/i.test(raw);

            if (!isJournalOrWebOrVideo && /\b(?:1[89]\d{2}|20\d{2})\./.test(raw)) {
                // Check if there is a "City: Publisher, YYYY." colon before the year
                const beforeYear = raw.split(/\b(?:1[89]\d{2}|20\d{2})\./)[0] || '';
                const lastSentenceSegment = beforeYear.split('.').filter(s => s.trim().length > 2).pop() || '';
                if (!lastSentenceSegment.includes(':')) {
                    issues.push({
                        category: 'Citations',
                        severity: 'high',
                        rule: 'Missing Place of Publication in Bibliography (Section 3.1)',
                        message: `Bibliography book entry in Paragraph ${para.index} is missing the city of publication before the publisher ("${lastSentenceSegment.trim()}").`,
                        expected: 'City: Publisher, Year. (e.g., Grand Rapids, MI: Zondervan, 2005.)',
                        found: `${lastSentenceSegment.trim()}.`,
                        location: {
                            paragraph: para.index,
                            section: 'Bibliography',
                            text: snippet
                        },
                        fix: 'Add the city of publication and a colon before the publisher name (use SAIACS/Chicago 17th ed. format)'
                    });
                }
            }

            // 4d. Check that book/journal entry has italicized title (Sections 3 & 5)
            const hasQuotes = /[“"']/.test(raw);
            if (!para.formatting.hasItalicRun && !/youtube|webpage|website|lecture|presentation|thesis|diss\./i.test(raw)) {
                issues.push({
                    category: 'Citations',
                    severity: 'medium',
                    rule: 'Italicized Titles in Bibliography (Section 3.1)',
                    message: `Bibliography entry in Paragraph ${para.index} does not contain an italicized book or journal title.`,
                    expected: 'Book and journal titles must be italicized',
                    found: hasQuotes ? 'Title in quotation marks without italicized container/book title' : 'Plain (non-italicized) text',
                    location: {
                        paragraph: para.index,
                        section: 'Bibliography',
                        text: snippet
                    },
                    fix: 'Italicize the book or journal title'
                });
            }

            // 4e. Track entries for alphabetical and chronological sorting check (Section 1.4, p. 24)
            const authorPrefix = raw.split('.')[0]?.trim() || '';
            const surname = raw.split(/[,\s.]/)[0]?.replace(/^["“‘']+/, '').toLowerCase() || '';
            const yearMatch = raw.match(/\b(1[89]\d{2}|20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

            if (surname) {
                currentCategoryEntries.push({
                    text: raw,
                    snippet,
                    index: para.index,
                    authorPrefix: authorPrefix.toLowerCase(),
                    surname,
                    year
                });
            }
        });

        // Check alphabetical order and same-author chronological order
        for (let i = 1; i < currentCategoryEntries.length; i++) {
            const prev = currentCategoryEntries[i - 1];
            const curr = currentCategoryEntries[i];

            if (prev.surname > curr.surname) {
                issues.push({
                    category: 'Citations',
                    severity: 'high',
                    rule: 'Bibliography Alphabetical Order (Section 1.4)',
                    message: `Bibliography entries are out of alphabetical order: "${curr.surname}" should appear before "${prev.surname}".`,
                    expected: `"${curr.surname}" before "${prev.surname}"`,
                    found: `"${prev.surname}" before "${curr.surname}"`,
                    location: {
                        paragraph: curr.index,
                        section: 'Bibliography',
                        text: curr.snippet
                    },
                    fix: 'Sort bibliography entries alphabetically by author surname'
                });
            } else if (
                prev.authorPrefix === curr.authorPrefix &&
                prev.year &&
                curr.year &&
                prev.year > curr.year
            ) {
                issues.push({
                    category: 'Citations',
                    severity: 'medium',
                    rule: 'Same-Author Chronological Order (Section 1.4)',
                    message: `Multiple works by the same author ("${curr.authorPrefix}") must be arranged in ascending chronological order by publication year (${curr.year} should come before ${prev.year}).`,
                    expected: `${curr.year} entry before ${prev.year} entry`,
                    found: `${prev.year} entry before ${curr.year} entry`,
                    location: {
                        paragraph: curr.index,
                        section: 'Bibliography',
                        text: curr.snippet
                    },
                    fix: 'Arrange multiple works by the same author from earliest publication year to latest'
                });
            }
        }
    }

    return issues;
}

module.exports = { validateCitations };
