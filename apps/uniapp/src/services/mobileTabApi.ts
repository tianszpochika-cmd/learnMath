import { getMobileHttp } from "./mobileClient";

const root = "/api/app/v1";
export const mobileTabApi = {
  home: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/user/home" }),
  profile: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/user/profile" }),
  checkin: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/checkin" }),
  submitCheckin: () => getMobileHttp().request<unknown>({ method: "POST", path: root + "/checkin" }),
  paths: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/paths" }),
  dailyTasks: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/daily-tasks" }),
  wrongbook: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/wrongbook", query: { page: 1, size: 1 } }),
  attempts: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/attempts", query: { page: 1, size: 3 } }),
  posts: (sort: "latest" | "featured", page = 1) => getMobileHttp().request<unknown>({ method: "GET", path: root + "/community/posts", query: { sort, page, size: 20 } }),
  mine: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/community/mine" }),
  hot: () => getMobileHttp().request<unknown>({ method: "GET", path: root + "/community/hot" }),
};
