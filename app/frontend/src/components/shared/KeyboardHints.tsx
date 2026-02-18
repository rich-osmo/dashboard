interface KeyboardHintsProps {
  hints: string[];
}

export function KeyboardHints({ hints }: KeyboardHintsProps) {
  return (
    <div className="keyboard-hints">
      {hints.map((hint, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {hint}
        </span>
      ))}
    </div>
  );
}
