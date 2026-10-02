export function Progress({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${safeValue}% concluído`} role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
