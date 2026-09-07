import { useState } from 'react';
import type { HotelRate, SupplierName } from '@hotel-comparator/shared';
import { cancelSearch, getSearchResult, startSearch } from './api';
import type { SearchHotelsRequest } from './api';
import { CancelButton } from './components/CancelButton';
import { Header } from './components/Header';
import { ResultCard } from './components/ResultCard';
import { SearchForm } from './components/SearchForm';
import { AlertIcon, InfoIcon } from './components/icons';

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
    <div className="page">
      <div className="page-inner">
        <Header />

        <SearchForm disabled={status === 'loading'} onSubmit={handleSearch} />

        {status === 'loading' && (
          <div className="status-panel loading">
            <span className="spinner" aria-hidden="true" />
            <span className="loading-text">Searching Supplier A &amp; Supplier B…</span>
            {workflowId && <CancelButton onCancel={handleCancel} disabled={cancelling} />}
          </div>
        )}

        {status === 'success' && hotel && <ResultCard hotel={hotel} />}

        {status === 'no-results' && (
          <div className="status-panel info">
            <InfoIcon className="icon-sm" />
            No hotels found for that search. Try a different city or dates.
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="status-panel error" role="alert">
            <AlertIcon className="icon-sm" />
            {errorMessage}
          </div>
        )}

        <footer className="page-footer">Orchestrated end-to-end with Temporal workflows.</footer>
      </div>
    </div>
  );
}

export default App;
