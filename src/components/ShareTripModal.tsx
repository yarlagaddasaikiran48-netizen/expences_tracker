import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Trip } from '../types/trip';

interface ShareTripModalProps {
  trip: Trip;
  isOwner: boolean;
  onClose: () => void;
  onUpdateTrip: (updates: {
    name: string;
    invitedEmails: string[];
    travelers: string[];
  }) => Promise<void>;
}

export function ShareTripModal({
  trip,
  isOwner,
  onClose,
  onUpdateTrip,
}: ShareTripModalProps) {
  const [tripName, setTripName] = useState(trip.name);
  const [invitedEmails, setInvitedEmails] = useState<string[]>(trip.invitedEmails);
  const [emailInput, setEmailInput] = useState('');
  const [travelers, setTravelers] = useState<string[]>(trip.travelers);
  const [travelerInput, setTravelerInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddEmail = () => {
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setError('Enter a valid Gmail/email address.');
      return;
    }
    if (invitedEmails.includes(clean)) {
      setEmailInput('');
      return;
    }
    if (invitedEmails.length >= 20) {
      setError('Maximum 20 collaborator emails allowed.');
      return;
    }
    setError('');
    setInvitedEmails([...invitedEmails, clean]);
    setEmailInput('');
  };

  const handleAddTraveler = () => {
    const clean = travelerInput.trim();
    if (!clean) return;
    if (travelers.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTravelerInput('');
      return;
    }
    if (travelers.length >= 20) {
      setError('Maximum 20 travelers allowed.');
      return;
    }
    setError('');
    setTravelers([...travelers, clean.slice(0, 50)]);
    setTravelerInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripName.trim()) {
      setError('Trip name cannot be empty.');
      return;
    }
    if (travelers.length === 0) {
      setError('At least 1 traveler is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onUpdateTrip({
        name: tripName.trim().slice(0, 80),
        invitedEmails,
        travelers,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-settings-title"
    >
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl max-w-lg w-full overflow-hidden">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5" />
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="trip-settings-title" className="text-base font-semibold text-slate-900">
            Trip Settings & Collaborators
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          <div>
            <label htmlFor="trip-name-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Trip Name
            </label>
            <input
              id="trip-name-input"
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              disabled={!isOwner}
              maxLength={80}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60 focus:outline-none focus:bg-white focus:border-emerald-600"
            />
          </div>

          {/* Travelers List */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Travelers ({travelers.length})
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
              {travelers.map((t) => (
                <div
                  key={t}
                  className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-1"
                >
                  <span className="truncate">{t}</span>
                  {isOwner && travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTravelers(travelers.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={travelerInput}
                  onChange={(e) => setTravelerInput(e.target.value)}
                  placeholder="Add traveler name"
                  maxLength={50}
                  className="flex-1 min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleAddTraveler}
                  className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1 px-4 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Collaborator Emails */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Share Live Access via Google Email
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Friends whose email is added here can sign in with Google on their own phones to view and add bills.
            </p>
            {isOwner && (
              <div className="flex gap-2 mb-2.5">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="friend@gmail.com"
                  className="flex-1 min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1 px-4 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Invite
                </button>
              </div>
            )}

            {invitedEmails.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {invitedEmails.map((email) => (
                  <div
                    key={email}
                    className="px-3 py-2 flex items-center justify-between text-xs text-slate-700"
                  >
                    <span className="truncate">{email}</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          setInvitedEmails(invitedEmails.filter((x) => x !== email))
                        }
                        aria-label={`Remove ${email}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No external emails invited yet.</p>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[36px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
            {isOwner && (
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] sm:min-h-[36px] px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
