// ============================================================
// Highlighting (word spans)
// ============================================================

export const highlight = (textNode: HTMLElement): void => {
  requestAnimationFrame(() => {
    textNode.style.backgroundColor = 'yellow';
    textNode.style.color = 'black';
    textNode.scrollIntoView({ block: 'center', inline: 'center' });
  });
};

export const unhighlight = (textNode: HTMLElement): void => {
  requestAnimationFrame(() => {
    textNode.style.backgroundColor = '';
    textNode.style.color = '';
  });
};

export const createWordSpan = (word: string): HTMLSpanElement => {
  const span = document.createElement('span');
  span.textContent = word;
  return span;
};

export const createSpaceSpan = (): HTMLSpanElement => {
  const space = document.createElement('span');
  space.textContent = ' ';
  return space;
};

export const wrapTextNodeIntoSpans = (textNode: Node): HTMLSpanElement[] => {
  const words = (textNode.nodeValue ?? '').split(/\s+/);
  const spans = words.map(createWordSpan);

  textNode.parentNode!.replaceChild(spans[0]!, textNode);
  for (let index = 1; index < spans.length; index++) {
    spans[index - 1]!.after(createSpaceSpan());
    spans[index - 1]!.nextSibling!.after(spans[index]!);
  }

  return spans;
};

export const prepareText = (textNodes: Node[]): HTMLSpanElement[] => {
  const allWords: HTMLSpanElement[] = [];
  for (const textNode of textNodes) {
    allWords.push(...wrapTextNodeIntoSpans(textNode));
  }
  return allWords;
};

export const unwrapSpansIntoText = (allWords: HTMLSpanElement[]): void => {
  allWords.forEach((span) => {
    const next = span.nextSibling;
    if (next && next.textContent === ' ') {
      next.replaceWith(document.createTextNode(' '));
    }
    span.replaceWith(document.createTextNode(span.textContent!));
  });
};
