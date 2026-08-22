import { isNoise, isContentTag } from './content';
import { isVisible, isInteractive, isNonTextElement } from './dom';

// ============================================================
// Text node collection
// ============================================================

export const isTextNodeBlockedByAncestor = (
    node: Node,
    container: Element,
): boolean => {
    let current = node.parentNode;
    while (current && current !== container) {
        if (
            isNoise(current as Element) ||
            (current.nodeType === Node.ELEMENT_NODE &&
                current instanceof HTMLElement &&
                !isVisible(current)) ||
            (current instanceof Element && isInteractive(current))
        ) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
};

export const isOnlyTextNodeWithPunctuation = (
    node: Node,
    container: Element,
): boolean => {
    if (container === document.body) {
        return false;
    }
    const parent = node.parentNode;
    if (
        !(parent instanceof Element) ||
        isContentTag(parent.tagName.toLowerCase())
    ) {
        return false;
    }
    return /^[\p{P}\p{S}\s]+$/u.test(node.nodeValue!.trim());
};

export const acceptTextNode = (node: Node, container: Element): number => {
    if (node.nodeValue === null || node.nodeValue.trim() === '') {
        return NodeFilter.FILTER_REJECT;
    }
    if (isTextNodeBlockedByAncestor(node, container)) {
        return NodeFilter.FILTER_REJECT;
    }
    const parent = node.parentNode;
    if (
        parent instanceof Element &&
        isNonTextElement(parent.tagName.toLowerCase())
    ) {
        return NodeFilter.FILTER_REJECT;
    }
    if (isOnlyTextNodeWithPunctuation(node, container)) {
        return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
};

const textNodeWalker = (container: Element): TreeWalker =>
    document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node: Node) => acceptTextNode(node, container),
        },
    );

export const collectTextNodes = (container: Element): Node[] => {
    const textNodes: Node[] = [];
    const walker = textNodeWalker(container);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }
    return textNodes;
};
