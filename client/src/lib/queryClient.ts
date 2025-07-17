import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  methodOrOptions?: string | { method?: string; body?: string },
  data?: unknown | undefined,
): Promise<Response> {
  let method = 'GET';
  let body = undefined;
  
  if (typeof methodOrOptions === 'string') {
    // Old signature: apiRequest(url, method, data)
    method = methodOrOptions;
    body = data ? JSON.stringify(data) : undefined;
  } else if (methodOrOptions && typeof methodOrOptions === 'object') {
    // New signature: apiRequest(url, {method, body})
    method = methodOrOptions.method || 'GET';
    body = methodOrOptions.body;
  }
  
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;
    
    // Handle query parameters from second element in queryKey
    if (queryKey.length > 1 && queryKey[1]) {
      const params = new URLSearchParams();
      const filters = queryKey[1] as Record<string, any>;
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
