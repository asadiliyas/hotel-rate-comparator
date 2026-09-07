import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchHotelsRequest } from '../api';
import { AlertIcon, PinIcon, SearchIcon } from './icons';

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
    <form className="search-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="city">City</label>
        <div className="input-with-icon">
          <PinIcon className="input-icon" />
          <input
            id="city"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Paris, Tokyo, New York"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="checkInDate">Check-in</label>
          <input
            id="checkInDate"
            type="date"
            value={checkInDate}
            onChange={(event) => setCheckInDate(event.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label htmlFor="checkOutDate">Check-out</label>
          <input
            id="checkOutDate"
            type="date"
            value={checkOutDate}
            onChange={(event) => setCheckOutDate(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {validationError && (
        <p className="field-error">
          <AlertIcon className="icon-sm" />
          {validationError}
        </p>
      )}

      <button type="submit" disabled={disabled} className="submit-button">
        <SearchIcon className="icon-sm" />
        {disabled ? 'Searching…' : 'Search hotels'}
      </button>
    </form>
  );
}
