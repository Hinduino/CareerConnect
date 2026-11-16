const DOCUMENT_MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function hasSupportedDocumentSignature(file) {
  const extension = file.originalname.toLowerCase().split('.').pop();
  if (DOCUMENT_MIME_TYPES[extension] !== file.mimetype || !Buffer.isBuffer(file.buffer)) {
    return false;
  }
  if (extension === 'pdf') {
    return file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  }
  if (extension === 'doc') {
    return file.buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === 'docx') {
    return file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  return false;
}

module.exports = { hasSupportedDocumentSignature };
