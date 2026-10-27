import { useId, useState, type FormEvent } from 'react'
import type {
  BodyMeasurement,
  BodyMeasurementCreate,
} from '../../types/measurement'
import type { UserProfile } from '../../types/profile'

interface MeasurementFormProps {
  userProfile: UserProfile
  onMeasurementSaved: (measurement: BodyMeasurement) => void
  onCancel?: () => void
}

function getBMICategory(bmi: number): {
  label: string
  color: string
  badgeClass: string
} {
  if (bmi < 18.5) {
    return {
      label: 'Underweight',
      color: 'text-amber-800 dark:text-darkButter',
      badgeClass:
        'bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border-amber-300 dark:border-darkButter/40',
    }
  }
  if (bmi < 25.0) {
    return {
      label: 'Normal weight',
      color: 'text-status-success-fg dark:text-emerald-400',
      badgeClass:
        'bg-status-success dark:bg-emerald-950/40 text-status-success-fg dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
    }
  }
  if (bmi < 30.0) {
    return {
      label: 'Overweight',
      color: 'text-amber-800 dark:text-darkButter',
      badgeClass:
        'bg-butter/50 dark:bg-darkButter/20 text-amber-900 dark:text-darkButter border-amber-300 dark:border-darkButter/40',
    }
  }
  return {
    label: 'Obese',
    color: 'text-alert dark:text-darkCoral',
    badgeClass:
      'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border-alert/30 dark:border-darkCoral/30',
  }
}

function getDefaultDateTime(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

const COMMON_SOURCES = ['manual', 'smart scale', 'home scale', 'clinic']

export function MeasurementForm({
  userProfile,
  onMeasurementSaved,
  onCancel,
}: MeasurementFormProps) {
  const formId = useId()
  const [measuredAt, setMeasuredAt] = useState(getDefaultDateTime)
  const [source, setSource] = useState('manual')
  const [notes, setNotes] = useState('')

  // Core
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState(
    userProfile.height_cm != null ? String(userProfile.height_cm) : ''
  )

  // Composition
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [muscleMassKg, setMuscleMassKg] = useState('')
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState('')
  const [bodyWaterPct, setBodyWaterPct] = useState('')
  const [boneMineralKg, setBoneMineralKg] = useState('')
  const [visceralFat, setVisceralFat] = useState('')
  const [bmrKcal, setBmrKcal] = useState('')
  const [heartRateBpm, setHeartRateBpm] = useState('')

  // Circumferences
  const [waistCm, setWaistCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [chestCm, setChestCm] = useState('')
  const [armsCm, setArmsCm] = useState('')
  const [thighsCm, setThighsCm] = useState('')
  const [neckCm, setNeckCm] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live calculated BMI
  const numWeight = parseFloat(weightKg)
  const numHeight = parseFloat(heightCm)
  const calculatedBMI =
    !isNaN(numWeight) && !isNaN(numHeight) && numWeight > 0 && numHeight > 0
      ? Number((numWeight / (numHeight / 100) ** 2).toFixed(1))
      : null

  // Live calculated Fat Mass
  const numFatPct = parseFloat(bodyFatPct)
  const calculatedFatMass =
    !isNaN(numWeight) &&
    !isNaN(numFatPct) &&
    numWeight > 0 &&
    numFatPct >= 0 &&
    numFatPct <= 100
      ? Number((numWeight * (numFatPct / 100)).toFixed(2))
      : null

  // Live Waist-to-Hip Ratio
  const numWaist = parseFloat(waistCm)
  const numHip = parseFloat(hipCm)
  const waistToHipRatio =
    !isNaN(numWaist) && !isNaN(numHip) && numWaist > 0 && numHip > 0
      ? Number((numWaist / numHip).toFixed(2))
      : null

  const parseNum = (val: string): number | null => {
    if (!val.trim()) return null
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  const parseIntNum = (val: string): number | null => {
    if (!val.trim()) return null
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const payload: BodyMeasurementCreate = {
      measured_at: new Date(measuredAt).toISOString(),
      source: source.trim() || 'manual',
      notes: notes.trim() || null,
      weight_kg: parseNum(weightKg),
      height_cm: parseNum(heightCm),
      body_fat_percentage: parseNum(bodyFatPct),
      muscle_mass_kg: parseNum(muscleMassKg),
      skeletal_muscle_mass_kg: parseNum(skeletalMuscleMassKg),
      body_water_percentage: parseNum(bodyWaterPct),
      bone_mineral_content_kg: parseNum(boneMineralKg),
      visceral_fat_level: parseNum(visceralFat),
      basal_metabolic_rate_kcal: parseNum(bmrKcal),
      heart_rate_bpm: parseIntNum(heartRateBpm),
      waist_circumference_cm: parseNum(waistCm),
      hip_circumference_cm: parseNum(hipCm),
      chest_circumference_cm: parseNum(chestCm),
      arms_circumference_cm: parseNum(armsCm),
      thighs_circumference_cm: parseNum(thighsCm),
      neck_circumference_cm: parseNum(neckCm),
    }

    // Check that at least one metric is provided
    const hasMetric = Object.entries(payload).some(([key, val]) => {
      if (['measured_at', 'source', 'notes'].includes(key)) return false
      return val !== null && val !== undefined
    })

    if (!hasMetric) {
      setError(
        'Please enter at least one measurement (e.g. weight, waist circumference).'
      )
      return
    }

    // Plausible range client-side validations
    if (
      payload.weight_kg != null &&
      (payload.weight_kg < 20 || payload.weight_kg > 350)
    ) {
      setError('Weight must be between 20 kg and 350 kg.')
      return
    }
    if (
      payload.body_fat_percentage != null &&
      (payload.body_fat_percentage < 2 || payload.body_fat_percentage > 75)
    ) {
      setError('Body fat percentage must be between 2% and 75%.')
      return
    }

    setLoading(true)
    try {
      const { measurementService } = await import(
        '../../services/measurementService'
      )
      const saved = await measurementService.createMeasurement(payload)
      onMeasurementSaved(saved)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to record measurement'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Calculate pointer position for BMI gauge (clamped 15 to 35)
  const bmiClamped = calculatedBMI ? Math.min(Math.max(calculatedBMI, 15), 35) : 22
  const bmiGaugePercent = ((bmiClamped - 15) / 20) * 100

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="space-y-6 text-left transition-colors motion-reduce:transition-none"
    >
      {/* Studio Header Card */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-ink dark:text-darkInk">
              Log Body Measurement
            </h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary border border-sand/60 dark:border-darkBorder/60">
              Metric Units (kg, cm, %)
            </span>
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
            Historical measurements are permanently preserved and never overwritten.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-status-error dark:bg-darkSurface border border-border-card text-alert dark:text-darkCoral text-sm font-medium shadow-2xs"
        >
          {error}
        </div>
      )}

      {/* Module 1: Timing & Device Context */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-sand/60 dark:border-darkBorder/60 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
            1. Timing &amp; Device Context
          </h3>
          <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
            Required: Date &amp; Time
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={`${formId}-measuredAt`}
              className="block text-xs font-semibold text-ink dark:text-darkInk mb-1"
            >
              Date &amp; Time <span className="text-alert">*</span>
            </label>
            <input
              id={`${formId}-measuredAt`}
              type="datetime-local"
              required
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-source`}
              className="block text-xs font-semibold text-ink dark:text-darkInk mb-1"
            >
              Source / Device
            </label>
            <div className="space-y-2">
              <input
                id={`${formId}-source`}
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. manual, home scale, clinic"
                className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
              />
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SOURCES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition cursor-pointer ${
                      source === s
                        ? 'bg-midnight text-white border-midnight dark:bg-darkMidnight dark:border-darkMidnight'
                        : 'bg-canvas dark:bg-darkCanvas border-sand dark:border-darkBorder text-inkSecondary dark:text-darkInkSecondary hover:text-ink dark:hover:text-darkInk'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module 2: Core Scale Metrics with Interactive BMI Gauge */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-sand/60 dark:border-darkBorder/60 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
            2. Core Scale Metrics
          </h3>
          <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
            Weight &amp; Height
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-1">
            <div>
              <label
                htmlFor={`${formId}-weight`}
                className="block text-xs font-semibold text-ink dark:text-darkInk mb-1"
              >
                Weight (kg)
              </label>
              <input
                id={`${formId}-weight`}
                type="number"
                step="0.05"
                min="20"
                max="350"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 78.5"
                className="w-full px-3 py-2 text-base font-bold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-height`}
                className="block text-xs font-semibold text-ink dark:text-darkInk mb-1"
              >
                Height (cm)
              </label>
              <input
                id={`${formId}-height`}
                type="number"
                step="0.1"
                min="50"
                max="260"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g. 178"
                className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
              />
            </div>
          </div>

          {/* Interactive BMI Gauge Card */}
          <div className="lg:col-span-2 p-4 rounded-xl bg-canvas/70 dark:bg-darkCanvas/70 border border-sand dark:border-darkBorder flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-inkSecondary dark:text-darkInkSecondary">
                  Live BMI Health Gauge
                </span>
                {calculatedBMI !== null ? (
                  <div className="text-xs flex items-center gap-1.5">
                    <span className="text-inkSecondary dark:text-darkInkSecondary">
                      BMI Preview:
                    </span>
                    <strong className="text-ink dark:text-darkInk">
                      {calculatedBMI}
                    </strong>
                    <span
                      className={`font-semibold ${getBMICategory(calculatedBMI).color}`}
                    >
                      ({getBMICategory(calculatedBMI).label})
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary italic">
                    Enter weight to compute BMI
                  </span>
                )}
              </div>

              {/* Graphical Scale */}
              <div className="mt-3 relative pt-4 pb-1">
                {/* Pointer Marker */}
                {calculatedBMI !== null && (
                  <div
                    className="absolute top-0 transition-all duration-200"
                    style={{ left: `calc(${bmiGaugePercent}% - 8px)` }}
                  >
                    <div className="w-4 h-4 text-midnight dark:text-darkMidnight">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12,18 4,6 20,6" />
                      </svg>
                    </div>
                  </div>
                )}
                {/* Colored segments */}
                <div className="h-3 w-full rounded-full flex overflow-hidden border border-sand/80 dark:border-darkBorder/80">
                  <div
                    className="bg-amber-300 dark:bg-amber-600/70"
                    style={{ width: '17.5%' }}
                    title="Underweight (<18.5)"
                  />
                  <div
                    className="bg-emerald-400 dark:bg-emerald-600"
                    style={{ width: '32.5%' }}
                    title="Normal (18.5-24.9)"
                  />
                  <div
                    className="bg-amber-400 dark:bg-amber-500"
                    style={{ width: '25%' }}
                    title="Overweight (25-29.9)"
                  />
                  <div
                    className="bg-alert dark:bg-darkCoral"
                    style={{ width: '25%' }}
                    title="Obese (≥30)"
                  />
                </div>
              </div>

              {/* Scale Labels */}
              <div className="flex justify-between text-[10px] text-inkSecondary dark:text-darkInkSecondary mt-1 font-medium">
                <span>Underweight (&lt;18.5)</span>
                <span>Normal (18.5-24.9)</span>
                <span>Overweight (25-29.9)</span>
                <span>Obese (30+)</span>
              </div>
            </div>

            <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary mt-4 pt-2 border-t border-sand/60 dark:border-darkBorder/60">
              Informational screening metric based on WHO adult reference ranges. BMI does not differentiate between muscle and fat mass and is not a medical diagnosis.
            </div>
          </div>
        </div>
      </div>

      {/* Module 3: Body Composition Analyzer */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-sand/60 dark:border-darkBorder/60 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
              3. Body Composition Analyzer
            </h3>
            {calculatedFatMass !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary">
                Est. Fat Mass:{' '}
                <strong className="text-ink dark:text-darkInk">
                  {calculatedFatMass} kg
                </strong>
              </span>
            )}
          </div>
          <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
            Bioimpedance / DEXA
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor={`${formId}-fatPct`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Body Fat (%)
            </label>
            <input
              id={`${formId}-fatPct`}
              type="number"
              step="0.1"
              min="2"
              max="75"
              value={bodyFatPct}
              onChange={(e) => setBodyFatPct(e.target.value)}
              placeholder="e.g. 16.5"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-muscleKg`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Muscle Mass (kg)
            </label>
            <input
              id={`${formId}-muscleKg`}
              type="number"
              step="0.1"
              min="10"
              max="250"
              value={muscleMassKg}
              onChange={(e) => setMuscleMassKg(e.target.value)}
              placeholder="e.g. 62.0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-skeletalMuscle`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Skeletal Muscle (kg)
            </label>
            <input
              id={`${formId}-skeletalMuscle`}
              type="number"
              step="0.1"
              min="5"
              max="150"
              value={skeletalMuscleMassKg}
              onChange={(e) => setSkeletalMuscleMassKg(e.target.value)}
              placeholder="e.g. 35.2"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-waterPct`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Body Water (%)
            </label>
            <input
              id={`${formId}-waterPct`}
              type="number"
              step="0.1"
              min="20"
              max="85"
              value={bodyWaterPct}
              onChange={(e) => setBodyWaterPct(e.target.value)}
              placeholder="e.g. 58.0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-boneMineral`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Bone Mineral (kg)
            </label>
            <input
              id={`${formId}-boneMineral`}
              type="number"
              step="0.05"
              min="0.5"
              max="15"
              value={boneMineralKg}
              onChange={(e) => setBoneMineralKg(e.target.value)}
              placeholder="e.g. 3.2"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-visceralFat`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Visceral Fat Level
            </label>
            <input
              id={`${formId}-visceralFat`}
              type="number"
              step="0.5"
              min="1"
              max="50"
              value={visceralFat}
              onChange={(e) => setVisceralFat(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-bmr`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              BMR (kcal)
            </label>
            <input
              id={`${formId}-bmr`}
              type="number"
              step="1"
              min="500"
              max="5000"
              value={bmrKcal}
              onChange={(e) => setBmrKcal(e.target.value)}
              placeholder="e.g. 1750"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-heartRate`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Resting HR (bpm)
            </label>
            <input
              id={`${formId}-heartRate`}
              type="number"
              step="1"
              min="30"
              max="240"
              value={heartRateBpm}
              onChange={(e) => setHeartRateBpm(e.target.value)}
              placeholder="e.g. 62"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
        </div>
      </div>

      {/* Module 4: Circumference Tape Measurements */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-sand/60 dark:border-darkBorder/60 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
              4. Body Circumferences (cm)
            </h3>
            {waistToHipRatio !== null && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-medium">
                Waist-to-Hip:{' '}
                <strong className="text-ink dark:text-darkInk">
                  {waistToHipRatio}
                </strong>
              </span>
            )}
          </div>
          <span className="text-[11px] text-inkSecondary dark:text-darkInkSecondary">
            Measuring Tape
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div>
            <label
              htmlFor={`${formId}-waist`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Waist
            </label>
            <input
              id={`${formId}-waist`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
              placeholder="82.0"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-hip`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Hip
            </label>
            <input
              id={`${formId}-hip`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={hipCm}
              onChange={(e) => setHipCm(e.target.value)}
              placeholder="98.0"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-chest`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Chest
            </label>
            <input
              id={`${formId}-chest`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={chestCm}
              onChange={(e) => setChestCm(e.target.value)}
              placeholder="102.0"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-arms`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Arms
            </label>
            <input
              id={`${formId}-arms`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={armsCm}
              onChange={(e) => setArmsCm(e.target.value)}
              placeholder="34.5"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-thighs`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Thighs
            </label>
            <input
              id={`${formId}-thighs`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={thighsCm}
              onChange={(e) => setThighsCm(e.target.value)}
              placeholder="56.0"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-neck`}
              className="block text-xs font-medium text-ink dark:text-darkInk mb-1"
            >
              Neck
            </label>
            <input
              id={`${formId}-neck`}
              type="number"
              step="0.5"
              min="10"
              max="300"
              value={neckCm}
              onChange={(e) => setNeckCm(e.target.value)}
              placeholder="39.0"
              className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
            />
          </div>
        </div>
      </div>

      {/* Module 5: Notes & Context */}
      <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs space-y-3">
        <label
          htmlFor={`${formId}-notes`}
          className="block text-xs font-semibold text-ink dark:text-darkInk"
        >
          5. Notes &amp; Daily Context
        </label>
        <textarea
          id={`${formId}-notes`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Fasted morning check, well rested, measured before breakfast"
          className="w-full px-3 py-2 text-sm rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk focus:outline-none focus:ring-2 focus:ring-periwinkle dark:focus:ring-darkPeriwinkle transition"
        />
      </div>

      {/* Form Submission Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 text-sm font-semibold rounded-xl text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white shadow-xs transition cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
        >
          {loading ? 'Recording...' : 'Save Measurement'}
        </button>
      </div>
    </form>
  )
}
