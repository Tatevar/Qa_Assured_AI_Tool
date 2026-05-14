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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function attachmentInput(attachments = []) {
  const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

  if (!normalizedAttachments.length) {
    return 'None';
  }

  return normalizedAttachments.map((attachment, index) => {
    const name = attachment.name || `Attachment ${index + 1}`;
    const type = attachment.type || 'Unknown type';
    const size = formatBytes(Number(attachment.size));
    const evidenceText = typeof attachment.text === 'string' && attachment.text.trim()
      ? `\n  Extracted text:\n${attachment.text.trim()}`
      : '';
    const imageNote = attachment.kind === 'image'
      ? '\n  Visual evidence is attached to the request'
      : '';

    return `- ${name} (${type}, ${size})${imageNote}${evidenceText}`;
  }).join('\n');
}

function bugInput({ issueDescription, clarificationAnswers, attachments }) {
  return `
Issue description:
${issueDescription.trim()}

Clarification answers:
${normalizeOptionalText(clarificationAnswers)}

Uploaded evidence:
${attachmentInput(attachments)}
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

export function generateBugReportPrompt({ issueDescription, clarificationAnswers, attachments }) {
  return `
You are a Senior QA Engineer writing a clear, developer-ready bug report.

Create a bug report from the issue description, clarification answers, and uploaded evidence.

The report must use this structure:
# Bug Report

**Title:** [Area][Feature/Platform] concise symptom

**Environment:**
- [environment detail or Not provided]

**Steps to Reproduce:**
1. Go to [website/application]
2. Open [specific page or feature]
3. Perform [specific action that triggers the issue]

**Actual Result:**
[observed behavior as plain text, not a bullet list]

**Expected Result:**
[expected behavior as plain text, not a bullet list]

**Evidence:**
[uploaded filename and relevant visual or text evidence, omit this section when no evidence is uploaded]

Rules:
- Keep the report specific to the provided issue.
- Preserve important product names, payment methods, platforms, and observed behavior.
- Infer reasonable bug-report wording from the description, but do not invent missing facts.
- Use "Not provided" for unknown environment, data, account, browser, device, version, or evidence.
- Make steps concise, numbered, and directly executable.
- Start reproduction steps from the user entry point, such as going to the website or opening the application.
- Separate navigation from the triggering action: first open the specific page, then perform the action that causes the issue.
- Do not use a single generic step like "Open the Parking Tickets section in the application" when the issue needs website entry, page navigation, and a user action.
- If the exact URL is not provided, write "Go to the website" or "Open the application" instead of inventing a URL.
- Use bold section labels exactly as shown.
- Do not include Severity, Priority, Affected Area, Reproducibility, or Clarification Questions sections.
- Do not use bullet points or numbered lists in Actual Result or Expected Result.
- Do not end any sentence or list item with a period.
- Use uploaded image evidence to describe visible errors, states, data, or UI mismatches.
- Use uploaded text evidence only when it directly supports the issue.
- Omit the Evidence section when no file is uploaded.

${bugInput({ issueDescription, clarificationAnswers, attachments })}
`.trim();
}
