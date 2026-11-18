import React, { useState } from 'react';
import { Check, Copy, Plus, X } from 'lucide-react';
import type { Trip } from '../types/trip';

interface ShareTripModalProps {
  trip: Trip;
  onClose: () => void;
  onUpdateTrip: (updates: {
    name: string;
    travelers: string[];
  }) => Promise<void>;
  onSwitchTripCode: (newCode: string) => void;
}

export function ShareTripModal({
  trip,
  onClose,
  onUpdateTrip,
  onSwitchTripCode,
}: ShareTripModalProps) {
  const [tripName, setTripName] = useState(trip.name);
  const [travelers, setTravelers] = useState<string[]>(trip.travelers);
  const [travelerInput, setTravelerInput] = useState('');
  const [tripCodeInput, setTripCodeInput] = useState(trip.id);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const shareUrl = `${window.location.origin}/?trip=${encodeURIComponent(trip.id)}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard errors
    }
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

  const handleSwitchCode = () => {
    const clean = tripCodeInput.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!clean) {
      setError('Enter a valid trip code (letters, numbers, hyphens).');
      return;
    }
    onSwitchTripCode(clean.slice(0, 64));
    onClose();
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
            Trip Crew & Share Link
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
          {/* Share Link */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="text-xs font-medium text-slate-700">
              Share with Friends (No Login Required)
            </div>
            <p className="text-xs text-slate-500">
              Send this link in WhatsApp. Everyone who opens it sees and updates the same live Kerala trip bills.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Share link"
                className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trip Name */}
          <div>
            <label htmlFor="trip-name-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Trip Name
            </label>
            <input
              id="trip-name-input"
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              maxLength={80}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
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
                  {travelers.length > 1 && (
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
          </div>

          {/* Switch / Create Trip Room Code */}
          <div className="border-t border-slate-100 pt-4">
            <label htmlFor="trip-code-input" className="block text-xs font-medium text-slate-700 mb-1">
              Trip Room Code
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Switch to a different trip ledger or create a fresh one by entering a new code.
            </p>
            <div className="flex gap-2">
              <input
                id="trip-code-input"
                type="text"
                value={tripCodeInput}
                onChange={(e) => setTripCodeInput(e.target.value)}
                placeholder="kerala-trip-2026"
                maxLength={64}
                className="flex-1 min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-base sm:text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={handleSwitchCode}
                className="min-h-[44px] sm:min-h-[36px] px-4 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Open Room
              </button>
            </div>
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
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] sm:min-h-[36px] px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
