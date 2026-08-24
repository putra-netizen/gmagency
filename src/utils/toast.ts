/**
 * Custom modern toast notification event emitter.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warn';

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
  warn(message: string, duration = 3500) {
    window.dispatchEvent(
      new CustomEvent<ToastEventDetail>('gm-toast', {
        detail: { message, type: 'warn', duration },
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
