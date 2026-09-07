import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { TASK_QUEUE } from '../config';
import { TEMPORAL_ADDRESS } from '../env';

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });

  const worker = await Worker.create({
    connection,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`[worker] polling task queue "${TASK_QUEUE}" at ${TEMPORAL_ADDRESS}`);
  await worker.run();
}

run().catch((err) => {
  console.error('[worker] failed to start:', err);
  process.exit(1);
});
