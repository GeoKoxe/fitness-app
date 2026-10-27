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
  accent: 'protein' | 'carbs' | 'fat' | 'fiber'
}

function NutrientProgress({ label, consumed, target, unit, accent }: NutrientProgressProps) {
  const hasTarget = target != null && target > 0
  const pct = hasTarget ? Math.round((consumed / target) * 100) : 0
  const isOver = hasTarget && consumed > target
  const diff = hasTarget ? Math.round(Math.abs(target - consumed) * 10) / 10 : 0

  // Semantic styles for each macro using approved palette tokens
  const accentStyles = {
    protein: {
      bar: isOver ? 'bg-alert dark:bg-darkCoral' : 'bg-periwinkle dark:bg-darkPeriwinkle',
      track: 'bg-sand/60 dark:bg-darkBorder/80',
      badge: isOver
        ? 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-alert/30 dark:border-darkCoral/30'
        : 'bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand dark:border-darkBorder',
    },
    carbs: {
      bar: isOver ? 'bg-alert dark:bg-darkCoral' : 'bg-amber-500 dark:bg-darkButter',
      track: 'bg-sand/60 dark:bg-darkBorder/80',
      badge: isOver
        ? 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-alert/30 dark:border-darkCoral/30'
        : 'bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand dark:border-darkBorder',
    },
    fat: {
      bar: isOver ? 'bg-alert dark:bg-darkCoral' : 'bg-midnight dark:text-white',
      track: 'bg-sand/60 dark:bg-darkBorder/80',
      badge: isOver
        ? 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-alert/30 dark:border-darkCoral/30'
        : 'bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand dark:border-darkBorder',
    },
    fiber: {
      bar: isOver ? 'bg-alert dark:bg-darkCoral' : 'bg-emerald-600 dark:bg-emerald-500',
      track: 'bg-sand/60 dark:bg-darkBorder/80',
      badge: isOver
        ? 'bg-status-error dark:bg-darkSurface text-alert dark:text-darkCoral border border-alert/30 dark:border-darkCoral/30'
        : 'bg-canvas dark:bg-darkCanvas text-inkSecondary dark:text-darkInkSecondary border border-sand dark:border-darkBorder',
    },
  }[accent]

  return (
    <div className="p-4 rounded-xl bg-canvas/60 dark:bg-darkCanvas/60 border border-sand dark:border-darkBorder flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-ink dark:text-darkInk">{label}</span>
        {hasTarget ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${accentStyles.badge}`}>
            {isOver ? `+${diff} ${unit} over` : `${diff} ${unit} left`}
          </span>
        ) : (
          <span className="text-[10px] text-inkSecondary dark:text-darkInkSecondary">No target</span>
        )}
      </div>

      <div className="my-2">
        <div className="text-xl font-extrabold text-ink dark:text-darkInk">
          {consumed}{' '}
          <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
            {hasTarget ? `/ ${target} ${unit}` : unit}
          </span>
        </div>
      </div>

      {hasTarget ? (
        <div>
          <div className="flex justify-between text-[10px] text-inkSecondary dark:text-darkInkSecondary mb-1 font-medium">
            <span>{pct}% of goal</span>
            {isOver && <span className="text-alert dark:text-darkCoral font-bold">Target Exceeded</span>}
          </div>
          <div
            role="progressbar"
            aria-valuenow={consumed}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`${label} progress: ${consumed} of ${target} ${unit}`}
            className={`w-full ${accentStyles.track} h-2 rounded-full overflow-hidden`}
          >
            <div
              className={`${accentStyles.bar} h-full rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-inkSecondary dark:text-darkInkSecondary italic">Target unset</div>
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
    <div className="bg-surface dark:bg-darkSurface border border-sand dark:border-darkBorder rounded-2xl p-5 sm:p-6 shadow-xs text-left space-y-5 transition-colors motion-reduce:transition-none">
      {/* Header with Title and Goal Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink dark:text-darkInk">
              Daily Nutrition Progress
            </h2>
            <button
              type="button"
              onClick={onOpenGoalsModal}
              className="text-xs px-2.5 py-1 rounded-xl bg-canvas dark:bg-darkCanvas text-ink dark:text-darkInk hover:bg-mist/50 dark:hover:bg-darkMist border border-sand dark:border-darkBorder transition font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-periwinkle dark:focus-visible:ring-darkPeriwinkle"
            >
              ⚙ Edit Goals
            </button>
          </div>
          <p className="text-xs text-inkSecondary dark:text-darkInkSecondary mt-0.5">
            {totalEntries === 0 ? (
              <span className="italic">No meals logged for this day yet.</span>
            ) : (
              <span>{totalEntries} food {totalEntries === 1 ? 'item' : 'items'} logged</span>
            )}
          </p>
        </div>

        {/* Calories Overview Banner */}
        <div className="flex items-baseline gap-2 bg-canvas/70 dark:bg-darkCanvas/70 px-4 py-2 rounded-xl border border-sand dark:border-darkBorder">
          <div className="text-right">
            <div className="text-xs text-inkSecondary dark:text-darkInkSecondary font-medium">Calories</div>
            <div className="text-2xl font-extrabold text-ink dark:text-darkInk">
              {Math.round(calories_kcal)}{' '}
              {hasCalTarget && (
                <span className="text-xs font-normal text-inkSecondary dark:text-darkInkSecondary">
                  / {Math.round(calTarget)} kcal
                </span>
              )}
            </div>
          </div>
          {hasCalTarget && (
            <div className="text-right border-l border-sand/70 dark:border-darkBorder/70 pl-3 ml-1">
              <div className="text-[10px] text-inkSecondary dark:text-darkInkSecondary uppercase font-bold tracking-wider">
                {calOver ? 'Over' : 'Remaining'}
              </div>
              <div
                className={`text-sm font-bold ${
                  calOver ? 'text-alert dark:text-darkCoral' : 'text-midnight dark:text-darkMidnight'
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
        <div className="p-3 bg-canvas/40 dark:bg-darkCanvas/40 rounded-xl border border-sand/60 dark:border-darkBorder/60">
          <div className="flex justify-between items-center text-xs mb-1 font-semibold">
            <span className="text-ink dark:text-darkInk">Energy Target Fulfillment</span>
            <span className={calOver ? 'text-alert dark:text-darkCoral' : 'text-status-success-fg dark:text-emerald-400'}>
              {calPct}% {calOver && '• Exceeded'}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={calories_kcal}
            aria-valuemin={0}
            aria-valuemax={calTarget}
            aria-label={`Calorie progress: ${Math.round(calories_kcal)} of ${Math.round(calTarget)} kcal`}
            className="w-full bg-sand/60 dark:bg-darkBorder/80 h-2.5 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                calOver ? 'bg-alert dark:bg-darkCoral' : 'bg-midnight dark:bg-darkMidnight'
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
          accent="protein"
        />
        <NutrientProgress
          label="Carbohydrates"
          consumed={carbs_g}
          target={goals?.carbs_g}
          unit="g"
          accent="carbs"
        />
        <NutrientProgress
          label="Fat"
          consumed={fat_g}
          target={goals?.fat_g}
          unit="g"
          accent="fat"
        />
        <NutrientProgress
          label="Fiber"
          consumed={fiber_g ?? 0}
          target={goals?.fiber_g}
          unit="g"
          accent="fiber"
        />
      </div>

      {/* Micronutrients breakdown */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-inkSecondary dark:text-darkInkSecondary pt-3 border-t border-sand/60 dark:border-darkBorder/60">
        <div>
          <span className="font-medium text-ink dark:text-darkInk">Sugar: </span>
          {sugar_g != null ? `${sugar_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-ink dark:text-darkInk">Sodium: </span>
          {sodium_mg != null ? `${sodium_mg} mg` : '--'}
        </div>
        {!goals?.calories_kcal && (
          <div className="ml-auto text-xs text-midnight dark:text-darkMidnight font-medium">
            💡 Click "⚙ Edit Goals" to configure your daily targets
          </div>
        )}
      </div>
    </div>
  )
}
