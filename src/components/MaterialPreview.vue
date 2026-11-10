<script setup lang="ts">
import { computed } from "vue";
import type { Material } from "../content";

const props = defineProps<{
  material: Material;
  size?: "compact" | "large";
}>();

const nationalEmblemUrl = `${import.meta.env.BASE_URL}brazil-coat-of-arms.svg`;

function youtubeVideoId(url: string): string {
  try {
    const videoUrl = new URL(url);
    const hostname = videoUrl.hostname.toLocaleLowerCase("en-US");
    const isYouTube =
      hostname === "youtu.be" ||
      hostname.endsWith(".youtu.be") ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname.endsWith(".youtube-nocookie.com");
    if (!isYouTube) return "";

    const videoId =
      hostname === "youtu.be"
        ? videoUrl.pathname.split("/").filter(Boolean)[0]
        : (videoUrl.searchParams.get("v") ??
          videoUrl.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1]);
    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
}

const thumbnailCandidates = computed(() => {
  const videoId = youtubeVideoId(props.material.url);
  const youtubeThumbnails = videoId
    ? [
        `https://img.youtube.com/vi/${videoId}/0.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      ]
    : [];
  return [
    ...new Set(
      [props.material.thumbnailUrl, ...youtubeThumbnails].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  ];
});

function retryThumbnail(event: Event) {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement)) return;
  const fallbacks = image.dataset.fallbacks?.split("\n").filter(Boolean) ?? [];
  const nextThumbnail = fallbacks.shift();
  if (nextThumbnail) {
    image.dataset.fallbacks = fallbacks.join("\n");
    image.src = nextThumbnail;
    return;
  }
  image.hidden = true;
}
</script>

<template>
  <component
    :is="material.type === 'video' && material.url ? 'a' : 'span'"
    v-if="
      material.type === 'video' ||
      material.type === 'document' ||
      material.type === 'law'
    "
    class="material-preview"
    :class="[
      `material-preview--${size ?? 'compact'}`,
      `material-preview--${material.type}`,
    ]"
    :href="material.type === 'video' && material.url ? material.url : undefined"
    :target="material.type === 'video' && material.url ? '_blank' : undefined"
    :rel="
      material.type === 'video' && material.url
        ? 'noopener noreferrer'
        : undefined
    "
    :aria-label="
      material.type === 'video' && material.url
        ? `Assistir ${material.title} (abre em nova aba)`
        : undefined
    "
    :aria-hidden="
      material.type === 'document' || material.type === 'law'
        ? 'true'
        : undefined
    "
  >
    <span v-if="material.type === 'video'" class="material-preview-frame">
      <span class="material-symbols-rounded" aria-hidden="true">
        play_circle
      </span>
      <img
        v-if="thumbnailCandidates.length"
        :src="thumbnailCandidates[0]"
        :data-fallbacks="thumbnailCandidates.slice(1).join('\n')"
        :alt="`Miniatura: ${material.title}`"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="retryThumbnail"
      />
    </span>
    <span v-else-if="material.type === 'law'" class="material-preview-emblem">
      <img :src="nationalEmblemUrl" alt="" />
    </span>
    <span v-else class="material-symbols-rounded">description</span>
  </component>
</template>
