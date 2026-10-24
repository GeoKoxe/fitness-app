import type { DailyMacroTotals } from '../../types/nutrition'
import type { NutritionGoal } from '../../types/nutritionGoal'

interface DailyProgressDashboardProps {
  totals: DailyMacroTotals
  totalEntries: number
  goals: NutritionGoal | null
  onOpenGoalsModal: () => void
}

interface NutrientProgressProps {
  label: string
  consumed: number
  target?: number | null | undefined
  unit: string
  color: 'emerald' | 'blue' | 'amber' | 'rose'
}

function NutrientProgress({ label, consumed, target, unit, color }: NutrientProgressProps) {
  const hasTarget = target != null && target > 0
  const pct = hasTarget ? Math.round((consumed / target) * 100) : 0
  const isOver = hasTarget && consumed > target
  const diff = hasTarget ? Math.round(Math.abs(target - consumed) * 10) / 10 : 0

  // Color classes mapping
  const colorMap = {
    emerald: {
      text: 'text-emerald-700 dark:text-emerald-400',
      bar: isOver ? 'bg-rose-500 dark:bg-rose-600' : 'bg-emerald-500',
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
      border: 'border-emerald-200/70 dark:border-emerald-900/40',
      track: 'bg-emerald-100 dark:bg-emerald-950/60',
    },
    blue: {
      text: 'text-blue-700 dark:text-blue-400',
      bar: isOver ? 'bg-rose-500 dark:bg-rose-600' : 'bg-blue-600',
      bg: 'bg-blue-50/70 dark:bg-blue-950/30',
      border: 'border-blue-200/70 dark:border-blue-900/40',
      track: 'bg-blue-100 dark:bg-blue-950/60',
    },
    amber: {
      text: 'text-amber-700 dark:text-amber-400',
      bar: isOver ? 'bg-rose-500 dark:bg-rose-600' : 'bg-amber-500',
      bg: 'bg-amber-50/70 dark:bg-amber-950/30',
      border: 'border-amber-200/70 dark:border-amber-900/40',
      track: 'bg-amber-100 dark:bg-amber-950/60',
    },
    rose: {
      text: 'text-rose-700 dark:text-rose-400',
      bar: isOver ? 'bg-rose-600 dark:bg-rose-500' : 'bg-rose-500',
      bg: 'bg-rose-50/70 dark:bg-rose-950/30',
      border: 'border-rose-200/70 dark:border-rose-900/40',
      track: 'bg-rose-100 dark:bg-rose-950/60',
    },
  }[color]

  return (
    <div className={`p-4 rounded-xl ${colorMap.bg} border ${colorMap.border} flex flex-col justify-between`}>
      <div className="flex justify-between items-start">
        <span className={`text-xs font-bold ${colorMap.text}`}>{label}</span>
        {hasTarget ? (
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              isOver
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isOver ? `+${diff} ${unit} over` : `${diff} ${unit} left`}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">No target</span>
        )}
      </div>

      <div className="my-2">
        <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {consumed}{' '}
          <span className="text-xs font-normal text-slate-500">
            {hasTarget ? `/ ${target} ${unit}` : unit}
          </span>
        </div>
      </div>

      {hasTarget ? (
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{pct}% of goal</span>
            {isOver && <span className="text-rose-600 font-bold">Target Exceeded</span>}
          </div>
          <div
            role="progressbar"
            aria-valuenow={consumed}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`${label} progress: ${consumed} of ${target} ${unit}`}
            className={`w-full ${colorMap.track} h-2 rounded-full overflow-hidden`}
          >
            <div
              className={`${colorMap.bar} h-full rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 italic">Target unset</div>
      )}
    </div>
  )
}

export function DailyProgressDashboard({
  totals,
  totalEntries,
  goals,
  onOpenGoalsModal,
}: DailyProgressDashboardProps) {
  const { calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg } = totals

  const calTarget = goals?.calories_kcal
  const hasCalTarget = calTarget != null && calTarget > 0
  const calPct = hasCalTarget ? Math.round((calories_kcal / calTarget) * 100) : 0
  const calOver = hasCalTarget && calories_kcal > calTarget
  const calDiff = hasCalTarget ? Math.round(Math.abs(calTarget - calories_kcal)) : 0

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs text-left space-y-5">
      {/* Header with Title and Goal Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Daily Nutrition Progress
            </h2>
            <button
              type="button"
              onClick={onOpenGoalsModal}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 transition font-medium"
            >
              ⚙ Edit Goals
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalEntries === 0 ? (
              <span className="text-slate-400 italic">No meals logged for this day yet.</span>
            ) : (
              <span>{totalEntries} food {totalEntries === 1 ? 'item' : 'items'} logged</span>
            )}
          </p>
        </div>

        {/* Calories Overview Banner */}
        <div className="flex items-baseline gap-2 bg-slate-50 dark:bg-slate-850 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium">Calories</div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {Math.round(calories_kcal)}{' '}
              {hasCalTarget && (
                <span className="text-xs font-normal text-slate-500">/ {Math.round(calTarget)} kcal</span>
              )}
            </div>
          </div>
          {hasCalTarget && (
            <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-3 ml-1">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {calOver ? 'Over' : 'Remaining'}
              </div>
              <div
                className={`text-sm font-bold ${
                  calOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {calDiff} kcal
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Calorie Progress Bar (when target is set) */}
      {hasCalTarget && (
        <div className="p-3 bg-emerald-50/40 dark:bg-slate-850 rounded-xl border border-emerald-100 dark:border-slate-800">
          <div className="flex justify-between items-center text-xs mb-1 font-semibold">
            <span className="text-slate-700 dark:text-slate-300">Energy Target Fulfillment</span>
            <span className={calOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
              {calPct}% {calOver && '• Exceeded'}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={calories_kcal}
            aria-valuemin={0}
            aria-valuemax={calTarget}
            aria-label={`Calorie progress: ${Math.round(calories_kcal)} of ${Math.round(calTarget)} kcal`}
            className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                calOver ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(calPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Macronutrient & Fiber Progress Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <NutrientProgress
          label="Protein"
          consumed={protein_g}
          target={goals?.protein_g}
          unit="g"
          color="blue"
        />
        <NutrientProgress
          label="Carbohydrates"
          consumed={carbs_g}
          target={goals?.carbs_g}
          unit="g"
          color="amber"
        />
        <NutrientProgress
          label="Fat"
          consumed={fat_g}
          target={goals?.fat_g}
          unit="g"
          color="rose"
        />
        <NutrientProgress
          label="Fiber"
          consumed={fiber_g ?? 0}
          target={goals?.fiber_g}
          unit="g"
          color="emerald"
        />
      </div>

      {/* Micronutrients breakdown */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">Sugar: </span>
          {sugar_g != null ? `${sugar_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">Sodium: </span>
          {sodium_mg != null ? `${sodium_mg} mg` : '--'}
        </div>
        {!goals?.calories_kcal && (
          <div className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            💡 Click "⚙ Edit Goals" to configure your daily targets
          </div>
        )}
      </div>
    </div>
  )
}
