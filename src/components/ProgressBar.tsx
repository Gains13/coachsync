type ProgressBarProps = {
  value: number
}

export default function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-emerald-600 transition-all"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}