import { Router } from 'express';
import { generateQaArtifact } from '../aiClient.js';
import {
  analyzeRisksPrompt,
  analyzeStoryPrompt,
  generateChecklistPrompt,
  generateQuestionsPrompt,
  generateTestCasesPrompt,
} from '../prompts.js';

const router = Router();

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

export default router;
