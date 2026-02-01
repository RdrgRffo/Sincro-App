import type { AxiosError } from 'axios';

type ApiErrorPayload = {
  success?: false;
  error?: string;
  code?: string;
  errors?: unknown;
};

function asAxiosError(error: unknown): AxiosError<ApiErrorPayload> | null {
  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    return error as AxiosError<ApiErrorPayload>;
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = asAxiosError(error);
  const apiMessage = axiosError?.response?.data?.error;
  if (apiMessage && apiMessage.trim().length > 0) {
    return apiMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const axiosError = asAxiosError(error);
  return axiosError?.response?.data?.code;
}

export function getApiErrorDetails<T = unknown>(error: unknown): T | undefined {
  const axiosError = asAxiosError(error);
  return axiosError?.response?.data?.errors as T | undefined;
}
