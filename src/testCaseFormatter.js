const STEP_LINE_PATTERN = /^(\s*\d+[.)]\s+)(.*)$/;
const EXPECTED_RESULT_LINE_PATTERN = /^(\s*\*\*Expected result:\*\*\s*)(.*)$/i;

function removeTrailingSentencePeriod(text) {
  return text.replace(/(?<!\d)\.(\s*)$/u, '$1');
}

export function formatTestCases(testCases) {
  if (typeof testCases !== 'string') {
    return '';
  }

  return testCases
    .split(/\r?\n/)
    .map((line) => {
      const stepMatch = line.match(STEP_LINE_PATTERN);

      if (stepMatch) {
        return `${stepMatch[1]}${removeTrailingSentencePeriod(stepMatch[2])}`;
      }

      const expectedMatch = line.match(EXPECTED_RESULT_LINE_PATTERN);

      if (expectedMatch) {
        return `${expectedMatch[1]}${removeTrailingSentencePeriod(expectedMatch[2])}`;
      }

      return line;
    })
    .join('\n');
}
