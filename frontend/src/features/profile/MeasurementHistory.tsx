import { useEffect, useState } from 'react'
import type { BodyMeasurement } from '../../types/measurement'
import { MeasurementDetailModal } from './MeasurementDetailModal'

interface MeasurementHistoryProps {
  refreshTrigger: number
  onLogNew: () => void
}

export function MeasurementHistory({
  refreshTrigger,
  onLogNew,
}: MeasurementHistoryProps) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const [selectedMeasurement, setSelectedMeasurement] =
    useState<BodyMeasurement | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        const { measurementService } = await import(
          '../../services/measurementService'
        )
        const data = await measurementService.listMeasurements({
          page,
          pageSize: 15,
        })
        if (!ignore) {
          setMeasurements(data.items)
          setTotal(data.total)
          setPage(data.page)
          setTotalPages(data.total_pages)
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load history'
          setError(msg)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [page, refreshTrigger, reloadTrigger])

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this measurement record?'
      )
    ) {
      return
    }
    setDeletingId(id)
    try {
      const { measurementService } = await import(
        '../../services/measurementService'
      )
      await measurementService.deleteMeasurement(id)
      const data = await measurementService.listMeasurements({
        page,
        pageSize: 15,
      })
      setMeasurements(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete measurement')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading && measurements.length === 0) {
    return (
      <div className="p-12 text-center text-inkSecondary dark:text-darkInkSecondary">
        <div className="inline-block animate-spin w-8 h-8 border-3 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-medium">Loading measurement records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="p-6 bg-status-error dark:bg-darkSurface border border-border-card text-center rounded-2xl"
      >
        <p className="text-alert dark:text-darkCoral font-medium mb-3">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setReloadTrigger((r) => r + 1)
          }}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-alert text-white hover:opacity-90 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert"
        >
          Retry
        </button>
      </div>
    )
  }

  if (measurements.length === 0) {
    return (
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-12 text-center shadow-xs transition-colors motion-reduce:transition-none">
        <div
          className="w-14 h-14 mx-auto rounded-2xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder flex items-center justify-center text-midnight dark:text-darkMidnight mb-4"
          aria-hidden="true"
        >
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-ink dark:text-darkInk mb-1">
          No Measurements Recorded Yet
        </h3>
        <p className="text-sm text-inkSecondary dark:text-darkInkSecondary max-w-md mx-auto mb-6">
          Start recording weight, body fat %, muscle mass, and circumferences to
          build your long-term health timeline.
        </p>
        <button
          type="button"
          onClick={onLogNew}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
        >
          Log Your First Measurement
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl shadow-xs overflow-hidden text-left transition-colors motion-reduce:transition-none">
      {/* Header bar */}
      <div className="p-4 sm:p-6 border-b border-sand dark:border-darkBorder flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink dark:text-darkInk">
            Measurement History
          </h2>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            Showing {measurements.length} of {total} historical records (most
            recent first)
          </p>
        </div>
        <button
          type="button"
          onClick={onLogNew}
          className="self-start sm:self-auto px-4 py-2 text-xs font-semibold rounded-xl text-white bg-midnight dark:bg-darkMidnight dark:text-white hover:opacity-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
        >
          + Log New
        </button>
      </div>

      {/* Desktop & Tablet Table View (>= 640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm text-ink dark:text-darkInk">
          <caption className="sr-only">
            Historical records of body measurements
          </caption>
          <thead className="bg-canvas dark:bg-darkCanvas text-xs font-semibold uppercase text-inkSecondary dark:text-darkInkSecondary border-b border-sand dark:border-darkBorder">
            <tr>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
              <th scope="col" className="px-4 py-3">
                Weight
              </th>
              <th scope="col" className="px-4 py-3">
                BMI
              </th>
              <th scope="col" className="px-4 py-3">
                Body Fat
              </th>
              <th scope="col" className="px-4 py-3">
                Muscle
              </th>
              <th scope="col" className="px-4 py-3">
                Waist
              </th>
              <th scope="col" className="px-4 py-3">
                Source
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/70 dark:divide-darkBorder">
            {measurements.map((m, idx) => {
              const prev = measurements[idx + 1]
              const weightDelta =
                m.weight_kg != null && prev?.weight_kg != null
                  ? Math.round((m.weight_kg - prev.weight_kg) * 10) / 10
                  : null

              const dateStr = new Date(m.measured_at).toLocaleDateString(
                'el-GR',
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }
              )
              const timeStr = new Date(m.measured_at).toLocaleTimeString(
                'el-GR',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )

              return (
                <tr
                  key={m.id}
                  className="hover:bg-canvas/50 dark:hover:bg-darkCanvas/40 transition motion-reduce:transition-none"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-ink dark:text-darkInk">
                      {dateStr}
                    </span>
                    <span className="block text-xs text-inkSecondary dark:text-darkInkSecondary">
                      {timeStr}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-ink dark:text-darkInk">
                    {m.weight_kg != null ? (
                      <div className="flex items-center gap-1.5">
                        <span>{m.weight_kg} kg</span>
                        {weightDelta !== null && (
                          <span
                            className={`text-[11px] font-semibold ${
                              weightDelta < 0
                                ? 'text-status-success-fg dark:text-emerald-400'
                                : weightDelta > 0
                                  ? 'text-midnight dark:text-darkMidnight'
                                  : 'text-inkSecondary dark:text-darkInkSecondary'
                            }`}
                          >
                            {weightDelta > 0 ? `↑ +${weightDelta}` : `↓ ${weightDelta}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.bmi != null ? (
                      <span>
                        {m.bmi}{' '}
                        {m.bmi_calculated && (
                          <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary font-normal">
                            (calc)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.body_fat_percentage != null ? (
                      `${m.body_fat_percentage}%`
                    ) : (
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.muscle_mass_kg != null ? (
                      `${m.muscle_mass_kg} kg`
                    ) : (
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.waist_circumference_cm != null ? (
                      `${m.waist_circumference_cm} cm`
                    ) : (
                      <span className="text-inkSecondary dark:text-darkInkSecondary">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-medium">
                      {m.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMeasurement(m)}
                      className="text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle rounded"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="text-xs font-semibold text-alert dark:text-darkCoral hover:underline disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert rounded"
                    >
                      {deletingId === m.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Timeline View (< 640px) */}
      <div className="sm:hidden divide-y divide-sand/70 dark:divide-darkBorder">
        {measurements.map((m, idx) => {
          const prev = measurements[idx + 1]
          const weightDelta =
            m.weight_kg != null && prev?.weight_kg != null
              ? Math.round((m.weight_kg - prev.weight_kg) * 10) / 10
              : null

          const dateStr = new Date(m.measured_at).toLocaleDateString('el-GR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          const timeStr = new Date(m.measured_at).toLocaleTimeString('el-GR', {
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div key={`mob-${m.id}`} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-ink dark:text-darkInk">
                    {dateStr}
                  </span>
                  <span className="ml-2 text-xs text-inkSecondary dark:text-darkInkSecondary">
                    {timeStr}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary">
                  {m.source}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand/70 dark:border-darkBorder">
                  <span className="text-inkSecondary dark:text-darkInkSecondary block">Weight</span>
                  <span className="text-sm font-bold text-ink dark:text-darkInk">
                    {m.weight_kg != null ? `${m.weight_kg} kg` : '--'}
                  </span>
                  {weightDelta !== null && (
                    <span
                      className={`block text-[11px] font-semibold ${
                        weightDelta < 0
                          ? 'text-status-success-fg dark:text-emerald-400'
                          : weightDelta > 0
                            ? 'text-midnight dark:text-darkMidnight'
                            : 'text-inkSecondary dark:text-darkInkSecondary'
                      }`}
                    >
                      {weightDelta > 0 ? `↑ +${weightDelta}` : `↓ ${weightDelta}`}
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand/70 dark:border-darkBorder">
                  <span className="text-inkSecondary dark:text-darkInkSecondary block">BMI</span>
                  <span className="text-sm font-bold text-ink dark:text-darkInk">
                    {m.bmi != null ? m.bmi : '--'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand/70 dark:border-darkBorder">
                  <span className="text-inkSecondary dark:text-darkInkSecondary block">Body Fat</span>
                  <span className="text-sm font-bold text-ink dark:text-darkInk">
                    {m.body_fat_percentage != null ? `${m.body_fat_percentage}%` : '--'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand/70 dark:border-darkBorder">
                  <span className="text-inkSecondary dark:text-darkInkSecondary block">Muscle Mass</span>
                  <span className="text-sm font-bold text-ink dark:text-darkInk">
                    {m.muscle_mass_kg != null ? `${m.muscle_mass_kg} kg` : '--'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedMeasurement(m)}
                  className="text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle rounded"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-xs font-semibold text-alert dark:text-darkCoral hover:underline disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert rounded"
                >
                  {deletingId === m.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-sand dark:border-darkBorder flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-sand dark:border-darkBorder disabled:opacity-40 hover:bg-canvas dark:hover:bg-darkCanvas transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
          >
            Previous
          </button>
          <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-sand dark:border-darkBorder disabled:opacity-40 hover:bg-canvas dark:hover:bg-darkCanvas transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
          >
            Next
          </button>
        </div>
      )}

      {selectedMeasurement && (
        <MeasurementDetailModal
          measurement={selectedMeasurement}
          onClose={() => setSelectedMeasurement(null)}
        />
      )}
    </div>
  )
}
