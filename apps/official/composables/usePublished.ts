interface ApiEnvelope<T> {
  code: number;
  data: T | null;
  message?: string;
}

export interface PublishedState<T> {
  value: T | null;
  available: boolean;
}

export function usePublished<T>(key: string, path: string, query?: Record<string, string | number | undefined>) {
  return useAsyncData<PublishedState<T>>(key, async () => {
    try {
      const result = await $fetch<ApiEnvelope<T>>("/api/public/" + path.replace(/^\//, ""), { query });
      if (result.code !== 0) return { value: null, available: false };
      return { value: result.data, available: true };
    } catch {
      return { value: null, available: false };
    }
  });
}
