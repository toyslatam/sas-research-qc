'use client';

const COLORS = [
  'text-cyan-400', 'text-violet-400', 'text-emerald-400',
  'text-sky-400',  'text-fuchsia-400', 'text-teal-400',
  'text-indigo-400', 'text-pink-400',
];

export function WordCloud({ words }: { words: { text: string; value: number }[] }) {
  if (!words.length)
    return <p className="text-slate-500 text-sm py-8 text-center">Sin palabras clave aún.</p>;

  const max = Math.max(...words.map((w) => w.value));

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center min-h-[130px] p-2">
      {words.slice(0, 32).map((w, i) => {
        const scale = 0.7 + (w.value / max) * 1.3;
        const color = COLORS[i % COLORS.length];
        const opacity = 0.45 + (w.value / max) * 0.55;
        return (
          <span
            key={w.text}
            title={`${w.value} ${w.value === 1 ? 'mención' : 'menciones'}`}
            className={`${color} font-medium cursor-default hover:opacity-100 transition-opacity duration-200 select-none`}
            style={{ fontSize: `${scale}rem`, opacity }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
