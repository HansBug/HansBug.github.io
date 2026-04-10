<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";

import OldBlogFilterSelect, { type OldBlogFilterOption } from "./OldBlogFilterSelect.vue";
import type { OldBlogCatalog, OldBlogPost } from "../data/oldBlogCatalog";

type SearchablePost = OldBlogPost & {
  searchText: string;
};

const props = defineProps<{
  catalog: OldBlogCatalog;
}>();

const initialLimit = 24;
const defaultSortKey = "views-desc";
const numberFormatter = new Intl.NumberFormat("zh-CN");

const query = ref("");
const selectedYear = ref("all");
const selectedCategory = ref("all");
const selectedTrack = ref("all");
const selectedSort = ref(defaultSortKey);
const limit = ref(initialLimit);
const yearChartCanvas = ref<HTMLCanvasElement | null>(null);

const searchablePosts: SearchablePost[] = props.catalog.posts.map((item) => ({
  ...item,
  searchText: [item.title, item.summary, item.categories.join(" "), item.track, item.date].join(" ").toLowerCase(),
}));

const years = [...new Set(props.catalog.posts.map((post) => post.year))].sort((left, right) => right - left);

const shortcutCategories = computed(() => props.catalog.categories.slice(0, 18));

const yearOptions = computed<OldBlogFilterOption[]>(() => [
  { label: "全部年份", value: "all" },
  ...years.map((year) => ({ label: `${year} 年`, value: String(year) })),
]);

const categoryOptions = computed<OldBlogFilterOption[]>(() => [
  { label: "全部分类", value: "all" },
  ...props.catalog.categories.map((category) => ({
    label: category.name,
    value: category.name,
    count: category.count,
  })),
]);

const trackOptions = computed<OldBlogFilterOption[]>(() => [
  { label: "全部归纳", value: "all" },
  ...props.catalog.trackCounts.map((track) => ({
    label: track.name,
    value: track.name,
    count: track.count,
  })),
]);

const sortOptions: OldBlogFilterOption[] = [
  { label: "按热度", value: "views-desc" },
  { label: "按评论数", value: "comments-desc" },
  { label: "按时间倒序", value: "date-desc" },
  { label: "按时间正序", value: "date-asc" },
];

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const filteredEntries = computed(() =>
  searchablePosts
    .map((item) => {
      let score = 0;

      if (!normalizedQuery.value) {
        score = 1;
      } else {
        if (item.title.toLowerCase().includes(normalizedQuery.value)) score += 8;
        if (item.categories.join(" ").toLowerCase().includes(normalizedQuery.value)) score += 5;
        if (item.track.toLowerCase().includes(normalizedQuery.value)) score += 4;
        if (item.summary.toLowerCase().includes(normalizedQuery.value)) score += 2;
        if (item.searchText.includes(normalizedQuery.value)) score += 1;
      }

      return { item, score };
    })
    .filter(({ item, score }) => {
      if (score <= 0) return false;
      if (selectedYear.value !== "all" && String(item.year) !== selectedYear.value) return false;
      if (selectedCategory.value !== "all" && !item.categories.includes(selectedCategory.value)) return false;
      if (selectedTrack.value !== "all" && item.track !== selectedTrack.value) return false;
      return true;
    }),
);

const sortedEntries = computed(() => {
  const entries = [...filteredEntries.value];

  const sorters = {
    "date-desc": (left: (typeof entries)[number], right: (typeof entries)[number]) =>
      right.item.dateTime.localeCompare(left.item.dateTime),
    "date-asc": (left: (typeof entries)[number], right: (typeof entries)[number]) =>
      left.item.dateTime.localeCompare(right.item.dateTime),
    "views-desc": (left: (typeof entries)[number], right: (typeof entries)[number]) =>
      right.item.views - left.item.views || right.item.dateTime.localeCompare(left.item.dateTime),
    "comments-desc": (left: (typeof entries)[number], right: (typeof entries)[number]) =>
      right.item.comments - left.item.comments ||
      right.item.views - left.item.views ||
      right.item.dateTime.localeCompare(left.item.dateTime),
  };

  return entries.sort((left, right) => {
    if (normalizedQuery.value && right.score !== left.score) {
      return right.score - left.score;
    }
    return sorters[selectedSort.value as keyof typeof sorters](left, right);
  });
});

const visiblePosts = computed(() => sortedEntries.value.slice(0, limit.value).map(({ item }) => item));
const filteredCount = computed(() => sortedEntries.value.length);
const filteredViews = computed(() => sortedEntries.value.reduce((sum, entry) => sum + entry.item.views, 0));
const showLoadMore = computed(() => filteredCount.value > visiblePosts.value.length);

const countText = computed(
  () => `当前筛出 ${filteredCount.value} 篇，累计阅读 ${numberFormatter.format(filteredViews.value)}。`,
);

const hintText = computed(() =>
  filteredCount.value > 0
    ? `已展示 ${visiblePosts.value.length} / ${filteredCount.value} 篇。标题会直接在新标签页打开博客园原文。`
    : "没有找到匹配结果，可以换更短的关键词，或者先按年份和分类缩小范围。",
);

function resetFilters() {
  query.value = "";
  selectedYear.value = "all";
  selectedCategory.value = "all";
  selectedTrack.value = "all";
  selectedSort.value = defaultSortKey;
  limit.value = initialLimit;
}

function loadMore() {
  limit.value += initialLimit;
}

function applyCategoryShortcut(category: string) {
  selectedCategory.value = category;
}

watch([query, selectedYear, selectedCategory, selectedTrack, selectedSort], () => {
  limit.value = initialLimit;
});

let yearChart: Chart<"bar", number[], string> | null = null;

onMounted(() => {
  const canvas = yearChartCanvas.value;
  if (!canvas) return;

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent").trim() || "#d65e45";
  const accentSoft = styles.getPropertyValue("--accent-soft").trim() || "rgba(214, 94, 69, 0.1)";
  const line = styles.getPropertyValue("--line").trim() || "rgba(25, 30, 35, 0.1)";
  const textMuted = styles.getPropertyValue("--text-muted").trim() || "#5c656e";

  yearChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: props.catalog.yearlyTrend.map((item) => String(item.year)),
      datasets: [
        {
          data: props.catalog.yearlyTrend.map((item) => item.count),
          backgroundColor: accent,
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 12,
          hoverBackgroundColor: "#171c21",
        },
      ],
    },
    options: {
      animation: false,
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          backgroundColor: "rgba(17, 21, 25, 0.94)",
          bodyFont: {
            family: "IBM Plex Sans",
          },
          callbacks: {
            label(context) {
              return `${context.raw} 篇`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: line,
          },
          ticks: {
            color: textMuted,
            font: {
              family: "IBM Plex Sans",
              size: 11,
            },
            precision: 0,
          },
        },
        y: {
          border: {
            display: false,
          },
          grid: {
            display: false,
          },
          ticks: {
            color: textMuted,
            font: {
              family: "IBM Plex Sans",
              size: 12,
            },
          },
        },
      },
    },
    plugins: [
      {
        id: "chartAreaBackground",
        beforeDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          ctx.save();
          ctx.fillStyle = accentSoft;
          ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
          ctx.restore();
        },
      },
    ],
  });
});

onBeforeUnmount(() => {
  yearChart?.destroy();
});
</script>

<template>
  <div class="oldblog-explorer page-grid">
    <div class="grid-two oldblog-insights">
      <article class="oldblog-panel shell-card">
        <h3 class="oldblog-panel__title">年度趋势</h3>
        <p class="oldblog-panel__description">从年度看，旧站明显分成前期高密度积累和后期专题化写作两个阶段。</p>
        <div class="oldblog-yearchart-shell">
          <canvas ref="yearChartCanvas" class="oldblog-yearchart" aria-label="旧站年度趋势图"></canvas>
        </div>
      </article>

      <article class="oldblog-panel shell-card">
        <h3 class="oldblog-panel__title">分类脉络</h3>
        <p class="oldblog-panel__description">这里直接用博客园旧站的真实随笔分类。点下面任一分类，会直接筛本页全量目录。</p>
        <div class="oldblog-category-cloud">
          <button
            v-for="item in shortcutCategories"
            :key="item.name"
            type="button"
            class="oldblog-filter-chip"
            @click="applyCategoryShortcut(item.name)"
          >
            <span>{{ item.name }}</span>
            <small>{{ item.count }}</small>
          </button>
        </div>
      </article>
    </div>

    <section class="oldblog-search shell-card">
      <div class="oldblog-filter-grid">
        <label class="oldblog-field oldblog-field--wide">
          <span>检索旧文</span>
          <input
            v-model="query"
            class="search-input"
            type="search"
            placeholder="输入标题、分类、主题或关键词，例如：treevalue、软工、前端、算法"
          />
        </label>

        <OldBlogFilterSelect v-model="selectedYear" label="年份" :options="yearOptions" />
        <OldBlogFilterSelect v-model="selectedCategory" label="旧站分类" :options="categoryOptions" />
        <OldBlogFilterSelect v-model="selectedTrack" label="归纳方向" :options="trackOptions" />
        <OldBlogFilterSelect v-model="selectedSort" label="排序" :options="sortOptions" />
      </div>

      <div class="oldblog-search__meta">
        <p class="oldblog-search__count">{{ countText }}</p>
        <button type="button" class="hero-action" @click="resetFilters">重置筛选</button>
      </div>

      <div class="oldblog-results">
        <article v-for="post in visiblePosts" :key="post.id" class="oldblog-result">
          <div class="oldblog-result__head">
            <h3 class="oldblog-linked-title">
              <a :href="post.url" target="_blank" rel="noreferrer">{{ post.title }}</a>
            </h3>
            <div class="oldblog-result__meta">
              <span class="tag-chip is-slate"><span>发布于 {{ post.date }}</span></span>
              <span class="tag-chip is-blue"><span>阅读 {{ numberFormatter.format(post.views) }}</span></span>
              <span class="tag-chip is-orange"><span>评论 {{ post.comments }}</span></span>
            </div>
          </div>
          <p class="oldblog-result__summary">
            {{ post.summary || "旧站原文已保留，这里只展示索引信息与概述。" }}
          </p>
          <div class="tag-row oldblog-result__tags">
            <span class="tag-chip is-red"><span>{{ post.track }}</span></span>
            <template v-if="post.categories.length > 0">
              <span v-for="category in post.categories" :key="`${post.id}-${category}`" class="tag-chip is-slate">
                <span>{{ category }}</span>
              </span>
            </template>
            <span v-else class="tag-chip is-slate"><span>未挂旧站分类</span></span>
          </div>
        </article>

        <article v-if="visiblePosts.length === 0" class="oldblog-result oldblog-result--empty">
          <h3>没有找到匹配结果</h3>
          <p>可以试试更短的关键词，或者先切回“全部年份 / 全部分组”再继续找。</p>
        </article>
      </div>

      <div class="oldblog-search__footer">
        <p class="oldblog-search__hint">{{ hintText }}</p>
        <button v-if="showLoadMore" type="button" class="hero-action" @click="loadMore">查看更多</button>
      </div>
    </section>
  </div>
</template>
