import type { HotelRate, SupplierName } from '@hotel-comparator/shared';
import { BuildingIcon, CheckBadgeIcon } from './icons';

interface ResultCardProps {
  hotel: HotelRate & { supplier: SupplierName };
}

export function ResultCard({ hotel }: ResultCardProps) {
  return (
    <div className="status-panel result">
      <div className="result-eyebrow">
        <CheckBadgeIcon className="icon-sm" />
        Best rate found
      </div>
      <div className="result-body">
        <div className="result-icon">
          <BuildingIcon className="icon" />
        </div>
        <div className="result-details">
          <h2>{hotel.name}</h2>
          <span className="supplier-pill">via {hotel.supplier}</span>
        </div>
        <p className="price">
          <span className="price-currency">$</span>
          {hotel.price.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
