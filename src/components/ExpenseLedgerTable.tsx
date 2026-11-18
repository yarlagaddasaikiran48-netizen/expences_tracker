import { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { EXPENSE_REASONS, type Expense } from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface ExpenseLedgerTableProps {
  expenses: Expense[];
  travelers: string[];
  loading: boolean;
  selectedPerson: string;
  onSelectPerson: (name: string) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onFocusAddForm: () => void;
}

export function ExpenseLedgerTable({
  expenses,
  travelers,
  loading,
  selectedPerson,
  onSelectPerson,
  onEditExpense,
  onDeleteExpense,
  onFocusAddForm,
}: ExpenseLedgerTableProps) {
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((exp) => {
      if (
        selectedPerson !== 'ALL' &&
        exp.paidBy !== selectedPerson &&
        !exp.splitAmong.includes(selectedPerson)
      ) {
        return false;
      }
      if (reasonFilter !== 'ALL' && exp.reason !== reasonFilter) {
        return false;
      }
      if (q) {
        const hay = `${exp.paidBy} ${exp.reason} ${exp.note} ${exp.expenseDate}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, selectedPerson, reasonFilter, searchQuery]);

  const personStats = useMemo(() => {
    if (selectedPerson === 'ALL') return null;
    let paidSum = 0;
    let paidCount = 0;
    let shareSum = 0;
    let shareCount = 0;
    for (const exp of expenses) {
      if (exp.paidBy === selectedPerson) {
        paidSum += exp.amount;
        paidCount += 1;
      }
      const participants = exp.splitAmong.length > 0 ? exp.splitAmong : travelers;
      if (participants.includes(selectedPerson)) {
        shareSum += exp.amount / participants.length;
        shareCount += 1;
      }
    }
    return { paidSum, paidCount, shareSum, shareCount };
  }, [expenses, selectedPerson, travelers]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);
  }, [filteredExpenses]);

  const handleConfirmDelete = async (expenseId: string) => {
    setDeletingId(expenseId);
    try {
      await onDeleteExpense(expenseId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header & Controls */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Expense Ledger ({filteredExpenses.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Itemized bill list · Filtered total:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {formatINR(filteredTotal)}
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search note, reason..."
                aria-label="Search expenses"
                className="w-full sm:w-48 min-h-[44px] sm:min-h-[34px] pl-8 pr-3 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
              />
            </div>

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              aria-label="Filter by reason"
              className="min-h-[44px] sm:min-h-[34px] px-3 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
            >
              <option value="ALL">All Reasons</option>
              {EXPENSE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Person Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onSelectPerson('ALL')}
            className={`min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedPerson === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            All ({expenses.length})
          </button>
          {travelers.map((name) => {
            const active = selectedPerson === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectPerson(active ? 'ALL' : name)}
                className={`min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Individual Person Quick Summary Strip when filtered */}
        {personStats && selectedPerson !== 'ALL' && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-900">
              {selectedPerson}&apos;s Individual Summary
            </span>
            <div className="flex flex-wrap items-center gap-3 text-slate-600">
              <span>
                Paid:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatINR(personStats.paidSum)}
                </strong>{' '}
                ({personStats.paidCount} bills)
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Share:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatINR(personStats.shareSum)}
                </strong>{' '}
                ({personStats.shareCount} bills)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table / List Content */}
      {loading ? (
        <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading expenses">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-12 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="px-6 py-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            {expenses.length === 0
              ? 'No Kerala trip expenses logged yet'
              : 'No bills match your current filter'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {expenses.length === 0
              ? 'Start by entering the first bill amount, tapping who paid, and selecting a reason.'
              : 'Try clearing the search box or switching back to All Travelers.'}
          </p>
          {expenses.length === 0 ? (
            <button
              type="button"
              onClick={onFocusAddForm}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
            >
              Log First Expense
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSelectPerson('ALL');
                setReasonFilter('ALL');
                setSearchQuery('');
              }}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Stacked Card Rows (< sm) */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filteredExpenses.map((exp) => {
              const splitCount = exp.splitAmong.length;
              const isAllSplit = splitCount === travelers.length;
              const splitLabel = isAllSplit
                ? `All ${travelers.length}`
                : `${splitCount} people`;

              return (
                <div key={exp.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {exp.reason}
                      </div>
                      {exp.note && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {exp.note}
                        </div>
                      )}
                    </div>
                    <div className="font-mono tabular-nums text-base font-semibold text-slate-900 shrink-0">
                      {formatINR(exp.amount)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-xs text-slate-500 truncate">
                      <span className="font-medium text-slate-800">{exp.paidBy}</span>
                      <span> · {exp.expenseDate}</span>
                      <span> · {splitLabel}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {confirmDeleteId === exp.id ? (
                        <>
                          <button
                            type="button"
                            disabled={deletingId === exp.id}
                            onClick={() => handleConfirmDelete(exp.id)}
                            className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                          >
                            {deletingId === exp.id ? '...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditExpense(exp)}
                            aria-label={`Edit ${exp.reason} paid by ${exp.paidBy}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(exp.id)}
                            aria-label={`Delete ${exp.reason} paid by ${exp.paidBy}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 sm:px-5">Date</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4">Reason & Details</th>
                  <th className="py-3 px-4">Split</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredExpenses.map((exp) => {
                  const splitCount = exp.splitAmong.length;
                  const isAllSplit = splitCount === travelers.length;
                  const splitLabel = isAllSplit
                    ? `All ${travelers.length}`
                    : splitCount <= 2
                      ? exp.splitAmong.join(', ')
                      : `${exp.splitAmong.slice(0, 2).join(', ')} +${splitCount - 2}`;

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 sm:px-5 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {exp.expenseDate}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {exp.paidBy}
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="font-medium text-slate-800">{exp.reason}</div>
                        {exp.note && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {exp.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {splitLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {confirmDeleteId === exp.id ? (
                            <>
                              <button
                                type="button"
                                disabled={deletingId === exp.id}
                                onClick={() => handleConfirmDelete(exp.id)}
                                className="px-2 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                              >
                                {deletingId === exp.id ? '...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditExpense(exp)}
                                aria-label={`Edit ${exp.reason} paid by ${exp.paidBy}`}
                                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(exp.id)}
                                aria-label={`Delete ${exp.reason} paid by ${exp.paidBy}`}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
