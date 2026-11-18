import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeftRight,
  LogOut,
  PlusCircle,
  Receipt,
  Users,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
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

function TripWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  const [memberTrips, setMemberTrips] = useState<Trip[]>([]);
  const [invitedTrips, setInvitedTrips] = useState<Trip[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState<boolean>(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(true);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [mobileTab, setMobileTab] = useState<'log' | 'totals' | 'bills' | 'settle'>('log');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const creatingDefaultTripRef = useRef<boolean>(false);
  const addFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setMemberTrips([]);
        setInvitedTrips([]);
        setTripsLoaded(false);
        setActiveTripId(null);
        setExpenses([]);
        setSettlements([]);
      }
    });
    return () => unsub();
  }, []);

  // Listen to trips where user is owner/member
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const tripsPath = 'trips';
    const memberQ = query(
      collection(db, tripsPath),
      where('memberUids', 'array-contains', user.uid)
    );

    const unsubMember = onSnapshot(
      memberQ,
      (snapshot) => {
        const list: Trip[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Kerala Trip'),
            destination: String(data.destination || 'Kerala'),
            ownerId: String(data.ownerId || ''),
            memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
            invitedEmails: Array.isArray(data.invitedEmails) ? data.invitedEmails : [],
            travelers:
              Array.isArray(data.travelers) && data.travelers.length > 0
                ? data.travelers
                : DEFAULT_TRAVELERS,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setMemberTrips(list);
        setTripsLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tripsPath)
    );

    let unsubInvited: (() => void) | null = null;
    if (user.email) {
      const invitedQ = query(
        collection(db, tripsPath),
        where('invitedEmails', 'array-contains', user.email.toLowerCase())
      );
      unsubInvited = onSnapshot(
        invitedQ,
        (snapshot) => {
          const list: Trip[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name || 'Kerala Trip'),
              destination: String(data.destination || 'Kerala'),
              ownerId: String(data.ownerId || ''),
              memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
              invitedEmails: Array.isArray(data.invitedEmails) ? data.invitedEmails : [],
              travelers:
                Array.isArray(data.travelers) && data.travelers.length > 0
                  ? data.travelers
                  : DEFAULT_TRAVELERS,
              createdAt: data.createdAt ?? null,
              updatedAt: data.updatedAt ?? null,
            };
          });
          setInvitedTrips(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, tripsPath)
      );
    }

    return () => {
      unsubMember();
      if (unsubInvited) unsubInvited();
    };
  }, [authReady, user]);

  // Auto-provision Kerala Trip if user has no trips and no pending invites
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !tripsLoaded) return;

    if (memberTrips.length > 0) {
      if (!activeTripId || !memberTrips.some((t) => t.id === activeTripId)) {
        setActiveTripId(memberTrips[0].id);
      }
      return;
    }

    if (invitedTrips.length === 0 && !creatingDefaultTripRef.current) {
      creatingDefaultTripRef.current = true;
      addDoc(collection(db, 'trips'), {
        name: 'Kerala Trip',
        destination: 'Kerala',
        ownerId: user.uid,
        memberUids: [user.uid],
        invitedEmails: [],
        travelers: DEFAULT_TRAVELERS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
        .then((docRef) => {
          setActiveTripId(docRef.id);
        })
        .catch((err) => {
          creatingDefaultTripRef.current = false;
          handleFirestoreError(err, OperationType.CREATE, 'trips');
        });
    }
  }, [authReady, user, tripsLoaded, memberTrips, invitedTrips, activeTripId]);

  const activeTrip = useMemo(() => {
    return memberTrips.find((t) => t.id === activeTripId) || memberTrips[0] || null;
  }, [memberTrips, activeTripId]);

  const pendingInvites = useMemo(() => {
    if (!user) return [];
    return invitedTrips.filter((t) => !t.memberUids.includes(user.uid));
  }, [invitedTrips, user]);

  // Listen to expenses and settlements for activeTrip
  useEffect(() => {
    if (!user || !user.emailVerified || !activeTrip) {
      setExpenses([]);
      setSettlements([]);
      setExpensesLoading(false);
      return;
    }

    setExpensesLoading(true);
    const expensesPath = `trips/${activeTrip.id}/expenses`;
    const expQ = query(
      collection(db, expensesPath),
      where('tripMemberUids', 'array-contains', user.uid)
    );

    const unsubExp = onSnapshot(
      expQ,
      (snapshot) => {
        const rows: Expense[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tripId: String(data.tripId || activeTrip.id),
            tripOwnerId: String(data.tripOwnerId || activeTrip.ownerId),
            tripMemberUids: Array.isArray(data.tripMemberUids)
              ? data.tripMemberUids
              : activeTrip.memberUids,
            authorId: String(data.authorId || ''),
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

    const settlementsPath = `trips/${activeTrip.id}/settlements`;
    const setQ = query(
      collection(db, settlementsPath),
      where('tripMemberUids', 'array-contains', user.uid)
    );

    const unsubSet = onSnapshot(
      setQ,
      (snapshot) => {
        const rows: SettlementRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tripId: String(data.tripId || activeTrip.id),
            tripOwnerId: String(data.tripOwnerId || activeTrip.ownerId),
            tripMemberUids: Array.isArray(data.tripMemberUids)
              ? data.tripMemberUids
              : activeTrip.memberUids,
            authorId: String(data.authorId || ''),
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
      unsubExp();
      unsubSet();
    };
  }, [user, activeTrip]);

  const travelers = activeTrip?.travelers || DEFAULT_TRAVELERS;

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

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to sign in with Google.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleJoinTrip = async (trip: Trip) => {
    if (!user) return;
    const tripPath = `trips/${trip.id}`;
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        memberUids: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });
      setActiveTripId(trip.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, tripPath);
    }
  };

  const handleSaveExpense = async (payload: {
    paidBy: string;
    amount: number;
    reason: string;
    note: string;
    splitAmong: string[];
    expenseDate: string;
  }) => {
    if (!user || !activeTrip) return;

    if (editingExpense) {
      const expPath = `trips/${activeTrip.id}/expenses/${editingExpense.id}`;
      try {
        await updateDoc(doc(db, 'trips', activeTrip.id, 'expenses', editingExpense.id), {
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

    const expColPath = `trips/${activeTrip.id}/expenses`;
    try {
      await addDoc(collection(db, 'trips', activeTrip.id, 'expenses'), {
        tripId: activeTrip.id,
        tripOwnerId: activeTrip.ownerId,
        tripMemberUids: activeTrip.memberUids,
        authorId: user.uid,
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
    if (!activeTrip) return;
    const expPath = `trips/${activeTrip.id}/expenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'expenses', expenseId));
      if (editingExpense?.id === expenseId) {
        setEditingExpense(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, expPath);
    }
  };

  const handleRecordSettlement = async (transfer: SettlementTransfer) => {
    if (!user || !activeTrip) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const setColPath = `trips/${activeTrip.id}/settlements`;
    try {
      await addDoc(collection(db, 'trips', activeTrip.id, 'settlements'), {
        tripId: activeTrip.id,
        tripOwnerId: activeTrip.ownerId,
        tripMemberUids: activeTrip.memberUids,
        authorId: user.uid,
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
    if (!activeTrip) return;
    const setPath = `trips/${activeTrip.id}/settlements/${settlementId}`;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'settlements', settlementId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, setPath);
    }
  };

  const handleUpdateTrip = async (updates: {
    name: string;
    invitedEmails: string[];
    travelers: string[];
  }) => {
    if (!activeTrip) return;
    const tripPath = `trips/${activeTrip.id}`;
    try {
      await updateDoc(doc(db, 'trips', activeTrip.id), {
        name: updates.name,
        invitedEmails: updates.invitedEmails,
        travelers: updates.travelers,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, tripPath);
    }
  };

  // Sync memberUids to existing expenses/settlements when owner opens trip after a collaborator joins
  useEffect(() => {
    if (!user || !activeTrip || activeTrip.ownerId !== user.uid) return;
    const staleExpenses = expenses.filter(
      (e) =>
        e.tripMemberUids.length !== activeTrip.memberUids.length ||
        !activeTrip.memberUids.every((uid) => e.tripMemberUids.includes(uid))
    );
    const staleSettlements = settlements.filter(
      (s) =>
        s.tripMemberUids.length !== activeTrip.memberUids.length ||
        !activeTrip.memberUids.every((uid) => s.tripMemberUids.includes(uid))
    );

    if (staleExpenses.length === 0 && staleSettlements.length === 0) return;

    const batch = writeBatch(db);
    for (const e of staleExpenses.slice(0, 200)) {
      batch.update(doc(db, 'trips', activeTrip.id, 'expenses', e.id), {
        tripMemberUids: activeTrip.memberUids,
        updatedAt: serverTimestamp(),
      });
    }
    for (const s of staleSettlements.slice(0, 200)) {
      batch.update(doc(db, 'trips', activeTrip.id, 'settlements', s.id), {
        tripMemberUids: activeTrip.memberUids,
        updatedAt: serverTimestamp(),
      });
    }
    batch.commit().catch((err) => console.error('Member sync failed:', err));
  }, [user, activeTrip, expenses, settlements]);

  const scrollToAddForm = () => {
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const switchMobileTab = (tab: 'log' | 'totals' | 'bills' | 'settle') => {
    setMobileTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">Loading Kerala Split...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              Kerala Split
            </span>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <span className="whitespace-nowrap shrink-0">Bill Entry</span>
              <span className="whitespace-nowrap shrink-0">Individual Totals</span>
              <span className="whitespace-nowrap shrink-0">Split Calculator</span>
            </nav>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {signingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700">
                Kerala Group Trip · 8 Travelers
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Track every trip bill and split fairly at the end.
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Pre-loaded with your crew so anyone can log who paid, pick a reason from the list, and inspect individual totals in real time.
              </p>
            </div>

            <div className="border-t border-b border-slate-100 py-4 space-y-2">
              <p className="text-xs font-medium text-slate-500">Trip Crew Included</p>
              <p className="text-sm font-medium text-slate-800 leading-relaxed">
                {DEFAULT_TRAVELERS.join(' · ')}
              </p>
            </div>

            {authError && (
              <div className="px-3.5 py-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full px-5 py-3 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              {signingIn ? 'Opening Google Sign-In...' : 'Continue with Google to Open Ledger'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: Exact 3 Zones (non-sticky on mobile to respect 15% sticky cap) */}
      <header className="md:sticky md:top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Kerala Split
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
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

          {/* Zone 3: Primary Action */}
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

      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:py-8 space-y-5 sm:space-y-6">
        {/* Pending Shared Trip Invites */}
        {pendingInvites.length > 0 && (
          <div className="bg-white border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-slate-800">
              You were invited to collaborate on{' '}
              <strong>{pendingInvites[0].name}</strong>
            </div>
            <button
              type="button"
              onClick={() => handleJoinTrip(pendingInvites[0])}
              className="min-h-[44px] sm:min-h-[36px] px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Join Shared Trip
            </button>
          </div>
        )}

        {/* Trip Context Header & Account Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{activeTrip?.destination || 'Kerala'}</span>
              <span aria-hidden="true">·</span>
              <span>{travelers.length} travelers</span>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[180px] sm:max-w-none">{user.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {activeTrip?.name || 'Kerala Trip'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {memberTrips.length > 1 && (
              <select
                value={activeTrip?.id || ''}
                onChange={(e) => setActiveTripId(e.target.value)}
                aria-label="Select trip"
                className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
              >
                {memberTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={signOutUser}
              className="min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
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
            currentUserId={user.uid}
            tripOwnerId={activeTrip?.ownerId || ''}
          />
        </section>

        {/* Settlement Plan & Export */}
        <section
          id="settle-up"
          className={mobileTab === 'settle' ? 'block' : 'hidden md:block'}
        >
          <SettleUpPanel
            tripName={activeTrip?.name || 'Kerala Trip'}
            summaries={summaries}
            transfers={transfers}
            settlements={settlements}
            expenses={expenses}
            onRecordSettlement={handleRecordSettlement}
            onDeleteSettlement={handleDeleteSettlement}
            currentUserId={user.uid}
            tripOwnerId={activeTrip?.ownerId || ''}
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

      {showShareModal && activeTrip && (
        <ShareTripModal
          trip={activeTrip}
          isOwner={activeTrip.ownerId === user.uid}
          onClose={() => setShowShareModal(false)}
          onUpdateTrip={handleUpdateTrip}
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
