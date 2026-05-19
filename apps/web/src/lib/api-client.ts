const API_PREFIX = "/api";

function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "";
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (!path.startsWith(API_PREFIX)) {
    path = `${API_PREFIX}${path}`;
  }

  const base = getBaseUrl();
  const url = `${base}${path}`;

  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
  };

  // ★ Always attach token if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("marketplace_token");
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
      // Let browser set Content-Type with boundary
      delete (headers as Record<string, string>)["Content-Type"];
    } else {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
    body,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      errorMessage = errBody.message || errBody.error || errorMessage;
    } catch { /* ignore */ }
    throw new ApiError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    api<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    api<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    api<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    api<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    api<T>(endpoint, { ...options, method: "DELETE" }),
};