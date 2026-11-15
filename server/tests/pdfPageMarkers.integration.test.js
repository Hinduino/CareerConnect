// SCRUM-305: Integration tests for PDF text extraction after the upgrade to
// pdf-parse 2 (PR #61). Uses the real parser in a separate Node process, like
// documentText.integration.test.js.
//
// pdf-parse 2 adds a page marker such as "-- 1 of 1 --" to the text it
// extracts. Tests written with `it.failing` document the resulting known bugs:
// they pass while the bug exists and start failing once it is fixed, as a
// reminder to turn them into normal `it` tests.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Builds a minimal one-page PDF whose page draws the given content stream.
function createPdf(contentStream) {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf);
}

// A page with text, like a normal resume
const TEXT_PDF = createPdf('BT /F1 18 Tf 72 720 Td (Naz Test React developer) Tj ET');
// A page with only drawn shapes and no text, like a scanned resume
const NO_TEXT_PDF = createPdf('0.8 g 72 600 468 20 re f 72 560 400 20 re f');

// Runs the production extractor and reports either its result or its error
function extract(pdfBuffer) {
    const script = [
        "const extractDocumentText = require('./src/utils/documentText');",
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', async () => {",
        '    try {',
        "        const result = await extractDocumentText({ originalname: 'resume.pdf', buffer: Buffer.from(input, 'base64') });",
        '        process.stdout.write(JSON.stringify(result));',
        '    } catch (error) {',
        '        process.stdout.write(JSON.stringify({ error: error.message }));',
        '    }',
        '});'
    ].join('\n');
    const output = execFileSync(process.execPath, ['-e', script], {
        cwd: path.resolve(__dirname, '..'),
        input: pdfBuffer.toString('base64'),
        encoding: 'utf8'
    });
    return JSON.parse(output);
}

describe('PDF text extraction with pdf-parse 2', () => {
    it('reads the text of a normal PDF resume', () => {
        expect(extract(TEXT_PDF).text).toContain('Naz Test React developer');
    });

    // Known bug: an image-only (scanned) PDF used to be rejected with
    // "No readable text". With pdf-parse 2 its extracted text is just the
    // page marker "-- 1 of 1 --", so it passes the check and is sent to the
    // AI as if it were a resume.
    it.failing('KNOWN BUG: rejects a PDF that has no text (e.g. a scanned resume)', () => {
        expect(extract(NO_TEXT_PDF)).toEqual({ error: 'No readable text was found in the document' });
    });

    // Known bug: the page marker added by pdf-parse 2 is included in the
    // resume text sent to the AI.
    it.failing('KNOWN BUG: does not add page markers to the resume text', () => {
        expect(extract(TEXT_PDF).text).not.toMatch(/-- \d+ of \d+ --/);
    });
});