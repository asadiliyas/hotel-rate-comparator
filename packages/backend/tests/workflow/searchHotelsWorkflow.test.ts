import { CancelledFailure, WorkflowFailedError } from '@temporalio/client';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import type { ApplicationFailure } from '@temporalio/workflow';
import type { SearchHotelsInput, SearchHotelsResult } from '@hotel-comparator/shared';
import type * as activities from '../../src/temporal/activities';
import { searchHotelsWorkflow } from '../../src/temporal/workflows';

const baseInput: SearchHotelsInput = {
  city: 'Paris',
  checkInDate: '2026-10-01',
  checkOutDate: '2026-10-05',
};

let testEnv: TestWorkflowEnvironment;
let testCounter = 0;

/** Each test gets its own task queue, not just its own workflow id, so a
 * still-shutting-down worker from a previous test can never contend with
 * the next test's Worker.create() on the same queue. */
function nextTestId(): string {
  testCounter += 1;
  return `test-${testCounter}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkflow(input: SearchHotelsInput, activityImpls: typeof activities): Promise<SearchHotelsResult> {
  const id = nextTestId();
  const taskQueue = `hotel-search-${id}`;

  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue,
    workflowsPath: require.resolve('../../src/temporal/workflows'),
    activities: activityImpls,
  });

  return worker.runUntil(
    testEnv.client.workflow.execute(searchHotelsWorkflow, {
      taskQueue,
      workflowId: `search-${id}`,
      args: [input],
    })
  );
}

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 60_000);

afterAll(async () => {
  await testEnv?.teardown();
});

describe('searchHotelsWorkflow - basic scenarios', () => {
  test('Supplier A cheaper -> returns A result', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => [{ hotelId: 'a1', name: 'Cheap A', price: 100 }],
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Pricier B', price: 150 }],
    });
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'a1', name: 'Cheap A', price: 100, supplier: 'SupplierA' },
    });
  });

  test('Supplier B cheaper -> returns B result', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => [{ hotelId: 'a1', name: 'Pricier A', price: 150 }],
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Cheap B', price: 100 }],
    });
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'b1', name: 'Cheap B', price: 100, supplier: 'SupplierB' },
    });
  });

  test('Both suppliers return the same rate -> deterministically picks Supplier A', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => [{ hotelId: 'a1', name: 'Hotel A', price: 120 }],
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Hotel B', price: 120 }],
    });
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'a1', name: 'Hotel A', price: 120, supplier: 'SupplierA' },
    });
  });

  test('Supplier A fails, Supplier B succeeds -> returns B result', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => {
        throw new Error('Supplier A is down');
      },
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Hotel B', price: 130 }],
    });
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'b1', name: 'Hotel B', price: 130, supplier: 'SupplierB' },
    });
  });

  test('Both suppliers fail -> workflow fails with a clear, non-retryable error', async () => {
    let caught: unknown;
    try {
      await runWorkflow(baseInput, {
        fetchSupplierARates: async () => {
          throw new Error('Supplier A is down');
        },
        fetchSupplierBRates: async () => {
          throw new Error('Supplier B is down');
        },
      });
      throw new Error('expected the workflow to fail');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(WorkflowFailedError);
    const cause = (caught as WorkflowFailedError).cause as ApplicationFailure;
    expect(cause.message).toContain('Both suppliers failed');
    expect(cause.nonRetryable).toBe(true);
  });

  test('One supplier returns empty -> uses the other result', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => [],
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Hotel B', price: 140 }],
    });
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'b1', name: 'Hotel B', price: 140, supplier: 'SupplierB' },
    });
  });

  test('Both suppliers return empty -> "No hotels found"', async () => {
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => [],
      fetchSupplierBRates: async () => [],
    });
    expect(result).toEqual({ status: 'NO_HOTELS_FOUND' });
  });
});

describe('searchHotelsWorkflow - advanced scenarios', () => {
  test('a supplier slower than the timeout -> proceeds with the other supplier\'s result', async () => {
    const result = await runWorkflow(
      { ...baseInput, supplierTimeoutMs: 200 },
      {
        fetchSupplierARates: async () => [{ hotelId: 'a1', name: 'Fast A', price: 110 }],
        fetchSupplierBRates: async () => {
          await sleep(1500);
          return [{ hotelId: 'b1', name: 'Slow B', price: 50 }];
        },
      }
    );
    // B would have been cheaper, but it never answers within the timeout budget.
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'a1', name: 'Fast A', price: 110, supplier: 'SupplierA' },
    });
  }, 20_000);

  test('Supplier A fails twice then succeeds -> still succeeds via the retry policy', async () => {
    let attempts = 0;
    const result = await runWorkflow(baseInput, {
      fetchSupplierARates: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error(`Transient failure #${attempts}`);
        }
        return [{ hotelId: 'a1', name: 'Recovered A', price: 90 }];
      },
      fetchSupplierBRates: async () => [{ hotelId: 'b1', name: 'Hotel B', price: 300 }],
    });

    expect(attempts).toBe(3);
    expect(result).toEqual({
      status: 'OK',
      hotel: { hotelId: 'a1', name: 'Recovered A', price: 90, supplier: 'SupplierA' },
    });
  }, 20_000);

  test('user cancels the request mid-way -> workflow stops gracefully with a cancellation', async () => {
    const id = nextTestId();
    const taskQueue = `hotel-search-${id}`;

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../../src/temporal/workflows'),
      activities: {
        fetchSupplierARates: async () => {
          await sleep(1500);
          return [{ hotelId: 'a1', name: 'Hotel A', price: 100 }];
        },
        fetchSupplierBRates: async () => {
          await sleep(1500);
          return [{ hotelId: 'b1', name: 'Hotel B', price: 100 }];
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(searchHotelsWorkflow, {
        taskQueue,
        workflowId: `search-${id}`,
        args: [{ ...baseInput, supplierTimeoutMs: 10_000 }],
      });

      await sleep(200);
      await handle.cancel();

      let caught: unknown;
      try {
        await handle.result();
        throw new Error('expected the workflow to be cancelled');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(WorkflowFailedError);
      expect((caught as WorkflowFailedError).cause).toBeInstanceOf(CancelledFailure);
    });
  }, 20_000);
});
