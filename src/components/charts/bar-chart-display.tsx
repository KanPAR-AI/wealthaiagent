// src/components/chat/structured-content/charts/BarChartDisplay.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { AiGraphContent } from '@/types/chat'; // Adjust path
import ChartErrorFallback from './error-fallback';

interface BarChartDisplayProps {
  chartData: AiGraphContent;
  isFullScreen: boolean;
}

const DEFAULT_COLORS = ['#8884D8', '#82Ca9D', '#FFC658', '#FF8042', '#0088FE', '#00C49F'];

const BarChartDisplay: React.FC<BarChartDisplayProps> = ({ chartData, isFullScreen }) => {
  if (chartData.graphType !== 'bar') return <ChartErrorFallback errorMessage="Invalid graph type for BarChart." />;
  if (!chartData.data || chartData.data.length === 0) return <ChartErrorFallback errorMessage="No data provided for BarChart." />;
  if (!chartData.options?.categoryKey || !chartData.options?.dataKeys || chartData.options.dataKeys.length === 0) {
    return <ChartErrorFallback errorMessage="Missing categoryKey or dataKeys in chart options for BarChart." />;
  }

  const { categoryKey, dataKeys, xAxisLabel, yAxisLabel, colors = DEFAULT_COLORS } = chartData.options;

  // Ensure all dataKeys exist in data items, or provide a default (e.g., 0)
  const processedData = chartData.data.map(item => {
    const newItem: Record<string, any> = { [categoryKey]: item[categoryKey] };
    dataKeys.forEach(key => {
      newItem[key] = typeof item[key] === 'number' ? item[key] : 0;
    });
    return newItem;
  });

  return (
    <div style={{ width: '100%', height: isFullScreen ? 'calc(100vh - 200px)' : 350 }} className="my-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={processedData} margin={{ top: 5, right: 10, left: 10, bottom: xAxisLabel ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryKey}>
          </XAxis>
          <YAxis>
            {yAxisLabel && <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />}
          </YAxis>
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartDisplay;