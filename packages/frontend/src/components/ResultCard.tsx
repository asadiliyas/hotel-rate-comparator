import type { HotelRate, SupplierName } from '@hotel-comparator/shared';

interface ResultCardProps {
  hotel: HotelRate & { supplier: SupplierName };
}

export function ResultCard({ hotel }: ResultCardProps) {
  return (
    <div className="status-panel result">
      <h2>{hotel.name}</h2>
      <p className="price">${hotel.price.toFixed(2)}</p>
      <p className="supplier">via {hotel.supplier}</p>
    </div>
  );
}
