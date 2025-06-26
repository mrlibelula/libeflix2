import axios from 'axios';
import { Comment, CommentsResponse, CreateCommentRequest, UpdateCommentRequest } from '@/types/comments';

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
export const CommentsApi = {
  // Get comments for a commentable (authenticated)
  async getComments(commentableType: string, commentableId: number, page: number = 1, perPage: number = 10): Promise<CommentsResponse> {
    const response = await api.get(`/api/comments`, {
      params: { commentable_type: commentableType, commentable_id: commentableId, page, per_page: perPage }
    });
    return response.data;
  },

  // Get comments for a commentable (public)
  async getPublicComments(commentableType: string, commentableId: number, page: number = 1, perPage: number = 10): Promise<CommentsResponse> {
    // Use a separate axios instance for public requests to avoid CSRF token issues
    const response = await axios.get(`/api/comments/public`, {
      params: { commentable_type: commentableType, commentable_id: commentableId, page, per_page: perPage },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  },

  // Create a new comment
  async createComment(data: CreateCommentRequest): Promise<Comment> {
    const response = await api.post('/api/comments', data, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
    return response.data.comment;
  },

  // Update a comment
  async updateComment(commentId: number, data: UpdateCommentRequest): Promise<Comment> {
    const response = await api.put(`/api/comments/${commentId}`, data, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
    return response.data.comment;
  },

  // Delete a comment
  async deleteComment(commentId: number): Promise<void> {
    await api.delete(`/api/comments/${commentId}`, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
  },

  // Toggle like on a comment
  async toggleCommentLike(commentId: number): Promise<{ likes_count: number; is_liked: boolean }> {
    const response = await api.post(`/api/comments/${commentId}/like`, {}, {
      headers: { 'X-CSRF-TOKEN': getCsrfToken() }
    });
    return response.data;
  },

  // Share a comment
  async shareComment(commentId: number): Promise<{ share_url: string }> {
    const response = await api.get(`/api/comments/${commentId}/share`);
    return response.data;
  }
}; 