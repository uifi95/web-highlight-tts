import { closest } from './dom';
import { findContentContainer, DEFAULT_SELECTOR } from './content';

// ============================================================
// Container picking (overlay)
// ============================================================

const createOverlay = (): HTMLDivElement => {
  const overlay = document.createElement('div');
  overlay.style.pointerEvents = 'none';
  overlay.style.position = 'fixed';
  overlay.style.border = '2px solid #ff9800';
  overlay.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.12)';
  overlay.style.background = 'rgba(255, 152, 0, 0.18)';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'none';
  return overlay;
};

const createPickerHint = (): HTMLDivElement => {
  const hint = document.createElement('div');
  hint.textContent =
    'Click a block to read from there · Press Esc for auto-detect';
  hint.style.position = 'fixed';
  hint.style.bottom = '20px';
  hint.style.left = '50%';
  hint.style.transform = 'translateX(-50%)';
  hint.style.background = 'rgba(0,0,0,0.8)';
  hint.style.color = '#fff';
  hint.style.padding = '8px 14px';
  hint.style.borderRadius = '8px';
  hint.style.font = '14px system-ui, sans-serif';
  hint.style.zIndex = '2147483647';
  return hint;
};

const positionOverlay = (overlay: HTMLDivElement, element: Element): void => {
  const rect = element.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
};

const pickTargetFromPoint = (
  clientX: number,
  clientY: number,
): HTMLElement | null => {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) {
    return null;
  }
  const target = closest(el);
  return target && target.textContent!.trim() ? target : null;
};

interface PickerListeners {
  onMove: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
  onKeydown: (event: KeyboardEvent) => void;
}

const registerPickerListeners = ({
  onMove,
  onClick,
  onKeydown,
}: PickerListeners): (() => void) => {
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

export const pickContainer = (onPick: (target: Element) => void): void => {
  let picked = false;
  let cleanup: () => void = () => {};

  const overlay = createOverlay();
  const hint = createPickerHint();

  const onMove = (event: MouseEvent): void => {
    const target = pickTargetFromPoint(event.clientX, event.clientY);
    if (target) {
      positionOverlay(overlay, target);
    }
  };

  const finish = (target: Element): void => {
    if (picked) {
      return;
    }
    picked = true;
    cleanup();
    overlay.remove();
    hint.remove();
    onPick(target);
  };

  const onClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const target = pickTargetFromPoint(event.clientX, event.clientY);
    if (target) {
      finish(target);
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      finish(findContentContainer(DEFAULT_SELECTOR));
    }
  };

  cleanup = registerPickerListeners({ onMove, onClick, onKeydown });

  document.body.appendChild(overlay);
  document.body.appendChild(hint);
};
