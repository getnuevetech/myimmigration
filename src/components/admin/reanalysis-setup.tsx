"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { startAdminReanalysisAction } from "@/actions/admin-reanalysis";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";

type Provider = {
  id: string;
  name: string;
  model: string;
  kind: string;
  supportsVision: boolean;
  hasKey: boolean;
  isEnabled: boolean;
};

type UserHit = { id: string; label: string; email: string; phone: string; role: string };
type CaseHit = {
  id: string;
  number: string;
  title: string;
  status: string;
  owner?: string;
  email?: string;
  updatedAt?: string;
};

export function AdminReanalysisSetup({
  providers,
  preselectedCase,
}: {
  providers: Provider[];
  preselectedCase?: CaseHit | null;
}) {
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null);
  const [userCases, setUserCases] = useState<CaseHit[]>([]);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseHits, setCaseHits] = useState<CaseHit[]>([]);
  const [caseOpen, setCaseOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseHit | null>(preselectedCase ?? null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedUser) {
      setUserCases([]);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/user-cases?userId=${encodeURIComponent(selectedUser.id)}`);
      const data = await res.json();
      setUserCases(data.results ?? []);
    });
  }, [selectedUser]);

  const searchUsers = (q: string) => {
    setUserQuery(q);
    if (userTimer.current) clearTimeout(userTimer.current);
    if (q.trim().length < 2) {
      setUserHits([]);
      setUserOpen(false);
      return;
    }
    userTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/user-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setUserHits(data.results ?? []);
      setUserOpen(true);
    }, 250);
  };

  const searchCases = (q: string) => {
    setCaseQuery(q);
    if (caseTimer.current) clearTimeout(caseTimer.current);
    if (q.trim().length < 2) {
      setCaseHits([]);
      setCaseOpen(false);
      return;
    }
    caseTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/case-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setCaseHits(data.results ?? []);
      setCaseOpen(true);
    }, 250);
  };

  const toggleProvider = (id: string) =>
    setSelectedProviders((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <ActionForm action={startAdminReanalysisAction} successMessage="Re-analysis started.">
      <input type="hidden" name="caseId" value={selectedCase?.id ?? ""} />
      <input type="hidden" name="providerIds" value={JSON.stringify(selectedProviders)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">1 · Find a user, then pull their case</p>
          <input
            value={userQuery}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search by email, mobile, or name…"
            autoComplete="off"
            className={inputClass}
          />
          {userOpen && !selectedUser && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {userHits.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No matching customers or consultants.</p>
              ) : (
                userHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(hit);
                      setUserQuery(`${hit.label} · ${hit.email}`);
                      setUserOpen(false);
                      setSelectedCase(null);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-lime-50"
                  >
                    <span className="font-medium text-slate-900">{hit.label}</span>{" "}
                    <span className="text-xs text-lime-600">({hit.role})</span>
                    <span className="block text-xs text-slate-500">
                      {hit.email}
                      {hit.phone ? ` · ${hit.phone}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedUser && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Cases for {selectedUser.label}
                {pending ? " — loading…" : ""}
              </p>
              {userCases.length === 0 && !pending ? (
                <p className="text-sm text-slate-500">No cases for this user.</p>
              ) : (
                userCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCase(item)}
                    className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedCase?.id === item.id
                        ? "border-lime-500 bg-lime-50"
                        : "border-slate-200 hover:border-lime-300"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{item.title}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {item.number} · {item.status.replace(/_/g, " ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">Or search any case</p>
          <input
            value={caseQuery}
            onChange={(e) => searchCases(e.target.value)}
            placeholder="Search IMM number, title, owner email, or mobile…"
            autoComplete="off"
            className={inputClass}
          />
          {caseOpen && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {caseHits.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No matching cases.</p>
              ) : (
                caseHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      setSelectedCase(hit);
                      setCaseQuery(`${hit.number} · ${hit.title}`);
                      setCaseOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-lime-50"
                  >
                    <span className="font-medium text-slate-900">{hit.title}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {hit.number}
                      {hit.owner ? ` · ${hit.owner}` : ""}
                      {hit.email ? ` · ${hit.email}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {selectedCase && (
        <p className="mt-4 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          Selected <span className="font-semibold">{selectedCase.title}</span>{" "}
          <span className="font-mono text-xs">{selectedCase.number}</span>
          {selectedCase.owner ? ` · ${selectedCase.owner}` : ""}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-900">2 · Models for this re-review</p>
        <p className="mb-3 text-xs text-slate-500">
          Select one or more configured AIs. Leave none selected to use the current pipeline, including rule-based
          fallback when no API keys are saved.
        </p>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => {
            const active = selectedProviders.includes(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                disabled={!provider.isEnabled}
                onClick={() => toggleProvider(provider.id)}
                title={provider.hasKey ? provider.model : "No API key — this model will be skipped and fallback may run"}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-lime-600 bg-lime-600 text-white"
                    : provider.hasKey
                      ? "border-slate-300 bg-white text-slate-700 hover:border-lime-400"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {provider.name}
                {!provider.hasKey && <span className="ml-1.5 text-[10px] opacity-70">no key</span>}
                {provider.supportsVision && <span className="ml-1.5 text-[10px] opacity-70">👁</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-900">3 · Who can see the staff re-analysis</p>
        <p className="mb-3 text-xs text-slate-500">
          The live customer output stays unchanged until you override. These flags only control whether they can see
          the new staff review beside it after this run finishes.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" name="visibleToCustomer" className="rounded border-slate-300" />
          Customer can see the re-analysed results
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" name="visibleToConsultant" className="rounded border-slate-300" />
          Consultant can see the re-analysed results
        </label>
      </section>

      <div className="mt-6">
        <SubmitButton className={!selectedCase ? "pointer-events-none opacity-50" : ""}>
          Re-review this case
        </SubmitButton>
        {!selectedCase && <p className="mt-2 text-xs text-slate-500">Select a case to run.</p>}
      </div>
    </ActionForm>
  );
}
