import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Download } from 'lucide-react';
import type { Expense, PersonSummary, SettlementTransfer } from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface ReportsViewProps {
  tripName: string;
  travelers: string[];
  expenses: Expense[];
  summaries: PersonSummary[];
  transfers: SettlementTransfer[];
}

export function ReportsView({
  tripName,
  travelers,
  expenses,
  summaries,
  transfers,
}: ReportsViewProps) {
  const [copied, setCopied] = useState(false);

  const totalSpend = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const perPersonShare = travelers.length > 0 ? totalSpend / travelers.length : 0;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { reason: string; count: number; total: number }>();
    for (const exp of expenses) {
      const prev = map.get(exp.reason) || {
        reason: exp.reason,
        count: 0,
        total: 0,
      };
      prev.count += 1;
      prev.total += exp.amount;
      map.set(exp.reason, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const handleCopySummary = async () => {
    const lines: string[] = [
      `*${tripName} — Trip Report*`,
      `Total Spent: ${formatINR(totalSpend)} (${expenses.length} bills)`,
      `Per Person Share (${travelers.length}): ${formatINR(perPersonShare)}`,
      '',
      '*For What (Category Totals):*',
      ...categoryBreakdown.map(
        (c) => `- ${c.reason}: ${formatINR(c.total)} (${c.count} bills)`
      ),
      '',
      '*Individual Totals:*',
      ...summaries.map((s) => {
        const status =
          s.netBalance > 0.5
            ? `+${formatINR(s.netBalance)} (Receive)`
            : s.netBalance < -0.5
              ? `${formatINR(s.netBalance)} (Pay)`
              : 'Settled';
        return `- ${s.name}: Paid ${formatINR(s.totalPaid)} | ${status}`;
      }),
    ];

    if (transfers.length > 0) {
      lines.push('', '*Who Pays Whom:*');
      for (const t of transfers) {
        lines.push(`- ${t.from} pays ${t.to}: ${formatINR(t.amount)}`);
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadCSV = () => {
    const header = ['Date', 'Paid By', 'Added By', 'For What', 'Note', 'Amount (INR)'];
    const rows = expenses.map((e) => [
      e.expenseDate,
      e.paidBy,
      e.addedBy || e.paidBy,
      e.reason,
      e.note.replace(/"/g, '""'),
      String(e.amount),
    ]);
    const csv = [
      header.join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tripName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Top Total Cards + Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Trip Report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total spent, what we spent on, and who pays whom.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied Report</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy WhatsApp Report</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={expenses.length === 0}
              className="min-h-[42px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] sm:text-xs text-slate-500">Grand Total</div>
            <div className="text-base sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
              {formatINR(totalSpend)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] sm:text-xs text-slate-500">
              Each ({travelers.length})
            </div>
            <div className="text-base sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
              {formatINR(perPersonShare)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] sm:text-xs text-slate-500">Total Bills</div>
            <div className="text-base sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
              {expenses.length}
            </div>
          </div>
        </div>
      </div>

      {/* For What We Spent (Category Breakdown) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            For What We Spent
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Category breakdown showing where the money went.
          </p>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No expenses logged yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categoryBreakdown.map((cat) => {
              const pct = totalSpend > 0 ? Math.round((cat.total / totalSpend) * 100) : 0;
              return (
                <div key={cat.reason} className="px-4 sm:px-5 py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-900">
                        {cat.reason}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        · {cat.count} {cat.count === 1 ? 'bill' : 'bills'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                        {formatINR(cat.total)}
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-500 ml-2">
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded-full"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="px-4 sm:px-5 py-3 bg-slate-50 flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatINR(totalSpend)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Individual Split & Who Pays Whom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Individual Totals */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Individual Split Balance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Person</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((s) => {
                  const isPos = s.netBalance > 0.5;
                  const isNeg = s.netBalance < -0.5;
                  return (
                    <tr key={s.name}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatINR(s.totalPaid)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap">
                        {isPos ? (
                          <span className="text-emerald-700">
                            +{formatINR(s.netBalance)} (Receive)
                          </span>
                        ) : isNeg ? (
                          <span className="text-rose-700">
                            {formatINR(s.netBalance)} (Pay)
                          </span>
                        ) : (
                          <span className="text-slate-500">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Who Pays Whom */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              Who Pays Whom
            </h3>
          </div>
          {transfers.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">
              {expenses.length === 0
                ? 'Add bills to see split payments.'
                : 'Everyone is even!'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <div
                  key={`${t.from}->${t.to}`}
                  className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-rose-700">{t.from}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-emerald-700">{t.to}</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatINR(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
