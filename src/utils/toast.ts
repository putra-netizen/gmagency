/**
 * Custom modern toast notification event emitter.
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastEventDetail {
  message: string;
  type: ToastType;
  duration?: number;
}

export const toast = {
  success(message: string, duration = 3000) {
    window.dispatchEvent(
      new CustomEvent<ToastEventDetail>('gm-toast', {
        detail: { message, type: 'success', duration },
      })
    );
  },
  error(message: string, duration = 4000) {
    window.dispatchEvent(
      new CustomEvent<ToastEventDetail>('gm-toast', {
        detail: { message, type: 'error', duration },
      })
    );
  },
  info(message: string, duration = 3000) {
    window.dispatchEvent(
      new CustomEvent<ToastEventDetail>('gm-toast', {
        detail: { message, type: 'info', duration },
      })
    );
  },
};
