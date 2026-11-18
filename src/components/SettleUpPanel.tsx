import { useState } from 'react';
import { ArrowRight, Check, Copy, Download, Trash2 } from 'lucide-react';
import type {
  Expense,
  PersonSummary,
  SettlementRecord,
  SettlementTransfer,
} from '../types/trip';
import { formatINR } from '../utils/splitCalculator';

interface SettleUpPanelProps {
  tripName: string;
  summaries: PersonSummary[];
  transfers: SettlementTransfer[];
  settlements: SettlementRecord[];
  expenses: Expense[];
  onRecordSettlement: (transfer: SettlementTransfer) => Promise<void>;
  onDeleteSettlement: (settlementId: string) => Promise<void>;
  currentUserId: string;
  tripOwnerId: string;
}

export function SettleUpPanel({
  tripName,
  summaries,
  transfers,
  settlements,
  expenses,
  onRecordSettlement,
  onDeleteSettlement,
  currentUserId,
  tripOwnerId,
}: SettleUpPanelProps) {
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const totalSpend = expenses.reduce((acc, e) => acc + e.amount, 0);

  const handleMarkPaid = async (transfer: SettlementTransfer) => {
    const key = `${transfer.from}->${transfer.to}`;
    setSettlingKey(key);
    try {
      await onRecordSettlement(transfer);
    } finally {
      setSettlingKey(null);
    }
  };

  const handleCopySummary = async () => {
    const lines: string[] = [
      `*${tripName} — Expense Split Summary*`,
      `Total Trip Spend: ${formatINR(totalSpend)} (${expenses.length} bills)`,
      '',
      '*Individual Totals:*',
      ...summaries.map((s) => {
        const status =
          s.netBalance > 0.5
            ? `+${formatINR(s.netBalance)} (Receive)`
            : s.netBalance < -0.5
              ? `${formatINR(s.netBalance)} (Pay)`
              : 'Settled';
        return `- ${s.name}: Paid ${formatINR(s.totalPaid)} | Share ${formatINR(s.fairShare)} | ${status}`;
      }),
    ];

    if (transfers.length > 0) {
      lines.push('', '*Who Pays Whom:*');
      for (const t of transfers) {
        lines.push(`- ${t.from} pays ${t.to}: ${formatINR(t.amount)}`);
      }
    } else {
      lines.push('', 'All balances are settled!');
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard denied
    }
  };

  const handleDownloadCSV = () => {
    const header = ['Date', 'Paid By', 'Reason', 'Details', 'Split Among', 'Amount (INR)'];
    const rows = expenses.map((e) => [
      e.expenseDate,
      e.paidBy,
      e.reason,
      e.note.replace(/"/g, '""'),
      e.splitAmong.join(' | '),
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
    link.download = `${tripName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_expenses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Final Split & Settlement Plan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Minimum transfers needed to settle all {summaries.length} travelers evenly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Copied Summary</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy WhatsApp Summary</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={expenses.length === 0}
            className="min-h-[44px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {transfers.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 border border-slate-200/80 rounded-lg">
            <p className="text-sm font-medium text-slate-900">
              {expenses.length === 0
                ? 'Log bills to calculate split transfers'
                : 'Everyone is settled up'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {expenses.length === 0
                ? 'Once bills are entered, this panel shows exactly who pays whom.'
                : 'No pending balances remain across the group.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {transfers.map((t) => {
              const key = `${t.from}->${t.to}`;
              const isBusy = settlingKey === key;
              return (
                <div
                  key={key}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-semibold text-rose-700">{t.from}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-emerald-700">{t.to}</span>
                    <span className="text-xs text-slate-500">· Suggested transfer</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-mono tabular-nums text-base sm:text-sm font-semibold text-slate-900">
                      {formatINR(t.amount)}
                    </span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleMarkPaid(t)}
                      className="min-h-[44px] sm:min-h-[34px] px-4 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isBusy ? 'Saving...' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recorded Settlements History */}
        {settlements.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-700">
              Recorded Settlement Payments ({settlements.length})
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {settlements.map((s) => {
                const canDelete =
                  s.authorId === currentUserId || tripOwnerId === currentUserId;
                return (
                  <div
                    key={s.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                      <span className="font-mono tabular-nums text-slate-500">
                        {s.settledDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-900">{s.fromPerson}</span>
                      <span>paid</span>
                      <span className="font-medium text-slate-900">{s.toPerson}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono tabular-nums font-medium text-emerald-700">
                        {formatINR(s.amount)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteSettlement(s.id)}
                          aria-label={`Remove settlement from ${s.fromPerson} to ${s.toPerson}`}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
