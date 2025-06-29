// API utilities with automatic CSRF token refresh and error handling

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

class ApiClient {
  private static instance: ApiClient;
  private csrfToken: string | null = null;

  private constructor() {
    this.refreshCSRFToken();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private refreshCSRFToken(): void {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (metaToken) {
      this.csrfToken = metaToken;
    }
  }

  private async fetchNewCSRFToken(): Promise<string | null> {
    try {
      const response = await fetch('/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const newToken = data.csrf_token;
        
        // Update the meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
          metaTag.setAttribute('content', newToken);
        }
        
        this.csrfToken = newToken;
        return newToken;
      }
    } catch (error) {
      console.error('Failed to fetch new CSRF token:', error);
    }
    return null;
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': this.csrfToken || '',
      ...customHeaders,
    };
  }

  public async request<T = any>(
    url: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const { headers: customHeaders, ...otherOptions } = options;
    
    // First attempt with current token
    let response = await this.makeRequest<T>(url, {
      ...otherOptions,
      headers: this.getHeaders(customHeaders as Record<string, string>),
    });

    // If we get a 419 (CSRF mismatch), try to refresh the token and retry once
    if (response.status === 419) {
      console.log('CSRF token mismatch, refreshing token and retrying...');
      
      const newToken = await this.fetchNewCSRFToken();
      if (newToken) {
        // Retry with the new token
        response = await this.makeRequest<T>(url, {
          ...otherOptions,
          headers: this.getHeaders(customHeaders as Record<string, string>),
        });
      }
    }

    return response;
  }

  private async makeRequest<T = any>(
    url: string, 
    options: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
      });

      const responseData = response.ok ? await response.json() : null;

      return {
        ok: response.ok,
        status: response.status,
        data: responseData,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Convenience methods
  public async get<T = any>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'GET', headers });
  }

  public async post<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined,
      headers 
    });
  }

  public async put<T = any>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined,
      headers 
    });
  }

  public async delete<T = any>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { method: 'DELETE', headers });
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Export convenience function for direct usage
export const api = {
  get: <T = any>(url: string, headers?: Record<string, string>) => apiClient.get<T>(url, headers),
  post: <T = any>(url: string, data?: any, headers?: Record<string, string>) => apiClient.post<T>(url, data, headers),
  put: <T = any>(url: string, data?: any, headers?: Record<string, string>) => apiClient.put<T>(url, data, headers),
  delete: <T = any>(url: string, headers?: Record<string, string>) => apiClient.delete<T>(url, headers),
}; 