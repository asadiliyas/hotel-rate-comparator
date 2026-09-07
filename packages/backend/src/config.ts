// Workflow code runs inside Temporal's deterministic V8 isolate sandbox,
// which has no Node globals (no `process`, no env vars). workflows.ts
// imports this module, so it must only ever contain pure literals - any
// process.env-derived values belong in env.ts instead, which only
// node-side code (worker/client/api/activities) may import.

export const TASK_QUEUE = 'hotel-search';

/** Per-activity start-to-close timeout, in milliseconds, unless a workflow input overrides it. */
export const DEFAULT_SUPPLIER_TIMEOUT_MS = 5000;

/** Must stay comfortably below DEFAULT_SUPPLIER_TIMEOUT_MS so heartbeats have room to land. */
export const SUPPLIER_HEARTBEAT_TIMEOUT_MS = 2000;
