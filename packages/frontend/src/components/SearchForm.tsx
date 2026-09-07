import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchHotelsRequest } from '../api';

interface SearchFormProps {
  disabled: boolean;
  onSubmit: (request: SearchHotelsRequest) => void;
}

export function SearchForm({ disabled, onSubmit }: SearchFormProps) {
  const [city, setCity] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!city.trim() || !checkInDate || !checkOutDate) {
      setValidationError('Please fill in city, check-in, and check-out dates.');
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      setValidationError('Check-out date must be after check-in date.');
      return;
    }

    setValidationError(null);
    onSubmit({ city: city.trim(), checkInDate, checkOutDate });
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="city">City</label>
        <input
          id="city"
          type="text"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="e.g. Paris"
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label htmlFor="checkInDate">Check-in date</label>
        <input
          id="checkInDate"
          type="date"
          value={checkInDate}
          onChange={(event) => setCheckInDate(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label htmlFor="checkOutDate">Check-out date</label>
        <input
          id="checkOutDate"
          type="date"
          value={checkOutDate}
          onChange={(event) => setCheckOutDate(event.target.value)}
          disabled={disabled}
        />
      </div>

      {validationError && <p className="field-error">{validationError}</p>}

      <button type="submit" disabled={disabled}>
        {disabled ? 'Searching…' : 'Search hotels'}
      </button>
    </form>
  );
}
