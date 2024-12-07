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
        'button, input, select, textarea, [contenteditable], [tabindex]'
    );

const textNodeWalker = (container) =>
    document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                const parent = node.parentNode;
                if (parent.nodeType === Node.ELEMENT_NODE) {
                    const tag = parent.tagName.toLowerCase();
                    if (
                        !isVisible(parent) ||
                        isInteractive(parent) ||
                        tag === 'script' ||
                        tag === 'style'
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return node.nodeValue.trim() !== ''
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        },
        false
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
let previousCharIndex = -1;

const isOnlyPunctuation = (str) => {
    const punctuationRegex = /^[\p{P}]+$/u;
    return punctuationRegex.test(str);
};

function findNextWordIndex(textElapsed, allWords, wordIncrement) {
    let nextIndex = currentIndex - 1;
    while (
        nextIndex < currentIndex + 10 &&
        !textElapsed.includes(allWords[nextIndex].innerText)
    ) {
        nextIndex++;
    }

    if (nextIndex === currentIndex + 10) {
        nextIndex = currentIndex + wordIncrement;
    }
    return nextIndex;
}

const resetHighlighting = () => {
    currentIndex = 0;
    previousCharIndex = -1;
};

const configureUtterance = ({ allWords, rate }) => {
    const fullText = allWords
        .map((span) => span.textContent)
        .join(' ')
        .trim();

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = rate;

    let wordIncrement;

    utterance.addEventListener('boundary', (event) => {
        if (event.name === 'word') {
            wordIncrement = 1;

            if (previousCharIndex >= 0) {
                const textElapsed = fullText
                    .slice(previousCharIndex, event.charIndex)
                    .trim();

                if (isOnlyPunctuation(textElapsed)) {
                    return;
                }

                wordIncrement = textElapsed.split(' ').length;

                let nextIndex = findNextWordIndex(
                    textElapsed,
                    allWords,
                    wordIncrement
                );

                if (nextIndex - currentIndex > 0) {
                    wordIncrement = nextIndex - currentIndex;
                }
            }
            previousCharIndex = event.charIndex;

            const currentWord = allWords[currentIndex];

            if (currentIndex >= 0) {
                unhighlight(currentWord);
            }

            const nextWord = allWords[currentIndex + wordIncrement];

            if (currentIndex < allWords.length - wordIncrement) {
                highlight(nextWord);
            }
            currentIndex += wordIncrement;
        } else {
            console.log(event);
        }
    });

    utterance.addEventListener('error', console.log);

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

const highlightAndSpeak = (container) => {
    const textNodes = [];
    const walker = textNodeWalker(container);

    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    const allWords = prepareText(textNodes);
    const utterance = configureUtterance({ allWords, rate: 1 });

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

const injectControls = (utterance) => {
    const play = document.createElement('button');
    play.innerText = '▶️';

    const pause = document.createElement('button');
    pause.innerText = '⏸️';

    const voiceSelector = document.createElement('select');
    populateVoiceOptions(voiceSelector);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '4px';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999999999999999999';
    container.replaceChildren(play, pause, voiceSelector);

    document.body.appendChild(container);
    play.addEventListener('click', () => {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        }
    });
    pause.addEventListener('click', () => {
        if (speechSynthesis.speaking) {
            speechSynthesis.pause();
        }
    });
    voiceSelector.addEventListener('change', (event) => {
        const [voiceName, lang] = event.target.value.split(' | ');
        const voice = speechSynthesis
            .getVoices()
            .find(({ name }) => name === voiceName);
        utterance.voice = voice;
        utterance.lang = lang;
        speechSynthesis.cancel();
        resetHighlighting();
        speechSynthesis.speak(utterance);
    });
};

const startTTS = (container) => {
    const utterance = highlightAndSpeak(container);
    setTimeout(() => injectControls(utterance), 200);
};

// Usage: Run this in dev tools, replacing 'body' with your desired selector
const selector = 'body';
const container = document.querySelector(selector);

startTTS(container);
