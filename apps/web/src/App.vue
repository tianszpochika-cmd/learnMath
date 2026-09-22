<script setup lang="ts">
// WD1 骨架（16 §2）：顶部导航 + 内容区（无侧栏）
</script>

<template>
  <div class="shell">
    <header class="nav">
      <RouterLink to="/" class="brand"><i>π</i>数源 MathOrigin</RouterLink>
      <nav class="links">
        <RouterLink to="/paths">路径</RouterLink>
        <RouterLink to="/graph">图谱</RouterLink>
        <RouterLink to="/community">社区</RouterLink>
        <RouterLink to="/formulas">公式馆</RouterLink>
      </nav>
      <div class="right">
        <span class="kbd">🔍 Ctrl K</span>
        <span class="bell">🔔</span>
        <span class="avatar">A</span>
      </div>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.nav {
  height: var(--nav-h);
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 30;
}
.brand {
  display: flex;
  gap: 9px;
  align-items: center;
  font-weight: 800;
  font-size: 16.5px;
  color: var(--ink);
  text-decoration: none;
}
.brand i {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-style: italic;
}
.links {
  display: flex;
  gap: 26px;
}
.links a {
  color: var(--ink2);
  text-decoration: none;
  font-size: 14.5px;
}
.links a.router-link-active {
  color: var(--brand);
  font-weight: 600;
}
.right {
  margin-left: auto;
  display: flex;
  gap: 16px;
  align-items: center;
}
.kbd {
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 4px 10px;
  color: var(--ink3);
}
.bell {
  cursor: pointer;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--grad);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 14px;
}
.content {
  flex: 1;
}
</style>
