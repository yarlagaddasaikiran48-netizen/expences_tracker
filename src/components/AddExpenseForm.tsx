import React, { useEffect, useState } from 'react';
import { Check, IndianRupee, X } from 'lucide-react';
import { EXPENSE_REASONS, type Expense } from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface AddExpenseFormProps {
  travelers: string[];
  editingExpense: Expense | null;
  onCancelEdit: () => void;
  onSubmit: (payload: {
    paidBy: string;
    addedBy: string;
    amount: number;
    reason: string;
    note: string;
    splitAmong: string[];
    expenseDate: string;
  }) => Promise<void>;
}

const ADDED_BY_STORAGE_KEY = 'kerala_split_added_by';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getInitialAddedBy(travelers: string[]): string {
  try {
    const saved = localStorage.getItem(ADDED_BY_STORAGE_KEY);
    if (saved && travelers.includes(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  return travelers[0] || 'Sai';
}

export function AddExpenseForm({
  travelers,
  editingExpense,
  onCancelEdit,
  onSubmit,
}: AddExpenseFormProps) {
  const [amountInput, setAmountInput] = useState<string>('');
  const [paidBy, setPaidBy] = useState<string>(travelers[0] || 'Sai');
  const [addedBy, setAddedBy] = useState<string>(() => getInitialAddedBy(travelers));
  const [reason, setReason] = useState<string>(EXPENSE_REASONS[0]);
  const [note, setNote] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayDateString());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<string>('');

  useEffect(() => {
    if (editingExpense) {
      setAmountInput(String(editingExpense.amount));
      setPaidBy(editingExpense.paidBy);
      setAddedBy(editingExpense.addedBy || editingExpense.paidBy);
      setReason(editingExpense.reason);
      setNote(editingExpense.note || '');
      setExpenseDate(editingExpense.expenseDate);
      setFormError('');
      setSavedNotice('');
    }
  }, [editingExpense]);

  const parsedAmount = Number(amountInput);
  const isAmountValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= 10000000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSavedNotice('');

    if (!isAmountValid) {
      setFormError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (!paidBy || !travelers.includes(paidBy)) {
      setFormError('Select who paid.');
      return;
    }
    if (!addedBy || !travelers.includes(addedBy)) {
      setFormError('Select who added this entry.');
      return;
    }

    try {
      localStorage.setItem(ADDED_BY_STORAGE_KEY, addedBy);
    } catch {
      // ignore storage errors
    }

    setSubmitting(true);
    try {
      const cleanAmount = Math.round(parsedAmount * 100) / 100;
      await onSubmit({
        paidBy,
        addedBy,
        amount: cleanAmount,
        reason: reason.trim().slice(0, 60),
        note: note.trim().slice(0, 180),
        splitAmong: travelers,
        expenseDate,
      });

      if (!editingExpense) {
        setAmountInput('');
        setNote('');
        setSavedNotice(`Saved ${formatINR(cleanAmount)} paid by ${paidBy}`);
        setTimeout(() => setSavedNotice(''), 3000);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5 max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {editingExpense ? 'Edit Entry' : 'Add Money'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter amount, who paid, for what, and who added it.
          </p>
        </div>
        {editingExpense && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      {/* Amount */}
      <div>
        <label
          htmlFor="expense-amount"
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          How Much (₹)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <IndianRupee className="w-4 h-4" />
          </span>
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            max="10000000"
            placeholder="0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
            className="w-full min-h-[52px] pl-10 pr-4 py-2.5 text-xl font-mono tabular-nums font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-colors"
          />
        </div>
      </div>

      {/* Who Paid (All 8 Names) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-700">Who Paid?</span>
          <span className="text-xs text-emerald-700 font-medium">{paidBy}</span>
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          role="radiogroup"
          aria-label="Who paid"
        >
          {travelers.map((name) => {
            const isSelected = paidBy === name;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setPaidBy(name)}
                className={`min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-between gap-2 whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reason + Manual Note */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="expense-reason"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            For What (Select from list)
          </label>
          <select
            id="expense-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
          >
            {EXPENSE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="expense-note"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Note / Place (Optional)
          </label>
          <input
            id="expense-note"
            type="text"
            maxLength={180}
            placeholder="e.g. Munnar tea, Alleppey lunch"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Who Added + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="expense-added-by"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Who Added This Entry?
          </label>
          <select
            id="expense-added-by"
            value={addedBy}
            onChange={(e) => setAddedBy(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
          >
            {travelers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="expense-date"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
          />
        </div>
      </div>

      {formError && (
        <div
          role="alert"
          className="px-3.5 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
        >
          {formError}
        </div>
      )}

      {savedNotice && (
        <div
          role="status"
          className="px-3.5 py-2.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          {savedNotice}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] px-5 py-3 text-base sm:text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors"
      >
        {submitting
          ? 'Saving...'
          : editingExpense
            ? 'Save Changes'
            : 'Add Money'}
      </button>
    </form>
  );
}
