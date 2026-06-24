import { Router } from 'express';
import { generateQaArtifact } from '../aiClient.js';
import { formatBugReport } from '../bugReportFormatter.js';
import {
  analyzeRisksPrompt,
  analyzeStoryPrompt,
  generateBugReportPrompt,
  generateChecklistPrompt,
  generateQuestionsPrompt,
  generateTestCasesPrompt,
} from '../prompts.js';

const router = Router();
const MAX_BUG_ATTACHMENTS = 6;
const MAX_BUG_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_BUG_VISUAL_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_FRAME_ATTACHMENTS = 5;
const MAX_ATTACHMENT_TEXT_CHARS = 12000;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
const BUG_ATTACHMENT_KINDS = new Set(['image', 'text', 'video', 'file']);

function createValidationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.statusCode = 400;
  return error;
}

function getDataUrlByteLength(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/) || [''])[0].length;

  return Math.floor((base64.length * 3) / 4) - padding;
}

function normalizeBugAttachments(attachments) {
  if (!attachments) {
    return [];
  }

  if (!Array.isArray(attachments)) {
    throw createValidationError('Attachments must be an array.');
  }

  if (attachments.length > MAX_BUG_ATTACHMENTS) {
    throw createValidationError(`Upload ${MAX_BUG_ATTACHMENTS} bug evidence files or fewer.`);
  }

  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      throw createValidationError('Attachment is invalid.');
    }

    const name = typeof attachment.name === 'string' && attachment.name.trim()
      ? attachment.name.trim().slice(0, 160)
      : 'Attachment';
    const type = typeof attachment.type === 'string' ? attachment.type.trim().slice(0, 120) : '';
    const size = Number(attachment.size || 0);
    const kind = BUG_ATTACHMENT_KINDS.has(attachment.kind) ? attachment.kind : 'file';
    const normalizedAttachment = {
      name,
      type,
      size: Number.isFinite(size) && size > 0 ? size : 0,
      kind,
    };

    if (normalizedAttachment.size > MAX_BUG_ATTACHMENT_BYTES) {
      throw createValidationError('Attachment must be 50 MB or smaller.');
    }

    if (kind === 'image') {
      const dataUrl = typeof attachment.dataUrl === 'string' ? attachment.dataUrl : '';

      if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) {
        throw createValidationError('Image attachment must be PNG, JPG, WEBP, or GIF.');
      }

      if (getDataUrlByteLength(dataUrl) > MAX_BUG_VISUAL_BYTES) {
        throw createValidationError('Image attachment data must be 8 MB or smaller.');
      }

      normalizedAttachment.dataUrl = dataUrl;
    }

    if (kind === 'video') {
      const frames = Array.isArray(attachment.frames) ? attachment.frames.slice(0, MAX_VIDEO_FRAME_ATTACHMENTS) : [];

      normalizedAttachment.frames = frames.map((frame, index) => {
        const dataUrl = typeof frame?.dataUrl === 'string' ? frame.dataUrl : '';

        if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) {
          throw createValidationError('Recording frame must be a PNG, JPG, WEBP, or GIF image.');
        }

        if (getDataUrlByteLength(dataUrl) > MAX_BUG_VISUAL_BYTES) {
          throw createValidationError('Recording frame data must be 8 MB or smaller.');
        }

        return {
          name: typeof frame.name === 'string' && frame.name.trim()
            ? frame.name.trim().slice(0, 160)
            : `${name} frame ${index + 1}`,
          type: typeof frame.type === 'string' && frame.type.trim() ? frame.type.trim().slice(0, 120) : 'image/jpeg',
          size: getDataUrlByteLength(dataUrl),
          kind: 'image',
          timestamp: Number.isFinite(Number(frame.timestamp)) ? Number(frame.timestamp) : null,
          dataUrl,
        };
      });
    }

    if (kind === 'text' && typeof attachment.text === 'string') {
      normalizedAttachment.text = attachment.text.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
    }

    return normalizedAttachment;
  });
}

function getVisualAttachments(attachments) {
  return attachments.flatMap((attachment) => {
    if (attachment.kind === 'image' && attachment.dataUrl) {
      return [attachment];
    }

    if (attachment.kind === 'video' && Array.isArray(attachment.frames)) {
      return attachment.frames.filter((frame) => frame.kind === 'image' && frame.dataUrl);
    }

    return [];
  });
}

function validateTaskDescription(req, res, next) {
  const { taskDescription } = req.body || {};

  if (typeof taskDescription !== 'string' || !taskDescription.trim()) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'taskDescription is required and must be a non-empty string.',
    });
  }

  return next();
}

function validateIssueDescription(req, res, next) {
  const { issueDescription } = req.body || {};

  if (typeof issueDescription !== 'string' || !issueDescription.trim()) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'issueDescription is required and must be a non-empty string.',
    });
  }

  try {
    req.body.clarificationAnswers = typeof req.body.clarificationAnswers === 'string'
      ? req.body.clarificationAnswers
      : typeof req.body.bugClarificationAnswers === 'string' ? req.body.bugClarificationAnswers : '';
    req.body.attachments = normalizeBugAttachments(req.body.attachments);
  } catch (err) {
    return next(err);
  }

  return next();
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

router.post(
  '/analyze-story',
  validateTaskDescription,
  asyncHandler(async (req, res) => {
    const prompt = analyzeStoryPrompt(req.body);
    const analysis = await generateQaArtifact(prompt);

    res.json({
      analysis,
    });
  }),
);

router.post(
  '/generate-questions',
  validateTaskDescription,
  asyncHandler(async (req, res) => {
    const prompt = generateQuestionsPrompt(req.body);
    const questions = await generateQaArtifact(prompt);

    res.json({
      questions,
    });
  }),
);

router.post(
  '/generate-checklist',
  validateTaskDescription,
  asyncHandler(async (req, res) => {
    const prompt = generateChecklistPrompt(req.body);
    const checklist = await generateQaArtifact(prompt);

    res.json({
      checklist,
    });
  }),
);

router.post(
  '/analyze-risks',
  validateTaskDescription,
  asyncHandler(async (req, res) => {
    const prompt = analyzeRisksPrompt(req.body);
    const risks = await generateQaArtifact(prompt);

    res.json({
      risks,
    });
  }),
);

router.post(
  '/generate-test-cases',
  validateTaskDescription,
  asyncHandler(async (req, res) => {
    const prompt = generateTestCasesPrompt(req.body);
    const testCases = await generateQaArtifact(prompt);

    res.json({
      testCases,
    });
  }),
);

router.post(
  '/generate-bug-report',
  validateIssueDescription,
  asyncHandler(async (req, res) => {
    const prompt = generateBugReportPrompt(req.body);
    const bugReport = formatBugReport(
      await generateQaArtifact(prompt, {
        imageAttachments: getVisualAttachments(req.body.attachments),
      }),
      {
        includeEvidence: req.body.attachments.length > 0,
        attachments: req.body.attachments,
        additionalInfo: req.body.clarificationAnswers,
      },
    );

    res.json({
      bugReport,
    });
  }),
);

export default router;
