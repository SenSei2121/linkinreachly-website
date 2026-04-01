import {
  layoutWithLines,
  prepareWithSegments,
} from 'https://esm.sh/@chenglou/pretext@0.0.3?bundle';

const targets = Array.from(document.querySelectorAll('[data-pretext-balance]')).map((element) => {
  const style = window.getComputedStyle(element);

  return {
    element,
    text: (element.textContent || '').trim(),
    originalMaxWidth: style.maxWidth,
    prepared: null,
    preparedFont: '',
  };
});

function getCanvasFont(style) {
  const parts = [];

  if (style.fontStyle && style.fontStyle !== 'normal') {
    parts.push(style.fontStyle);
  }

  if (style.fontVariant && style.fontVariant !== 'normal') {
    parts.push(style.fontVariant);
  }

  if (style.fontWeight) {
    parts.push(style.fontWeight);
  }

  parts.push(style.fontSize);
  parts.push(style.fontFamily);

  return parts.join(' ');
}

function getLineHeight(style) {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.2 : 0;
}

function getAvailableWidth(target) {
  const parentWidth = target.element.parentElement?.clientWidth ?? target.element.clientWidth;
  const originalMaxWidth = Number.parseFloat(target.originalMaxWidth);

  if (Number.isFinite(originalMaxWidth)) {
    return Math.max(1, Math.floor(Math.min(parentWidth, originalMaxWidth)));
  }

  return Math.max(1, Math.floor(parentWidth));
}

function getPrepared(target, font) {
  if (target.prepared !== null && target.preparedFont === font) {
    return target.prepared;
  }

  target.prepared = prepareWithSegments(target.text, font);
  target.preparedFont = font;
  return target.prepared;
}

function getTightWidth(lines) {
  return Math.ceil(lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0));
}

function getBalanceScore(lines) {
  if (lines.length <= 1) {
    return 1;
  }

  const widths = lines.map((line) => line.width);
  const widest = Math.max(...widths);
  const narrowest = Math.min(...widths);

  if (widest === 0) {
    return 1;
  }

  return narrowest / widest;
}

function balanceTarget(target) {
  const style = window.getComputedStyle(target.element);
  const font = getCanvasFont(style);
  const lineHeight = getLineHeight(style);
  const availableWidth = getAvailableWidth(target);

  if (!font || !lineHeight || !availableWidth) {
    return;
  }

  const prepared = getPrepared(target, font);
  const baseline = layoutWithLines(prepared, availableWidth, lineHeight);

  if (baseline.lineCount <= 1 || baseline.lineCount > 4) {
    target.element.style.maxWidth = `${availableWidth}px`;
    return;
  }

  let minRatio = 0.82;
  if (baseline.lineCount === 4) {
    minRatio = 0.9;
  }

  const minCandidateWidth = Math.max(1, Math.floor(availableWidth * minRatio));
  let bestTightWidth = getTightWidth(baseline.lines);
  let bestScore = getBalanceScore(baseline.lines);

  for (let candidateWidth = availableWidth - 4; candidateWidth >= minCandidateWidth; candidateWidth -= 4) {
    const candidate = layoutWithLines(prepared, candidateWidth, lineHeight);

    if (candidate.lineCount !== baseline.lineCount) {
      continue;
    }

    const candidateScore = getBalanceScore(candidate.lines);
    const candidateTightWidth = getTightWidth(candidate.lines);

    if (
      candidateScore > bestScore + 0.015 ||
      (Math.abs(candidateScore - bestScore) <= 0.015 && candidateTightWidth > bestTightWidth)
    ) {
      bestScore = candidateScore;
      bestTightWidth = candidateTightWidth;
    }
  }

  target.element.style.maxWidth = `${Math.min(availableWidth, bestTightWidth)}px`;
}

function rebalanceAll() {
  targets.forEach(balanceTarget);
}

async function init() {
  if (targets.length === 0) {
    return;
  }

  if ('fonts' in document && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Keep the current metrics if font loading fails.
    }
  }

  rebalanceAll();

  let frameId = 0;
  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(rebalanceAll);
  });
}

init();
