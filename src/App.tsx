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
  ArrowLeftRight,
  PlusCircle,
  Receipt,
  Users,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './firebase';
import { AddExpenseForm } from './components/AddExpenseForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExpenseLedgerTable } from './components/ExpenseLedgerTable';
import { IndividualTotalsTable } from './components/IndividualTotalsTable';
import { SettleUpPanel } from './components/SettleUpPanel';
import { ShareTripModal } from './components/ShareTripModal';
import {
  DEFAULT_TRAVELERS,
  type Expense,
  type SettlementRecord,
  type SettlementTransfer,
  type Trip,
} from './types/trip';
import {
  computePersonSummaries,
  computeSettlementTransfers,
  formatINR,
} from './utils/splitCalculator';

const DEFAULT_TRIP_ID = 'kerala-trip-2026';
const TRIP_STORAGE_KEY = 'kerala_split_trip_id';

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
  const [tripId, setTripId] = useState<string>(resolveInitialTripId);
  const [trip, setTrip] = useState<Trip | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(true);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [mobileTab, setMobileTab] = useState<'log' | 'totals' | 'bills' | 'settle'>('log');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  const creatingTripRef = useRef<boolean>(false);
  const addFormRef = useRef<HTMLDivElement | null>(null);

  // Sync URL query param & localStorage when switching trip rooms
  const handleSwitchTripCode = (newCode: string) => {
    const clean = newCode.trim().replace(/[^a-zA-Z0-9_-]/g, '-') || DEFAULT_TRIP_ID;
    creatingTripRef.current = false;
    setTripId(clean);
    try {
      localStorage.setItem(TRIP_STORAGE_KEY, clean);
      const url = new URL(window.location.href);
      url.searchParams.set('trip', clean);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore URL/storage errors
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  // Listen to active trip doc and auto-create it if it doesn't exist yet
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

    const settlementsPath = `trips/${tripId}/settlements`;
    const setQ = query(
      collection(db, settlementsPath),
      where('tripId', '==', tripId)
    );

    const unsubSet = onSnapshot(
      setQ,
      (snapshot) => {
        const rows: SettlementRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tripId: String(data.tripId || tripId),
            fromPerson: String(data.fromPerson || ''),
            toPerson: String(data.toPerson || ''),
            amount: Number(data.amount || 0),
            settledDate: String(data.settledDate || ''),
            note: String(data.note || ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setSettlements(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, settlementsPath)
    );

    return () => {
      unsubTrip();
      unsubExp();
      unsubSet();
    };
  }, [tripId]);

  const travelers = trip?.travelers || DEFAULT_TRAVELERS;

  const summaries = useMemo(
    () => computePersonSummaries(travelers, expenses, settlements),
    [travelers, expenses, settlements]
  );

  const transfers = useMemo(
    () => computeSettlementTransfers(summaries),
    [summaries]
  );

  const totalTripSpend = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amount, 0),
    [expenses]
  );

  const perPersonAvg = travelers.length > 0 ? totalTripSpend / travelers.length : 0;

  const totalUnsettledAmount = useMemo(
    () => transfers.reduce((acc, t) => acc + t.amount, 0),
    [transfers]
  );

  const handleSaveExpense = async (payload: {
    paidBy: string;
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
          amount: payload.amount,
          reason: payload.reason,
          note: payload.note,
          splitAmong: payload.splitAmong,
          expenseDate: payload.expenseDate,
          updatedAt: serverTimestamp(),
        });
        setEditingExpense(null);
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

  const handleRecordSettlement = async (transfer: SettlementTransfer) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const setColPath = `trips/${tripId}/settlements`;
    try {
      await addDoc(collection(db, 'trips', tripId, 'settlements'), {
        tripId,
        fromPerson: transfer.from,
        toPerson: transfer.to,
        amount: transfer.amount,
        settledDate: today,
        note: 'Settled via Kerala Split',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, setColPath);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    const setPath = `trips/${tripId}/settlements/${settlementId}`;
    try {
      await deleteDoc(doc(db, 'trips', tripId, 'settlements', settlementId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, setPath);
    }
  };

  const handleUpdateTrip = async (updates: {
    name: string;
    travelers: string[];
  }) => {
    const tripPath = `trips/${tripId}`;
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        name: updates.name,
        travelers: updates.travelers,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, tripPath);
    }
  };

  const scrollToAddForm = () => {
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const switchMobileTab = (tab: 'log' | 'totals' | 'bills' | 'settle') => {
    setMobileTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: Exact 3 Zones */}
      <header className="md:sticky md:top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Kerala Split
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#log-bill"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Log Bill
            </a>
            <a
              href="#individual-totals"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Individual Totals
            </a>
            <a
              href="#expense-ledger"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Expense List
            </a>
            <a
              href="#settle-up"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Settle Up
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="min-h-[40px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Crew & Share</span>
            </button>
          </div>
        </div>
      </header>

      <main
        id="top"
        className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:py-8 space-y-5 sm:space-y-6"
      >
        {/* Trip Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{trip?.destination || 'Kerala'}</span>
              <span aria-hidden="true">·</span>
              <span>{travelers.length} travelers</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Room: {tripId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {trip?.name || 'Kerala Trip'}
            </h1>
          </div>
        </div>

        {/* 4-Column KPI Summary Strip */}
        <section
          aria-label="Trip summary metrics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
            <p className="text-xs text-slate-500">Total Trip Spend</p>
            <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-1">
              {formatINR(totalTripSpend)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
            <p className="text-xs text-slate-500">Avg Per Person ({travelers.length})</p>
            <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-1">
              {formatINR(perPersonAvg)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
            <p className="text-xs text-slate-500">Bills Logged</p>
            <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-slate-900 mt-1">
              {expenses.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
            <p className="text-xs text-slate-500">Remaining to Settle</p>
            <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-emerald-700 mt-1">
              {formatINR(totalUnsettledAmount)}
            </p>
          </div>
        </section>

        {/* Primary Workspace: Log Bill + Individual Totals Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section
            id="log-bill"
            ref={addFormRef}
            className={`lg:col-span-5 ${mobileTab === 'log' ? 'block' : 'hidden md:block'}`}
          >
            <AddExpenseForm
              travelers={travelers}
              editingExpense={editingExpense}
              onCancelEdit={() => setEditingExpense(null)}
              onSubmit={async (payload) => {
                await handleSaveExpense(payload);
                if (window.innerWidth < 768) {
                  switchMobileTab('bills');
                }
              }}
            />
          </section>

          <section
            id="individual-totals"
            className={`lg:col-span-7 ${mobileTab === 'totals' ? 'block' : 'hidden md:block'}`}
          >
            <IndividualTotalsTable
              summaries={summaries}
              selectedPerson={selectedPerson}
              onSelectPerson={(name) => {
                setSelectedPerson(name);
                if (name !== 'ALL' && window.innerWidth < 768) {
                  switchMobileTab('bills');
                }
              }}
            />
          </section>
        </div>

        {/* Full Itemized Expense Table */}
        <section
          id="expense-ledger"
          className={mobileTab === 'bills' ? 'block' : 'hidden md:block'}
        >
          <ExpenseLedgerTable
            expenses={expenses}
            travelers={travelers}
            loading={expensesLoading}
            selectedPerson={selectedPerson}
            onSelectPerson={setSelectedPerson}
            onEditExpense={(exp) => {
              setEditingExpense(exp);
              if (window.innerWidth < 768) {
                switchMobileTab('log');
              } else {
                scrollToAddForm();
              }
            }}
            onDeleteExpense={handleDeleteExpense}
            onFocusAddForm={() => {
              if (window.innerWidth < 768) {
                switchMobileTab('log');
              } else {
                scrollToAddForm();
              }
            }}
          />
        </section>

        {/* Settlement Plan & Export */}
        <section
          id="settle-up"
          className={mobileTab === 'settle' ? 'block' : 'hidden md:block'}
        >
          <SettleUpPanel
            tripName={trip?.name || 'Kerala Trip'}
            summaries={summaries}
            transfers={transfers}
            settlements={settlements}
            expenses={expenses}
            onRecordSettlement={handleRecordSettlement}
            onDeleteSettlement={handleDeleteSettlement}
          />
        </section>
      </main>

      <footer className="hidden md:block border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Kerala Split · Group Expense Ledger</span>
          <span>Travelers: {travelers.join(', ')}</span>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Tab Bar (Thumb Zone, < md only) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      >
        <div className="grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => switchMobileTab('log')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileTab === 'log' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">Add Bill</span>
          </button>

          <button
            type="button"
            onClick={() => switchMobileTab('totals')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileTab === 'totals' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">Totals</span>
          </button>

          <button
            type="button"
            onClick={() => switchMobileTab('bills')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileTab === 'bills' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">
              Bills ({expenses.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchMobileTab('settle')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileTab === 'settle' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight">Settle</span>
          </button>
        </div>
      </nav>

      {showShareModal && (
        <ShareTripModal
          trip={
            trip || {
              id: tripId,
              name: 'Kerala Trip',
              destination: 'Kerala',
              travelers: DEFAULT_TRAVELERS,
            }
          }
          onClose={() => setShowShareModal(false)}
          onUpdateTrip={handleUpdateTrip}
          onSwitchTripCode={handleSwitchTripCode}
        />
      )}
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
