import { ChevronRight } from 'lucide-react';
import type { PersonSummary } from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface IndividualTotalsTableProps {
  summaries: PersonSummary[];
  selectedPerson: string;
  onSelectPerson: (name: string) => void;
}

export function IndividualTotalsTable({
  summaries,
  selectedPerson,
  onSelectPerson,
}: IndividualTotalsTableProps) {
  const grandPaid = summaries.reduce((acc, s) => acc + s.totalPaid, 0);
  const grandShare = summaries.reduce((acc, s) => acc + s.fairShare, 0);
  const grandBills = summaries.reduce((acc, s) => acc + s.billsPaidCount, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Individual Totals & Split Summary
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap any traveler to view their individual bills.
          </p>
        </div>
        {selectedPerson !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectPerson('ALL')}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Show All
          </button>
        )}
      </div>

      {/* Mobile Stacked List (< sm) */}
      <div className="sm:hidden divide-y divide-slate-100">
        {summaries.map((person) => {
          const isSelected = selectedPerson === person.name;
          const isPositive = person.netBalance > 0.5;
          const isNegative = person.netBalance < -0.5;

          return (
            <button
              key={person.name}
              type="button"
              onClick={() => onSelectPerson(isSelected ? 'ALL' : person.name)}
              className={`w-full text-left px-4 py-3.5 min-h-[64px] flex items-center justify-between gap-3 transition-colors ${
                isSelected ? 'bg-emerald-50/70' : 'active:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {person.name}
                  </span>
                  {isSelected && (
                    <span className="text-xs text-emerald-700">· Filtered</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  Paid {formatINR(person.totalPaid)} · Share {formatINR(person.fairShare)} · {person.billsPaidCount} bills
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  {isPositive ? (
                    <>
                      <div className="font-mono tabular-nums text-sm font-semibold text-emerald-700">
                        +{formatINR(person.netBalance)}
                      </div>
                      <div className="text-[11px] text-emerald-700">Receive</div>
                    </>
                  ) : isNegative ? (
                    <>
                      <div className="font-mono tabular-nums text-sm font-semibold text-rose-700">
                        {formatINR(person.netBalance)}
                      </div>
                      <div className="text-[11px] text-rose-700">Pay</div>
                    </>
                  ) : (
                    <>
                      <div className="font-mono tabular-nums text-sm font-medium text-slate-600">
                        ₹0
                      </div>
                      <div className="text-[11px] text-slate-500">Settled</div>
                    </>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          );
        })}

        <div className="px-4 py-3.5 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-900">
          <span>Trip Total ({summaries.length} people)</span>
          <span className="font-mono tabular-nums">
            {formatINR(grandPaid)} · {grandBills} bills
          </span>
        </div>
      </div>

      {/* Desktop / Tablet Table (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="py-3 px-4 sm:px-5">Traveler</th>
              <th className="py-3 px-4 text-right">Bills Paid</th>
              <th className="py-3 px-4 text-right">Total Paid</th>
              <th className="py-3 px-4 text-right">Fair Share</th>
              <th className="py-3 px-4 sm:px-5 text-right">Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {summaries.map((person) => {
              const isSelected = selectedPerson === person.name;
              const isPositive = person.netBalance > 0.5;
              const isNegative = person.netBalance < -0.5;

              return (
                <tr
                  key={person.name}
                  onClick={() =>
                    onSelectPerson(isSelected ? 'ALL' : person.name)
                  }
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4 sm:px-5 font-medium text-slate-900 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{person.name}</span>
                      {isSelected && (
                        <span className="text-xs font-normal text-emerald-700">
                          · Filtered
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {person.billsPaidCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {formatINR(person.totalPaid)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {formatINR(person.fairShare)}
                  </td>
                  <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">
                    {isPositive ? (
                      <span className="inline-flex items-center justify-end gap-1.5 font-mono tabular-nums font-medium text-emerald-700">
                        <span>+{formatINR(person.netBalance)}</span>
                        <span className="font-sans text-xs font-normal text-emerald-700">
                          (Receive)
                        </span>
                      </span>
                    ) : isNegative ? (
                      <span className="inline-flex items-center justify-end gap-1.5 font-mono tabular-nums font-medium text-rose-700">
                        <span>{formatINR(person.netBalance)}</span>
                        <span className="font-sans text-xs font-normal text-rose-700">
                          (Pay)
                        </span>
                      </span>
                    ) : (
                      <span className="font-sans text-xs text-slate-500">
                        Settled · ₹0
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
              <td className="py-3 px-4 sm:px-5">Trip Total ({summaries.length} people)</td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {grandBills}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatINR(grandPaid)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatINR(grandShare)}
              </td>
              <td className="py-3 px-4 sm:px-5 text-right text-xs font-normal text-slate-500">
                Balanced
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
