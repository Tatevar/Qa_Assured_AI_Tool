const REMOVED_SECTION_LABELS = new Set([
  'Affected Area',
  'Reproducibility',
  'Clarification Questions',
]);

const RESULT_SECTION_LABELS = new Set(['Actual Result', 'Expected Result']);
const SECTION_LABELS = [
  'Affected Surface',
  'Severity / Priority',
  'Preconditions / Test Data',
  'Steps to Reproduce',
  'Clarification Questions',
  'Additional Info',
  'Actual Result',
  'Expected Result',
  'Endpoint / Route',
  'Request Details',
  'Response Details',
  'Affected Area',
  'Reproducibility',
  'Environment',
  'Evidence',
  'Preconditions',
  'Test Data',
  'Priority',
  'Severity',
  'Title',
];
const PRESERVED_TITLE_TERMS = new Map([
  ['api', 'API'],
  ['sms', 'SMS'],
  ['id', 'ID'],
  ['url', 'URL'],
  ['anpr', 'ANPR'],
  ['paygo', 'PayGo'],
  ['mp4', 'MP4'],
  ['ui', 'UI'],
  ['ux', 'UX'],
  ['qa', 'QA'],
  ['qase', 'Qase'],
  ['ios', 'iOS'],
  ['android', 'Android'],
  ['csv', 'CSV'],
  ['pdf', 'PDF'],
]);

function normalizeLabel(label) {
  return label.replace(/\*+/g, '').replace(/:+$/, '').trim().replace(/\s+/g, ' ');
}

function sectionEquals(label, expectedLabel) {
  return label.toLowerCase() === expectedLabel.toLowerCase();
}

function sectionSetHas(sectionSet, label) {
  return [...sectionSet].some((sectionName) => sectionEquals(label, sectionName));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSectionLine(line) {
  const trimmed = line.trim();
  const headingMatch = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
  const source = headingMatch ? headingMatch[1] : trimmed;

  for (const sectionLabel of SECTION_LABELS) {
    const escapedLabel = escapeRegExp(sectionLabel);
    const patterns = [
      new RegExp(`^\\*\\*\\s*${escapedLabel}\\s*(?:\\*\\*)?\\s*:\\*{0,2}\\s*(.*)$`, 'i'),
      new RegExp(`^\\*\\*\\s*${escapedLabel}\\s*\\*\\*\\s*:?\\s*(.*)$`, 'i'),
      new RegExp(`^${escapedLabel}\\s*:\\s*(.*)$`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match) {
        return {
          label: sectionLabel,
          content: match[1].trim(),
        };
      }
    }

    if (headingMatch && sectionEquals(normalizeLabel(source), sectionLabel)) {
      return {
        label: sectionLabel,
        content: '',
      };
    }
  }

  return null;
}

function getSectionLabel(line) {
  const sectionLine = parseSectionLine(line);

  return sectionLine ? sectionLine.label : '';
}

function formatSectionLabel(label) {
  return `**${label}:**`;
}

function removeLeadingListMarker(line) {
  return line.replace(/^(\s*)(?:[-*\u2022]|\d+[.)])\s+/, '$1');
}

function removeResultListMarker(line) {
  return line
    .replace(/^(\s*(?:\*\*)?(?:Actual|Expected) Result:?\*\*?\s*)(?:[-*\u2022]|\d+[.)])\s+/i, '$1')
    .replace(/^(\s*)(?:[-*\u2022]|\d+[.)])\s+/, '$1');
}

function removeTrailingSentencePeriod(line) {
  return line.replace(/(?<!\d)\.(\s*)$/u, '$1');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isAllCapsTitle(value) {
  const letters = value.replace(/[^A-Za-z]/g, '');

  return Boolean(letters) && letters === letters.toUpperCase();
}

function normalizeTitleWord(word, forceLowercase) {
  const key = word.toLowerCase();

  if (PRESERVED_TITLE_TERMS.has(key)) {
    return PRESERVED_TITLE_TERMS.get(key);
  }

  if (!forceLowercase && (/^[A-Z0-9]{2,}$/.test(word) || /[a-z][A-Z]/.test(word))) {
    return word;
  }

  return word.toLowerCase();
}

function sentenceCaseTitle(title) {
  const normalizedTitle = String(title || '').trim().replace(/\s+/g, ' ');

  if (!normalizedTitle) {
    return normalizedTitle;
  }

  const forceLowercase = isAllCapsTitle(normalizedTitle);
  const converted = normalizedTitle.replace(/[A-Za-z][A-Za-z0-9]*(?:[/-][A-Za-z0-9]+)*/g, (word) => {
    return word
      .split(/([/-])/)
      .map((part) => (part === '/' || part === '-' ? part : normalizeTitleWord(part, forceLowercase)))
      .join('');
  });

  return converted.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

function formatTitleLine(line) {
  const titlePatterns = [
    /^(\s*\*\*Title:\*\*\s*)(.+)$/i,
    /^(\s*\*\*Title\*\*:?\s*)(.+)$/i,
    /^(\s*Title:\s*)(.+)$/i,
  ];

  for (const pattern of titlePatterns) {
    const match = line.match(pattern);

    if (match) {
      return `${match[1]}${sentenceCaseTitle(match[2])}`;
    }
  }

  return line;
}

function getEvidenceLabel(attachment = {}) {
  const name = attachment.name || '';
  const type = attachment.type || '';

  if (attachment.kind === 'image' || /^image\//i.test(type)) {
    return 'Screenshot';
  }

  if (attachment.kind === 'video' || /^video\//i.test(type) || /\.mp4$/i.test(name)) {
    return 'Recording';
  }

  return 'Attachment';
}

function buildEvidenceLines(attachments = []) {
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.filter((attachment) => attachment && typeof attachment === 'object')
    : [];

  if (!normalizedAttachments.length) {
    return [];
  }

  return [
    '**Evidence:**',
    ...normalizedAttachments.map((attachment, index) => {
      const label = getEvidenceLabel(attachment);
      const name = attachment.name || `Attachment ${index + 1}`;
      const details = [
        attachment.type,
        formatBytes(Number(attachment.size)),
      ].filter(Boolean);
      const frameCount = Array.isArray(attachment.frames) ? attachment.frames.length : 0;

      if (frameCount) {
        details.push(`${frameCount} sampled frame${frameCount === 1 ? '' : 's'} analyzed`);
      }

      return `- ${label}: ${name}${details.length ? ` (${details.join(', ')})` : ''}`;
    }),
  ];
}

function removeSection(lines, sectionName) {
  const result = [];
  let isSkipping = false;

  for (const line of lines) {
    const sectionLabel = getSectionLabel(line);

    if (isSkipping && sectionLabel) {
      isSkipping = false;
    }

    if (sectionEquals(sectionLabel, sectionName)) {
      isSkipping = true;
      continue;
    }

    if (!isSkipping) {
      result.push(line);
    }
  }

  return result;
}

function findSectionIndex(lines, sectionName) {
  return lines.findIndex((line) => sectionEquals(getSectionLabel(line), sectionName));
}

function findNextSectionIndex(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (getSectionLabel(lines[index])) {
      return index;
    }
  }

  return lines.length;
}

function insertSection(lines, insertIndex, sectionLines) {
  return [
    ...lines.slice(0, insertIndex),
    '',
    ...sectionLines,
    '',
    ...lines.slice(insertIndex),
  ];
}

function placeEvidenceAfterActual(lines, attachments) {
  const evidenceLines = buildEvidenceLines(attachments);

  if (!evidenceLines.length) {
    return lines;
  }

  const withoutEvidence = removeSection(lines, 'Evidence');
  const actualIndex = findSectionIndex(withoutEvidence, 'Actual Result');
  const expectedIndex = findSectionIndex(withoutEvidence, 'Expected Result');
  const insertIndex = actualIndex >= 0
    ? findNextSectionIndex(withoutEvidence, actualIndex)
    : expectedIndex >= 0 ? expectedIndex : withoutEvidence.length;

  return insertSection(withoutEvidence, insertIndex, evidenceLines);
}

function placeAdditionalInfo(lines, additionalInfo) {
  const normalizedInfo = typeof additionalInfo === 'string' ? additionalInfo.trim() : '';

  if (!normalizedInfo || findSectionIndex(lines, 'Additional Info') >= 0) {
    return lines;
  }

  const severityIndex = findSectionIndex(lines, 'Severity / Priority');
  const expectedIndex = findSectionIndex(lines, 'Expected Result');
  const insertIndex = severityIndex >= 0
    ? severityIndex
    : expectedIndex >= 0 ? findNextSectionIndex(lines, expectedIndex) : lines.length;

  return insertSection(lines, insertIndex, [
    '**Additional Info:**',
    normalizedInfo,
  ]);
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
    const sectionLine = parseSectionLine(line);
    const sectionLabel = sectionLine ? sectionLine.label : '';

    if (skipRemovedSection) {
      if (!sectionLabel) {
        continue;
      }

      skipRemovedSection = false;
    }

    if (sectionSetHas(removedSectionLabels, sectionLabel)) {
      skipRemovedSection = true;
      activeSection = '';
      continue;
    }

    if (sectionLabel) {
      activeSection = sectionLabel;
    }

    if (sectionLine && !sectionEquals(sectionLabel, 'Title')) {
      formattedLines.push(formatSectionLabel(sectionLabel));

      if (sectionLine.content) {
        const content = sectionSetHas(RESULT_SECTION_LABELS, sectionLabel)
          ? removeLeadingListMarker(sectionLine.content)
          : sectionLine.content;

        if (content.trim()) {
          formattedLines.push(removeTrailingSentencePeriod(content));
        }
      }

      continue;
    }

    if (sectionSetHas(RESULT_SECTION_LABELS, activeSection)) {
      line = removeResultListMarker(line);
    }

    line = formatTitleLine(line);
    formattedLines.push(removeTrailingSentencePeriod(line));
  }

  const withEvidence = options.includeEvidence === false
    ? formattedLines
    : placeEvidenceAfterActual(formattedLines, options.attachments);
  const withAdditionalInfo = placeAdditionalInfo(withEvidence, options.additionalInfo);

  return collapseBlankLines(withAdditionalInfo);
}
