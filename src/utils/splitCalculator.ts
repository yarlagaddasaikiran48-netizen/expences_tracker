import type {
  Expense,
  PersonSummary,
  SettlementRecord,
  SettlementTransfer,
} from '../types/trip';

export function roundRupees(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatINR(amount: number): string {
  const abs = Math.abs(roundRupees(amount));
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${amount < -0.005 ? '-' : ''}₹${formatted}`;
}

export function computePersonSummaries(
  travelers: string[],
  expenses: Expense[],
  settlements: SettlementRecord[]
): PersonSummary[] {
  const map = new Map<string, PersonSummary>();

  for (const name of travelers) {
    map.set(name, {
      name,
      totalPaid: 0,
      fairShare: 0,
      settledSent: 0,
      settledReceived: 0,
      netBalance: 0,
      billsPaidCount: 0,
      billsInvolvedCount: 0,
    });
  }

  for (const exp of expenses) {
    if (!map.has(exp.paidBy)) {
      map.set(exp.paidBy, {
        name: exp.paidBy,
        totalPaid: 0,
        fairShare: 0,
        settledSent: 0,
        settledReceived: 0,
        netBalance: 0,
        billsPaidCount: 0,
        billsInvolvedCount: 0,
      });
    }
    const payer = map.get(exp.paidBy)!;
    payer.totalPaid = roundRupees(payer.totalPaid + exp.amount);
    payer.billsPaidCount += 1;

    const participants = exp.splitAmong.length > 0 ? exp.splitAmong : travelers;
    const perHead = exp.amount / participants.length;
    for (const person of participants) {
      if (!map.has(person)) {
        map.set(person, {
          name: person,
          totalPaid: 0,
          fairShare: 0,
          settledSent: 0,
          settledReceived: 0,
          netBalance: 0,
          billsPaidCount: 0,
          billsInvolvedCount: 0,
        });
      }
      const p = map.get(person)!;
      p.fairShare = roundRupees(p.fairShare + perHead);
      p.billsInvolvedCount += 1;
    }
  }

  for (const s of settlements) {
    const sender = map.get(s.fromPerson);
    const receiver = map.get(s.toPerson);
    if (sender) {
      sender.settledSent = roundRupees(sender.settledSent + s.amount);
    }
    if (receiver) {
      receiver.settledReceived = roundRupees(receiver.settledReceived + s.amount);
    }
  }

  const result: PersonSummary[] = [];
  for (const summary of map.values()) {
    // Net balance = (What I paid - My fair share) + (What I already paid to settle - What I already received)
    summary.netBalance = roundRupees(
      summary.totalPaid - summary.fairShare + summary.settledSent - summary.settledReceived
    );
    result.push(summary);
  }

  return result;
}

export function computeSettlementTransfers(
  summaries: PersonSummary[]
): SettlementTransfer[] {
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  for (const s of summaries) {
    if (s.netBalance < -0.5) {
      debtors.push({ name: s.name, amount: Math.abs(s.netBalance) });
    } else if (s.netBalance > 0.5) {
      creditors.push({ name: s.name, amount: s.netBalance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const transferAmt = roundRupees(Math.min(debtor.amount, creditor.amount));

    if (transferAmt >= 1) {
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: transferAmt,
      });
    }

    debtor.amount = roundRupees(debtor.amount - transferAmt);
    creditor.amount = roundRupees(creditor.amount - transferAmt);

    if (debtor.amount < 0.5) i++;
    if (creditor.amount < 0.5) j++;
  }

  return transfers;
}
