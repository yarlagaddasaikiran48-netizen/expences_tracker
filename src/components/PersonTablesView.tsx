import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Expense } from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface PersonTablesViewProps {
  travelers: string[];
  expenses: Expense[];
  loading: boolean;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onGoToAdd: () => void;
}

export function PersonTablesView({
  travelers,
  expenses,
  loading,
  onEditExpense,
  onDeleteExpense,
  onGoToAdd,
}: PersonTablesViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const groupedByPerson = useMemo(() => {
    return travelers.map((name) => {
      const items = expenses.filter((e) => e.paidBy === name);
      const total = items.reduce((sum, e) => sum + e.amount, 0);
      return { name, items, total };
    });
  }, [travelers, expenses]);

  const visibleGroups = useMemo(() => {
    if (selectedPerson === 'ALL') return groupedByPerson;
    return groupedByPerson.filter((g) => g.name === selectedPerson);
  }, [groupedByPerson, selectedPerson]);

  const grandTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteExpense(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading person tables">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Person Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Each Person&apos;s Paid Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              What each person paid for, how much, and their individual total.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-slate-500">All 8 Total</div>
            <div className="font-mono tabular-nums text-sm font-semibold text-slate-900">
              {formatINR(grandTotal)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedPerson('ALL')}
            className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedPerson === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({travelers.length})
          </button>
          {travelers.map((name) => {
            const active = selectedPerson === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedPerson(active ? 'ALL' : name)}
                className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">No entries added yet</p>
          <p className="text-xs text-slate-500">
            Add your first bill in the Add Money tab to see each person&apos;s table.
          </p>
          <button
            type="button"
            onClick={onGoToAdd}
            className="min-h-[44px] px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <div
              key={group.name}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              {/* Person Card Header */}
              <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'bill paid' : 'bills paid'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Individual Total</div>
                  <div className="font-mono tabular-nums text-base sm:text-lg font-semibold text-emerald-700">
                    {formatINR(group.total)}
                  </div>
                </div>
              </div>

              {group.items.length === 0 ? (
                <div className="px-4 sm:px-5 py-4 text-xs text-slate-500">
                  No bills paid by {group.name} yet · Total: ₹0
                </div>
              ) : (
                <>
                  {/* Mobile Rows (< sm) */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <div key={item.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {item.reason}
                            </div>
                            {item.note && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {item.note}
                              </div>
                            )}
                          </div>
                          <div className="font-mono tabular-nums text-sm font-semibold text-slate-900 shrink-0">
                            {formatINR(item.amount)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            {item.expenseDate}
                            {item.addedBy ? ` · Added by ${item.addedBy}` : ''}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {confirmDeleteId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={() => handleConfirmDelete(item.id)}
                                  className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-rose-600 rounded-md"
                                >
                                  {deletingId === item.id ? '...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[36px] px-2 py-1 text-xs text-slate-600"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onEditExpense(item)}
                                  aria-label={`Edit ${item.reason}`}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  aria-label={`Delete ${item.reason}`}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-rose-600 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-900">
                      <span>{group.name} Total</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(group.total)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Table (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                          <th className="py-2.5 px-5">For What</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Added By</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                          <th className="py-2.5 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {group.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-5">
                              <div className="font-medium text-slate-900">
                                {item.reason}
                              </div>
                              {item.note && (
                                <div className="text-xs text-slate-500">
                                  {item.note}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                              {item.expenseDate}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {item.addedBy || item.paidBy}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                              {formatINR(item.amount)}
                            </td>
                            <td className="py-2.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1">
                                {confirmDeleteId === item.id ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={deletingId === item.id}
                                      onClick={() => handleConfirmDelete(item.id)}
                                      className="px-2 py-1 text-xs font-medium text-white bg-rose-600 rounded"
                                    >
                                      {deletingId === item.id ? '...' : 'Confirm'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-2 py-1 text-xs text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onEditExpense(item)}
                                      aria-label={`Edit ${item.reason}`}
                                      className="p-1.5 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(item.id)}
                                      aria-label={`Delete ${item.reason}`}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50/70 text-sm font-semibold text-slate-900">
                          <td colSpan={3} className="py-2.5 px-5">
                            {group.name} Total
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                            {formatINR(group.total)}
                          </td>
                          <td className="py-2.5 px-5" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
