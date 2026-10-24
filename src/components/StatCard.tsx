type StatCardProps = {
  label: string
  value: string | number
  subtext?: string
}

export default function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 ">
      <p className="text-sm text-muted">{label}</p>
      <h3 className="mt-2 text-2xl font-bold text-ink">{value}</h3>
      {subtext && <p className="mt-1 text-sm text-muted">{subtext}</p>}
    </div>
  )
}