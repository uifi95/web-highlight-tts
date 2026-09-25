import { collectTextNodes } from './text';
import { prepareText, unwrapSpansIntoText } from './highlight';
import { configureUtterance, stopTTS } from './tts';
import {
  getCurrentContainer,
  getCurrentAllWords,
  setCurrentUtterance,
  setCurrentAllWords,
  setCurrentContainer,
} from './state';
import { pickContainer } from './picker';

// ============================================================
// Orchestration (speak a container)
// ============================================================

export const highlightAndSpeak = (
  container: Element,
): SpeechSynthesisUtterance => {
  if (
    getCurrentContainer() &&
    getCurrentContainer() !== container &&
    getCurrentAllWords().length
  ) {
    unwrapSpansIntoText(getCurrentAllWords());
    setCurrentAllWords([]);
  }

  const textNodes = collectTextNodes(container);
  const allWords = prepareText(textNodes);
  const utterance = configureUtterance({ allWords, rate: 1 });

  setCurrentUtterance(utterance);
  setCurrentAllWords(allWords);
  setCurrentContainer(container);

  speechSynthesis.speak(utterance);
  window.addEventListener('beforeunload', () => speechSynthesis.cancel());

  return utterance;
};

export const searchAndSpeak = (): void => {
  stopTTS();
  pickContainer((nextContainer) => {
    highlightAndSpeak(nextContainer);
  });
};
