import { ActivityCancellationType, ApplicationFailure, isCancellation, proxyActivities } from '@temporalio/workflow';
import type { SearchHotelsInput, SearchHotelsResult } from '@hotel-comparator/shared';
import type * as activities from './activities';
import { pickBestRate } from '../compare';
import { DEFAULT_SUPPLIER_TIMEOUT_MS, SUPPLIER_HEARTBEAT_TIMEOUT_MS } from '../config';

export async function searchHotelsWorkflow(input: SearchHotelsInput): Promise<SearchHotelsResult> {
  const { fetchSupplierARates, fetchSupplierBRates } = proxyActivities<typeof activities>({
    startToCloseTimeout: input.supplierTimeoutMs ?? DEFAULT_SUPPLIER_TIMEOUT_MS,
    heartbeatTimeout: SUPPLIER_HEARTBEAT_TIMEOUT_MS,
    cancellationType: ActivityCancellationType.TRY_CANCEL,
    retry: {
      initialInterval: '500ms',
      backoffCoefficient: 2,
      maximumAttempts: 3,
      maximumInterval: '2s',
    },
  });

  // Both suppliers are called concurrently. allSettled means a slow or
  // failing supplier - whether from a timeout, an HTTP error, or the whole
  // workflow being cancelled - never blocks or discards the other's result.
  const [outcomeA, outcomeB] = await Promise.allSettled([fetchSupplierARates(input), fetchSupplierBRates(input)]);

  const aCancelled = outcomeA.status === 'rejected' && isCancellation(outcomeA.reason);
  const bCancelled = outcomeB.status === 'rejected' && isCancellation(outcomeB.reason);
  if (aCancelled && bCancelled) {
    // A per-activity timeout alone never produces a cancellation on both
    // sides at once - only an outside request to cancel this workflow does,
    // since that cascades to every activity still in flight. Propagate that
    // as a real cancellation instead of falling through to the generic
    // "both suppliers failed" business error below.
    if (outcomeA.status === 'rejected') throw outcomeA.reason;
    if (outcomeB.status === 'rejected') throw outcomeB.reason;
  }

  const decision = pickBestRate(outcomeA, outcomeB);

  if (decision.status === 'ALL_SUPPLIERS_FAILED') {
    throw ApplicationFailure.nonRetryable('Both suppliers failed to return results', 'AllSuppliersFailedError');
  }

  return decision;
}
