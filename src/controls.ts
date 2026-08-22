import {
    playTTS,
    pauseTTS,
    stopTTS,
    applyVoice,
    englishVoices,
} from './tts';
import { searchAndSpeak } from './orchestrate';
import { getCurrentUtterance } from './state';

// ============================================================
// Controls (UI)
// ============================================================

const appendVoiceOption = (
    voiceSelector: HTMLSelectElement,
    voice: SpeechSynthesisVoice,
): void => {
    const option = document.createElement('option');
    option.textContent = `${voice.name} | (${voice.lang})`;
    option.setAttribute('data-lang', voice.lang);
    option.setAttribute('data-name', voice.name);
    voiceSelector.appendChild(option);
};

const populateVoiceOptions = (voiceSelector: HTMLSelectElement): void => {
    englishVoices().forEach((voice) => appendVoiceOption(voiceSelector, voice));
};

const createIconButton = (icon: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.innerText = icon;
    button.style.cursor = 'pointer';
    return button;
};

interface Controls {
    play: HTMLButtonElement;
    pause: HTMLButtonElement;
    stop: HTMLButtonElement;
    search: HTMLButtonElement;
    voiceSelector: HTMLSelectElement;
    container: HTMLDivElement;
}

const buildControlsContainer = (): Controls => {
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
    container.style.zIndex = '2147483647';
    container.replaceChildren(play, pause, stop, search, voiceSelector);

    return { play, pause, stop, search, voiceSelector, container };
};

const applySelectedVoice = (event: Event): void => {
    const [voiceName, lang] = (
        event.target as HTMLSelectElement
    ).value.split(' | ');
    stopTTS();
    const currentUtterance = getCurrentUtterance();
    if (currentUtterance && voiceName !== undefined && lang !== undefined) {
        applyVoice(currentUtterance, voiceName, lang);
        speechSynthesis.speak(currentUtterance);
    }
};

const wireControls = ({
    play,
    pause,
    stop,
    search,
    voiceSelector,
}: Controls): void => {
    play.addEventListener('click', playTTS);
    pause.addEventListener('click', pauseTTS);
    stop.addEventListener('click', stopTTS);
    search.addEventListener('click', searchAndSpeak);
    voiceSelector.addEventListener('change', applySelectedVoice);
};

export const injectControls = (): void => {
    const controls = buildControlsContainer();
    document.body.appendChild(controls.container);
    wireControls(controls);
};
