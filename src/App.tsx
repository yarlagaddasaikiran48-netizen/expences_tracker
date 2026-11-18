import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  Check,
  PlusCircle,
  Share2,
  Table2,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './firebase';
import { AddExpenseForm } from './components/AddExpenseForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PersonTablesView } from './components/PersonTablesView';
import { ReportsView } from './components/ReportsView';
import {
  DEFAULT_TRAVELERS,
  type Expense,
  type Trip,
} from './types/trip';
import {
  computePersonSummaries,
  computeSettlementTransfers,
  formatINR,
} from './utils/splitCalculator';

const DEFAULT_TRIP_ID = 'kerala-trip-2026';
const TRIP_STORAGE_KEY = 'kerala_split_trip_id';

type AppTab = 'add' | 'persons' | 'reports';

function resolveInitialTripId(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('trip')?.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    if (fromUrl) {
      localStorage.setItem(TRIP_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(TRIP_STORAGE_KEY)?.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    if (saved) return saved;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_TRIP_ID;
}

function TripWorkspace() {
  const [tripId] = useState<string>(resolveInitialTripId);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<AppTab>('add');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const creatingTripRef = useRef<boolean>(false);

  useEffect(() => {
    testConnection();
  }, []);

  useEffect(() => {
    const tripDocPath = `trips/${tripId}`;
    const tripRef = doc(db, 'trips', tripId);

    const unsubTrip = onSnapshot(
      tripRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTrip({
            id: snap.id,
            name: String(data.name || 'Kerala Trip'),
            destination: String(data.destination || 'Kerala'),
            travelers:
              Array.isArray(data.travelers) && data.travelers.length > 0
                ? data.travelers
                : DEFAULT_TRAVELERS,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          });
        } else if (!creatingTripRef.current) {
          creatingTripRef.current = true;
          setDoc(tripRef, {
            name: 'Kerala Trip',
            destination: 'Kerala',
            travelers: DEFAULT_TRAVELERS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch((err) => {
            creatingTripRef.current = false;
            handleFirestoreError(err, OperationType.CREATE, tripDocPath);
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, tripDocPath)
    );

    setExpensesLoading(true);
    const expensesPath = `trips/${tripId}/expenses`;
    const expQ = query(
      collection(db, expensesPath),
      where('tripId', '==', tripId)
    );

    const unsubExp = onSnapshot(
      expQ,
      (snapshot) => {
        const rows: Expense[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tripId: String(data.tripId || tripId),
            paidBy: String(data.paidBy || ''),
            addedBy: data.addedBy ? String(data.addedBy) : undefined,
            amount: Number(data.amount || 0),
            reason: String(data.reason || 'Other'),
            note: String(data.note || ''),
            splitAmong: Array.isArray(data.splitAmong) ? data.splitAmong : [],
            expenseDate: String(data.expenseDate || ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        rows.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
        setExpenses(rows);
        setExpensesLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, expensesPath)
    );

    return () => {
      unsubTrip();
      unsubExp();
    };
  }, [tripId]);

  const travelers = trip?.travelers || DEFAULT_TRAVELERS;

  const summaries = useMemo(
    () => computePersonSummaries(travelers, expenses, []),
    [travelers, expenses]
  );

  const transfers = useMemo(
    () => computeSettlementTransfers(summaries),
    [summaries]
  );

  const totalTripSpend = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amount, 0),
    [expenses]
  );

  const switchTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveExpense = async (payload: {
    paidBy: string;
    addedBy: string;
    amount: number;
    reason: string;
    note: string;
    splitAmong: string[];
    expenseDate: string;
  }) => {
    if (editingExpense) {
      const expPath = `trips/${tripId}/expenses/${editingExpense.id}`;
      try {
        await updateDoc(doc(db, 'trips', tripId, 'expenses', editingExpense.id), {
          paidBy: payload.paidBy,
          addedBy: payload.addedBy,
          amount: payload.amount,
          reason: payload.reason,
          note: payload.note,
          splitAmong: payload.splitAmong,
          expenseDate: payload.expenseDate,
          updatedAt: serverTimestamp(),
        });
        setEditingExpense(null);
        switchTab('persons');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, expPath);
      }
      return;
    }

    const expColPath = `trips/${tripId}/expenses`;
    try {
      await addDoc(collection(db, 'trips', tripId, 'expenses'), {
        tripId,
        paidBy: payload.paidBy,
        addedBy: payload.addedBy,
        amount: payload.amount,
        reason: payload.reason,
        note: payload.note,
        splitAmong: payload.splitAmong,
        expenseDate: payload.expenseDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, expColPath);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const expPath = `trips/${tripId}/expenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, 'trips', tripId, 'expenses', expenseId));
      if (editingExpense?.id === expenseId) {
        setEditingExpense(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, expPath);
    }
  };

  const handleCopyShareLink = async () => {
    const url = `${window.location.origin}/?trip=${encodeURIComponent(tripId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar: 3-zone clean header */}
      <header className="md:sticky md:top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sm:gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Kerala Split
          </span>

          {/* Desktop 3-Tab Switcher */}
          <nav
            aria-label="Primary tabs"
            className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => switchTab('add')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'add'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Add Money
            </button>
            <button
              type="button"
              onClick={() => switchTab('persons')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'persons'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Person Table
            </button>
            <button
              type="button"
              onClick={() => switchTab('reports')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reports
            </button>
          </nav>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="min-h-[40px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:py-8 space-y-5">
        {/* Compact Trip Total Strip */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {trip?.name || 'Kerala Trip'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {travelers.length} people · {expenses.length} entries
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Total Spent</div>
            <div className="text-lg sm:text-xl font-mono tabular-nums font-semibold text-emerald-700">
              {formatINR(totalTripSpend)}
            </div>
          </div>
        </div>

        {/* Tab 1: Add Money */}
        {activeTab === 'add' && (
          <AddExpenseForm
            travelers={travelers}
            editingExpense={editingExpense}
            onCancelEdit={() => {
              setEditingExpense(null);
              switchTab('persons');
            }}
            onSubmit={handleSaveExpense}
          />
        )}

        {/* Tab 2: Person Table */}
        {activeTab === 'persons' && (
          <PersonTablesView
            travelers={travelers}
            expenses={expenses}
            loading={expensesLoading}
            onEditExpense={(exp) => {
              setEditingExpense(exp);
              switchTab('add');
            }}
            onDeleteExpense={handleDeleteExpense}
            onGoToAdd={() => switchTab('add')}
          />
        )}

        {/* Tab 3: Reports */}
        {activeTab === 'reports' && (
          <ReportsView
            tripName={trip?.name || 'Kerala Trip'}
            travelers={travelers}
            expenses={expenses}
            summaries={summaries}
            transfers={transfers}
          />
        )}
      </main>

      {/* Mobile Fixed 3-Tab Bottom Navigation */}
      <nav
        aria-label="Mobile tabs"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      >
        <div className="grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => switchTab('add')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'add'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">
              Add Money
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('persons')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'persons'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Table2 className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">
              Person Table
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('reports')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'reports'
                ? 'text-emerald-700'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">
              Reports
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TripWorkspace />
    </ErrorBoundary>
  );
}
