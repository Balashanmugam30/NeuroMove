"use client";

import React, { useState } from "react";
import { SubjectProfile, CreateSubjectProfileRequest } from "@neuromove/contracts";
import { User, Plus, CheckCircle2, Shield, Hand } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormControls";

interface SubjectProfileSelectorProps {
  profiles: SubjectProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profile: SubjectProfile) => void;
  onCreateProfile: (req: CreateSubjectProfileRequest) => Promise<void>;
  disabled?: boolean;
}

export function SubjectProfileSelector({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onCreateProfile,
  disabled = false,
}: SubjectProfileSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferredHand, setPreferredHand] = useState<"RIGHT" | "LEFT" | "AMBIDEXTROUS">("RIGHT");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProfile = profiles.find((p) => p.profile_id === selectedProfileId) || profiles[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateProfile({
        subject_id: subjectId.trim(),
        display_name: displayName.trim() || undefined,
        preferred_hand: preferredHand,
        notes: notes.trim() || undefined,
      });
      setSubjectId("");
      setDisplayName("");
      setNotes("");
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Participant Subject Profile</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                <Shield className="w-3 h-3" /> Pseudonymous ID
              </span>
            </div>
            <p className="text-xs text-slate-500">Select or register an anonymized subject calibration record</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCreating(!isCreating)}
            disabled={disabled}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {isCreating ? "Cancel" : "New Subject Profile"}
          </Button>
        </div>
      </div>

      {isCreating ? (
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 mb-4">
          <div className="text-xs font-bold text-slate-800">Register Pseudonymous Subject</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="Subject Identifier (e.g. sub-003)"
              placeholder="sub-003"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            />
            <Input
              label="Display Alias (Optional)"
              placeholder="Participant Beta"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Select
              label="Preferred Hand"
              value={preferredHand}
              onChange={(e) => setPreferredHand(e.target.value as any)}
              options={[
                { value: "RIGHT", label: "Right-Hand Dominant" },
                { value: "LEFT", label: "Left-Hand Dominant" },
                { value: "AMBIDEXTROUS", label: "Ambidextrous" },
              ]}
            />
          </div>
          <Input
            label="Research Notes (Optional)"
            placeholder="e.g. Morning baseline recording, resting state verified"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
              Save Profile
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {profiles.map((p) => {
            const isSelected = p.profile_id === selectedProfile?.profile_id;
            return (
              <button
                key={p.profile_id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectProfile(p)}
                className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900">{p.subject_id}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="text-xs font-medium text-slate-700 truncate">{p.display_name || "Standard Subject"}</div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-3xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium">
                    <Hand className="w-3 h-3 text-slate-400" /> {p.preferred_hand}
                  </span>
                  <span>•</span>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
