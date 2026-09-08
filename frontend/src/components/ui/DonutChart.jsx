import { PieChart, Pie, Cell } from 'recharts'

export function DonutChart({
  percent = 0,
  size = 168,
  thickness = 16,
  fillColor = 'var(--color-charcoal)',
  trackColor = 'var(--accent-blue-gray)',
  centerLabel,
  centerSub,
}) {
  const data = [
    { name: 'value', value: percent },
    { name: 'rest', value: 100 - percent },
  ]
  const outerRadius = size / 2
  const innerRadius = outerRadius - thickness

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={true}
          cornerRadius={thickness / 2}
        >
          <Cell fill={fillColor} />
          <Cell fill={trackColor} />
        </Pie>
      </PieChart>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span
              className="text-ink font-bold tracking-[-0.02em]"
              style={{ fontSize: size * 0.155 }}
            >
              {centerLabel}
            </span>
          )}
          {centerSub && <span className="text-muted mt-0.5 text-xs">{centerSub}</span>}
        </div>
      )}
    </div>
  )
}
