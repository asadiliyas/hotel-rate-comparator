interface CancelButtonProps {
  onCancel: () => void;
  disabled?: boolean;
}

export function CancelButton({ onCancel, disabled }: CancelButtonProps) {
  return (
    <button type="button" className="cancel-pill" onClick={onCancel} disabled={disabled}>
      {disabled ? 'Cancelling…' : 'Cancel search'}
    </button>
  );
}
