const express = require('express');
const requireAuth = require('../middleware/auth');
const multer = require('multer');
const extractDocumentText = require('../utils/documentText');
const Resume = require('../models/Resume');
const mongoose = require('mongoose');
const { hasSupportedDocumentSignature } = require('../utils/documentFile');
const { generateAssistantReply, loadCareerConnectContext } = require('../services/chatService');

const router = express.Router();
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const DOCUMENT_MIME_TYPES = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_SIZE },
    fileFilter: (req, file, callback) => {
        const extension = file.originalname.toLowerCase().split('.').pop();
        if (!DOCUMENT_MIME_TYPES[extension] || DOCUMENT_MIME_TYPES[extension] !== file.mimetype) {
            return callback(new Error('Only PDF, DOC, and DOCX documents can be shared'));
        }
        return callback(null, true);
    }
});

function withOptionalAuth(req, res, next) {
    if (!req.headers.authorization) {
        return next();
    }
    return requireAuth(req, res, next);
}

router.post('/', withOptionalAuth, upload.single('document'), async (req, res) => {
    const profileResumeId = req.body?.profileResumeId;
    const hasProfileResume = profileResumeId !== undefined
        && profileResumeId !== null
        && profileResumeId !== '';
    if (hasProfileResume && typeof profileResumeId !== 'string') {
        return res.status(400).json({ error: 'Invalid profile resume ID.' });
    }

    const messages = req.body?.messages;
    let conversation;
    try {
        conversation = typeof messages === 'string' ? JSON.parse(messages) : messages;
    } catch {
        return res.status(400).json({ error: 'Chat messages must be valid JSON' });
    }

    if (
        !Array.isArray(conversation)
        || conversation.length === 0
        || conversation.length > MAX_MESSAGES
        || conversation[conversation.length - 1]?.role !== 'user'
    ) {
        return res.status(400).json({ error: 'Send up to 20 chat messages ending with a user message' });
    }

    const invalidMessage = conversation.some((message) => (
        !message
        || !['user', 'assistant'].includes(message.role)
        || typeof message.content !== 'string'
        || !message.content.trim()
        || message.content.length > MAX_MESSAGE_LENGTH
    ));
    if (invalidMessage) {
        return res.status(400).json({
            error: `Each message must have a role and contain 1-${MAX_MESSAGE_LENGTH} characters`
        });
    }

    let documentContext = null;
    if (req.file) {
        if (hasProfileResume) {
            return res.status(400).json({ error: 'Choose either an attached document or a profile resume, not both.' });
        }
        if (!hasSupportedDocumentSignature(req.file)) {
            return res.status(400).json({
                error: 'The file contents do not match a supported PDF, DOC, or DOCX document.'
            });
        }
        try {
            documentContext = await extractDocumentText(req.file);
        } catch (error) {
            if (error.message === 'No readable text was found in the document') {
                return res.status(400).json({ error: error.message });
            }
            console.error('Failed to extract uploaded chat document.');
            return res.status(400).json({
                error: 'Could not read this document. Check that it is a valid PDF, DOC, or DOCX file.'
            });
        }
    } else if (hasProfileResume) {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Sign in to use a resume from your profile.' });
        }
        if (!mongoose.isValidObjectId(profileResumeId)) {
            return res.status(400).json({ error: 'Invalid profile resume ID.' });
        }
        try {
            const resume = await Resume.findOne({
                _id: profileResumeId,
                user: req.user.id
            }).select('originalName contentType +data');
            if (!resume || !resume.data) {
                return res.status(404).json({ error: 'Profile resume not found.' });
            }
            const profileFile = {
                originalname: resume.originalName,
                mimetype: resume.contentType,
                buffer: resume.data
            };
            if (!hasSupportedDocumentSignature(profileFile)) {
                return res.status(400).json({
                    error: 'The saved profile resume is not a valid PDF, DOC, or DOCX document.'
                });
            }
            try {
                documentContext = await extractDocumentText(profileFile);
            } catch (error) {
                if (error.message === 'No readable text was found in the document') {
                    return res.status(400).json({ error: 'No readable text was found in your profile resume.' });
                }
                console.error('Failed to extract profile resume text.');
                return res.status(400).json({
                    error: 'Could not analyze your profile resume. Check that it is a valid PDF, DOC, or DOCX file.'
                });
            }
        } catch {
            console.error('Failed to load profile resume for chat.');
            return res.status(500).json({ error: 'Could not load your profile resume. Please try again.' });
        }
    }

    let careerContext;
    try {
        careerContext = await loadCareerConnectContext(req.user?.id);
    } catch {
        console.error('Failed to load chat context from CareerConnect.');
        return res.status(500).json({
            error: 'Could not load CareerConnect data for the assistant. Please try again.'
        });
    }

    try {
        const reply = await generateAssistantReply({
            conversation,
            documentContext,
            careerContext
        });
        return res.status(200).json({ reply });
    } catch (serviceError) {
        return res.status(502).json({ error: serviceError.message });
    }
});

module.exports = router;
