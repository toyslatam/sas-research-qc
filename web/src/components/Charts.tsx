'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185'];

export function SentimentChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FrequencyBarChart({
  data,
  title,
}: {
  data: { term: string; count: number }[];
  title?: string;
}) {
  if (!data.length) return <Empty />;
  return (
    <div>
      {title && <p className="text-xs text-slate-500 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" stroke="#94a3b8" />
          <YAxis type="category" dataKey="term" width={100} stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty() {
  return <p className="text-slate-500 text-sm py-8 text-center">Sin datos</p>;
}
