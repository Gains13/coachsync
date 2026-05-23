type StatCardProps = {
  label: string
  value: string | number
  subtext?: string
}

export default function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-900">{value}</h3>
      {subtext && <p className="mt-1 text-sm text-slate-500">{subtext}</p>}
    </div>
  )
}