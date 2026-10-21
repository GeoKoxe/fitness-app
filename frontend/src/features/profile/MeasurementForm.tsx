import { useId, useState, type FormEvent } from 'react'
import type { BodyMeasurement, BodyMeasurementCreate } from '../../types/measurement'
import type { UserProfile } from '../../types/profile'

interface MeasurementFormProps {
  userProfile: UserProfile
  onMeasurementSaved: (measurement: BodyMeasurement) => void
  onCancel?: () => void
}

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-amber-500' }
  if (bmi < 25.0) return { label: 'Normal weight', color: 'text-emerald-500' }
  if (bmi < 30.0) return { label: 'Overweight', color: 'text-amber-500' }
  return { label: 'Obese', color: 'text-red-500' }
}

function getDefaultDateTime(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

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
    !isNaN(numWeight) && !isNaN(numFatPct) && numWeight > 0 && numFatPct >= 0 && numFatPct <= 100
      ? Number((numWeight * (numFatPct / 100)).toFixed(2))
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
      setError('Please enter at least one measurement (e.g. weight, waist circumference).')
      return
    }

    // Plausible range client-side validations
    if (payload.weight_kg != null && (payload.weight_kg < 20 || payload.weight_kg > 350)) {
      setError('Weight must be between 20 kg and 350 kg.')
      return
    }
    if (payload.body_fat_percentage != null && (payload.body_fat_percentage < 2 || payload.body_fat_percentage > 75)) {
      setError('Body fat percentage must be between 2% and 75%.')
      return
    }

    setLoading(true)
    try {
      const { measurementService } = await import('../../services/measurementService')
      const saved = await measurementService.createMeasurement(payload)
      onMeasurementSaved(saved)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record measurement'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 shadow rounded-xl p-6 border border-slate-200 dark:border-slate-800 text-left"
    >
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Log Body Measurement
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Historical measurements are permanently preserved and never overwritten.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
          Metric Units (kg, cm, %)
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Date & Metadata */}
      <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
          Metadata & Timing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-measuredAt`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              id={`${formId}-measuredAt`}
              type="datetime-local"
              required
              value={measuredAt}
              onChange={(e) => setMeasuredAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-source`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Source
            </label>
            <input
              id={`${formId}-source`}
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. manual, home scale, clinic"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Core Metrics
          </h3>
          {calculatedBMI !== null && (
            <div className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <span className="text-slate-500">BMI Preview:</span>
              <strong className="text-slate-800 dark:text-slate-100">{calculatedBMI}</strong>
              <span className={`font-semibold ${getBMICategory(calculatedBMI).color}`}>
                ({getBMICategory(calculatedBMI).label})
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-weight`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-height`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Body Composition */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Body Composition
          </h3>
          {calculatedFatMass !== null && (
            <span className="text-xs text-slate-500">
              Est. Fat Mass: <strong className="text-slate-700 dark:text-slate-300">{calculatedFatMass} kg</strong>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${formId}-fatPct`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-muscleKg`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-skeletalMuscle`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-waterPct`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-boneMineral`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-visceralFat`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-bmr`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-heartRate`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Circumferences */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
          Body Circumferences (cm)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div>
            <label htmlFor={`${formId}-waist`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-hip`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-chest`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-arms`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-thighs`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-neck`} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Notes & Context
        </label>
        <textarea
          id={`${formId}-notes`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Fasted morning check, feeling well rested"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition"
        >
          {loading ? 'Recording...' : 'Save Measurement'}
        </button>
      </div>
    </form>
  )
}
