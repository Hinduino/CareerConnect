jest.mock('mammoth', () => ({
    extractRawText: jest.fn()
}));
jest.mock('pdf-parse', () => jest.fn());
jest.mock('word-extractor', () => jest.fn());

const mammoth = require('mammoth');
const extractDocumentText = require('./documentText');

describe('extractDocumentText', () => {
    it('limits extracted document text to 12,000 characters', async () => {
        mammoth.extractRawText.mockResolvedValue({ value: 'a'.repeat(15000) });

        const result = await extractDocumentText({
            originalname: 'long-resume.docx',
            buffer: Buffer.from('document')
        });

        expect(result.text).toHaveLength(12000);
        expect(result.truncated).toBe(true);
    });
});
