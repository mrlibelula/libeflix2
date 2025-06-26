import axios from 'axios';

// Helper to get CSRF token
const getCsrfToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

// Retry logic with token refresh
let isRefreshingToken = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Create an Axios instance
const api = axios.create();

// Add a response interceptor for handling 419 errors
api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 419 (CSRF token mismatch) and we haven't already retried
    if (error.response?.status === 419 && !originalRequest._retry) {
      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['X-CSRF-TOKEN'] = token;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshingToken = true;

      return new Promise((resolve, reject) => {
        api.get('/csrf-token')
          .then(({ data }) => {
            const newCsrfToken = data.csrf_token;
            api.defaults.headers.common['X-CSRF-TOKEN'] = newCsrfToken;
            originalRequest.headers['X-CSRF-TOKEN'] = newCsrfToken;
            processQueue(null, newCsrfToken);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            reject(err);
          })
          .finally(() => {
            isRefreshingToken = false;
          });
      });
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);

// API methods
export const EpisodesApi = {
  // Get likes information for an episode
  async getLikes(episodeId: number): Promise<{ likes_count: number; is_liked: boolean }> {
    const response = await api.get(`/api/episodes/${episodeId}/likes`);
    return response.data;
  },

  // Like an episode
  async like(episodeId: number): Promise<{ likes_count: number; is_liked: boolean }> {
    const response = await api.post(`/api/episodes/${episodeId}/like`, {}, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
    return response.data;
  },

  // Unlike an episode
  async unlike(episodeId: number): Promise<{ likes_count: number; is_liked: boolean }> {
    const response = await api.delete(`/api/episodes/${episodeId}/like`, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
    return response.data;
  }
}; 