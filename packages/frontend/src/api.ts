import type { SearchHotelsResult } from '@hotel-comparator/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4100';

export interface SearchHotelsRequest {
  city: string;
  checkInDate: string;
  checkOutDate: string;
}

export class ApiError extends Error {}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function startSearch(request: SearchHotelsRequest): Promise<{ workflowId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/search-hotels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response));
  }
  return response.json();
}

export async function getSearchResult(workflowId: string): Promise<SearchHotelsResult> {
  const response = await fetch(`${API_BASE_URL}/api/search-hotels/${encodeURIComponent(workflowId)}`);
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response));
  }
  return response.json();
}

export async function cancelSearch(workflowId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/search-hotels/${encodeURIComponent(workflowId)}/cancel`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response));
  }
}
