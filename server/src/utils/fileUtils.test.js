const { sanitizeFilename } = require('./fileUtils');

describe('fileUtils', () => {
  describe('sanitizeFilename', () => {
    it('sanitizes normal filenames', () => {
      expect(sanitizeFilename('resume.pdf')).toBe('resume.pdf');
    });

    it('removes carriage returns, newlines, and quotes', () => {
      expect(sanitizeFilename('resume\r\n"test".pdf')).toBe('resumetest.pdf');
    });

    it('trims whitespace', () => {
      expect(sanitizeFilename('  resume.pdf  ')).toBe('resume.pdf');
    });

    it('returns default filename when name becomes empty after sanitizing', () => {
      expect(sanitizeFilename('\r\n""\n\r')).toBe('file');
    });

    it('returns default filename when only whitespace', () => {
      expect(sanitizeFilename('   ')).toBe('file');
    });
  });
});
