// process.env-derived config. Only for node-side code (worker, client, api,
// activities) - never import this from workflows.ts, see config.ts.

export const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

export const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 4100);

export const SUPPLIERS_BASE_URL = process.env.SUPPLIERS_BASE_URL ?? 'http://localhost:4000';

export const SUPPLIER_A_URL = `${SUPPLIERS_BASE_URL}/supplierA/hotels`;
export const SUPPLIER_B_URL = `${SUPPLIERS_BASE_URL}/supplierB/hotels`;
