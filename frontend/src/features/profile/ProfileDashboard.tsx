import { useEffect, useState } from 'react'
import type { BodyMeasurement } from '../../types/measurement'
import type { UserProfile } from '../../types/profile'
import { BodyTrendsChart } from './BodyTrendsChart'
import { MeasurementForm } from './MeasurementForm'
import { MeasurementHistory } from './MeasurementHistory'
import { ProfileForm } from './ProfileForm'

type TabType = 'overview' | 'log' | 'history' | 'trends'

export interface ProfileDashboardProps {
  initialTab?: TabType
  initialEditingProfile?: boolean
  activeSection?: 'body' | 'profile'
}

function getBMICategoryInfo(bmi: number): {
  label: string
  textClass: string
  percent: number
} {
  const clamped = Math.min(Math.max(bmi, 15), 35)
  const percent = ((clamped - 15) / 20) * 100

  if (bmi < 18.5) {
    return {
      label: 'Underweight',
      textClass: 'text-amber-800 dark:text-darkButter',
      percent,
    }
  }
  if (bmi < 25.0) {
    return {
      label: 'Normal weight',
      textClass: 'text-status-success-fg dark:text-emerald-400',
      percent,
    }
  }
  if (bmi < 30.0) {
    return {
      label: 'Overweight',
      textClass: 'text-amber-800 dark:text-darkButter',
      percent,
    }
  }
  return {
    label: 'Obese',
    textClass: 'text-alert dark:text-darkCoral',
    percent,
  }
}

export function ProfileDashboard({
  initialTab = 'overview',
  initialEditingProfile = false,
  activeSection = 'body',
}: ProfileDashboardProps = {}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [latestMeasurement, setLatestMeasurement] =
    useState<BodyMeasurement | null>(null)
  const [allMeasurements, setAllMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [isEditingProfile, setIsEditingProfile] = useState(initialEditingProfile)
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
          const listRes = await measurementService.listMeasurements({
            pageSize: 15,
          })
          if (!ignore) {
            setLatestMeasurement(latest)
            setAllMeasurements(listRes.items || [])
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
      <div className="py-24 text-center text-inkSecondary dark:text-darkInkSecondary">
        <div className="inline-block animate-spin w-10 h-10 border-4 border-midnight dark:border-darkMidnight border-t-transparent rounded-full mb-4" />
        <p className="text-base font-medium">
          Loading personal fitness profile...
        </p>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div
        role="alert"
        className="max-w-lg mx-auto my-12 p-6 bg-status-error dark:bg-darkSurface border border-border-card rounded-2xl text-center"
      >
        <h3 className="text-lg font-bold text-alert dark:text-darkCoral mb-2">
          Unable to Load Profile
        </h3>
        <p className="text-sm text-alert dark:text-darkCoral mb-4">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setRefreshTrigger((prev) => prev + 1)
          }}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-alert text-white hover:opacity-90 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert"
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
          <div
            className="w-16 h-16 mx-auto rounded-2xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder text-midnight dark:text-darkMidnight flex items-center justify-center mb-4 shadow-xs"
            aria-hidden="true"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink dark:text-darkInk mb-2">
            Welcome to Your Fitness Hub
          </h1>
          <p className="text-sm text-inkSecondary dark:text-darkInkSecondary">
            Let's create your personal profile to start logging measurements,
            body composition, and health metrics.
          </p>
        </div>
        <ProfileForm initialProfile={null} onProfileSaved={handleProfileSaved} />
      </div>
    )
  }

  // Calculate delta from previous entry if available
  const previousMeasurement =
    allMeasurements.length > 1 ? allMeasurements[1] : null
  const weightDelta =
    latestMeasurement?.weight_kg != null &&
    previousMeasurement?.weight_kg != null
      ? Math.round(
          (latestMeasurement.weight_kg - previousMeasurement.weight_kg) * 10
        ) / 10
      : null

  // Waist-to-Hip Ratio
  const waistVal = latestMeasurement?.waist_circumference_cm
  const hipVal = latestMeasurement?.hip_circumference_cm
  const waistToHip =
    waistVal && hipVal && waistVal > 0 && hipVal > 0
      ? Number((waistVal / hipVal).toFixed(2))
      : null

  const bmiInfo = latestMeasurement?.bmi
    ? getBMICategoryInfo(latestMeasurement.bmi)
    : null

  return (
    <div className="w-full text-left space-y-6">
      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-status-success dark:bg-darkSurface border border-border-card text-status-success-fg dark:text-emerald-400 text-sm flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-fg rounded px-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile mode */}
      {activeSection === 'profile' && (
        <div className="space-y-6">
          <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left transition-colors motion-reduce:transition-none">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0"
                aria-hidden="true"
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink dark:text-darkInk">
                  {profile.name}
                </h1>
                <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
                  {profile.height_cm
                    ? `${profile.height_cm} cm`
                    : 'Height not specified'}
                  {profile.sex ? ` • ${profile.sex}` : ''}
                  {profile.activity_level
                    ? ` • ${profile.activity_level.replace('_', ' ')}`
                    : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-sand dark:border-darkBorder bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
            >
              {isEditingProfile ? 'Close Edit' : 'Edit Profile'}
            </button>
          </div>

          {isEditingProfile && (
            <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs">
              <ProfileForm
                initialProfile={profile}
                onProfileSaved={handleProfileSaved}
                onCancel={() => setIsEditingProfile(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Body & Measurements mode */}
      {activeSection === 'body' && (
        <>
          {/* Section Header */}
          <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-left transition-colors motion-reduce:transition-none">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-darkInk">
                  Body &amp; Measurements
                </h1>
                <span className="inline-block whitespace-nowrap shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-mist/70 dark:bg-darkMist text-ink dark:text-darkInk border border-sand/70 dark:border-darkBorder self-start sm:self-auto">
                  Greece • Metric (kg/cm)
                </span>
              </div>
              <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-1">
                Track your weight, body composition, circumferences, and
                long-term health metrics.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {latestMeasurement && (
                <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder shadow-2xs">
                  <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
                    Latest:
                  </span>
                  <span className="text-sm font-bold text-ink dark:text-darkInk">
                    {latestMeasurement.weight_kg != null
                      ? `${latestMeasurement.weight_kg} kg`
                      : '--'}
                  </span>
                  {latestMeasurement.bmi != null && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-semibold">
                      BMI {latestMeasurement.bmi}
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('log')}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-midnight dark:bg-darkMidnight dark:text-white hover:opacity-95 shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
              >
                + New Entry
              </button>
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div
            role="tablist"
            aria-label="Body and Measurements Sections"
            className="flex border-b border-sand dark:border-darkBorder gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-0.5"
          >
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'log', label: 'Log Measurement' },
              { id: 'history', label: 'History' },
              { id: 'trends', label: 'Measurement Trends' },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition cursor-pointer motion-reduce:transition-none border-b-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle ${
                    isActive
                      ? 'border-midnight text-midnight dark:border-darkMidnight dark:text-darkMidnight'
                      : 'border-transparent text-inkSecondary hover:text-ink dark:text-darkInkSecondary dark:hover:text-darkInk'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab Content: OVERVIEW (Unified Health Command Center - Styled per Reference Image) */}
          {activeTab === 'overview' && (
            <div className="space-y-6 text-left">
              {/* Primary Snapshot Container */}
              <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-3xl p-6 shadow-xs transition-colors motion-reduce:transition-none space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-sand/60 dark:border-darkBorder/60 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-ink dark:text-darkInk">
                      Current Body Composition Snapshot
                    </h2>
                    <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
                      Informational screening metrics based on your latest recorded entry. Not intended for medical diagnosis.
                    </p>
                  </div>
                  {latestMeasurement && (
                    <span className="text-xs text-inkSecondary dark:text-darkInkSecondary bg-canvas dark:bg-darkCanvas px-3 py-1 rounded-full border border-sand/70 dark:border-darkBorder">
                      Last recorded:{' '}
                      {new Date(
                        latestMeasurement.measured_at
                      ).toLocaleDateString('el-GR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                {latestMeasurement ? (
                  <div className="space-y-6">
                    {/* Top Row Grid: Hero Curve Card (2 cols) + Stacked Side Cards (1 col) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Hero Card: Line Curve with Milestone Pin & Bottom Wells (Matching Reference Image Hero) */}
                      <div className="lg:col-span-2 bg-midnight text-white dark:bg-darkMidnight rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[350px]">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-coral dark:text-darkCoral block">
                              Trajectory
                            </span>
                            <h3 className="text-xl font-extrabold tracking-tight text-white">
                              Overview
                            </h3>
                          </div>
                          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl text-xs font-semibold self-start sm:self-auto">
                            <button
                              type="button"
                              className="px-3 py-1 rounded-xl bg-white/25 text-white shadow-xs cursor-pointer"
                            >
                              Body Weight
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('trends')}
                              className="px-3 py-1 rounded-xl text-white/70 hover:text-white cursor-pointer transition"
                            >
                              Trends
                            </button>
                          </div>
                        </div>

                        {/* Spline Wave Curve SVG with Peak Milestone Marker (Matching "9.178 Steps" in Image) */}
                        <div className="my-4 relative z-10 w-full overflow-hidden select-none">
                          <svg
                            viewBox="0 0 500 130"
                            className="w-full h-28 sm:h-36 overflow-visible"
                            fill="none"
                          >
                            <defs>
                              <linearGradient id="heroCurveGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#EF767A" stopOpacity="0.45" />
                                <stop offset="100%" stopColor="#324376" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            {/* Area fill */}
                            <path
                              d="M 10 95 C 70 80, 120 105, 170 85 C 220 65, 250 45, 300 40 C 350 35, 410 70, 490 60 L 490 120 L 10 120 Z"
                              fill="url(#heroCurveGradient)"
                            />
                            {/* Spline line */}
                            <path
                              d="M 10 95 C 70 80, 120 105, 170 85 C 220 65, 250 45, 300 40 C 350 35, 410 70, 490 60"
                              stroke="#EF767A"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                            />
                            {/* Vertical guideline */}
                            <line
                              x1="300"
                              y1="40"
                              x2="300"
                              y2="120"
                              stroke="rgba(255, 255, 255, 0.3)"
                              strokeDasharray="3 3"
                            />
                            {/* Milestone circular marker */}
                            <circle
                              cx="300"
                              cy="40"
                              r="7"
                              fill="#EF767A"
                              stroke="#FFFFFF"
                              strokeWidth="3"
                            />
                          </svg>

                          {/* Milestone Floating Pill (Matching "9.178 Steps" in Reference Image) */}
                          <div
                            className="absolute top-1 left-[54%] sm:left-[57%] transform -translate-x-1/2 -translate-y-2 bg-white/20 backdrop-blur-md border border-white/40 text-white px-3 py-1 rounded-2xl shadow-lg pointer-events-none text-center"
                          >
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                              Latest Entry
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold block">
                              {latestMeasurement.weight_kg != null ? `${latestMeasurement.weight_kg} kg` : '--'}
                            </span>
                          </div>

                          {/* Month Indicators along bottom */}
                          <div className="flex justify-between text-[11px] font-medium text-white/60 pt-2 px-2 border-t border-white/10">
                            <span>May</span>
                            <span>Jun</span>
                            <span>Jul</span>
                            <span className="px-2 py-0.5 rounded-full bg-white text-midnight font-bold">Oct</span>
                            <span>Nov</span>
                            <span>Dec</span>
                          </div>
                        </div>

                        {/* Bottom Metric Wells (Embedded at the base of the Hero Card) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-white/10 relative z-10 text-center">
                          {/* Well 1 */}
                          <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs flex flex-col justify-between">
                            <span className="text-[10px] font-medium text-white/70 block uppercase tracking-wider">
                              Weight Delta
                            </span>
                            <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                              {weightDelta !== null ? (
                                weightDelta > 0 ? `+${weightDelta} kg` : `${weightDelta} kg`
                              ) : (
                                'Baseline'
                              )}
                            </div>
                            <span className="text-[9px] text-white/60 block mt-0.5">
                              {previousMeasurement ? 'vs last log' : 'initial entry'}
                            </span>
                          </div>

                          {/* Well 2: Elevated Center Well */}
                          <div className="p-2.5 rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-xs flex flex-col justify-between shadow-xs">
                            <span className="text-[10px] font-bold text-coral dark:text-darkCoral block uppercase tracking-wider">
                              Body Weight
                            </span>
                            <div className="text-base sm:text-xl font-black text-white mt-0.5">
                              {latestMeasurement.weight_kg != null ? latestMeasurement.weight_kg : '--'}
                              <span className="text-xs font-normal text-white/80 ml-1">kg</span>
                            </div>
                            <span className="text-[9px] text-white/70 block mt-0.5">
                              Current Mass
                            </span>
                          </div>

                          {/* Well 3 */}
                          <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs flex flex-col justify-between">
                            <span className="text-[10px] font-medium text-white/70 block uppercase tracking-wider">
                              BMI
                            </span>
                            <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                              {latestMeasurement.bmi != null ? latestMeasurement.bmi : '--'}
                            </div>
                            <span className="text-[9px] text-emerald-300 font-semibold block mt-0.5">
                              {bmiInfo ? `Status: ${bmiInfo.label}` : 'Screening'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Stacked Activity Cards */}
                      <div className="flex flex-col justify-between gap-4">
                        {/* Card 1: BMI Classification (Matching "Daily Jogging" in Reference Image) */}
                        <div className="p-5 rounded-3xl bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-card hover:shadow-md transition flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-13 h-13 rounded-2xl bg-mist/70 dark:bg-darkMist text-midnight dark:text-darkMidnight flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary block">
                                BMI Classification
                              </span>
                              <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-2xl font-black text-ink dark:text-darkInk">
                                  {latestMeasurement.bmi != null ? latestMeasurement.bmi : '--'}
                                </span>
                                {bmiInfo && (
                                  <span className={`text-xs font-bold ${bmiInfo.textClass}`}>
                                    {bmiInfo.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Vibrant Waist-to-Hip Ratio Card (Matching "My Jogging" in Reference Image) */}
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-coral to-coralHover text-white dark:from-darkCoral dark:to-coral shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[175px]">
                          <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                              <span className="text-sm font-bold text-white">
                                Waist-to-Hip Ratio
                              </span>
                            </div>
                          </div>

                          <div className="my-2 relative z-10">
                            <span className="text-xs uppercase font-medium text-white/80 block tracking-wider">
                              Proportional Balance
                            </span>
                            <div className="text-3xl font-black tracking-tight text-white mt-0.5">
                              {waistToHip !== null ? `${waistToHip}` : '--'}
                              <span className="text-xs font-normal text-white/80 ml-1.5">WHR</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/20 relative z-10 text-xs text-white/90">
                            <span>Low health risk screening</span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('trends')}
                              aria-label="View Waist to Hip Trends"
                              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-coral transition flex items-center justify-center font-bold cursor-pointer"
                            >
                              &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row Grid: 3 Feature Cards with Elevated Badges & Progress Bars (Matching Bottom Cards in Reference Image) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Bottom Card 1: Body Fat Ratio */}
                      <div className="p-6 rounded-3xl bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-card hover:shadow-md transition flex flex-col justify-between">
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center shadow-md mb-4">
                            <svg className="w-6 h-6 text-coral dark:text-darkCoral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-ink dark:text-darkInk">
                              Body Fat
                            </h4>
                            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
                              Target ~15-20%
                            </span>
                          </div>
                          <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                            {latestMeasurement.body_fat_percentage != null ? (
                              <>
                                {latestMeasurement.body_fat_percentage}{' '}
                                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">%</span>
                              </>
                            ) : (
                              '--'
                            )}
                          </div>
                        </div>

                        {/* Progress Indicator & Status Pills */}
                        <div className="mt-5 space-y-3">
                          <div className="w-full bg-sand/60 dark:bg-darkBorder rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-coral dark:bg-darkCoral h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (latestMeasurement.body_fat_percentage || 20) * 3)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="px-2.5 py-1 rounded-full bg-mist/50 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-semibold">
                              {latestMeasurement.fat_mass_kg != null ? `${latestMeasurement.fat_mass_kg} kg fat` : 'Bioimpedance'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-status-success/30 text-status-success-fg dark:text-emerald-400 font-bold border border-emerald-300/40">
                              Optimal Range
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Card 2: Skeletal Muscle Mass */}
                      <div className="p-6 rounded-3xl bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-card hover:shadow-md transition flex flex-col justify-between">
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center shadow-md mb-4">
                            <svg className="w-6 h-6 text-butter dark:text-darkButter" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-ink dark:text-darkInk">
                              Muscle Mass
                            </h4>
                            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
                              Vitality tracking
                            </span>
                          </div>
                          <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                            {latestMeasurement.muscle_mass_kg != null ? (
                              <>
                                {latestMeasurement.muscle_mass_kg}{' '}
                                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">kg</span>
                              </>
                            ) : (
                              '--'
                            )}
                          </div>
                        </div>

                        {/* Progress Indicator & Status Pills */}
                        <div className="mt-5 space-y-3">
                          <div className="w-full bg-sand/60 dark:bg-darkBorder rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, ((latestMeasurement.muscle_mass_kg || 50) / 75) * 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="px-2.5 py-1 rounded-full bg-mist/50 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-semibold">
                              {latestMeasurement.skeletal_muscle_mass_kg != null ? `${latestMeasurement.skeletal_muscle_mass_kg} kg skeletal` : 'Lean mass'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-status-info/30 text-midnight dark:text-darkMidnight font-bold border border-midnight/20">
                              High Vitality
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Card 3: Body Circumferences */}
                      <div className="p-6 rounded-3xl bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder shadow-card hover:shadow-md transition flex flex-col justify-between">
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-midnight text-white dark:bg-darkMidnight dark:text-darkCanvas flex items-center justify-center shadow-md mb-4">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-ink dark:text-darkInk">
                              Circumferences
                            </h4>
                            <span className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">
                              Waist &amp; Hips
                            </span>
                          </div>
                          <div className="text-2xl font-extrabold text-ink dark:text-darkInk mt-1">
                            {latestMeasurement.waist_circumference_cm != null ? (
                              <>
                                {latestMeasurement.waist_circumference_cm}{' '}
                                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">cm waist</span>
                              </>
                            ) : (
                              '--'
                            )}
                          </div>
                        </div>

                        {/* Progress Indicator & Status Pills */}
                        <div className="mt-5 space-y-3">
                          <div className="w-full bg-sand/60 dark:bg-darkBorder rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-periwinkle dark:bg-darkPeriwinkle h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (waistToHip || 0.8) * 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="px-2.5 py-1 rounded-full bg-mist/50 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-semibold">
                              {latestMeasurement.hip_circumference_cm != null ? `${latestMeasurement.hip_circumference_cm} cm hips` : 'Tape'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-butter/30 text-ink dark:text-darkInk font-bold border border-sand">
                              Proportional
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics: Vitality & Body Circumferences Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Secondary Panel A: Metabolism & Vital Signs */}
                      <div className="p-4 rounded-xl bg-canvas/50 dark:bg-darkCanvas/50 border border-sand dark:border-darkBorder space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
                          Metabolic &amp; Vitality Indicators
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2.5 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Resting HR
                            </span>
                            <span className="text-sm font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.heart_rate_bpm != null
                                ? `${latestMeasurement.heart_rate_bpm} bpm`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              BMR
                            </span>
                            <span className="text-sm font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.basal_metabolic_rate_kcal !=
                              null
                                ? `${latestMeasurement.basal_metabolic_rate_kcal} kcal`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Visceral Fat
                            </span>
                            <span className="text-sm font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.visceral_fat_level != null
                                ? `Lvl ${latestMeasurement.visceral_fat_level}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Hydration
                            </span>
                            <span className="text-sm font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.body_water_percentage != null
                                ? `${latestMeasurement.body_water_percentage}%`
                                : '--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Secondary Panel B: Circumference Tape Explorer */}
                      <div className="p-4 rounded-xl bg-canvas/50 dark:bg-darkCanvas/50 border border-sand dark:border-darkBorder space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
                            Circumference Tape (cm)
                          </h3>
                          {waistToHip !== null && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-mist/60 dark:bg-darkMist text-inkSecondary dark:text-darkInkSecondary font-medium">
                              Waist/Hip Ratio:{' '}
                              <strong className="text-ink dark:text-darkInk">
                                {waistToHip}
                              </strong>
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Waist
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.waist_circumference_cm != null
                                ? `${latestMeasurement.waist_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Hip
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.hip_circumference_cm != null
                                ? `${latestMeasurement.hip_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Chest
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.chest_circumference_cm != null
                                ? `${latestMeasurement.chest_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Arms
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.arms_circumference_cm != null
                                ? `${latestMeasurement.arms_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Thighs
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.thighs_circumference_cm != null
                                ? `${latestMeasurement.thighs_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface dark:bg-darkSurface border border-sand/60 dark:border-darkBorder/60">
                            <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary block">
                              Neck
                            </span>
                            <span className="font-bold text-ink dark:text-darkInk">
                              {latestMeasurement.neck_circumference_cm != null
                                ? `${latestMeasurement.neck_circumference_cm}`
                                : '--'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informational Screening Advisory */}
                    <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary bg-canvas/40 dark:bg-darkCanvas/40 p-3 rounded-xl border border-sand/50 dark:border-darkBorder/50 flex items-start gap-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5 text-midnight dark:text-darkMidnight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <strong>Informational Screening Notice:</strong> BMI and waist-to-hip calculations follow WHO adult screening reference guidelines. These metrics provide general health screening estimates, do not distinguish muscle from adipose tissue, and do not constitute clinical or medical diagnoses.
                      </span>
                    </div>

                    {/* Quick Action Navigation Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sand/60 dark:border-darkBorder/60">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('log')}
                          className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-midnight hover:opacity-95 dark:bg-darkMidnight dark:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
                        >
                          + Log Measurement
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('trends')}
                          className="px-4 py-2 text-xs font-semibold rounded-xl text-ink dark:text-darkInk bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder hover:bg-mist/50 dark:hover:bg-darkMist transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
                        >
                          Analyze Trends
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle rounded"
                      >
                        View Full History &rarr;
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-3">
                    <div
                      className="w-12 h-12 mx-auto rounded-2xl bg-canvas dark:bg-darkCanvas border border-sand dark:border-darkBorder flex items-center justify-center text-midnight dark:text-darkMidnight"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-6 h-6"
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
                    <p className="text-sm text-inkSecondary dark:text-darkInkSecondary">
                      No measurements recorded yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('log')}
                      className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-midnight text-white dark:bg-darkMidnight dark:text-white hover:opacity-95 shadow-xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
                    >
                      Log First Measurement
                    </button>
                  </div>
                )}
              </div>

              {/* Integrated Recent Activity Ledger */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-inkSecondary dark:text-darkInkSecondary">
                    Recent Activity Timeline
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-semibold text-midnight dark:text-darkMidnight hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle rounded"
                  >
                    View Full History &rarr;
                  </button>
                </div>
                <MeasurementHistory
                  refreshTrigger={refreshTrigger}
                  onLogNew={() => setActiveTab('log')}
                />
              </div>
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

          {activeTab === 'trends' && <BodyTrendsChart />}
        </>
      )}
    </div>
  )
}
