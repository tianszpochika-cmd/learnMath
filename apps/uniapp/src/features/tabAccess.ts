import { ensureMobileSession } from "../services/mobileClient";

export async function enterTab(load: () => Promise<void>): Promise<boolean> {
  const ready = await ensureMobileSession();
  if (!ready) { uni.reLaunch({ url: "/pages/login/index" }); return false; }
  // #ifdef H5
  uni.hideTabBar({ animation: false });
  // #endif
  await load();
  return true;
}
export function unavailable(): void { uni.showToast({ title: "此内容暂不可打开", icon: "none" }); }
