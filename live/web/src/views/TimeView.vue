<template>
  <AppLayout active-site="form.site">
    <div class="time-page">
      <header class="time-header">
        <h1>解析耗时</h1>
        <p class="time-sub">调用 <code>/api/time</code>，对比冷解析与缓存命中耗时。</p>
      </header>

      <section class="time-panel">
        <div class="time-form">
          <label class="time-field">
            <span>平台</span>
            <select v-model="form.site">
              <option v-for="p in enabledPlatforms" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </label>
          <label class="time-field">
            <span>房间号</span>
            <input v-model="form.room" type="text" inputmode="numeric" placeholder="252140">
          </label>
          <label class="time-field">
            <span>清晰度</span>
            <input v-model="form.quality" type="text" placeholder="可选，如 蓝光4M">
          </label>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="loadCache">
            刷新缓存
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="runBench">
            {{ loading ? "测试中…" : "运行基准" }}
          </button>
        </div>

        <p v-if="error" class="time-msg time-msg--err">{{ error }}</p>
        <p v-if="report?.server_time" class="time-meta">服务端时间 {{ formatTime(report.server_time) }}</p>
      </section>

      <section v-if="report?.cache" class="time-panel">
        <h2 class="panel-title">缓存状态</h2>
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-label">条目数</span>
            <strong>{{ report.cache.entries }} / {{ report.cache.max_entries }}</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">meta TTL</span>
            <strong>{{ report.cache.ttl_sec.meta }}s</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">tier TTL</span>
            <strong>{{ report.cache.ttl_sec.tier }}s</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">payload TTL</span>
            <strong>{{ report.cache.ttl_sec.payload }}s</strong>
          </div>
        </div>
      </section>

      <section v-if="report?.benchmark" class="time-panel">
        <h2 class="panel-title">
          基准结果 · {{ report.benchmark.site }} / {{ report.benchmark.room }}
          <span v-if="report.benchmark.quality" class="muted"> · {{ report.benchmark.quality }}</span>
        </h2>
        <div class="table-wrap scrolly">
          <table class="time-table">
            <thead>
              <tr>
                <th>场景</th>
                <th>墙钟</th>
                <th>total</th>
                <th>meta</th>
                <th>tier</th>
                <th>缓存</th>
                <th>主播</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.benchmark.runs" :key="row.label">
                <td>
                  <strong>{{ row.label }}</strong>
                  <span class="row-desc">{{ row.desc }}</span>
                </td>
                <td>{{ row.wall_ms }}ms</td>
                <td>{{ timingCell(row, "total_ms") }}</td>
                <td>{{ timingCell(row, "meta_ms") }}</td>
                <td>{{ timingCell(row, "tier_ms") }}</td>
                <td>{{ cacheFlags(row) }}</td>
                <td>{{ row.error || row.anchor || "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="time-panel time-panel--hint">
        <h2 class="panel-title">API</h2>
        <pre class="api-snippet">{{ apiExample }}</pre>
      </section>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { fetchTimeReport } from "../api/time.js";
import { PLATFORMS } from "../config/platforms";

const enabledPlatforms = PLATFORMS.filter((p) => p.enabled);
const form = reactive({
  site: "douyu",
  room: "252140",
  quality: "",
});
const loading = ref(false);
const error = ref("");
const report = ref(null);

const apiExample = computed(() => {
  const q = new URLSearchParams({ site: form.site, room: form.room, run: "1" });
  if (form.quality) q.set("quality", form.quality);
  return `GET /api/time?${q.toString()}`;
});

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function timingCell(row, key) {
  const val = row.timing?.[key];
  return val == null ? "—" : `${val}ms`;
}

function cacheFlags(row) {
  const parts = [];
  if (row.payload_cached) parts.push("payload");
  if (row.cached_meta) parts.push("meta");
  if (row.cached_tier) parts.push("tier");
  if (row.cached && !parts.length) parts.push("cached");
  return parts.length ? parts.join(", ") : "—";
}

async function loadCache() {
  loading.value = true;
  error.value = "";
  try {
    report.value = await fetchTimeReport({
      site: form.site,
      room: form.room,
      quality: form.quality,
      run: false,
    });
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function runBench() {
  loading.value = true;
  error.value = "";
  try {
    report.value = await fetchTimeReport({
      site: form.site,
      room: form.room,
      quality: form.quality,
      run: true,
    });
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadCache);
</script>

<style scoped>
.time-page {
  max-width: 960px;
  margin: 0 auto;
  padding: .5rem .75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.time-header h1 {
  margin: 0;
  font-size: 1.25rem;
}

.time-sub {
  margin: .35rem 0 0;
  color: var(--muted);
  font-size: .88rem;
}

.time-sub code {
  font-size: .85em;
  color: var(--amber);
}

.time-panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
}

.panel-title {
  margin: 0 0 .75rem;
  font-size: 1rem;
}

.time-form {
  display: grid;
  gap: .75rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  align-items: end;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  font-size: .82rem;
  color: var(--muted);
}

.time-field input,
.time-field select {
  width: 100%;
}

.time-msg {
  margin: .75rem 0 0;
  font-size: .88rem;
}

.time-msg--err {
  color: var(--danger);
}

.time-meta {
  margin: .5rem 0 0;
  font-size: .78rem;
  color: var(--muted);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: .75rem;
}

.stat-card {
  background: var(--bg-soft);
  border-radius: 10px;
  padding: .65rem .75rem;
  display: flex;
  flex-direction: column;
  gap: .25rem;
}

.stat-label {
  font-size: .75rem;
  color: var(--muted);
}

.stat-card strong {
  font-size: 1.05rem;
  color: var(--amber);
}

.table-wrap {
  max-height: 320px;
}

.time-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .84rem;
}

.time-table th,
.time-table td {
  padding: .55rem .45rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.time-table th {
  color: var(--muted);
  font-weight: 600;
}

.row-desc {
  display: block;
  font-size: .72rem;
  color: var(--muted);
  margin-top: .15rem;
}

.muted {
  color: var(--muted);
  font-weight: 400;
}

.api-snippet {
  margin: 0;
  padding: .75rem;
  background: var(--bg-soft);
  border-radius: 8px;
  font-size: .82rem;
  overflow-x: auto;
  color: var(--amber);
}
</style>
