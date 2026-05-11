function normalizeOptionalText(value, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function baseInput({ taskDescription, additionalContext, clarificationAnswers }) {
  return `
Task description:
${taskDescription.trim()}

Additional context:
${normalizeOptionalText(additionalContext)}

Clarification answers:
${normalizeOptionalText(clarificationAnswers)}
`.trim();
}

function bugInput({ issueDescription, clarificationAnswers }) {
  return `
Issue description:
${issueDescription.trim()}

Clarification answers:
${normalizeOptionalText(clarificationAnswers)}
`.trim();
}

export function analyzeStoryPrompt({ taskDescription, additionalContext }) {
  return `
You are a Senior QA Engineer analyzing a user story or feature description from a risk-based testing perspective.

Return a structured QA story analysis with these sections:
- Summary of the feature
- Main business goal
- Key user flows
- Assumptions
- Missing or unclear requirements
- QA focus areas

Rules:
- Do not generate generic QA content.
- Keep the analysis specific to the provided story.
- Highlight ambiguity that can affect QA scope, data setup, permissions, or regression risk.
- Use clear Markdown headings and concise bullets.

${baseInput({ taskDescription, additionalContext })}
`.trim();
}

export function generateQuestionsPrompt({ taskDescription, additionalContext }) {
  return `
You are a Senior QA Engineer with 8+ years of experience in web and mobile applications.

Generate only meaningful clarification questions that are critical for proper QA work.

Group questions by:
- Business Logic
- User Roles & Permissions
- Data Validation
- Edge Cases
- Integrations
- UI/UX
- Regression Impact

Rules:
- Ask only questions that impact test design, test data, risk, or release confidence.
- Do not ask obvious, generic, or already answered questions.
- Keep questions short and precise.
- Use Markdown headings and bullets.
- No explanations.

${baseInput({ taskDescription, additionalContext })}
`.trim();
}

export function generateChecklistPrompt({ taskDescription, additionalContext, clarificationAnswers }) {
  return `
You are a Senior QA Engineer creating a practical, risk-based QA checklist for a product team.

Generate a structured QA checklist with these sections:
- Functional
- Business Logic
- Roles & Permissions
- Data Validation
- Negative Scenarios
- Edge Cases
- UI/UX
- Regression Impact

Each checklist item must include:
- Check
- Expected Result
- Priority: High, Medium, or Low

Format each checklist item exactly as:
- Check: ...
  Expected Result: ...
  Priority: High|Medium|Low

Rules:
- Do not generate generic QA content.
- Make every check specific, executable, and relevant to the provided story.
- Prioritize risky business rules, permissions, validation, data integrity, and regression areas.
- Do not invent unrelated product behavior.
- Use Markdown headings and bullets.

${baseInput({ taskDescription, additionalContext, clarificationAnswers })}
`.trim();
}

export function generateTestCasesPrompt({ taskDescription, additionalContext, clarificationAnswers }) {
  return `
You are a Senior QA Engineer writing detailed executable manual test cases.

Generate practical test cases from the story, context, and clarification answers.

Each test case must include:
- Test Case ID
- Title
- Priority: High, Medium, or Low
- Preconditions
- Test Data
- Steps
- Expected Result
- Type: Positive, Negative, Edge Case, or Regression

Format each test case exactly as:
## TC-001: Title
- Priority: High|Medium|Low
- Preconditions: ...
- Test Data: ...
- Steps:
  1. ...
  2. ...
- Expected Result: ...
- Type: Positive|Negative|Edge Case|Regression

Rules:
- Do not generate generic QA content.
- Cover the highest-risk and most important user flows first.
- Include positive, negative, edge case, validation, permissions, and regression scenarios when relevant.
- Keep steps clear enough for a QA engineer to execute manually.
- Do not invent unrelated product behavior.
- Use Markdown headings and numbered steps.

${baseInput({ taskDescription, additionalContext, clarificationAnswers })}
`.trim();
}

export function analyzeRisksPrompt({ taskDescription, additionalContext, clarificationAnswers }) {
  return `
You are a Senior QA Engineer analyzing QA risks for a user story or feature.

Generate a QA risk analysis. Each risk must include:
- Risk
- Why it matters
- Suggested testing approach
- Priority: High, Medium, or Low

Rules:
- Do not generate generic QA content.
- Focus on product quality, business logic, permissions, validation, data integrity, integrations, edge cases, and regression risk.
- Make the testing approach specific and actionable.
- Use Markdown headings and bullets.

${baseInput({ taskDescription, additionalContext, clarificationAnswers })}
`.trim();
}

export function generateBugQuestionsPrompt({ issueDescription, clarificationAnswers }) {
  return `
You are a Senior QA Engineer preparing a bug ticket from raw issue notes.

Generate only clarification questions that would materially improve the bug report.

Group questions by:
- Environment
- Reproduction Steps
- Actual vs Expected Result
- Scope and Impact
- Evidence

Rules:
- Ask only questions that are missing, ambiguous, or important for developers to reproduce and fix the issue.
- Do not ask generic questions when the provided issue already answers them.
- Keep questions short and precise.
- If no important questions are needed, return exactly: No critical clarification questions are needed.
- Use Markdown headings and bullets.

${bugInput({ issueDescription, clarificationAnswers })}
`.trim();
}

export function generateBugReportPrompt({ issueDescription, clarificationAnswers }) {
  return `
You are a Senior QA Engineer writing a clear, developer-ready bug report.

Create a bug report from the issue description and any clarification answers.

The report must use this structure:
# Bug Report

**Title:** [Area][Feature/Platform] concise symptom

**Environment:**
- [environment detail or Not provided]

**Steps to Reproduce:**
1. [first executable step]

**Actual Result:**
[observed behavior as plain text, not a bullet list]

**Expected Result:**
[expected behavior as plain text, not a bullet list]

Rules:
- Keep the report specific to the provided issue.
- Preserve important product names, payment methods, platforms, and observed behavior.
- Infer reasonable bug-report wording from the description, but do not invent missing facts.
- Use "Not provided" for unknown environment, data, account, browser, device, version, or evidence.
- Make steps concise, numbered, and directly executable.
- Use bold section labels exactly as shown.
- Do not include Severity, Priority, Affected Area, Reproducibility, or Clarification Questions sections.
- Do not use bullet points or numbered lists in Actual Result or Expected Result.
- Do not end any sentence or list item with a period.

${bugInput({ issueDescription, clarificationAnswers })}
`.trim();
}
