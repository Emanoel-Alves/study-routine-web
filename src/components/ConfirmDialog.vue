<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { confirmDialogState, resolveConfirmation } from "../confirm-dialog";

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && confirmDialogState.isOpen) {
    resolveConfirmation(false);
  }
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <Transition name="confirm-dialog">
    <div
      v-if="confirmDialogState.isOpen"
      class="confirm-dialog-backdrop"
      @click.self="resolveConfirmation(false)"
    >
      <section
        class="confirm-dialog-card app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <span
          class="material-symbols-rounded confirm-dialog-icon"
          aria-hidden="true"
        >
          {{ confirmDialogState.danger ? "warning" : "help" }}
        </span>
        <h2 id="confirm-dialog-title">{{ confirmDialogState.title }}</h2>
        <p id="confirm-dialog-message">{{ confirmDialogState.message }}</p>
        <div class="confirm-dialog-actions">
          <button
            class="secondary-button"
            type="button"
            autofocus
            @click="resolveConfirmation(false)"
          >
            {{ confirmDialogState.cancelLabel }}
          </button>
          <button
            :class="
              confirmDialogState.danger ? 'danger-button' : 'primary-button'
            "
            class="confirm-dialog-confirm"
            type="button"
            @click="resolveConfirmation(true)"
          >
            {{ confirmDialogState.confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>
