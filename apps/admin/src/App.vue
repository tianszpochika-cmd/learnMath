<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { menuSections, type MenuItem } from "./features/adminShell";

/** AD1 骨架（17 §2）：左菜单 220（可折叠 64）+ 顶栏（面包屑/未读/头像）。 */
const route = useRoute();
const router = useRouter();
const collapsed = ref(false);

const sections = menuSections();
const flat: MenuItem[] = sections.flatMap((s) => s.items);
const crumbs = computed(() => {
  const current = flat.find((i) => i.name === route.name);
  return current ? `数源管理端 / ${current.label}` : `数源管理端 / ${(route.meta.title as string) || ""}`;
});
const activeName = computed(() => String(route.name ?? ""));

function logout(): void {
  void router.push("/login");
}
</script>

<template>
  <div class="shell" :class="{ collapsed }">
    <aside class="menu">
      <div class="mlogo"><i>π</i><span v-if="!collapsed">数源管理端</span></div>
      <template v-for="s in sections" :key="s.group">
        <div v-if="!collapsed" class="mgrp">{{ s.group }}</div>
        <div
          v-for="item in s.items"
          :key="item.name"
          class="mi"
          :class="{ on: activeName === item.name }"
          :title="item.label"
          @click="router.push(item.path)"
        >
          <span class="ico">{{ item.label.slice(0, 1) }}</span>
          <span v-if="!collapsed" class="lbl">{{ item.label }}</span>
          <span v-if="item.star && !collapsed" class="star">自研</span>
        </div>
      </template>
    </aside>

    <div class="main">
      <header class="top">
        <span class="fold" @click="collapsed = !collapsed">☰</span>
        <span class="crumb">{{ crumbs }}</span>
        <div class="right">
          <span class="bell">🔔<i class="badge">15</i></span>
          <span class="ava" @click="logout">管</span>
        </div>
      </header>
      <main class="body">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}
.menu {
  width: 220px;
  flex: none;
  background: #fff;
  border-right: 1px solid var(--line);
  padding-bottom: 24px;
  transition: width 0.2s;
  overflow-y: auto;
}
.shell.collapsed .menu {
  width: 64px;
}
.mlogo {
  display: flex;
  gap: 9px;
  align-items: center;
  padding: 16px;
  font-weight: 800;
  font-size: 15px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 6px;
  white-space: nowrap;
}
.mlogo i {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 8px;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-style: italic;
}
.mgrp {
  font-size: 10.5px;
  color: var(--ink3);
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 14px 16px 5px;
}
.mi {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--ink2);
  white-space: nowrap;
}
.mi:hover {
  background: #f3f6fb;
  color: var(--brand);
}
.mi.on {
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-weight: 700;
  border-right: 3px solid var(--brand);
}
.mi .ico {
  width: 22px;
  text-align: center;
  font-weight: 800;
  font-size: 12.5px;
}
.mi .star {
  margin-left: auto;
  font-size: 9.5px;
  background: var(--grad);
  color: #fff;
  border-radius: 5px;
  padding: 1px 6px;
  font-weight: 800;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.top {
  height: 50px;
  background: #fff;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 18px;
}
.fold {
  cursor: pointer;
  font-size: 17px;
  color: var(--ink2);
}
.crumb {
  font-size: 13px;
  color: var(--ink2);
}
.right {
  margin-left: auto;
  display: flex;
  gap: 16px;
  align-items: center;
}
.bell {
  position: relative;
  cursor: pointer;
}
.badge {
  position: absolute;
  top: -6px;
  right: -9px;
  background: #ef4444;
  color: #fff;
  font-style: normal;
  font-size: 10.5px;
  border-radius: 99px;
  padding: 1px 7px;
  font-weight: 700;
}
.ava {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
}
.body {
  flex: 1;
  padding: 16px 18px;
  overflow-y: auto;
}
</style>
