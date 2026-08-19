"use client";

import {
  BarChart,
  Bar,
  BarXAxis,
  Grid,
  ChartTooltip,
} from "@/components/ui/bar-chart";

const dailyData = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(2024, 0, 1);
  date.setDate(date.getDate() + i);
  return {
    day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Math.floor(50 + Math.sin(i / 7) * 30 + ((i * 7) % 37) - 18),
  };
});

export default function BarChartDemo6() {
  return (
    <div className="w-full">
      <BarChart data={dailyData} xDataKey="day" barGap={0.1}>
        <Grid horizontal />
        <Bar dataKey="value" lineCap="butt" />
        <BarXAxis maxLabels={6} />
        <ChartTooltip />
      </BarChart>
    </div>
  );
}
