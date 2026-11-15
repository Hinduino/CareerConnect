const { execFileSync } = require('node:child_process');
const path = require('node:path');

function createTextPdf() {
    const stream = 'BT /F1 18 Tf 72 720 Td (CareerConnect PDF extraction test) Tj ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
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

function createObjectStreamPdf() {
    const stream = 'BT /F1 18 Tf 72 720 Td (PDF object stream extraction test) Tj ET';
    const packedObjects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let objectStreamHeader = '';
    let objectStreamBody = '';
    packedObjects.forEach((object, index) => {
        objectStreamHeader += `${index + 1} ${Buffer.byteLength(objectStreamBody)} `;
        objectStreamBody += `${object}\n`;
    });
    const objectStreamContent = `${objectStreamHeader}${objectStreamBody}`;
    const parts = [Buffer.from('%PDF-1.5\n')];
    let length = parts[0].length;
    const offsets = {};
    const appendObject = (number, body) => {
        offsets[number] = length;
        const buffer = Buffer.from(`${number} 0 obj\n${body}\nendobj\n`);
        parts.push(buffer);
        length += buffer.length;
    };

    appendObject(5, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    appendObject(
        7,
        `<< /Type /ObjStm /N 4 /First ${Buffer.byteLength(objectStreamHeader)} /Length ${Buffer.byteLength(objectStreamContent)} >>\nstream\n${objectStreamContent}endstream`
    );

    const xrefOffset = length;
    const entries = Array.from({ length: 9 }, () => ({ type: 0, field1: 0, field2: 0 }));
    entries[0] = { type: 0, field1: 0, field2: 65535 };
    for (let index = 0; index < packedObjects.length; index += 1) {
        entries[index + 1] = { type: 2, field1: 7, field2: index };
    }
    entries[5] = { type: 1, field1: offsets[5], field2: 0 };
    entries[7] = { type: 1, field1: offsets[7], field2: 0 };
    entries[8] = { type: 1, field1: xrefOffset, field2: 0 };
    const xrefData = Buffer.alloc(entries.length * 7);
    entries.forEach((entry, index) => {
        const entryOffset = index * 7;
        xrefData.writeUInt8(entry.type, entryOffset);
        xrefData.writeUInt32BE(entry.field1, entryOffset + 1);
        xrefData.writeUInt16BE(entry.field2, entryOffset + 5);
    });

    parts.push(Buffer.from(`8 0 obj\n<< /Type /XRef /Size 9 /Root 1 0 R /W [1 4 2] /Length ${xrefData.length} >>\nstream\n`));
    parts.push(xrefData);
    parts.push(Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefOffset}\n%%EOF`));
    return Buffer.concat(parts);
}

function extractPdfInNodeProcess(pdfBuffer) {
    const script = [
        "const extractDocumentText = require('./src/utils/documentText');",
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', async () => {",
        "    const result = await extractDocumentText({ originalname: 'resume.pdf', buffer: Buffer.from(input, 'base64') });",
        "    process.stdout.write(JSON.stringify(result));",
        '});'
    ].join('\n');
    const output = execFileSync(process.execPath, ['-e', script], {
        cwd: path.resolve(__dirname, '..'),
        input: pdfBuffer.toString('base64'),
        encoding: 'utf8'
    });
    return JSON.parse(output);
}

describe('PDF text extraction integration', () => {
    it('extracts readable text from a valid PDF using the production parser', async () => {
        const result = extractPdfInNodeProcess(createTextPdf());
        expect(result).toEqual({
            text: expect.stringContaining('CareerConnect PDF extraction test'),
            truncated: false
        });
    });

    it('extracts readable text from a valid PDF with compressed object references', async () => {
        expect(extractPdfInNodeProcess(createObjectStreamPdf())).toMatchObject({
            text: expect.stringContaining('PDF object stream extraction test'),
            truncated: false
        });
    });
});
