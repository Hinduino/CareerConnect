jest.mock('mammoth', () => ({
    extractRawText: jest.fn()
}));
jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn()
}));
jest.mock('word-extractor', () => jest.fn());

const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');
const extractDocumentText = require('./documentText');
const WordExtractor = require('word-extractor');

describe('extractDocumentText', () => {
    beforeEach(() => {
        PDFParse.mockReset();
        mammoth.extractRawText.mockReset();
        WordExtractor.mockReset();
    });

    it('limits extracted document text to 12,000 characters', async () => {
        mammoth.extractRawText.mockResolvedValue({ value: 'a'.repeat(15000) });

        const result = await extractDocumentText({
            originalname: 'long-resume.docx',
            buffer: Buffer.from('document')
        });

        expect(result.text).toHaveLength(12000);
        expect(result.truncated).toBe(true);
    });

    it('trims DOCX text and reports when it fits within the limit', async () => {
        mammoth.extractRawText.mockResolvedValue({ value: '  DOCX resume content  ' });

        await expect(extractDocumentText({
            originalname: 'resume.DOCX',
            buffer: Buffer.from('document')
        })).resolves.toEqual({ text: 'DOCX resume content', truncated: false });
        expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: Buffer.from('document') });
    });

    it('extracts and trims legacy DOC documents', async () => {
        const document = { getBody: jest.fn().mockReturnValue('  DOC resume content  ') };
        const extractor = { extract: jest.fn().mockResolvedValue(document) };
        WordExtractor.mockImplementation(() => extractor);
        const buffer = Buffer.from('legacy document');

        await expect(extractDocumentText({
            originalname: 'resume.doc',
            buffer
        })).resolves.toEqual({ text: 'DOC resume content', truncated: false });
        expect(extractor.extract).toHaveBeenCalledWith(buffer);
        expect(document.getBody).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['an empty DOCX', 'resume.docx', { value: ' \n\t ' }],
        ['a non-string DOCX response', 'resume.docx', { value: null }]
    ])('rejects %s without readable text', async (_label, originalname, parsed) => {
        mammoth.extractRawText.mockResolvedValue(parsed);

        await expect(extractDocumentText({
            originalname,
            buffer: Buffer.from('document')
        })).rejects.toThrow('No readable text was found in the document');
    });

    it('rejects unsupported document extensions', async () => {
        await expect(extractDocumentText({
            originalname: 'resume.txt',
            buffer: Buffer.from('text')
        })).rejects.toThrow('Only PDF, DOC, and DOCX documents can be shared');
    });

    it('releases the PDF parser after extracting text', async () => {
        const parser = {
            getText: jest.fn().mockResolvedValue({ text: 'PDF resume content' }),
            destroy: jest.fn()
        };
        PDFParse.mockImplementation(() => parser);
        const file = {
            originalname: 'resume.pdf',
            buffer: Buffer.from('%PDF-1.7')
        };

        const result = await extractDocumentText(file);

        expect(PDFParse).toHaveBeenCalledWith({ data: file.buffer });
        expect(result).toEqual({ text: 'PDF resume content', truncated: false });
        expect(parser.destroy).toHaveBeenCalledTimes(1);
    });

    it('releases the PDF parser when PDF text extraction fails', async () => {
        const parser = {
            getText: jest.fn().mockRejectedValue(new Error('Invalid PDF')),
            destroy: jest.fn()
        };
        PDFParse.mockImplementation(() => parser);

        await expect(extractDocumentText({
            originalname: 'resume.pdf',
            buffer: Buffer.from('%PDF-1.7')
        })).rejects.toThrow('Invalid PDF');
        expect(parser.destroy).toHaveBeenCalledTimes(1);
    });

    it('rejects PDF files without readable text and still releases the parser', async () => {
        const parser = {
            getText: jest.fn().mockResolvedValue({ text: '  ' }),
            destroy: jest.fn()
        };
        PDFParse.mockImplementation(() => parser);

        await expect(extractDocumentText({
            originalname: 'resume.pdf',
            buffer: Buffer.from('%PDF-1.7')
        })).rejects.toThrow('No readable text was found in the document');
        expect(parser.destroy).toHaveBeenCalledTimes(1);
    });
});
