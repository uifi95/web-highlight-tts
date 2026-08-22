// ============================================================
// Shared TTS session state + lifecycle
// ============================================================

let currentIndex = 0;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAllWords: HTMLSpanElement[] = [];
let currentContainer: Element | null = null;

export const getActiveWordIndex = (): number => currentIndex;

export const setActiveWordIndex = (index: number): void => {
    currentIndex = index;
};

export const getCurrentUtterance = (): SpeechSynthesisUtterance | null =>
    currentUtterance;

export const setCurrentUtterance = (
    utterance: SpeechSynthesisUtterance | null,
): void => {
    currentUtterance = utterance;
};

export const getCurrentAllWords = (): HTMLSpanElement[] => currentAllWords;

export const setCurrentAllWords = (words: HTMLSpanElement[]): void => {
    currentAllWords = words;
};

export const getCurrentContainer = (): Element | null => currentContainer;

export const setCurrentContainer = (container: Element | null): void => {
    currentContainer = container;
};

export const resetHighlighting = (): void => {
    currentIndex = 0;
};
