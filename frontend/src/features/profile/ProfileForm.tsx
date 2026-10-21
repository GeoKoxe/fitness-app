import { useState, type FormEvent } from 'react'
import type {
  ActivityLevelType,
  SexType,
  UserProfile,
  UserProfileCreate,
  UserProfileUpdate,
} from '../../types/profile'

interface ProfileFormProps {
  initialProfile: UserProfile | null
  onProfileSaved: (profile: UserProfile) => void
  onCancel?: () => void
}

export function ProfileForm({
  initialProfile,
  onProfileSaved,
  onCancel,
}: ProfileFormProps) {
  const [name, setName] = useState(initialProfile?.name ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(
    initialProfile?.date_of_birth ?? ''
  )
  const [sex, setSex] = useState<SexType | ''>(initialProfile?.sex ?? '')
  const [heightCm, setHeightCm] = useState(
    initialProfile?.height_cm != null ? String(initialProfile.height_cm) : ''
  )
  const [activityLevel, setActivityLevel] = useState<ActivityLevelType | ''>(
    initialProfile?.activity_level ?? ''
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }

    const parsedHeight = heightCm ? parseFloat(heightCm) : null
    if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 260)) {
      setError('Height must be between 50 and 260 cm.')
      return
    }

    if (dateOfBirth) {
      const today = new Date().toISOString().split('T')[0]
      if (today && dateOfBirth > today) {
        setError('Date of birth cannot be in the future.')
        return
      }
    }

    setLoading(true)
    try {
      const { profileService } = await import('../../services/profileService')
      let saved: UserProfile
      if (initialProfile) {
        const updatePayload: UserProfileUpdate = {
          name: trimmedName,
          date_of_birth: dateOfBirth || null,
          sex: (sex as SexType) || null,
          height_cm: parsedHeight,
          activity_level: (activityLevel as ActivityLevelType) || null,
        }
        saved = await profileService.updateProfile(updatePayload)
      } else {
        const createPayload: UserProfileCreate = {
          name: trimmedName,
          date_of_birth: dateOfBirth || null,
          sex: (sex as SexType) || null,
          height_cm: parsedHeight,
          activity_level: (activityLevel as ActivityLevelType) || null,
        }
        saved = await profileService.createProfile(createPayload)
      }
      onProfileSaved(saved)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile'
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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {initialProfile ? 'Edit Profile' : 'Create User Profile'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Your personal health parameters (metric units: cm, kg).
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. Maria Papadaki"
          />
        </div>

        <div>
          <label htmlFor="height" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Height (cm)
          </label>
          <input
            id="height"
            type="number"
            step="0.1"
            min="50"
            max="260"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. 175.0"
          />
        </div>

        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Date of Birth
          </label>
          <input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="sex" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Biological Sex
          </label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as SexType | '')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select (optional)</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="activityLevel" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Activity Level
          </label>
          <select
            id="activityLevel"
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevelType | '')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select activity level (optional)</option>
            <option value="sedentary">Sedentary (little to no exercise, desk job)</option>
            <option value="lightly_active">Lightly active (light exercise 1-3 days/week)</option>
            <option value="moderately_active">Moderately active (moderate exercise 3-5 days/week)</option>
            <option value="very_active">Very active (hard exercise 6-7 days/week)</option>
            <option value="extra_active">Extra active (very hard exercise, physical job or twice-a-day training)</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
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
          {loading ? 'Saving...' : initialProfile ? 'Save Changes' : 'Create Profile'}
        </button>
      </div>
    </form>
  )
}
