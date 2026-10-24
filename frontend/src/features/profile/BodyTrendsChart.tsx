import { useEffect, useState } from 'react'
import type { BodyMeasurement } from '../../types/measurement'

type TrendMetric = 'weight_kg' | 'body_fat_percentage' | 'muscle_mass_kg' | 'waist_circumference_cm'

interface MetricConfig {
  key: TrendMetric
  label: string
  unit: string
  color: string
  strokeColor: string
  fillColor: string
}

const METRIC_CONFIGS: Record<TrendMetric, MetricConfig> = {
  weight_kg: {
    key: 'weight_kg',
    label: 'Body Weight',
    unit: 'kg',
    color: 'emerald',
    strokeColor: '#10b981',
    fillColor: 'rgba(16, 185, 129, 0.15)',
  },
  body_fat_percentage: {
    key: 'body_fat_percentage',
    label: 'Body Fat',
    unit: '%',
    color: 'amber',
    strokeColor: '#f59e0b',
    fillColor: 'rgba(245, 158, 11, 0.15)',
  },
  muscle_mass_kg: {
    key: 'muscle_mass_kg',
    label: 'Muscle Mass',
    unit: 'kg',
    color: 'blue',
    strokeColor: '#3b82f6',
    fillColor: 'rgba(59, 130, 246, 0.15)',
  },
  waist_circumference_cm: {
    key: 'waist_circumference_cm',
    label: 'Waist Circumference',
    unit: 'cm',
    color: 'purple',
    strokeColor: '#8b5cf6',
    fillColor: 'rgba(139, 92, 246, 0.15)',
  },
}

export function BodyTrendsChart() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>('weight_kg')
  const [activePoint, setActivePoint] = useState<{
    dateStr: string
    value: number
    unit: string
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const { measurementService } = await import('../../services/measurementService')
        // Fetch up to 100 recent measurements
        const res = await measurementService.listMeasurements({ pageSize: 100 })
        if (!ignore) {
          // Sort chronologically ascending for trends
          const sorted = [...res.items].sort(
            (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
          )
          setMeasurements(sorted)
          setError(null)
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load measurements')
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const config = METRIC_CONFIGS[selectedMetric]

  // Filter ONLY items with real, non-null values for the chosen metric (NEVER fabricate or interpolate)
  const dataPoints = measurements
    .filter((m) => {
      const val = m[selectedMetric]
      return val !== null && val !== undefined && !isNaN(Number(val))
    })
    .map((m) => ({
      id: m.id,
      date: new Date(m.measured_at),
      dateStr: new Date(m.measured_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      fullDateStr: new Date(m.measured_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      value: Number(m[selectedMetric]),
    }))

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
        <p>Loading measurement trend history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs">
        {error}
      </div>
    )
  }

  // Summary stats
  const values = dataPoints.map((d) => d.value)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 0
  const latestVal = values.length > 0 ? (values[values.length - 1] ?? null) : null
  const earliestVal = values.length > 0 ? (values[0] ?? null) : null
  const delta =
    latestVal !== null && earliestVal !== null && values.length > 1
      ? Math.round((latestVal - earliestVal) * 10) / 10
      : null

  // SVG Chart Geometry
  const width = 760
  const height = 260
  const paddingX = 50
  const paddingY = 30
  const chartW = width - paddingX * 2
  const chartH = height - paddingY * 2

  // Y scale with a slight buffer so line isn't clipped
  const range = maxVal - minVal || 1
  const yBuffer = range * 0.15
  const yMin = Math.max(0, minVal - yBuffer)
  const yMax = maxVal + yBuffer

  const getX = (index: number) => {
    if (dataPoints.length === 1) return width / 2
    return paddingX + (index / (dataPoints.length - 1)) * chartW
  }

  const getY = (val: number) => {
    const norm = (val - yMin) / (yMax - yMin)
    return height - paddingY - norm * chartH
  }

  const svgPoints = dataPoints.map((p, idx) => `${getX(idx)},${getY(p.value)}`).join(' ')

  // Generate gridline levels
  const gridSteps = 4
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = yMin + (i / gridSteps) * (yMax - yMin)
    return {
      value: Math.round(val * 10) / 10,
      y: getY(val),
    }
  })

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs text-left space-y-6">
      {/* Metric Selector Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Body Measurement Trends
          </h3>
          <p className="text-xs text-slate-500">
            Real recorded measurements plotted over time. No fabricated or interpolated points.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {(Object.keys(METRIC_CONFIGS) as TrendMetric[]).map((key) => {
            const m = METRIC_CONFIGS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedMetric(key)
                  setActivePoint(null)
                }}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedMetric === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {dataPoints.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">Latest Recorded</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {latestVal} <span className="text-xs font-normal text-slate-500">{config.unit}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">Overall Change</span>
            <div
              className={`text-lg font-bold mt-0.5 ${
                delta !== null && delta !== 0
                  ? delta < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {delta !== null ? (delta > 0 ? `+${delta}` : `${delta}`) : '--'}{' '}
              <span className="text-xs font-normal text-slate-500">{config.unit}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">Min in History</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {minVal} <span className="text-xs font-normal text-slate-500">{config.unit}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">Max in History</span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {maxVal} <span className="text-xs font-normal text-slate-500">{config.unit}</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive SVG Chart Container */}
      {dataPoints.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">
            No {config.label.toLowerCase()} records found
          </p>
          <p>Log measurements including {config.label.toLowerCase()} to generate historical trends.</p>
        </div>
      ) : dataPoints.length === 1 && dataPoints[0] ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
            Single Measurement: {dataPoints[0].value} {config.unit}
          </p>
          <p className="text-slate-400">
            Recorded on {dataPoints[0].fullDateStr}. Log at least one more measurement to draw a line trend.
          </p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          {/* Tooltip Overlay */}
          {activePoint && (
            <div
              className="absolute z-10 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all"
              style={{
                left: `${(activePoint.x / width) * 100}%`,
                top: `${(activePoint.y / height) * 100}%`,
                marginTop: '-10px',
              }}
            >
              <div className="font-bold">
                {activePoint.value} {activePoint.unit}
              </div>
              <div className="text-[10px] opacity-80">{activePoint.dateStr}</div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[500px] select-none"
            role="img"
            aria-label={`${config.label} trend chart showing ${dataPoints.length} measurements`}
          >
            {/* Horizontal Gridlines and Y Labels */}
            {gridLines.map((gl, i) => (
              <g key={`gl-${i}`}>
                <line
                  x1={paddingX}
                  y1={gl.y}
                  x2={width - paddingX}
                  y2={gl.y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-200 dark:text-slate-800"
                />
                <text
                  x={paddingX - 8}
                  y={gl.y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-medium"
                >
                  {gl.value}
                </text>
              </g>
            ))}

            {/* Shaded Area */}
            <polygon
              points={`
                ${getX(0)},${height - paddingY}
                ${svgPoints}
                ${getX(dataPoints.length - 1)},${height - paddingY}
              `}
              fill={config.fillColor}
            />

            {/* Trend Line */}
            <polyline
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />

            {/* Individual Data Points */}
            {dataPoints.map((p, idx) => {
              const cx = getX(idx)
              const cy = getY(p.value)
              const isSelected = activePoint?.dateStr === p.fullDateStr

              return (
                <g key={`pt-${p.id || idx}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : 4}
                    fill={config.strokeColor}
                    stroke="white"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.value} ${config.unit} on ${p.fullDateStr}`}
                    onMouseEnter={() =>
                      setActivePoint({
                        dateStr: p.fullDateStr,
                        value: p.value,
                        unit: config.unit,
                        x: cx,
                        y: cy,
                      })
                    }
                    onMouseLeave={() => setActivePoint(null)}
                    onFocus={() =>
                      setActivePoint({
                        dateStr: p.fullDateStr,
                        value: p.value,
                        unit: config.unit,
                        x: cx,
                        y: cy,
                      })
                    }
                    onBlur={() => setActivePoint(null)}
                    className="cursor-pointer transition-all duration-150 focus:outline-hidden"
                  />
                  {/* X Axis Label */}
                  <text
                    x={cx}
                    y={height - paddingY + 16}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-medium"
                  >
                    {p.dateStr}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
