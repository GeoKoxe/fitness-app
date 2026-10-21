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
    if (!window.confirm('Are you sure you want to delete this measurement record?')) {
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
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-3" />
        <p className="text-sm">Loading measurement records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-center">
        <p className="text-red-700 dark:text-red-300 font-medium mb-3">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setReloadTrigger((r) => r + 1)
          }}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  if (measurements.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          No Measurements Recorded Yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          Start recording weight, body fat %, muscle mass, and circumferences to build your long-term health timeline.
        </p>
        <button
          type="button"
          onClick={onLogNew}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
        >
          Log Your First Measurement
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden text-left">
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Measurement History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Showing {measurements.length} of {total} historical records (most recent first)
          </p>
        </div>
        <button
          type="button"
          onClick={onLogNew}
          className="self-start sm:self-auto px-4 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition"
        >
          + Log New
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Weight</th>
              <th scope="col" className="px-4 py-3">BMI</th>
              <th scope="col" className="px-4 py-3">Body Fat</th>
              <th scope="col" className="px-4 py-3">Muscle</th>
              <th scope="col" className="px-4 py-3">Waist</th>
              <th scope="col" className="px-4 py-3">Source</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {measurements.map((m) => {
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
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{dateStr}</span>
                    <span className="block text-xs text-slate-400">{timeStr}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {m.weight_kg != null ? `${m.weight_kg} kg` : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.bmi != null ? (
                      <span>
                        {m.bmi}{' '}
                        {m.bmi_calculated && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (calc)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.body_fat_percentage != null ? `${m.body_fat_percentage}%` : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.muscle_mass_kg != null ? `${m.muscle_mass_kg} kg` : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.waist_circumference_cm != null ? `${m.waist_circumference_cm} cm` : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {m.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMeasurement(m)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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
