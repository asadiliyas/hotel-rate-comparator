import {
  ApplicationFailure,
  CancelledFailure,
  Client,
  Connection,
  WorkflowFailedError,
  WorkflowNotFoundError,
} from '@temporalio/client';
import type { SearchHotelsInput, SearchHotelsResult } from '@hotel-comparator/shared';
import { searchHotelsWorkflow } from './workflows';
import { TASK_QUEUE } from '../config';
import { TEMPORAL_ADDRESS } from '../env';

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: TEMPORAL_ADDRESS }).then(
      (connection) => new Client({ connection })
    );
  }
  return clientPromise;
}

export async function startSearch(input: SearchHotelsInput): Promise<{ workflowId: string }> {
  const client = await getClient();
  const workflowId = `search-hotels-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await client.workflow.start(searchHotelsWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [input],
  });

  return { workflowId };
}

export type SearchOutcome =
  | { kind: 'result'; result: SearchHotelsResult }
  | { kind: 'failed'; message: string }
  | { kind: 'cancelled' }
  | { kind: 'not_found' };

export async function getSearchResult(workflowId: string): Promise<SearchOutcome> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);

  try {
    const result = await handle.result();
    return { kind: 'result', result };
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return { kind: 'not_found' };
    }
    if (err instanceof WorkflowFailedError) {
      if (err.cause instanceof CancelledFailure) {
        return { kind: 'cancelled' };
      }
      if (err.cause instanceof ApplicationFailure) {
        return { kind: 'failed', message: err.cause.message };
      }
      return { kind: 'failed', message: err.message };
    }
    throw err;
  }
}

export async function cancelSearch(workflowId: string): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
}
