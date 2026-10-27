import type { DailyMacroTotals } from '../../types/nutrition'

interface DailySummaryCardProps {
  totals: DailyMacroTotals
  totalEntries: number
}

export function DailySummaryCard({ totals, totalEntries }: DailySummaryCardProps) {
  const { calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg } = totals

  // Macro calorie contributions (Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g)
  const proteinKcal = protein_g * 4
  const carbsKcal = carbs_g * 4
  const fatKcal = fat_g * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

  const proteinPct = totalMacroKcal > 0 ? Math.round((proteinKcal / totalMacroKcal) * 100) : 0
  const carbsPct = totalMacroKcal > 0 ? Math.round((carbsKcal / totalMacroKcal) * 100) : 0
  const fatPct = totalMacroKcal > 0 ? Math.round((fatKcal / totalMacroKcal) * 100) : 0

  return (
    <div className="bg-surface border border-edge rounded-2xl p-6 shadow-xs text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Daily Nutrition Summary
          </h2>
          <p className="text-xs text-inkSecondary">
            {totalEntries === 0 ? 'No foods logged for this date' : `${totalEntries} food entries logged`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-extrabold text-status-success-fg">
            {Math.round(calories_kcal)}
          </span>
          <span className="text-sm font-medium text-inkSecondary ml-1.5">kcal total</span>
        </div>
      </div>

      {/* Macronutrient Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Protein */}
        <div className="p-3.5 rounded-xl bg-brand/10 border border-brand/20">
          <div className="flex justify-between items-center text-xs font-semibold text-brand">
            <span>Protein</span>
            <span>{proteinPct}%</span>
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {protein_g} <span className="text-xs font-normal text-inkSecondary">g</span>
          </div>
          <div className="w-full bg-surfaceMuted h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-brand h-full rounded-full" style={{ width: `${Math.min(proteinPct, 100)}%` }} />
          </div>
        </div>

        {/* Carbohydrates */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex justify-between items-center text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span>Carbs</span>
            <span>{carbsPct}%</span>
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {carbs_g} <span className="text-xs font-normal text-inkSecondary">g</span>
          </div>
          <div className="w-full bg-surfaceMuted h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-600 dark:bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(carbsPct, 100)}%` }} />
          </div>
        </div>

        {/* Fat */}
        <div className="p-3.5 rounded-xl bg-status-danger-bg border border-status-danger-border">
          <div className="flex justify-between items-center text-xs font-semibold text-status-danger-fg">
            <span>Fat</span>
            <span>{fatPct}%</span>
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {fat_g} <span className="text-xs font-normal text-inkSecondary">g</span>
          </div>
          <div className="w-full bg-surfaceMuted h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-status-danger-fg h-full rounded-full" style={{ width: `${Math.min(fatPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Micronutrients breakdown */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-inkSecondary pt-4 border-t border-edge">
        <div>
          <span className="font-medium text-ink">Fiber: </span>
          {fiber_g != null ? `${fiber_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-ink">Sugar: </span>
          {sugar_g != null ? `${sugar_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-ink">Sodium: </span>
          {sodium_mg != null ? `${sodium_mg} mg` : '--'}
        </div>
      </div>
    </div>
  )
}
