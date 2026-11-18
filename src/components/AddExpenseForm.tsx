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
    amount: number;
    reason: string;
    note: string;
    splitAmong: string[];
    expenseDate: string;
  }) => Promise<void>;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function AddExpenseForm({
  travelers,
  editingExpense,
  onCancelEdit,
  onSubmit,
}: AddExpenseFormProps) {
  const [paidBy, setPaidBy] = useState<string>(travelers[0] || 'Sai');
  const [amountInput, setAmountInput] = useState<string>('');
  const [reason, setReason] = useState<string>(EXPENSE_REASONS[0]);
  const [note, setNote] = useState<string>('');
  const [splitAmong, setSplitAmong] = useState<string[]>(travelers);
  const [expenseDate, setExpenseDate] = useState<string>(getTodayDateString());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (editingExpense) {
      setPaidBy(editingExpense.paidBy);
      setAmountInput(String(editingExpense.amount));
      setReason(editingExpense.reason);
      setNote(editingExpense.note || '');
      setSplitAmong(
        editingExpense.splitAmong.length > 0 ? editingExpense.splitAmong : travelers
      );
      setExpenseDate(editingExpense.expenseDate);
      setFormError('');
    } else {
      setSplitAmong((prev) => (prev.length === 0 ? travelers : prev));
    }
  }, [editingExpense, travelers]);

  const parsedAmount = Number(amountInput);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= 10000000;
  const perPersonShare =
    isAmountValid && splitAmong.length > 0 ? parsedAmount / splitAmong.length : 0;

  const toggleSplitPerson = (name: string) => {
    setSplitAmong((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Keep at least 1 person
        return prev.filter((p) => p !== name);
      }
      return [...prev, name];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!paidBy || !travelers.includes(paidBy)) {
      setFormError('Please select who paid the bill.');
      return;
    }
    if (!isAmountValid) {
      setFormError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please select a reason from the list.');
      return;
    }
    if (splitAmong.length === 0) {
      setFormError('Select at least one person to split with.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        paidBy,
        amount: Math.round(parsedAmount * 100) / 100,
        reason: reason.trim().slice(0, 60),
        note: note.trim().slice(0, 180),
        splitAmong,
        expenseDate,
      });

      if (!editingExpense) {
        setAmountInput('');
        setNote('');
        setSplitAmong(travelers);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {editingExpense ? 'Edit Expense Entry' : 'Log New Bill'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter the amount, tap who paid, and select a reason from the list.
          </p>
        </div>
        {editingExpense && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      {/* Amount + Date Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="expense-amount"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Amount Paid (INR)
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
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
              className="w-full min-h-[48px] pl-9 pr-4 py-2.5 text-lg font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-colors"
            />
          </div>
          {isAmountValid && (
            <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
              {formatINR(perPersonShare)} per person · split {splitAmong.length} ways
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="expense-date"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Bill Date
          </label>
          <input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="w-full min-h-[48px] px-3 py-2.5 text-base sm:text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-colors"
          />
        </div>
      </div>

      {/* Who Paid Selection List (All 8 Names Always Visible) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-700">Who Paid?</span>
          <span className="text-xs text-slate-500">Selected: {paidBy}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Who paid">
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
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <span className="truncate">{name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reason Dropdown List + Manual Note */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="expense-reason"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Reason (Select from list)
          </label>
          <select
            id="expense-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2.5 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-colors"
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
            Manual Details / Place (Optional)
          </label>
          <input
            id="expense-note"
            type="text"
            maxLength={180}
            placeholder="e.g. Munnar tea estate lunch, Alleppey boat"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2.5 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition-colors"
          />
        </div>
      </div>

      {/* Split Among Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-700">
            Split Among ({splitAmong.length} of {travelers.length})
          </span>
          <button
            type="button"
            onClick={() => setSplitAmong(travelers)}
            className="min-h-[36px] px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            Select All {travelers.length}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {travelers.map((name) => {
            const included = splitAmong.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleSplitPerson(name)}
                aria-pressed={included}
                className={`min-h-[44px] px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-between gap-2 whitespace-nowrap ${
                  included
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{name}</span>
                <span className="font-mono text-[11px] opacity-80">
                  {included ? 'In' : 'Out'}
                </span>
              </button>
            );
          })}
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

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto min-h-[48px] sm:min-h-[42px] px-5 py-2.5 text-base sm:text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
        >
          {submitting
            ? 'Saving...'
            : editingExpense
              ? 'Save Changes'
              : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
