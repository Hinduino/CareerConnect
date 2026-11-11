function sanitizeFilename(name) {
  return name.replace(/[\r\n"]/g, "").trim() || "file";
}

function toResumeFields(file) {
  return {
    originalName: sanitizeFilename(file.originalname),
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };
}

function toResumeMetadata(resume) {
  return {
    id: resume._id,
    originalName: resume.originalName,
    contentType: resume.contentType,
    size: resume.size,
    createdAt: resume.createdAt,
  };
}

function toPictureFields(file) {
  return {
    originalName: sanitizeFilename(file.originalname),
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };
}

function toPictureMetadata(picture, userId) {
  return {
    user: userId,
    originalName: picture.originalName,
    contentType: picture.contentType,
    size: picture.size,
  };
}

module.exports = {
  sanitizeFilename,
  toResumeFields,
  toResumeMetadata,
  toPictureFields,
  toPictureMetadata,
};
