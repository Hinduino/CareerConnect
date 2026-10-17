const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const WordExtractor = require('word-extractor');

async function extractDocumentText(file) {
    const extension = file.originalname.toLowerCase().split('.').pop();
    let text;

    if (extension === 'pdf') {
        const parsed = await pdfParse(file.buffer);
        text = parsed.text;
    } else if (extension === 'docx') {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        text = parsed.value;
    } else if (extension === 'doc') {
        const document = await new WordExtractor().extract(file.buffer);
        text = document.getBody();
    } else {
        throw new Error('Only PDF, DOC, and DOCX documents can be shared');
    }

    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('No readable text was found in the document');
    }

    const maxCharacters = 12000;
    return {
        text: text.trim().slice(0, maxCharacters),
        truncated: text.trim().length > maxCharacters
    };
}

module.exports = extractDocumentText;
