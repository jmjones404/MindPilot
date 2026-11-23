import { useEffect, useRef } from 'react';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
export function ProgressChart({ labels, values, totals, dark }: { labels: string[]; values: number[]; totals: number[]; dark: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, { type: 'bar', data: { labels, datasets: [{ label: 'Completed', data: values, backgroundColor: '#6c9ae7', borderRadius: 7, maxBarThickness: 34 }, { label: 'Remaining', data: totals.map((t, i) => t - values[i]), backgroundColor: dark ? '#2c3a4d' : '#e9eef7', borderRadius: 7, maxBarThickness: 34 }] }, options: { responsive: true, maintainAspectRatio: false, animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 350 }, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: dark ? '#a5b2c8' : '#65748c', font: { size: 13 } } }, y: { stacked: true, beginAtZero: true, suggestedMax: Math.max(4, ...totals), border: { display: false }, ticks: { stepSize: 1, color: dark ? '#a5b2c8' : '#65748c' }, grid: { color: dark ? '#29354a' : '#edf0f5' } } } } });
    return () => chart.destroy();
  }, [JSON.stringify(labels), JSON.stringify(values), JSON.stringify(totals), dark]);
  return <div className="chart-container"><canvas ref={canvas} role="img" aria-label="Daily scheduled activity completion chart. Exact figures are listed below."/></div>;
}
