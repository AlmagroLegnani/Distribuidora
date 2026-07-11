interface StatsCardProps {
  title: string;
  value: number | string;
  description?: string;
  color?: 'blue' | 'yellow' | 'green' | 'red' | 'gray';
  icon?: React.ReactNode;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
};

const iconBg = {
  blue: 'bg-blue-100 text-blue-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
};

export default function StatsCard({ title, value, description, color = 'blue', icon }: StatsCardProps) {
  return (
    <div className={`card p-5 border ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {description && <p className="text-xs mt-1 opacity-60">{description}</p>}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${iconBg[color]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
