// Shared class strings for the redesigned UI, so buttons and cards stay consistent.

const btnBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btnBase} bg-accent text-white hover:bg-accent-dark`;
export const btnDark = `${btnBase} bg-ink text-white hover:bg-ink/85`;
export const btnGhost = `${btnBase} border border-line bg-white text-ink hover:bg-canvas`;
export const btnDanger = `${btnBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

export const card = "rounded-[18px] border border-line bg-white";
