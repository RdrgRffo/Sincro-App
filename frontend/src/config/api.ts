import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { disconnectRealtime, reconnectRealtimeWithFreshToken } from '@/realtime/socketClient';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // CSRF: Adjuntar token CSRF de la cookie en el header para métodos mutativos
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    const csrfCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf-token='));
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1];
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: string) => void; reject: (reason: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't intercept 401s from auth endpoints (login, refresh, logout) — show them directly
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        disconnectRealtime();
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        if (newRefreshToken) {
          useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
        } else {
          useAuthStore.getState().setAccessToken(newAccessToken);
        }
        reconnectRealtimeWithFreshToken();
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        disconnectRealtime();
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Show descriptive toast for 403 Forbidden errors
    if (error.response?.status === 403) {
      const serverMessage = error.response?.data?.message;
      const displayMessage = serverMessage
        ? `Acceso denegado: ${serverMessage}`
        : 'No tienes permisos para realizar esta acción.';
      toast.error(displayMessage, { duration: 5000 });
    }

    return Promise.reject(error);
  }
);

export default api;
