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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Daily Nutrition Summary
          </h2>
          <p className="text-xs text-slate-500">
            {totalEntries === 0 ? 'No foods logged for this date' : `${totalEntries} food entries logged`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {Math.round(calories_kcal)}
          </span>
          <span className="text-sm font-medium text-slate-500 ml-1.5">kcal total</span>
        </div>
      </div>

      {/* Macronutrient Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Protein */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40">
          <div className="flex justify-between items-center text-xs font-semibold text-blue-700 dark:text-blue-300">
            <span>Protein</span>
            <span>{proteinPct}%</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {protein_g} <span className="text-xs font-normal text-slate-500">g</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900/60 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(proteinPct, 100)}%` }} />
          </div>
        </div>

        {/* Carbohydrates */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40">
          <div className="flex justify-between items-center text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span>Carbs</span>
            <span>{carbsPct}%</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {carbs_g} <span className="text-xs font-normal text-slate-500">g</span>
          </div>
          <div className="w-full bg-amber-200 dark:bg-amber-900/60 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(carbsPct, 100)}%` }} />
          </div>
        </div>

        {/* Fat */}
        <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40">
          <div className="flex justify-between items-center text-xs font-semibold text-rose-700 dark:text-rose-300">
            <span>Fat</span>
            <span>{fatPct}%</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {fat_g} <span className="text-xs font-normal text-slate-500">g</span>
          </div>
          <div className="w-full bg-rose-200 dark:bg-rose-900/60 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(fatPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Micronutrients breakdown */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">Fiber: </span>
          {fiber_g != null ? `${fiber_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">Sugar: </span>
          {sugar_g != null ? `${sugar_g} g` : '--'}
        </div>
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">Sodium: </span>
          {sodium_mg != null ? `${sodium_mg} mg` : '--'}
        </div>
      </div>
    </div>
  )
}

