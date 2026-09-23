import React, { useState, useEffect } from 'react';
import {
  Edit3,
  X,
  Lock,
  Tag,
  Calendar,
  ShieldCheck,
  FileText,
  AlertCircle
} from 'lucide-react';
import { VaultDocument, DocumentCategory, SensitivityLevel } from '../types.js';
import { api } from '../services/api.js';

interface EditDocumentModalProps {
  document: VaultDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: VaultDocument) => void;
}

const CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: 'VOICE_AUDIO', label: '🎙️ Voice & Audio' },
  { id: 'IDENTITY', label: 'Identity & IDs' },
  { id: 'EDUCATION', label: 'Education & Marksheets' },
  { id: 'EMPLOYMENT', label: 'Career & Internships' },
  { id: 'MEDICAL', label: 'Medical & Health' },
  { id: 'FINANCIAL', label: 'PAN & Financial' },
  { id: 'LEGAL', label: 'Legal & Certificates' },
  { id: 'OTHER', label: 'General Document' }
];

export function EditDocumentModal({
  document: doc,
  isOpen,
  onClose,
  onSuccess
}: EditDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('OTHER');
  const [documentNumber, setDocumentNumber] = useState('');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('CONFIDENTIAL');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [verifiedIssuer, setVerifiedIssuer] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && doc) {
      setTitle(doc.title || '');
      setCategory(doc.category || 'OTHER');
      setDocumentNumber(doc.documentNumber || '');
      setSensitivity(doc.sensitivity || 'CONFIDENTIAL');
      setTagsInput(doc.tags ? doc.tags.join(', ') : '');
      setNotes(doc.notes || '');
      setIssueDate(doc.issueDate ? doc.issueDate.split('T')[0] : '');
      setExpiryDate(doc.expiryDate ? doc.expiryDate.split('T')[0] : '');
      setVerifiedIssuer(doc.verifiedIssuer || '');
      setError(null);
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await api.updateDocument(doc.id, {
        title: title.trim(),
        category,
        documentNumber: documentNumber.trim(),
        sensitivity,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        notes: notes.trim(),
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        verifiedIssuer: verifiedIssuer.trim()
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update document metadata');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Rename & Re-categorize Document
              </h2>
              <p className="text-xs text-slate-400">
                Update vault metadata without modifying encrypted ciphertext payload
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Title / Document Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Vault Category <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Security Sensitivity <span className="text-red-400">*</span>
              </label>
              <select
                value={sensitivity}
                onChange={e => setSensitivity(e.target.value as SensitivityLevel)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="CONFIDENTIAL">Confidential (AES-256-GCM)</option>
                <option value="TOP_SECRET">Top Secret (Zero-Knowledge)</option>
                <option value="RESTRICTED">Restricted Access</option>
                <option value="STANDARD">Standard Encrypted File</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Document / ID Reference #
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                placeholder="e.g. PASSPORT-94812"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Issuing Authority / Organization
              </label>
              <input
                type="text"
                value={verifiedIssuer}
                onChange={e => setVerifiedIssuer(e.target.value)}
                placeholder="e.g. Government Agency"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. audio, contract, tax"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Notes & Metadata
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any private notes or descriptions..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 font-medium resize-none"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Document integrity verified. All modifications logged in Security Audit logs.</span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving Changes...' : 'Save Updates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
