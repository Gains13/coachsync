// src/components/ui/PageShell.tsx
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-screen-lg mx-auto">
      {children}
    </div>
  );
}