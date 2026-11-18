import type { Timestamp } from 'firebase/firestore';

export const DEFAULT_TRAVELERS: string[] = [
  'Sai',
  'Venkat',
  'Surya',
  'Suneel',
  'Jeevan',
  'Suman',
  'Litin',
  'Mukunda',
];

export const EXPENSE_REASONS: string[] = [
  'Food & Dining',
  'Stay & Houseboat',
  'Cab, Auto & Fuel',
  'Train, Bus & Flights',
  'Entry Tickets & Boating',
  'Snacks, Tea & Water',
  'Groceries & Essentials',
  'Shopping & Souvenirs',
  'Medical & Emergency',
  'Other',
];

export interface Trip {
  id: string;
  name: string;
  destination: string;
  ownerId: string;
  memberUids: string[];
  invitedEmails: string[];
  travelers: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Expense {
  id: string;
  tripId: string;
  tripOwnerId: string;
  tripMemberUids: string[];
  authorId: string;
  paidBy: string;
  amount: number;
  reason: string;
  note: string;
  splitAmong: string[];
  expenseDate: string; // YYYY-MM-DD
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SettlementRecord {
  id: string;
  tripId: string;
  tripOwnerId: string;
  tripMemberUids: string[];
  authorId: string;
  fromPerson: string;
  toPerson: string;
  amount: number;
  settledDate: string; // YYYY-MM-DD
  note: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PersonSummary {
  name: string;
  totalPaid: number;
  fairShare: number;
  settledSent: number;
  settledReceived: number;
  netBalance: number; // positive => should receive, negative => owes
  billsPaidCount: number;
  billsInvolvedCount: number;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}
