<script setup lang="ts">
import "katex/dist/katex.min.css";
import { renderResourceMath } from "../utils/renderResourceMath";

const props = withDefaults(defineProps<{ latex: string; display?: boolean }>(), { display: false });
const rendered = computed(() => renderResourceMath(props.latex, props.display));
</script>

<template>
  <span class="resource-math" :class="{ 'resource-math-display': display }">
    <!-- v-html 的唯一来源是 KaTeX 严格模式输出，绝不接收原始服务端 HTML。 -->
    <span v-if="rendered.html" class="resource-math-rendered" v-html="rendered.html" />
    <span v-else class="resource-math-fallback">
      <span class="sr-only">公式原文：</span><code>{{ rendered.source || "公式待补全" }}</code>
    </span>
  </span>
</template>

<style scoped>
.resource-math{display:inline-block;max-width:100%;color:inherit}
.resource-math-display{display:block;overflow-x:auto;overflow-y:hidden;padding:3px 0}
.resource-math-rendered{display:inline-block;max-width:100%}
.resource-math-display .resource-math-rendered{min-width:100%;text-align:center}
.resource-math-fallback{display:inline-block;max-width:100%;overflow-wrap:anywhere;white-space:pre-wrap;font:inherit}
.resource-math-fallback code{font:inherit}
:deep(.katex-display){margin:.2em 0;overflow-x:auto;overflow-y:hidden}
:deep(.katex){color:inherit}
@media(max-width:600px){.resource-math-display :deep(.katex){font-size:.9em}}
</style>
