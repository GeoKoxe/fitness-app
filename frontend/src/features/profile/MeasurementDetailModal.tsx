import { useEffect } from 'react'
import type { BodyMeasurement } from '../../types/measurement'

interface MeasurementDetailModalProps {
  measurement: BodyMeasurement | null
  onClose: () => void
}

export function MeasurementDetailModal({
  measurement,
  onClose,
}: MeasurementDetailModalProps) {
  // Dismiss on Escape key
  useEffect(() => {
    if (!measurement) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [measurement, onClose])

  if (!measurement) return null

  const renderMetric = (
    label: string,
    value: number | null | undefined,
    unit: string
  ) => (
    <div className="bg-canvas/60 dark:bg-darkCanvas/60 p-3 rounded-xl border border-sand/80 dark:border-darkBorder/80">
      <div className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
        {label}
      </div>
      <div className="text-base font-semibold text-ink dark:text-darkInk mt-0.5">
        {value != null ? (
          <>
            {value}{' '}
            <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
              {unit}
            </span>
          </>
        ) : (
          <span className="text-xs text-inkSecondary dark:text-darkInkSecondary italic">
            Not recorded
          </span>
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
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity motion-reduce:transition-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-left transition-colors motion-reduce:transition-none"
      >
        <div className="flex justify-between items-start pb-4 border-b border-sand dark:border-darkBorder">
          <div>
            <h2
              id="modal-title"
              className="text-lg font-bold text-ink dark:text-darkInk"
            >
              Measurement Details
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-inkSecondary dark:text-darkInkSecondary">
                {dateStr}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary">
                {measurement.source}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk hover:bg-mist/40 dark:hover:bg-darkMist/40 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {measurement.notes && (
          <div className="my-4 p-3 rounded-xl bg-mist/30 dark:bg-darkMist/30 border border-sand dark:border-darkBorder text-sm text-ink dark:text-darkInk">
            <strong className="font-semibold text-ink dark:text-darkInk">
              Notes:
            </strong>{' '}
            {measurement.notes}
          </div>
        )}

        {/* Core Metrics */}
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary mb-2">
            Core Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {renderMetric('Weight', measurement.weight_kg, 'kg')}
            {renderMetric('Height', measurement.height_cm, 'cm')}
            {renderMetric(
              'BMI',
              measurement.bmi,
              measurement.bmi_calculated ? '(calc)' : ''
            )}
          </div>
        </div>

        {/* Body Composition */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary mb-2">
            Body Composition
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {renderMetric('Body Fat', measurement.body_fat_percentage, '%')}
            {renderMetric('Fat Mass', measurement.fat_mass_kg, 'kg')}
            {renderMetric('Muscle Mass', measurement.muscle_mass_kg, 'kg')}
            {renderMetric(
              'Skeletal Muscle',
              measurement.skeletal_muscle_mass_kg,
              'kg'
            )}
            {renderMetric('Body Water', measurement.body_water_percentage, '%')}
            {renderMetric('Water Mass', measurement.body_water_mass_kg, 'kg')}
            {renderMetric(
              'Bone Mineral',
              measurement.bone_mineral_content_kg,
              'kg'
            )}
            {renderMetric(
              'Visceral Fat',
              measurement.visceral_fat_level,
              'lvl'
            )}
            {renderMetric('BMR', measurement.basal_metabolic_rate_kcal, 'kcal')}
            {renderMetric('Heart Rate', measurement.heart_rate_bpm, 'bpm')}
          </div>
        </div>

        {/* Circumferences */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary mb-2">
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

        <div className="mt-6 pt-4 border-t border-sand dark:border-darkBorder flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
