import { BuildingIcon } from './icons';

export function Header() {
  return (
    <header className="app-header">
      <div className="brand-badge">
        <BuildingIcon className="icon" />
      </div>
      <h1>Hotel Rate Comparator</h1>
      <p className="subtitle">Real-time rates from two suppliers, compared and orchestrated by a Temporal workflow.</p>
    </header>
  );
}
