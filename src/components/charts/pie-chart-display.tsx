// src/components/chat/structured-content/charts/PieChartDisplay.tsx
import { AiGraphContent } from '@/types/chat'; // Adjust path as needed
import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import ChartErrorFallback from './error-fallback';

interface PieChartDisplayProps {
  chartData: AiGraphContent;
  isFullScreen: boolean;
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

const PieChartDisplay: React.FC<PieChartDisplayProps> = ({ chartData, isFullScreen }) => {
  if (chartData.graphType !== 'pie') return <ChartErrorFallback errorMessage="Invalid graph type for PieChart." />;
  if (!chartData.data || chartData.data.length === 0) return <ChartErrorFallback errorMessage="No data provided for PieChart." />;
  if (!chartData.options?.categoryKey || !chartData.options?.dataKeys || chartData.options.dataKeys.length === 0) {
    return <ChartErrorFallback errorMessage="Missing categoryKey or dataKeys in chart options for PieChart." />;
  }

  const categoryKey = chartData.options.categoryKey;
  const valueKey = chartData.options.dataKeys[0]; // For pie, use the first dataKey as value

  const processedData = chartData.data.map(item => ({
    name: item[categoryKey],
    value: typeof item[valueKey] === 'number' ? item[valueKey] : 0,
  })).filter(item => item.name !== undefined && item.value > 0);

  if (processedData.length === 0) return <ChartErrorFallback errorMessage="Processed data for PieChart is empty or invalid." />;

  const colors = chartData.options.colors || DEFAULT_COLORS;

  return (
    <div style={{ width: '100%', height: isFullScreen ? 'calc(100vh - 200px)' : 300 }} className="my-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={isFullScreen ? 200 : 80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {processedData.map((__, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartDisplay;