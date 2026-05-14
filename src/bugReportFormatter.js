const REMOVED_SECTION_LABELS = new Set([
  'Severity',
  'Priority',
  'Affected Area',
  'Reproducibility',
  'Clarification Questions',
]);

const RESULT_SECTION_LABELS = new Set(['Actual Result', 'Expected Result']);

function normalizeLabel(label) {
  return label.replace(/\*+/g, '').replace(/:+$/, '').trim().replace(/\s+/g, ' ');
}

function getSectionLabel(line) {
  const trimmed = line.trim();
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
  const source = headingMatch ? headingMatch[1] : trimmed;
  const boldMatch = source.match(/^\*\*([^*]+)\*\*:?\s*/);

  if (boldMatch) {
    return normalizeLabel(boldMatch[1]);
  }

  const plainMatch = source.match(/^([A-Za-z][A-Za-z\s/]+):/);

  if (plainMatch) {
    return normalizeLabel(plainMatch[1]);
  }

  return headingMatch ? normalizeLabel(source) : '';
}

function removeResultListMarker(line) {
  return line
    .replace(/^(\s*(?:\*\*)?(?:Actual|Expected) Result:?\*\*?\s*)(?:[-*\u2022]|\d+[.)])\s+/i, '$1')
    .replace(/^(\s*)(?:[-*\u2022]|\d+[.)])\s+/, '$1');
}

function removeTrailingSentencePeriod(line) {
  return line.replace(/(?<!\d)\.(\s*)$/u, '$1');
}

function collapseBlankLines(lines) {
  const collapsed = [];
  let previousWasBlank = false;

  for (const line of lines) {
    const isBlank = line.trim() === '';

    if (isBlank && previousWasBlank) {
      continue;
    }

    collapsed.push(line);
    previousWasBlank = isBlank;
  }

  return collapsed.join('\n').trim();
}

export function formatBugReport(report, options = {}) {
  if (typeof report !== 'string') {
    return '';
  }

  const removedSectionLabels = new Set(REMOVED_SECTION_LABELS);

  if (options.includeEvidence === false) {
    removedSectionLabels.add('Evidence');
  }

  const formattedLines = [];
  let skipRemovedSection = false;
  let activeSection = '';

  for (const originalLine of report.split(/\r?\n/)) {
    let line = originalLine;
    const sectionLabel = getSectionLabel(line);

    if (skipRemovedSection) {
      if (!sectionLabel) {
        continue;
      }

      skipRemovedSection = false;
    }

    if (removedSectionLabels.has(sectionLabel)) {
      skipRemovedSection = true;
      activeSection = '';
      continue;
    }

    if (sectionLabel) {
      activeSection = sectionLabel;
    }

    if (RESULT_SECTION_LABELS.has(activeSection)) {
      line = removeResultListMarker(line);
    }

    formattedLines.push(removeTrailingSentencePeriod(line));
  }

  return collapseBlankLines(formattedLines);
}
