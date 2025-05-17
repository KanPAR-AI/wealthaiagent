// src/components/chat/structured-content/charts/LineChartDisplay.tsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { AiGraphContent } from '@/types/chat'; // Adjust path
import ChartErrorFallback from './error-fallback';

interface LineChartDisplayProps {
  chartData: AiGraphContent;
  isFullScreen: boolean;
}

const DEFAULT_COLORS = ['#8884D8', '#82Ca9D', '#FFC658', '#FF8042', '#0088FE', '#00C49F'];

const LineChartDisplay: React.FC<LineChartDisplayProps> = ({ chartData, isFullScreen }) => {
  if (chartData.graphType !== 'line') return <ChartErrorFallback errorMessage="Invalid graph type for LineChart." />;
  if (!chartData.data || chartData.data.length === 0) return <ChartErrorFallback errorMessage="No data provided for LineChart." />;
  if (!chartData.options?.categoryKey || !chartData.options?.dataKeys || chartData.options.dataKeys.length === 0) {
    return <ChartErrorFallback errorMessage="Missing categoryKey or dataKeys in chart options for LineChart." />;
  }

  const { categoryKey, dataKeys, xAxisLabel, yAxisLabel, colors = DEFAULT_COLORS } = chartData.options;

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
        <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: xAxisLabel ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryKey}>
            {xAxisLabel && <Label value={xAxisLabel} offset={-20} position="insideBottom" />}
          </XAxis>
          <YAxis>
            {yAxisLabel && <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />}
          </YAxis>
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} activeDot={{ r: 8 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartDisplay;