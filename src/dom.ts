// ============================================================
// DOM utilities
// ============================================================

export const isVisible = (node: HTMLElement): boolean => {
    const style = window.getComputedStyle(node);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        node.offsetParent !== null &&
        node.offsetWidth > 0 &&
        node.offsetHeight > 0 &&
        node.getClientRects().length > 0
    );
};

export const isInteractive = (node: Element): boolean =>
    node.matches(
        'button, input, select, textarea, [contenteditable], [tabindex]',
    );

export const isNonTextElement = (tag: string): boolean =>
    tag === 'script' || tag === 'style' || tag === 'head';

export const closest = (element: Element): HTMLElement | null =>
    element.closest(
        'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, article, section, div'
    );
