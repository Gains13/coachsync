type StatCardProps = {
  title: string;
  value: string;
};

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
      <p className="text-xs font-medium text-muted sm:text-sm">{title}</p>

      <h2 className="mt-2 break-words text-lg font-bold text-ink sm:text-xl">
        {value}
      </h2>
    </div>
  );
}