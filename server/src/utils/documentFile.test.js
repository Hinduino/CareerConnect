// SCRUM-305: Unit tests for resume file validation used by the SCRUM-110
// AI features (resume feedback, job recommendations, chat resume selection)
// and by resume uploads. A file is only accepted when its extension, its
// declared type, and its actual contents all agree.

const { hasSupportedDocumentSignature } = require("./documentFile");

const PDF_BYTES = Buffer.from("%PDF-1.7\n% resume content");
const DOC_BYTES = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x01]);
const DOCX_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

const PDF_TYPE = "application/pdf";
const DOC_TYPE = "application/msword";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function file(originalname, mimetype, buffer) {
  return { originalname, mimetype, buffer };
}

describe("hasSupportedDocumentSignature", () => {
  describe("accepts real PDF, DOC and DOCX files", () => {
    it.each([
      ["PDF", file("resume.pdf", PDF_TYPE, PDF_BYTES)],
      ["DOC", file("resume.doc", DOC_TYPE, DOC_BYTES)],
      ["DOCX", file("resume.docx", DOCX_TYPE, DOCX_BYTES)],
    ])("%s", (_label, input) => {
      expect(hasSupportedDocumentSignature(input)).toBe(true);
    });

    it("ignores the case of the file extension", () => {
      expect(hasSupportedDocumentSignature(file("RESUME.PDF", PDF_TYPE, PDF_BYTES))).toBe(true);
    });

    it("uses only the last extension of names with several dots", () => {
      expect(hasSupportedDocumentSignature(file("my.resume.v2.docx", DOCX_TYPE, DOCX_BYTES))).toBe(true);
    });

    it("finds the PDF marker even after a few leading bytes", () => {
      const withPrefix = Buffer.concat([Buffer.from("\n\n  "), PDF_BYTES]);
      expect(hasSupportedDocumentSignature(file("resume.pdf", PDF_TYPE, withPrefix))).toBe(true);
    });
  });

  describe("rejects files whose contents do not match", () => {
    it.each([
      ["a text file renamed to .pdf", file("resume.pdf", PDF_TYPE, Buffer.from("just some text"))],
      ["a DOCX renamed to .pdf", file("resume.pdf", PDF_TYPE, DOCX_BYTES)],
      ["a PDF renamed to .docx", file("resume.docx", DOCX_TYPE, PDF_BYTES)],
      ["a PDF renamed to .doc", file("resume.doc", DOC_TYPE, PDF_BYTES)],
      ["an empty PDF", file("resume.pdf", PDF_TYPE, Buffer.alloc(0))],
      ["an empty DOCX", file("resume.docx", DOCX_TYPE, Buffer.alloc(0))],
    ])("%s", (_label, input) => {
      expect(hasSupportedDocumentSignature(input)).toBe(false);
    });

    it("only looks for the PDF marker in the first 1024 bytes", () => {
      const markerTooLate = Buffer.concat([Buffer.alloc(1024, 0x20), PDF_BYTES]);
      expect(hasSupportedDocumentSignature(file("resume.pdf", PDF_TYPE, markerTooLate))).toBe(false);
    });
  });

  describe("rejects files whose extension and declared type disagree", () => {
    it.each([
      ["PDF bytes declared as DOCX", file("resume.pdf", DOCX_TYPE, PDF_BYTES)],
      ["DOCX bytes declared as PDF", file("resume.docx", PDF_TYPE, DOCX_BYTES)],
      ["DOC declared as DOCX", file("resume.doc", DOCX_TYPE, DOC_BYTES)],
    ])("%s", (_label, input) => {
      expect(hasSupportedDocumentSignature(input)).toBe(false);
    });
  });

  describe("rejects unsupported formats", () => {
    it.each([
      ["a .txt file", file("resume.txt", "text/plain", Buffer.from("resume"))],
      ["an image", file("resume.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]))],
      ["a file with no extension", file("resume", PDF_TYPE, PDF_BYTES)],
      ["an .rtf file", file("resume.rtf", "application/rtf", Buffer.from("{\\rtf1"))],
    ])("%s", (_label, input) => {
      expect(hasSupportedDocumentSignature(input)).toBe(false);
    });
  });

  it("rejects a file with no contents loaded", () => {
    expect(hasSupportedDocumentSignature(file("resume.pdf", PDF_TYPE, undefined))).toBe(false);
    expect(hasSupportedDocumentSignature(file("resume.pdf", PDF_TYPE, "%PDF-1.7"))).toBe(false);
  });

  it("rejects an unknown extension even when its MIME type is also absent", () => {
    expect(hasSupportedDocumentSignature(file("resume.unknown", undefined, Buffer.from("data")))).toBe(false);
  });
});