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

const DEFAULT_SELECTOR = 'body';

const findContentContainer = (selector) => {
    const explicit = document.querySelector(selector);
    if (!explicit) {
        return document.body;
    }

    if (selector !== DEFAULT_SELECTOR) {
        return explicit;
    }

    const candidates = [];
    const inspect = (element) => {
        const tag = element.tagName.toLowerCase();
        if (tag === 'body' || tag === 'html') {
            return;
        }
        if (isNoise(element) || !isVisible(element)) {
            return;
        }

        const text = element.innerText;
        if (!text || text.trim().length < 100) {
            return;
        }

        const clone = element.cloneNode(true);
        clone.querySelectorAll(NOISE_SELECTOR).forEach((n) => n.remove());

        const cleanText = (clone.innerText || '').trim();
        const cleanChars = cleanText.length;
        const totalChars = (text || '').trim().length;
        const totalWords = text.trim().split(/\s+/).length;
        const links = element.querySelectorAll('a').length;
        const paragraphs = element.querySelectorAll('p').length;

        let signalMarks = 0;
        const idClass =
            `${element.id} ${element.className || ''}`.toLowerCase();
        const signalHit = (regexp) => (regexp.test(idClass) ? 1 : 0);
        signalMarks += signalHit(/article|post|main|content|entry|body/i);
        signalMarks -= signalHit(
            /nav|menu|sidebar|comment|footer|header|advert|related/i,
        );

        const textScore = cleanText.length * 0.5;
        const paraScore = Math.min(paragraphs, 20) * 15;
        const linkPenalty =
            Math.max(0, 40 - links) * 0.5 + (links > 40 ? -40 : 0);

        candidates.push({
            element,
            score:
                textScore +
                paraScore +
                linkPenalty +
                signalMarks * 60 +
                cleanChars,
        });
    };

    const queue = [document.body];
    while (queue.length) {
        const current = queue.shift();
        inspect(current);
        for (const child of current.children) {
            queue.push(child);
        }
    }

    if (!candidates.length) {
        return document.body;
    }

    candidates.sort((a, b) => b.score - a.score);

    const withinMain = [];
    const isUnder = (child, ancestor) =>
        child !== ancestor && ancestor.contains(child);
    for (const candidate of candidates) {
        const inside = candidates.some(
            (other) =>
                other !== candidate &&
                other.score <= candidate.score &&
                isUnder(candidate.element, other.element),
        );
        if (!inside) {
            withinMain.push(candidate);
        }
    }

    return (withinMain[0] || candidates[0]).element;
};

const textNodeWalker = (container) =>
    document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                const parent = node.parentNode;

                let current = parent;
                while (current && current !== container) {
                    if (
                        isNoise(current) ||
                        (current.nodeType === Node.ELEMENT_NODE &&
                            !isVisible(current)) ||
                        isInteractive(current)
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    current = current.parentNode;
                }

                if (parent.nodeType === Node.ELEMENT_NODE) {
                    const tag = parent.tagName.toLowerCase();
                    if (tag === 'script' || tag === 'style' || tag === 'head') {
                        return NodeFilter.FILTER_REJECT;
                    }
                }

                if (container !== document.body) {
                    if (
                        parent.nodeType === Node.ELEMENT_NODE &&
                        !isContentTag(parent.tagName.toLowerCase())
                    ) {
                        const text = node.nodeValue.trim();
                        const hasOnlyPunctuation = /^[\p{P}\p{S}\s]+$/u.test(
                            text,
                        );
                        if (hasOnlyPunctuation) {
                            return NodeFilter.FILTER_REJECT;
                        }
                    }
                }

                return node.nodeValue.trim() !== ''
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        },
        false,
    );

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

let currentIndex = 0;

const resetHighlighting = () => {
    currentIndex = 0;
};

const configureUtterance = ({ allWords, rate }) => {
    const fullText = allWords
        .map((span) => span.textContent)
        .join(' ')
        .trim();

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

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rate;

    utterance.addEventListener('boundary', (event) => {
        if (event.name !== 'word') {
            return;
        }

        let wordIndex = 0;
        for (let index = 0; index < wordOffsets.length; index++) {
            if (wordOffsets[index] <= event.charIndex) {
                wordIndex = index;
            } else {
                break;
            }
        }

        if (currentIndex >= 0 && currentIndex < allWords.length) {
            unhighlight(allWords[currentIndex]);
        }

        if (wordIndex < allWords.length) {
            highlight(allWords[wordIndex]);
            currentIndex = wordIndex;
        }
    });

    utterance.addEventListener('error', (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') {
            return;
        }
        console.error('Speech synthesis error', event.error, event);
    });

    utterance.onend = () => {
        currentIndex = 0;
        allWords.forEach((word) => {
            unhighlight(word);
        });
    };

    return utterance;
};

const prepareText = (textNodes) => {
    const allWords = [];
    textNodes.forEach((textNode) => {
        const words = textNode.nodeValue.split(/\s+/);
        const spans = words.map((word) => {
            const span = document.createElement('span');
            span.textContent = word;

            return span;
        });
        allWords.push(...spans);
        textNode.parentNode.replaceChild(spans[0], textNode);
        for (let index = 1; index < spans.length; index++) {
            const space = document.createElement('span');
            space.textContent = ' ';
            spans[index - 1].after(space);
            space.after(spans[index]);
        }
    });

    return allWords;
};

let currentUtterance = null;
let currentAllWords = [];
let currentContainer = null;

const unwrapWords = (allWords) => {
    allWords.forEach((span) => {
        const next = span.nextSibling;
        if (next && next.textContent === ' ') {
            span.replaceWith(document.createTextNode(span.textContent));
            next.remove();
        } else {
            span.replaceWith(document.createTextNode(span.textContent));
        }
    });
};

const clearHighlight = () => {
    currentAllWords.forEach(unhighlight);
};

const stopTTS = () => {
    speechSynthesis.cancel();
    resetHighlighting();
    clearHighlight();
};

const applyVoice = (utterance, voiceName, lang) => {
    const voice = speechSynthesis
        .getVoices()
        .find(({ name }) => name === voiceName);
    utterance.voice = voice;
    utterance.lang = lang;
};

const highlightAndSpeak = (container) => {
    if (currentContainer && currentContainer !== container && currentAllWords.length) {
        unwrapWords(currentAllWords);
        currentAllWords = [];
    }

    const textNodes = [];
    const walker = textNodeWalker(container);

    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    const allWords = prepareText(textNodes);
    const utterance = configureUtterance({ allWords, rate: 1 });

    currentUtterance = utterance;
    currentAllWords = allWords;
    currentContainer = container;

    speechSynthesis.speak(utterance);
    window.addEventListener('beforeunload', () => speechSynthesis.cancel());

    return utterance;
};

const populateVoiceOptions = (voiceSelector) => {
    const voices = speechSynthesis
        .getVoices()
        .filter(({ lang }) => lang === 'en-US');

    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} | (${voice.lang})`;
        option.setAttribute('data-lang', voice.lang);
        option.setAttribute('data-name', voice.name);
        voiceSelector.appendChild(option);
    });
};

const injectControls = () => {
    const play = document.createElement('button');
    play.innerText = '▶️';

    const pause = document.createElement('button');
    pause.innerText = '⏸️';

    const stop = document.createElement('button');
    stop.innerText = '⏹️';

    const search = document.createElement('button');
    search.innerText = '🔍';

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
    container.querySelectorAll('button').forEach((button) => {
        button.style.cursor = 'pointer';
    });

    document.body.appendChild(container);
    play.addEventListener('click', () => {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        } else if (currentUtterance && !speechSynthesis.speaking) {
            speechSynthesis.speak(currentUtterance);
        }
    });
    pause.addEventListener('click', () => {
        if (speechSynthesis.speaking) {
            speechSynthesis.pause();
        }
    });
    stop.addEventListener('click', () => {
        stopTTS();
    });
    search.addEventListener('click', () => {
        speechSynthesis.cancel();
        resetHighlighting();
        clearHighlight();
        pickContainer((nextContainer) => {
            highlightAndSpeak(nextContainer);
        });
    });
    voiceSelector.addEventListener('change', (event) => {
        const [voiceName, lang] = event.target.value.split(' | ');
        speechSynthesis.cancel();
        resetHighlighting();
        clearHighlight();
        if (currentUtterance) {
            applyVoice(currentUtterance, voiceName, lang);
            speechSynthesis.speak(currentUtterance);
        }
    });
};

const pickContainer = (onPick) => {
    let picked = false;
    const overlay = document.createElement('div');
    overlay.style.pointerEvents = 'none';
    overlay.style.position = 'fixed';
    overlay.style.border = '2px solid #ff9800';
    overlay.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.12)';
    overlay.style.background = 'rgba(255, 152, 0, 0.18)';
    overlay.style.zIndex = '9999999999999999998';

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

    const positionOverlay = (el) => {
        const rect = el.getBoundingClientRect();
        overlay.style.display = 'block';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
    };
    overlay.style.display = 'none';

    const cleanup = () => {
        overlay.remove();
        hint.remove();
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeydown, true);
    };

    const onMove = (event) => {
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (!el) {
            return;
        }
        const target = el.closest(
            'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, article, section, div'
        );
        if (target && target.textContent.trim()) {
            positionOverlay(target);
        }
    };

    const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (!el) {
            return;
        }
        const target = el.closest(
            'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, article, section, div'
        );
        picked = true;
        cleanup();
        onPick(target);
    };

    const onKeydown = (event) => {
        if (event.key === 'Escape') {
            picked = true;
            cleanup();
            onPick(findContentContainer(DEFAULT_SELECTOR));
        }
    };

    document.body.appendChild(overlay);
    document.body.appendChild(hint);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown, true);
};

injectControls();
