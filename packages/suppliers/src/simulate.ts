import type { Request } from 'express';

export interface SimulationParams {
  /** Milliseconds to wait before responding. A value larger than the caller's
   * own timeout is indistinguishable from a true timeout from the caller's
   * point of view, so this single knob covers both "delay" and "timeout". */
  delayMs: number;
  /** Respond with an empty hotel list. */
  empty: boolean;
  /** Respond with this HTTP error status instead of hotel data, when set. */
  errorStatus: number | null;
}

const DEFAULT_DELAY_MS = 250;

export function parseSimulationParams(req: Request): SimulationParams {
  const rawDelay = req.query.delayMs;
  const parsedDelay = rawDelay !== undefined ? Number(rawDelay) : NaN;
  const delayMs = Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : DEFAULT_DELAY_MS;

  const empty = req.query.empty === 'true';

  const rawError = req.query.error;
  let errorStatus: number | null = null;
  if (rawError !== undefined) {
    const parsedStatus = Number(rawError);
    errorStatus = Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus <= 599 ? parsedStatus : 500;
  }

  return { delayMs, empty, errorStatus };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
