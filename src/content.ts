import { isVisible } from './dom';

// ============================================================
// Content detection (noise + scoring)
// ============================================================

const NOISE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'iframe',
  'object',
  'embed',
  'dialog',
  '[aria-hidden="true"]',
  '[hidden]',
  '.nav',
  '.navbar',
  '.menu',
  '.sidebar',
  '.side-bar',
  '.ads',
  '.advertisement',
  '.ad-box',
  '.banner',
  '.cookie',
  '.cookie-banner',
  '.consent',
  '.modal',
  '.overlay',
  '.popup',
  '.gallery',
  '.social',
  '.social-share',
  '.share',
  '.comments',
  '.comment-section',
  '.related',
  '.related-posts',
  '.recommend',
  '.recommended',
  '.pagination',
  '.copyright',
  '.disclaimer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="dialog"]',
].join(', ');

export const isNoise = (node: Element): boolean =>
  node.nodeType === Node.ELEMENT_NODE && node.matches(NOISE_SELECTOR);

export const isContentTag = (tag: string): boolean =>
  tag === 'p' ||
  tag === 'h1' ||
  tag === 'h2' ||
  tag === 'h3' ||
  tag === 'h4' ||
  tag === 'h5' ||
  tag === 'h6' ||
  tag === 'li' ||
  tag === 'td' ||
  tag === 'th' ||
  tag === 'blockquote' ||
  tag === 'pre' ||
  tag === 'figcaption' ||
  tag === 'article';

export const hasMeaningfulText = (element: HTMLElement): boolean => {
  const text = element.innerText;
  return Boolean(text && text.trim().length >= 100);
};

export const cleanTextLength = (element: HTMLElement): number => {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(NOISE_SELECTOR).forEach((n) => n.remove());
  return (clone.innerText || '').trim().length;
};

export const signalMarksFor = (element: Element): number => {
  const idClass = `${element.id} ${element.className || ''}`.toLowerCase();
  const count = (regexp: RegExp): number => (regexp.test(idClass) ? 1 : 0);
  return (
    count(/article|post|main|content|entry|body/i) -
    count(/nav|menu|sidebar|comment|footer|header|advert|related/i)
  );
};

export interface Candidate {
  element: HTMLElement;
  score: number;
}

export const scoreElement = (element: HTMLElement): Candidate => {
  const cleanChars = cleanTextLength(element);
  const links = element.querySelectorAll('a').length;
  const paragraphs = element.querySelectorAll('p').length;

  const textScore = cleanChars * 0.5;
  const paraScore = Math.min(paragraphs, 20) * 15;
  const linkPenalty = Math.max(0, 40 - links) * 0.5 + (links > 40 ? -40 : 0);

  return {
    element,
    score:
      textScore +
      paraScore +
      linkPenalty +
      signalMarksFor(element) * 60 +
      cleanChars,
  };
};

export const collectBodyCandidates = (): Candidate[] => {
  const candidates: Candidate[] = [];
  const queue: HTMLElement[] = [document.body];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const tag = current.tagName.toLowerCase();
    if (tag !== 'body' && tag !== 'html') {
      if (
        !isNoise(current) &&
        isVisible(current) &&
        hasMeaningfulText(current)
      ) {
        candidates.push(scoreElement(current));
      }
    }
    for (const child of current.children) {
      queue.push(child as HTMLElement);
    }
  }
  return candidates;
};

export const sortCandidates = (candidates: Candidate[]): Candidate[] =>
  [...candidates].sort((a, b) => b.score - a.score);

export const isContainedBy = (child: Element, ancestor: Element): boolean =>
  child !== ancestor && ancestor.contains(child);

export const topLevelCandidates = (candidates: Candidate[]): Candidate[] =>
  candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other !== candidate &&
          other.score <= candidate.score &&
          isContainedBy(candidate.element, other.element),
      ),
  );

export const DEFAULT_SELECTOR = 'body';

export const findContentContainer = (selector: string): Element => {
  const explicit = document.querySelector(selector);
  if (!explicit) {
    return document.body;
  }

  if (selector !== DEFAULT_SELECTOR) {
    return explicit;
  }

  const candidates = sortCandidates(collectBodyCandidates());
  if (!candidates.length) {
    return document.body;
  }

  const withinMain = topLevelCandidates(candidates);
  return (withinMain[0] || candidates[0]!).element;
};
