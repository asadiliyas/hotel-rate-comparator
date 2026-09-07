import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BACKEND_PORT } from '../env';
import { cancelSearch, getSearchResult, startSearch } from '../temporal/client';

const app = express();
app.use(cors());
app.use(express.json());

const searchHotelsSchema = z
  .object({
    city: z.string().trim().min(1, 'city is required'),
    checkInDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'checkInDate must be a valid date'),
    checkOutDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'checkOutDate must be a valid date'),
  })
  .refine((v) => Date.parse(v.checkOutDate) > Date.parse(v.checkInDate), {
    message: 'checkOutDate must be after checkInDate',
    path: ['checkOutDate'],
  });

/** Express 5's route-param typing allows string[] for repeatable segments; ours never are. */
function getWorkflowIdParam(req: Request, res: Response): string | null {
  const { workflowId } = req.params;
  if (typeof workflowId !== 'string') {
    res.status(400).json({ error: 'Invalid workflow id' });
    return null;
  }
  return workflowId;
}

app.post('/api/search-hotels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = searchHotelsSchema.parse(req.body);
    const { workflowId } = await startSearch(input);
    res.status(202).json({ workflowId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((issue) => issue.message).join('; ') });
      return;
    }
    next(err);
  }
});

app.get('/api/search-hotels/:workflowId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflowId = getWorkflowIdParam(req, res);
    if (workflowId === null) return;
    const outcome = await getSearchResult(workflowId);
    switch (outcome.kind) {
      case 'result':
        res.status(200).json(outcome.result);
        return;
      case 'cancelled':
        res.status(409).json({ error: 'Search was cancelled' });
        return;
      case 'not_found':
        res.status(404).json({ error: 'Unknown search id' });
        return;
      case 'failed':
        res.status(502).json({ error: outcome.message });
        return;
    }
  } catch (err) {
    next(err);
  }
});

app.post('/api/search-hotels/:workflowId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflowId = getWorkflowIdParam(req, res);
    if (workflowId === null) return;
    await cancelSearch(workflowId);
    res.status(202).json({ status: 'cancel requested' });
  } catch (err) {
    next(err);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[backend api] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(BACKEND_PORT, () => {
  console.log(`[api] listening on http://localhost:${BACKEND_PORT}`);
});
