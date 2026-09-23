import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  FolderLock,
  ArrowRight,
  Check,
  Edit2,
  Trash2,
  AlertTriangle,
  FileText,
  HardDrive,
  Sparkles,
  Info,
  Search,
  User as UserIcon,
  ChevronRight,
  KeyRound
} from 'lucide-react';
import { PersonProfile, CreatePersonProfilePayload, User } from '../types.js';
import { api } from '../services/api.js';
import { formatBytes } from '../utils/formatters.js';

interface MultiPersonProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectProfile: (profile: PersonProfile) => void;
  onProfileAdded?: (profile: PersonProfile) => void;
  onProfileDeleted?: (profileId: string) => void;
}

const PRESET_RELATIONSHIPS = [
  'Self',
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Family Member',
  'Friend',
  'Colleague',
  'Client'
];

const PRESET_COLORS: { id: string; label: string; bg: string; text: string; ring: string; border: string }[] = [
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500/20', text: 'text-teal-400', ring: 'ring-teal-500', border: 'border-teal-500/30' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500/20', text: 'text-blue-400', ring: 'ring-blue-500', border: 'border-blue-500/30' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500/20', text: 'text-purple-400', ring: 'ring-purple-500', border: 'border-purple-500/30' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500', border: 'border-amber-500/30' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500', border: 'border-emerald-500/30' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500/20', text: 'text-rose-400', ring: 'ring-rose-500', border: 'border-rose-500/30' },
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/20', text: 'text-indigo-400', ring: 'ring-indigo-500', border: 'border-indigo-500/30' }
];

export function MultiPersonProfilesModal({
  isOpen,
  onClose,
  currentUser,
  onSelectProfile,
  onProfileAdded,
  onProfileDeleted
}: MultiPersonProfilesModalProps) {
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PersonProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<PersonProfile | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formRelationship, setFormRelationship] = useState('Family Member');
  const [formCustomRel, setFormCustomRel] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formColor, setFormColor] = useState('teal');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await api.getProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
      setIsAdding(false);
      setEditingProfile(null);
      setDeletingProfile(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormName('');
    setFormRelationship('Family Member');
    setFormCustomRel('');
    setFormEmail('');
    setFormAvatarUrl('');
    setFormColor('teal');
    setFormNotes('');
    setFormError('');
    setIsAdding(false);
    setEditingProfile(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (profile: PersonProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setFormName(profile.name);
    if (PRESET_RELATIONSHIPS.includes(profile.relationship)) {
      setFormRelationship(profile.relationship);
      setFormCustomRel('');
    } else {
      setFormRelationship('Other');
      setFormCustomRel(profile.relationship);
    }
    setFormEmail(profile.email || '');
    setFormAvatarUrl(profile.avatarUrl || '');
    setFormColor(profile.avatarColor || 'teal');
    setFormNotes(profile.notes || '');
    setFormError('');
    setIsAdding(false);
  };

  const handleSubmitProfile = async (openImmediately: boolean = false) => {
    if (!formName.trim()) {
      setFormError('Please enter a name for the profile');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    const resolvedRelationship = formRelationship === 'Other' && formCustomRel.trim()
      ? formCustomRel.trim()
      : formRelationship;

    const payload: CreatePersonProfilePayload = {
      name: formName.trim(),
      relationship: resolvedRelationship,
      email: formEmail.trim() || undefined,
      avatarUrl: formAvatarUrl.trim() || undefined,
      avatarColor: formColor,
      notes: formNotes.trim() || undefined
    };

    try {
      if (editingProfile) {
        // Update existing
        const updated = await api.updateProfile(editingProfile.id, payload);
        setProfiles(prev => prev.map(p => p.id === editingProfile.id ? { ...p, ...updated } : p));
        resetForm();
      } else {
        // Create new
        const created = await api.createProfile(payload);
        setProfiles(prev => [...prev, created]);
        if (onProfileAdded) onProfileAdded(created);

        if (openImmediately) {
          onSelectProfile(created);
          onClose();
        } else {
          resetForm();
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return;
    setFormSubmitting(true);
    try {
      await api.deleteProfile(deletingProfile.id);
      setProfiles(prev => prev.filter(p => p.id !== deletingProfile.id));
      if (onProfileDeleted) onProfileDeleted(deletingProfile.id);
      setDeletingProfile(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete profile');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.relationship && p.relationship.toLowerCase().includes(q));
  });

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorConfig = (colorId?: string) => {
    return PRESET_COLORS.find(c => c.id === colorId) || PRESET_COLORS[0];
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Multi-Person Profiles
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  ISOLATED VAULTS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Every person has their own private, dedicated encrypted vault container.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Active Profile Info Banner */}
          {currentUser && (
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <div className="text-xs text-slate-300 truncate">
                  Currently open: <span className="font-bold text-white">{currentUser.name}</span>
                  {currentUser.relationship && !currentUser.relationship.includes('Primary') && currentUser.relationship !== 'Self' && (
                    <span className="text-slate-400 ml-1">({currentUser.relationship})</span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-teal-400 font-mono flex-shrink-0">
                Active Vault
              </div>
            </div>
          )}

          {/* Add or Edit Profile Form */}
          {(isAdding || editingProfile) ? (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-blue-500/30 space-y-3.5 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>{editingProfile ? `Edit Profile: ${editingProfile.name}` : 'Add New Person Profile'}</span>
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-3">
                {/* Person Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Person Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Siddharth, Maya, Dad, Client Records..."
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {/* Relationship / Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Relationship / Tag
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESET_RELATIONSHIPS.map(rel => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => {
                          setFormRelationship(rel);
                          if (rel !== 'Other') setFormCustomRel('');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                          formRelationship === rel
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {rel}
                      </button>
                    ))}
                  </div>

                  {formRelationship === 'Other' && (
                    <input
                      type="text"
                      value={formCustomRel}
                      onChange={e => setFormCustomRel(e.target.value)}
                      placeholder="Specify custom role or relationship..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* Accent Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Profile Badge Color
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormColor(c.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${c.bg} ${c.border} border ${
                          formColor === c.id ? `ring-2 ${c.ring} scale-110` : 'opacity-70 hover:opacity-100'
                        }`}
                        title={c.label}
                      >
                        {formColor === c.id && <Check className={`w-3.5 h-3.5 ${c.text} stroke-[3]`} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Photo URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formAvatarUrl}
                    onChange={e => setFormAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Private Notes / Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="e.g. Passport, health records, academic documents..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                {!editingProfile && (
                  <button
                    type="button"
                    disabled={formSubmitting}
                    onClick={() => handleSubmitProfile(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Save Profile
                  </button>
                )}

                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => handleSubmitProfile(!editingProfile)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <span>Saving...</span>
                  ) : editingProfile ? (
                    <span>Save Changes</span>
                  ) : (
                    <>
                      <span>Create & Open Vault</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Search & Add New Profile Bar */
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search person profiles..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                id="btn-add-new-person"
                onClick={handleStartAdd}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add New Person</span>
              </button>
            </div>
          )}

          {/* Profiles Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span>Saved Person Profiles ({filteredProfiles.length})</span>
              <span className="text-[11px] text-slate-500">Click a person to open their vault</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading person vaults...</span>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 p-6">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">No profiles found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery ? 'No profiles match your search criteria.' : 'Create profiles for family members, clients, or specific records to keep their data completely separated.'}
                </p>
                {!isAdding && (
                  <button
                    onClick={handleStartAdd}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create First Person Profile</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredProfiles.map(profile => {
                  const isActive = currentUser?.id === profile.id;
                  const colorConfig = getColorConfig(profile.avatarColor);

                  return (
                    <div
                      key={profile.id}
                      onClick={() => {
                        onSelectProfile(profile);
                        onClose();
                      }}
                      className={`group relative p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg shadow-blue-950/50'
                          : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt={profile.name}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-700 flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}
                          >
                            {getInitials(profile.name)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                              {profile.name}
                            </h3>
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span className="text-[11px] font-medium text-slate-300">
                              {profile.relationship?.replace(/Primary\s*(\(Self\))?/i, 'Self') || 'Vault User'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <FileText className="w-3 h-3 text-slate-500" />
                              {profile.documentCount || 0} docs
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <HardDrive className="w-3 h-3 text-slate-500" />
                              {formatBytes(profile.storageUsedBytes || 0)}
                            </span>
                          </div>

                          {profile.notes && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                              {profile.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={e => handleStartEdit(profile, e)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button (disabled for primary or only profile) */}
                        {!profile.isPrimary && profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setDeletingProfile(profile);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Profile & Records"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Open Button */}
                        {isActive ? (
                          <div className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            Current
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600/80 group-hover:bg-blue-600 transition-colors shadow-sm">
                            <span>Open Vault</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Sub-Modal */}
        {deletingProfile && (
          <div
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingProfile(null)}
          >
            <div
              className="bg-slate-900 border border-rose-500/40 rounded-xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Profile?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete <span className="font-semibold text-rose-300">"{deletingProfile.name}"</span>?
                  All documents and shares stored under this person will be permanently erased.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingProfile(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer"
                >
                  {formSubmitting ? 'Deleting...' : 'Delete Vault'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>Each person’s vault is completely segregated and encrypted.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
