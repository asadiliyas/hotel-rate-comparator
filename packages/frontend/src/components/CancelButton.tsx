interface CancelButtonProps {
  onCancel: () => void;
  disabled?: boolean;
}

export function CancelButton({ onCancel, disabled }: CancelButtonProps) {
  return (
    <button type="button" className="link-button" onClick={onCancel} disabled={disabled}>
      {disabled ? 'Cancelling…' : 'Cancel search'}
    </button>
  );
}
