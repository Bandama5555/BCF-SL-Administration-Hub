/**
 * BCF-SL Frontend API Client
 *
 * Provides a unified client-side interface to call Express backend APIs
 * or proxied Next.js endpoints.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  directToBackend?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(path: string, params?: Record<string, any>, direct: boolean = false): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const base = direct ? this.baseUrl : "";
    const url = new URL(base ? `${base}${cleanPath}` : cleanPath, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return direct ? url.toString() : `${url.pathname}${url.search}`;
  }

  async get<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params, options?.directToBackend);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
    }

    return await res.json();
  }

  async post<T = any>(path: string, data?: any, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params, options?.directToBackend);
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options?.headers as Record<string, string>),
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
    }

    return await res.json();
  }

  async put<T = any>(path: string, data?: any, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params, options?.directToBackend);
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
    }

    return await res.json();
  }

  async delete<T = any>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.params, options?.directToBackend);
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorBody.message || errorBody.error || `HTTP ${res.status}`);
    }

    return await res.json();
  }
}

export const apiClient = new ApiClient(BACKEND_URL);
