<script setup lang="ts">
import { computed } from "vue";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";

export interface OldBlogFilterOption {
  label: string;
  value: string;
  count?: number;
}

const model = defineModel<string>({ required: true });

const props = defineProps<{
  label: string;
  options: OldBlogFilterOption[];
}>();

const selectedOption = computed(() => props.options.find((item) => item.value === model.value) ?? props.options[0]);
</script>

<template>
  <label class="oldblog-field">
    <span>{{ label }}</span>
    <Listbox v-model="model">
      <div class="oldblog-listbox">
        <ListboxButton class="oldblog-listbox__button">
          <span class="oldblog-listbox__text">{{ selectedOption?.label }}</span>
          <span class="oldblog-listbox__icon" aria-hidden="true">
            <svg viewBox="0 0 12 12">
              <path d="M2.25 4.5 6 8.25 9.75 4.5" />
            </svg>
          </span>
        </ListboxButton>

        <Transition name="oldblog-listbox">
          <ListboxOptions class="oldblog-listbox__options" as="ul">
            <ListboxOption
              v-for="item in options"
              :key="item.value"
              :value="item.value"
              as="li"
              v-slot="{ active, selected }"
            >
              <div
                class="oldblog-listbox__option"
                :class="{
                  'is-active': active,
                  'is-selected': selected,
                }"
              >
                <span>{{ item.label }}</span>
                <small v-if="item.count !== undefined">{{ item.count }}</small>
              </div>
            </ListboxOption>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  </label>
</template>
