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

describe('extractDocumentText', () => {
    beforeEach(() => {
        PDFParse.mockReset();
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
});
