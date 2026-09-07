import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { HotelRate, SupplierName } from '@hotel-comparator/shared';
import { generateHotels } from './data';
import { delay, parseSimulationParams } from './simulate';

const PORT = Number(process.env.SUPPLIERS_PORT ?? 4000);

const app = express();
app.use(cors());

async function handleSupplierRequest(req: Request, res: Response, supplier: SupplierName): Promise<void> {
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  if (!city) {
    res.status(400).json({ error: 'city query parameter is required' });
    return;
  }

  const { delayMs, empty, errorStatus } = parseSimulationParams(req);
  await delay(delayMs);

  if (errorStatus !== null) {
    res.status(errorStatus).json({ error: `Simulated ${supplier} server error` });
    return;
  }

  const hotels: HotelRate[] = empty ? [] : generateHotels(city, supplier);
  res.status(200).json({ hotels });
}

app.get('/supplierA/hotels', (req, res, next) => {
  handleSupplierRequest(req, res, 'SupplierA').catch(next);
});

app.get('/supplierB/hotels', (req, res, next) => {
  handleSupplierRequest(req, res, 'SupplierB').catch(next);
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[suppliers] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Mock suppliers listening on http://localhost:${PORT}`);
});
