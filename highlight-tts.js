// ============================================================
// DOM utilities
// ============================================================

const isVisible = (node) => {
    var style = window.getComputedStyle(node);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        node.offsetParent !== null &&
        node.offsetWidth &&
        node.offsetHeight &&
        node.getClientRects().length
    );
};

const isInteractive = (node) =>
    node.matches(
        'button, input, select, textarea, [contenteditable], [tabindex]',
    );

const isNonTextElement = (tag) =>
    tag === 'script' || tag === 'style' || tag === 'head';

const closest = (element, ancestors) =>
    element.closest(
        'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, article, section, div'
    );

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

const isNoise = (node) =>
    node.nodeType === Node.ELEMENT_NODE && node.matches(NOISE_SELECTOR);

const isContentTag = (tag) =>
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

const hasMeaningfulText = (element) => {
    const text = element.innerText;
    return Boolean(text && text.trim().length >= 100);
};

const cleanTextLength = (element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(NOISE_SELECTOR).forEach((n) => n.remove());
    return (clone.innerText || '').trim().length;
};

const signalMarksFor = (element) => {
    const idClass = `${element.id} ${element.className || ''}`.toLowerCase();
    const count = (regexp) => (regexp.test(idClass) ? 1 : 0);
    return (
        count(/article|post|main|content|entry|body/i) -
        count(/nav|menu|sidebar|comment|footer|header|advert|related/i)
    );
};

const scoreElement = (element) => {
    const text = element.innerText.trim();
    const cleanChars = cleanTextLength(element);
    const totalWords = text.split(/\s+/).length;
    const links = element.querySelectorAll('a').length;
    const paragraphs = element.querySelectorAll('p').length;

    const textScore = cleanChars * 0.5;
    const paraScore = Math.min(paragraphs, 20) * 15;
    const linkPenalty =
        Math.max(0, 40 - links) * 0.5 + (links > 40 ? -40 : 0);

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

const collectBodyCandidates = () => {
    const candidates = [];
    const queue = [document.body];
    while (queue.length) {
        const current = queue.shift();
        const tag = current.tagName.toLowerCase();
        if (tag !== 'body' && tag !== 'html') {
            if (!isNoise(current) && isVisible(current) && hasMeaningfulText(current)) {
                candidates.push(scoreElement(current));
            }
        }
        for (const child of current.children) {
            queue.push(child);
        }
    }
    return candidates;
};

const sortCandidates = (candidates) =>
    [...candidates].sort((a, b) => b.score - a.score);

const isContainedBy = (child, ancestor) =>
    child !== ancestor && ancestor.contains(child);

const topLevelCandidates = (candidates) =>
    candidates.filter(
        (candidate) =>
            !candidates.some(
                (other) =>
                    other !== candidate &&
                    other.score <= candidate.score &&
                    isContainedBy(candidate.element, other.element),
            ),
    );

const findContentContainer = (selector) => {
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
    return (withinMain[0] || candidates[0]).element;
};

const DEFAULT_SELECTOR = 'body';

// ============================================================
// Text node collection
// ============================================================

const isTextNodeBlockedByAncestor = (node, container) => {
    let current = node.parentNode;
    while (current && current !== container) {
        if (
            isNoise(current) ||
            (current.nodeType === Node.ELEMENT_NODE && !isVisible(current)) ||
            isInteractive(current)
        ) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
};

const isOnlyTextNodeWithPunctuation = (node, container) => {
    if (container === document.body) {
        return false;
    }
    const parent = node.parentNode;
    if (
        parent.nodeType !== Node.ELEMENT_NODE ||
        isContentTag(parent.tagName.toLowerCase())
    ) {
        return false;
    }
    return /^[\p{P}\p{S}\s]+$/u.test(node.nodeValue.trim());
};

const acceptTextNode = (node, container) => {
    if (node.nodeValue.trim() === '') {
        return NodeFilter.FILTER_REJECT;
    }
    if (isTextNodeBlockedByAncestor(node, container)) {
        return NodeFilter.FILTER_REJECT;
    }
    const parent = node.parentNode;
    if (
        parent.nodeType === Node.ELEMENT_NODE &&
        isNonTextElement(parent.tagName.toLowerCase())
    ) {
        return NodeFilter.FILTER_REJECT;
    }
    if (isOnlyTextNodeWithPunctuation(node, container)) {
        return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
};

const textNodeWalker = (container) =>
    document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => acceptTextNode(node, container),
        },
        false,
    );

const collectTextNodes = (container) => {
    const textNodes = [];
    const walker = textNodeWalker(container);
    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }
    return textNodes;
};

// ============================================================
// Highlighting (word spans)
// ============================================================

const highlight = (textNode) => {
    requestAnimationFrame(() => {
        textNode.style.backgroundColor = 'yellow';
        textNode.style.color = 'black';
        textNode.scrollIntoView({ block: 'center', inline: 'center' });
    });
};

const unhighlight = (textNode) => {
    requestAnimationFrame(() => {
        textNode.style.backgroundColor = '';
        textNode.style.color = '';
    });
};

const createWordSpan = (word) => {
    const span = document.createElement('span');
    span.textContent = word;
    return span;
};

const createSpaceSpan = () => {
    const space = document.createElement('span');
    space.textContent = ' ';
    return space;
};

const wrapTextNodeIntoSpans = (textNode) => {
    const words = textNode.nodeValue.split(/\s+/);
    const spans = words.map(createWordSpan);

    textNode.parentNode.replaceChild(spans[0], textNode);
    for (let index = 1; index < spans.length; index++) {
        spans[index - 1].after(createSpaceSpan());
        spans[index - 1].nextSibling.after(spans[index]);
    }

    return spans;
};

const prepareText = (textNodes) => {
    const allWords = [];
    for (const textNode of textNodes) {
        allWords.push(...wrapTextNodeIntoSpans(textNode));
    }
    return allWords;
};

// ============================================================
// Speech synthesis (TTS)
// ============================================================

const unwrapSpansIntoText = (allWords) => {
    allWords.forEach((span) => {
        const next = span.nextSibling;
        if (next && next.textContent === ' ') {
            next.remove();
        }
        span.replaceWith(document.createTextNode(span.textContent));
    });
};

const computeWordOffsets = (allWords, fullText) => {
    const wordOffsets = [];
    let charPos = 0;
    for (const span of allWords) {
        const text = span.textContent;
        while (charPos < fullText.length && fullText[charPos] === ' ') {
            charPos++;
        }
        wordOffsets.push(fullText.indexOf(text, charPos));
        charPos += text.length;
    }
    return wordOffsets;
};

const buildUtteranceText = (allWords) =>
    allWords.map((span) => span.textContent).join(' ').trim();

const wordIndexForCharIndex = (wordOffsets, charIndex) => {
    let wordIndex = 0;
    for (let index = 0; index < wordOffsets.length; index++) {
        if (wordOffsets[index] <= charIndex) {
            wordIndex = index;
        } else {
            break;
        }
    }
    return wordIndex;
};

const setActiveWord = (wordIndex, allWords) => {
    if (currentIndex >= 0 && currentIndex < allWords.length) {
        unhighlight(allWords[currentIndex]);
    }
    if (wordIndex < allWords.length) {
        highlight(allWords[wordIndex]);
        currentIndex = wordIndex;
    }
};

const onBoundary = (event, wordOffsets, allWords) => {
    if (event.name !== 'word') {
        return;
    }
    const wordIndex = wordIndexForCharIndex(wordOffsets, event.charIndex);
    setActiveWord(wordIndex, allWords);
};

const onUtteranceError = (event) => {
    if (event.error === 'canceled' || event.error === 'interrupted') {
        return;
    }
    console.error('Speech synthesis error', event.error, event);
};

const onUtteranceEnd = (allWords) => {
    currentIndex = 0;
    allWords.forEach((word) => {
        unhighlight(word);
    });
};

const configureUtterance = ({ allWords, rate }) => {
    const fullText = buildUtteranceText(allWords);
    const wordOffsets = computeWordOffsets(allWords, fullText);

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rate;

    utterance.addEventListener('boundary', (event) =>
        onBoundary(event, wordOffsets, allWords),
    );
    utterance.addEventListener('error', onUtteranceError);
    utterance.onend = () => onUtteranceEnd(allWords);

    return utterance;
};

const applyVoice = (utterance, voiceName, lang) => {
    const voice = speechSynthesis
        .getVoices()
        .find(({ name }) => name === voiceName);
    utterance.voice = voice;
    utterance.lang = lang;
};

// ============================================================
// TTS state + lifecycle
// ============================================================

let currentIndex = 0;
let currentUtterance = null;
let currentAllWords = [];
let currentContainer = null;

const resetHighlighting = () => {
    currentIndex = 0;
};

const clearHighlight = () => {
    currentAllWords.forEach(unhighlight);
};

const stopTTS = () => {
    speechSynthesis.cancel();
    resetHighlighting();
    clearHighlight();
};

// ============================================================
// Orchestration
// ============================================================

const highlightAndSpeak = (container) => {
    if (currentContainer && currentContainer !== container && currentAllWords.length) {
        unwrapSpansIntoText(currentAllWords);
        currentAllWords = [];
    }

    const textNodes = collectTextNodes(container);
    const allWords = prepareText(textNodes);
    const utterance = configureUtterance({ allWords, rate: 1 });

    currentUtterance = utterance;
    currentAllWords = allWords;
    currentContainer = container;

    speechSynthesis.speak(utterance);
    window.addEventListener('beforeunload', () => speechSynthesis.cancel());

    return utterance;
};

// ============================================================
// Controls (UI)
// ============================================================

const englishVoices = () =>
    speechSynthesis.getVoices().filter(({ lang }) => lang === 'en-US');

const appendVoiceOption = (voiceSelector, voice) => {
    const option = document.createElement('option');
    option.textContent = `${voice.name} | (${voice.lang})`;
    option.setAttribute('data-lang', voice.lang);
    option.setAttribute('data-name', voice.name);
    voiceSelector.appendChild(option);
};

const populateVoiceOptions = (voiceSelector) => {
    englishVoices().forEach((voice) => appendVoiceOption(voiceSelector, voice));
};

const createIconButton = (icon) => {
    const button = document.createElement('button');
    button.innerText = icon;
    button.style.cursor = 'pointer';
    return button;
};

const buildControlsContainer = () => {
    const play = createIconButton('▶️');
    const pause = createIconButton('⏸️');
    const stop = createIconButton('⏹️');
    const search = createIconButton('🔍');

    const voiceSelector = document.createElement('select');
    populateVoiceOptions(voiceSelector);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '4px';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999999999999999999';
    container.replaceChildren(play, pause, stop, search, voiceSelector);

    return { play, pause, stop, search, voiceSelector, container };
};

const getActiveUtterance = () =>
    currentUtterance && !speechSynthesis.speaking ? currentUtterance : null;

const playTTS = () => {
    if (speechSynthesis.paused) {
        speechSynthesis.resume();
        return;
    }
    const utterance = getActiveUtterance();
    if (utterance) {
        speechSynthesis.speak(utterance);
    }
};

const pauseTTS = () => {
    if (speechSynthesis.speaking) {
        speechSynthesis.pause();
    }
};

const searchAndSpeak = () => {
    stopTTS();
    pickContainer((nextContainer) => {
        highlightAndSpeak(nextContainer);
    });
};

const applySelectedVoice = (event) => {
    const [voiceName, lang] = event.target.value.split(' | ');
    stopTTS();
    if (currentUtterance) {
        applyVoice(currentUtterance, voiceName, lang);
        speechSynthesis.speak(currentUtterance);
    }
};

const wireControls = ({ play, pause, stop, search, voiceSelector }) => {
    play.addEventListener('click', playTTS);
    pause.addEventListener('click', pauseTTS);
    stop.addEventListener('click', stopTTS);
    search.addEventListener('click', searchAndSpeak);
    voiceSelector.addEventListener('change', applySelectedVoice);
};

const injectControls = () => {
    const controls = buildControlsContainer();
    document.body.appendChild(controls.container);
    wireControls(controls);
};

// ============================================================
// Container picking (overlay)
// ============================================================

const createOverlay = () => {
    const overlay = document.createElement('div');
    overlay.style.pointerEvents = 'none';
    overlay.style.position = 'fixed';
    overlay.style.border = '2px solid #ff9800';
    overlay.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.12)';
    overlay.style.background = 'rgba(255, 152, 0, 0.18)';
    overlay.style.zIndex = '9999999999999999998';
    overlay.style.display = 'none';
    return overlay;
};

const createPickerHint = () => {
    const hint = document.createElement('div');
    hint.textContent = 'Click a block to read from there · Press Esc for auto-detect';
    hint.style.position = 'fixed';
    hint.style.bottom = '20px';
    hint.style.left = '50%';
    hint.style.transform = 'translateX(-50%)';
    hint.style.background = 'rgba(0,0,0,0.8)';
    hint.style.color = '#fff';
    hint.style.padding = '8px 14px';
    hint.style.borderRadius = '8px';
    hint.style.font = '14px system-ui, sans-serif';
    hint.style.zIndex = '9999999999999999998';
    return hint;
};

const positionOverlay = (overlay, element) => {
    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
};

const pickTargetFromPoint = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) {
        return null;
    }
    const target = closest(el);
    return target && target.textContent.trim() ? target : null;
};

const registerPickerListeners = ({ onMove, onClick, onKeydown }) => {
    const cleanup = () => {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeydown, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown, true);
    return cleanup;
};

const pickContainer = (onPick) => {
    let picked = false;

    const overlay = createOverlay();
    const hint = createPickerHint();

    const onMove = (event) => {
        const target = pickTargetFromPoint(event.clientX, event.clientY);
        if (target) {
            positionOverlay(overlay, target);
        }
    };

    const finish = (onPick, target) => {
        if (picked) {
            return;
        }
        picked = true;
        cleanup();
        overlay.remove();
        hint.remove();
        onPick(target);
    };

    const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = pickTargetFromPoint(event.clientX, event.clientY);
        if (target) {
            finish(onPick, target);
        }
    };

    const onKeydown = (event) => {
        if (event.key === 'Escape') {
            finish(onPick, findContentContainer(DEFAULT_SELECTOR));
        }
    };

    const cleanup = registerPickerListeners({ onMove, onClick, onKeydown });

    document.body.appendChild(overlay);
    document.body.appendChild(hint);
};

injectControls();
