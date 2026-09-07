import { useState } from 'react';
import type { HotelRate, SupplierName } from '@hotel-comparator/shared';
import { cancelSearch, getSearchResult, startSearch } from './api';
import type { SearchHotelsRequest } from './api';
import { CancelButton } from './components/CancelButton';
import { ResultCard } from './components/ResultCard';
import { SearchForm } from './components/SearchForm';

type Status = 'idle' | 'loading' | 'success' | 'no-results' | 'error';

function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [hotel, setHotel] = useState<(HotelRate & { supplier: SupplierName }) | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function handleSearch(request: SearchHotelsRequest) {
    setStatus('loading');
    setErrorMessage(null);
    setHotel(null);
    setCancelling(false);

    try {
      const started = await startSearch(request);
      setWorkflowId(started.workflowId);

      const outcome = await getSearchResult(started.workflowId);
      if (outcome.status === 'OK') {
        setHotel(outcome.hotel);
        setStatus('success');
      } else {
        setStatus('no-results');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('error');
    } finally {
      setWorkflowId(null);
      setCancelling(false);
    }
  }

  async function handleCancel() {
    if (!workflowId || cancelling) return;
    setCancelling(true);
    try {
      await cancelSearch(workflowId);
    } catch {
      // Best effort - the pending search request above will surface any real problem.
    }
  }

  return (
    <main className="page">
      <h1>Hotel Rate Comparator</h1>
      <p className="subtitle">Compares live offers from two suppliers through a Temporal workflow.</p>

      <SearchForm disabled={status === 'loading'} onSubmit={handleSearch} />

      {status === 'loading' && (
        <div className="status-panel loading">
          <span className="spinner" aria-hidden="true" />
          <span>Searching suppliers…</span>
          {workflowId && <CancelButton onCancel={handleCancel} disabled={cancelling} />}
        </div>
      )}

      {status === 'success' && hotel && <ResultCard hotel={hotel} />}

      {status === 'no-results' && <div className="status-panel info">No hotels found for that search.</div>}

      {status === 'error' && errorMessage && (
        <div className="status-panel error" role="alert">
          {errorMessage}
        </div>
      )}
    </main>
  );
}

export default App;
