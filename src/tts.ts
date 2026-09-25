import { highlight, unhighlight } from './highlight';
import {
  getActiveWordIndex,
  setActiveWordIndex,
  getCurrentUtterance,
  getCurrentAllWords,
  resetHighlighting,
} from './state';

// ============================================================
// Speech synthesis (TTS)
// ============================================================

const computeWordOffsets = (
  allWords: HTMLSpanElement[],
  fullText: string,
): number[] => {
  const wordOffsets: number[] = [];
  let charPos = 0;
  for (const span of allWords) {
    const text = span.textContent ?? '';
    while (charPos < fullText.length && fullText[charPos] === ' ') {
      charPos++;
    }
    wordOffsets.push(fullText.indexOf(text, charPos));
    charPos += text.length;
  }
  return wordOffsets;
};

const buildUtteranceText = (allWords: HTMLSpanElement[]): string =>
  allWords
    .map((span) => span.textContent ?? '')
    .join(' ')
    .trim();

const wordIndexForCharIndex = (wordOffsets: number[], charIndex: number) => {
  let wordIndex = 0;
  for (let index = 0; index < wordOffsets.length; index++) {
    if (wordOffsets[index]! <= charIndex) {
      wordIndex = index;
    } else {
      break;
    }
  }
  return wordIndex;
};

const setActiveWord = (wordIndex: number, allWords: HTMLSpanElement[]) => {
  const currentIndex = getActiveWordIndex();
  if (currentIndex >= 0 && currentIndex < allWords.length) {
    unhighlight(allWords[currentIndex]!);
  }
  if (wordIndex < allWords.length) {
    highlight(allWords[wordIndex]!);
    setActiveWordIndex(wordIndex);
  }
};

const onBoundary = (
  event: SpeechSynthesisEvent,
  wordOffsets: number[],
  allWords: HTMLSpanElement[],
) => {
  if (event.name !== 'word') {
    return;
  }
  const wordIndex = wordIndexForCharIndex(wordOffsets, event.charIndex);
  setActiveWord(wordIndex, allWords);
};

const onUtteranceError = (event: SpeechSynthesisErrorEvent): void => {
  if (event.error === 'canceled' || event.error === 'interrupted') {
    return;
  }
  console.error('Speech synthesis error', event.error, event);
};

const onUtteranceEnd = (allWords: HTMLSpanElement[]): void => {
  setActiveWordIndex(0);
  allWords.forEach((word) => {
    unhighlight(word);
  });
};

export const configureUtterance = ({
  allWords,
  rate,
}: {
  allWords: HTMLSpanElement[];
  rate: number;
}): SpeechSynthesisUtterance => {
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

export const applyVoice = (
  utterance: SpeechSynthesisUtterance,
  voiceName: string,
  lang: string,
): void => {
  const voice = speechSynthesis
    .getVoices()
    .find(({ name }) => name === voiceName);
  utterance.voice = voice ?? null;
  utterance.lang = lang;
};

export const englishVoices = (): SpeechSynthesisVoice[] =>
  speechSynthesis.getVoices().filter(({ lang }) => lang === 'en-US');

// ============================================================
// TTS lifecycle (play / pause / stop)
// ============================================================

const clearHighlight = (): void => {
  getCurrentAllWords().forEach(unhighlight);
};

export const stopTTS = (): void => {
  speechSynthesis.cancel();
  resetHighlighting();
  clearHighlight();
};

const getActiveUtterance = (): SpeechSynthesisUtterance | null =>
  getCurrentUtterance() && !speechSynthesis.speaking
    ? getCurrentUtterance()
    : null;

export const playTTS = (): void => {
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
    return;
  }
  const utterance = getActiveUtterance();
  if (utterance) {
    speechSynthesis.speak(utterance);
  }
};

export const pauseTTS = (): void => {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
};
