<script setup lang="ts">
import { computed } from "vue";
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
    required: false,
    placeholder: "Selecione uma opção",
    ariaLabel: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

const selectedOptionIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
);
const selectedIndex = computed(() =>
  selectedOptionIndex.value < 0 ? "" : String(selectedOptionIndex.value),
);

function updateSelectedOption(index: string): void {
  const option = props.options[Number(index)];
  const value = option?.value ?? "";
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <div class="app-select">
    <SelectRoot
      :model-value="selectedIndex"
      :disabled="disabled"
      :required="required"
      @update:model-value="updateSelectedOption"
    >
      <SelectTrigger
        class="app-select-trigger"
        :aria-label="ariaLabel || undefined"
      >
        <SelectValue :placeholder="placeholder" />
        <span
          class="material-symbols-rounded app-select-chevron"
          aria-hidden="true"
        >
          expand_more
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="app-select-content"
          position="popper"
          :side-offset="4"
          align="start"
        >
          <SelectViewport class="app-select-viewport">
            <SelectItem
              v-for="(option, index) in options"
              :key="`${index}-${option.value}`"
              :value="String(index)"
              :disabled="option.disabled"
              class="app-select-item"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
              <SelectItemIndicator class="app-select-item-indicator">
                <span class="material-symbols-rounded" aria-hidden="true">
                  check
                </span>
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>
