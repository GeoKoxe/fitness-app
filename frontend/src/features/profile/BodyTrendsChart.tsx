import { useEffect, useState } from 'react'
import type { BodyMeasurement } from '../../types/measurement'

type TrendMetric =
  | 'weight_kg'
  | 'body_fat_percentage'
  | 'muscle_mass_kg'
  | 'waist_circumference_cm'

interface MetricConfig {
  key: TrendMetric
  label: string
  unit: string
  strokeColor: string
  darkStrokeColor: string
  fillColor: string
  darkFillColor: string
}

const METRIC_CONFIGS: Record<TrendMetric, MetricConfig> = {
  weight_kg: {
    key: 'weight_kg',
    label: 'Body Weight',
    unit: 'kg',
    strokeColor: '#324376', // Midnight Navy
    darkStrokeColor: '#8EA2D8', // Bright Periwinkle
    fillColor: 'rgba(50, 67, 118, 0.12)',
    darkFillColor: 'rgba(142, 162, 216, 0.15)',
  },
  body_fat_percentage: {
    key: 'body_fat_percentage',
    label: 'Body Fat',
    unit: '%',
    strokeColor: '#C2455A', // Alert Crimson
    darkStrokeColor: '#FF8A8E', // Coral Light
    fillColor: 'rgba(194, 69, 90, 0.12)',
    darkFillColor: 'rgba(255, 138, 142, 0.15)',
  },
  muscle_mass_kg: {
    key: 'muscle_mass_kg',
    label: 'Muscle Mass',
    unit: 'kg',
    strokeColor: '#255D85', // Slate Blue
    darkStrokeColor: '#76B3DC', // Bright Blue
    fillColor: 'rgba(37, 93, 133, 0.12)',
    darkFillColor: 'rgba(118, 179, 220, 0.15)',
  },
  waist_circumference_cm: {
    key: 'waist_circumference_cm',
    label: 'Waist Circumference',
    unit: 'cm',
    strokeColor: '#586BA4', // Periwinkle
    darkStrokeColor: '#A5B5E4', // Soft Lavender
    fillColor: 'rgba(88, 107, 164, 0.12)',
    darkFillColor: 'rgba(165, 181, 228, 0.15)',
  },
}

export function BodyTrendsChart() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>('weight_kg')
  const [showDataTable, setShowDataTable] = useState(false)
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
        const { measurementService } = await import(
          '../../services/measurementService'
        )
        const res = await measurementService.listMeasurements({ pageSize: 100 })
        if (!ignore) {
          // Sort chronologically ascending for trend visualization
          const sorted = [...res.items].sort(
            (a, b) =>
              new Date(a.measured_at).getTime() -
              new Date(b.measured_at).getTime()
          )
          setMeasurements(sorted)
          setError(null)
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : 'Failed to load measurements'
          )
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
      <div className="p-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-2" />
        <p>Loading measurement trend history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="p-4 bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral rounded-2xl text-xs"
      >
        {error}
      </div>
    )
  }

  // Summary statistics
  const values = dataPoints.map((d) => d.value)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 0
  const latestVal =
    values.length > 0 ? (values[values.length - 1] ?? null) : null
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

  // Y scale with a slight buffer so the curve does not clip
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

  const svgPoints = dataPoints
    .map((p, idx) => `${getX(idx)},${getY(p.value)}`)
    .join(' ')

  // Grid steps
  const gridSteps = 4
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = yMin + (i / gridSteps) * (yMax - yMin)
    return {
      value: Math.round(val * 10) / 10,
      y: getY(val),
    }
  })

  return (
    <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-5 sm:p-6 shadow-xs text-left space-y-6 transition-colors motion-reduce:transition-none">
      {/* Metric Selector Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-ink dark:text-darkInk">
            Body Measurement Trends
          </h3>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Real recorded measurements plotted chronologically. No fabricated data.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-canvas dark:bg-darkCanvas border border-sand/60 dark:border-darkBorder/60 rounded-xl text-xs font-semibold">
          {(Object.keys(METRIC_CONFIGS) as TrendMetric[]).map((key) => {
            const m = METRIC_CONFIGS[key]
            const isSelected = selectedMetric === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedMetric(key)
                  setActivePoint(null)
                }}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-lg transition motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle ${
                  isSelected
                    ? 'bg-midnight text-white dark:bg-darkMidnight dark:text-white shadow-2xs'
                    : 'text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
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
          <div className="p-3 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand dark:border-darkBorder">
            <span className="text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary">
              Latest Recorded
            </span>
            <div className="text-lg font-bold text-ink dark:text-darkInk mt-0.5">
              {latestVal}{' '}
              <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                {config.unit}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand dark:border-darkBorder">
            <span className="text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary">
              Overall Change
            </span>
            <div className="text-lg font-bold mt-0.5 text-ink dark:text-darkInk">
              {delta !== null ? (
                <>
                  <span
                    className={
                      delta < 0
                        ? 'text-status-success-fg dark:text-emerald-400'
                        : delta > 0
                          ? 'text-midnight dark:text-darkMidnight'
                          : 'text-inkSecondary dark:text-darkInkSecondary'
                    }
                  >
                    {delta > 0 ? `+${delta}` : `${delta}`}
                  </span>{' '}
                  <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                    {config.unit}
                  </span>
                </>
              ) : (
                '--'
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand dark:border-darkBorder">
            <span className="text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary">
              Min in History
            </span>
            <div className="text-lg font-bold text-ink dark:text-darkInk mt-0.5">
              {minVal}{' '}
              <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                {config.unit}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand dark:border-darkBorder">
            <span className="text-[11px] font-medium text-inkSecondary dark:text-darkInkSecondary">
              Max in History
            </span>
            <div className="text-lg font-bold text-ink dark:text-darkInk mt-0.5">
              {maxVal}{' '}
              <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                {config.unit}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive SVG Chart or Empty State */}
      {dataPoints.length === 0 ? (
        <div className="p-12 text-center text-xs text-inkSecondary dark:text-darkInkSecondary border border-dashed border-sand dark:border-darkBorder rounded-2xl">
          <p className="font-semibold text-ink dark:text-darkInk mb-1">
            No {config.label.toLowerCase()} records found
          </p>
          <p>
            Log measurements including {config.label.toLowerCase()} to generate
            historical trends.
          </p>
        </div>
      ) : dataPoints.length === 1 && dataPoints[0] ? (
        <div className="p-8 text-center text-xs text-inkSecondary dark:text-darkInkSecondary border border-dashed border-sand dark:border-darkBorder rounded-2xl space-y-1">
          <p className="font-semibold text-sm text-ink dark:text-darkInk">
            Single Measurement: {dataPoints[0].value} {config.unit}
          </p>
          <p className="text-inkSecondary dark:text-darkInkSecondary">
            Recorded on {dataPoints[0].fullDateStr}. Log at least one more
            measurement to draw a line trend.
          </p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          {/* Accessible Tooltip Overlay */}
          {activePoint && (
            <div
              className="absolute z-10 px-2.5 py-1.5 bg-midnight dark:bg-darkCanvas text-white dark:text-darkInk text-[11px] rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all"
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
                  className="text-sand dark:text-darkBorder"
                />
                <text
                  x={paddingX - 8}
                  y={gl.y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-inkSecondary dark:fill-darkInkSecondary font-medium"
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
              className="dark:hidden"
            />
            <polygon
              points={`
                ${getX(0)},${height - paddingY}
                ${svgPoints}
                ${getX(dataPoints.length - 1)},${height - paddingY}
              `}
              fill={config.darkFillColor}
              className="hidden dark:block"
            />

            {/* Trend Line (Light mode) */}
            <polyline
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
              className="dark:hidden"
            />
            {/* Trend Line (Dark mode) */}
            <polyline
              fill="none"
              stroke={config.darkStrokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
              className="hidden dark:block"
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
                    className="text-[10px] fill-inkSecondary dark:fill-darkInkSecondary font-medium"
                  >
                    {p.dateStr}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Accessible Data Table Toggle for Screen Readers and Keyboard Users */}
          <div className="mt-4 pt-3 border-t border-sand/60 dark:border-darkBorder/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDataTable((prev) => !prev)}
              className="text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle rounded"
            >
              {showDataTable
                ? 'Hide Accessible Data Table'
                : 'Show Accessible Data Table'}
            </button>
            <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
              {dataPoints.length} data points
            </span>
          </div>

          {showDataTable && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs text-left text-ink dark:text-darkInk border border-sand dark:border-darkBorder rounded-xl">
                <caption className="sr-only">
                  {config.label} historical recorded data table
                </caption>
                <thead className="bg-canvas dark:bg-darkCanvas border-b border-sand dark:border-darkBorder font-semibold">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Date &amp; Time
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Value ({config.unit})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand dark:divide-darkBorder">
                  {dataPoints.map((p) => (
                    <tr key={p.id || p.fullDateStr}>
                      <td className="px-3 py-1.5">{p.fullDateStr}</td>
                      <td className="px-3 py-1.5 font-medium">
                        {p.value} {config.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
