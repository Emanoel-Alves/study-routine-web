import { reactive } from "vue";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export const confirmDialogState = reactive({
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  danger: false,
});

let settleConfirmation: ((confirmed: boolean) => void) | null = null;

export function requestConfirmation(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  if (settleConfirmation) settleConfirmation(false);

  confirmDialogState.title = options.title;
  confirmDialogState.message = options.message;
  confirmDialogState.confirmLabel = options.confirmLabel ?? "Confirmar";
  confirmDialogState.cancelLabel = options.cancelLabel ?? "Cancelar";
  confirmDialogState.danger = options.danger ?? false;
  confirmDialogState.isOpen = true;

  return new Promise((resolve) => {
    settleConfirmation = resolve;
  });
}

export function resolveConfirmation(confirmed: boolean): void {
  confirmDialogState.isOpen = false;
  const settle = settleConfirmation;
  settleConfirmation = null;
  settle?.(confirmed);
}
