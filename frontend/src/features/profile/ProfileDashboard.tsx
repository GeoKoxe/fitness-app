import { useEffect, useState } from 'react'
import type { BodyMeasurement } from '../../types/measurement'
import type { UserProfile } from '../../types/profile'
import { MeasurementForm } from './MeasurementForm'
import { MeasurementHistory } from './MeasurementHistory'
import { ProfileForm } from './ProfileForm'

type TabType = 'overview' | 'log' | 'history'

export function ProfileDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [latestMeasurement, setLatestMeasurement] =
    useState<BodyMeasurement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        const { profileService } = await import('../../services/profileService')
        const { measurementService } = await import(
          '../../services/measurementService'
        )

        const profileData = await profileService.getProfile()
        if (ignore) return
        setProfile(profileData)

        if (profileData) {
          const latest = await measurementService.getLatestMeasurement()
          if (!ignore) {
            setLatestMeasurement(latest)
          }
        }
        if (!ignore) {
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load profile data'
          setError(msg)
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [refreshTrigger])

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const handleProfileSaved = (saved: UserProfile) => {
    setProfile(saved)
    setIsEditingProfile(false)
    showSuccess('User profile saved successfully!')
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleMeasurementSaved = () => {
    showSuccess('Body measurement logged successfully!')
    setActiveTab('history')
    setRefreshTrigger((prev) => prev + 1)
  }

  if (loading && !profile) {
    return (
      <div className="py-24 text-center text-slate-500">
        <div className="inline-block animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-4" />
        <p className="text-base font-medium">Loading personal fitness profile...</p>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-center">
        <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">
          Unable to Load Profile
        </h3>
        <p className="text-sm text-red-600 dark:text-red-300 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setRefreshTrigger((prev) => prev + 1)
          }}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    )
  }

  // If no profile exists yet, show the profile setup wizard
  if (!profile) {
    return (
      <div className="max-w-xl mx-auto my-12 px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome to Your Fitness Hub
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Let's create your personal profile to start logging measurements, body composition, and health metrics.
          </p>
        </div>
        <ProfileForm initialProfile={null} onProfileSaved={handleProfileSaved} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Success Notification Banner */}
      {successMessage && (
        <div role="status" className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {profile.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {profile.height_cm ? `${profile.height_cm} cm` : 'Height not specified'}
                {profile.sex ? ` • ${profile.sex}` : ''}
                {profile.activity_level ? ` • ${profile.activity_level.replace('_', ' ')}` : ''}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditingProfile((prev) => !prev)}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
        >
          {isEditingProfile ? 'Close Edit' : 'Edit Profile'}
        </button>
      </div>

      {isEditingProfile && (
        <div className="mb-8">
          <ProfileForm
            initialProfile={profile}
            onProfileSaved={handleProfileSaved}
            onCancel={() => setIsEditingProfile(false)}
          />
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
            activeTab === 'log'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Log Measurement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-left">
          {/* Latest Stats Snapshot */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Current Body Composition Snapshot
              </h2>
              {latestMeasurement && (
                <span className="text-xs text-slate-500">
                  Last recorded: {new Date(latestMeasurement.measured_at).toLocaleDateString('el-GR')}
                </span>
              )}
            </div>

            {latestMeasurement ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750">
                  <span className="text-xs text-slate-500 font-medium">Weight</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {latestMeasurement.weight_kg != null ? (
                      <>
                        {latestMeasurement.weight_kg} <span className="text-sm font-normal text-slate-500">kg</span>
                      </>
                    ) : (
                      '--'
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750">
                  <span className="text-xs text-slate-500 font-medium">BMI</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {latestMeasurement.bmi != null ? latestMeasurement.bmi : '--'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750">
                  <span className="text-xs text-slate-500 font-medium">Body Fat</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {latestMeasurement.body_fat_percentage != null ? (
                      <>
                        {latestMeasurement.body_fat_percentage} <span className="text-sm font-normal text-slate-500">%</span>
                      </>
                    ) : (
                      '--'
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-750">
                  <span className="text-xs text-slate-500 font-medium">Muscle Mass</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {latestMeasurement.muscle_mass_kg != null ? (
                      <>
                        {latestMeasurement.muscle_mass_kg} <span className="text-sm font-normal text-slate-500">kg</span>
                      </>
                    ) : (
                      '--'
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">No measurement recorded yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('log')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Log First Measurement
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions & Recent History Preview */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Recent Activity
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              View Full History →
            </button>
          </div>
          <MeasurementHistory
            refreshTrigger={refreshTrigger}
            onLogNew={() => setActiveTab('log')}
          />
        </div>
      )}

      {activeTab === 'log' && (
        <MeasurementForm
          userProfile={profile}
          onMeasurementSaved={handleMeasurementSaved}
          onCancel={() => setActiveTab('overview')}
        />
      )}

      {activeTab === 'history' && (
        <MeasurementHistory
          refreshTrigger={refreshTrigger}
          onLogNew={() => setActiveTab('log')}
        />
      )}
    </div>
  )
}
