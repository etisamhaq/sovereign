import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface UsageData {
  date: string;
  count: number;
}

interface ToolUsage {
  name: string;
  count: number;
  category: string;
}

interface UsageChartProps {
  usageData?: UsageData[];
  toolUsage?: ToolUsage[];
  chartType?: 'line' | 'bar' | 'doughnut';
}

export const UsageChart: React.FC<UsageChartProps> = ({
  usageData = [],
  toolUsage = [],
  chartType = 'line',
}) => {
  // Generate sample data if none provided
  if (usageData.length === 0) {
    const today = new Date();
    usageData = Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(today, 6 - i), 'yyyy-MM-dd'),
      count: Math.floor(Math.random() * 50) + 20,
    }));
  }

  if (toolUsage.length === 0) {
    toolUsage = [
      { name: 'Paraphrasing', count: 245, category: 'writing' },
      { name: 'Grammar Check', count: 189, category: 'writing' },
      { name: 'Essay Writer', count: 156, category: 'writing' },
      { name: 'Summarizer', count: 134, category: 'education' },
      { name: 'Citation Generator', count: 98, category: 'education' },
    ];
  }

  const lineChartData = {
    labels: usageData.map(d => format(new Date(d.date), 'MMM dd')),
    datasets: [
      {
        label: 'Daily Usage',
        data: usageData.map(d => d.count),
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const barChartData = {
    labels: toolUsage.map(t => t.name),
    datasets: [
      {
        label: 'Tool Usage',
        data: toolUsage.map(t => t.count),
        backgroundColor: [
          'rgba(79, 70, 229, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(244, 63, 94, 0.8)',
        ],
      },
    ],
  };

  const doughnutData = {
    labels: ['Writing', 'Education', 'Utility'],
    datasets: [
      {
        data: [
          toolUsage.filter(t => t.category === 'writing').reduce((sum, t) => sum + t.count, 0),
          toolUsage.filter(t => t.category === 'education').reduce((sum, t) => sum + t.count, 0),
          toolUsage.filter(t => t.category === 'utility').reduce((sum, t) => sum + t.count, 0),
        ],
        backgroundColor: [
          'rgba(79, 70, 229, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 146, 60, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: chartType !== 'doughnut' ? {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    } : undefined,
  };

  return (
    <div className="h-80">
      {chartType === 'line' && <Line data={lineChartData} options={options} />}
      {chartType === 'bar' && <Bar data={barChartData} options={options} />}
      {chartType === 'doughnut' && <Doughnut data={doughnutData} options={options} />}
    </div>
  );
};