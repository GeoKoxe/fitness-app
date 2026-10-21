import type { BodyMeasurement } from '../../types/measurement'

interface MeasurementDetailModalProps {
  measurement: BodyMeasurement | null
  onClose: () => void
}

export function MeasurementDetailModal({
  measurement,
  onClose,
}: MeasurementDetailModalProps) {
  if (!measurement) return null

  const renderMetric = (label: string, value: number | null | undefined, unit: string) => (
    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</div>
      <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
        {value != null ? (
          <>
            {value} <span className="text-xs font-normal text-slate-500">{unit}</span>
          </>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Not recorded</span>
        )}
      </div>
    </div>
  )

  const dateStr = new Date(measurement.measured_at).toLocaleString('el-GR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-left">
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Measurement Details
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{dateStr}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {measurement.source}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {measurement.notes && (
          <div className="my-4 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 text-sm text-emerald-900 dark:text-emerald-200">
            <strong>Notes:</strong> {measurement.notes}
          </div>
        )}

        {/* Core */}
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Core Metrics
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {renderMetric('Weight', measurement.weight_kg, 'kg')}
            {renderMetric('Height', measurement.height_cm, 'cm')}
            {renderMetric(
              'BMI',
              measurement.bmi,
              measurement.bmi_calculated ? '(calc)' : ''
            )}
          </div>
        </div>

        {/* Composition */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Body Composition
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {renderMetric('Body Fat', measurement.body_fat_percentage, '%')}
            {renderMetric('Fat Mass', measurement.fat_mass_kg, 'kg')}
            {renderMetric('Muscle Mass', measurement.muscle_mass_kg, 'kg')}
            {renderMetric('Skeletal Muscle', measurement.skeletal_muscle_mass_kg, 'kg')}
            {renderMetric('Body Water', measurement.body_water_percentage, '%')}
            {renderMetric('Water Mass', measurement.body_water_mass_kg, 'kg')}
            {renderMetric('Bone Mineral', measurement.bone_mineral_content_kg, 'kg')}
            {renderMetric('Visceral Fat', measurement.visceral_fat_level, 'lvl')}
            {renderMetric('BMR', measurement.basal_metabolic_rate_kcal, 'kcal')}
            {renderMetric('Heart Rate', measurement.heart_rate_bpm, 'bpm')}
          </div>
        </div>

        {/* Circumferences */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Circumferences
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {renderMetric('Waist', measurement.waist_circumference_cm, 'cm')}
            {renderMetric('Hip', measurement.hip_circumference_cm, 'cm')}
            {renderMetric('Chest', measurement.chest_circumference_cm, 'cm')}
            {renderMetric('Arms', measurement.arms_circumference_cm, 'cm')}
            {renderMetric('Thighs', measurement.thighs_circumference_cm, 'cm')}
            {renderMetric('Neck', measurement.neck_circumference_cm, 'cm')}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

