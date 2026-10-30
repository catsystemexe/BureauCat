"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { CaseDocument, CaseSummary, JournalItem, Situation } from "@/components/types";
import { SituationDocumentsSection } from "@/components/journal/SituationDocumentsSection";
import { SituationPager } from "@/components/journal/SituationPager";
import { CompactJournal } from "@/components/journal/CompactJournal";
import { contextualJournalPinIds, EMPTY_EVIDENCE, type JournalEvidence, type JournalSource } from "@/lib/journal/overview";
import { DocumentTextIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";

const EMPTY_ITEMS: JournalItem[] = [];

type SituationResponse = { situation?: Situation };
type SituationsResponse = { situations?: Situation[] };

function SituationCard({
  onSituationUpdated,
  situation
}: {
  onSituationUpdated: (situation: Situation) => void;
  situation: Situation | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setTitleDraft(situation?.title ?? "");
    setError(null);
  }, [situation?.id, situation?.title]);

  function beginEditing() {
    if (!situation) {
      return;
    }

    setTitleDraft(situation.title);
    setError(null);
    setIsMenuOpen(false);
    setIsEditing(true);
  }

  function cancelEditing() {
    setTitleDraft(situation?.title ?? "");
    setError(null);
    setIsEditing(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!situation || !titleDraft.trim()) {
      setError("Název situace nesmí být prázdný.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const response = await fetch(`/api/situations/${situation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() })
      });
      const data = (await response.json()) as SituationResponse;

      if (!response.ok || !data.situation) {
        throw new Error("Nepodařilo se upravit situaci.");
      }

      onSituationUpdated(data.situation);
      setIsEditing(false);
    } catch {
      setError("Nepodařilo se upravit situaci.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="notebook-card notebook-user-card situation-card" aria-labelledby="situation-card-title">
      <DocumentTextIcon className="notebook-section-icon user-section-icon" />
      <div className="notebook-section-content">
        <div className="notebook-card-header">
          <h3 id="situation-card-title">Situace</h3>
          {!isEditing ? (
            <div className="notebook-row-actions">
              <button
                aria-expanded={isMenuOpen}
                aria-label="Akce situace"
                className="notebook-icon-button persistent-action"
                disabled={!situation}
                onClick={() => setIsMenuOpen((current) => !current)}
                title="Akce situace"
                type="button"
              >
                <EllipsisVerticalIcon aria-hidden="true" className="notebook-action-icon" />
              </button>
              {isMenuOpen ? (
                <div className="notebook-row-menu" role="menu">
                  <button onClick={beginEditing} role="menuitem" type="button">
                    Přejmenovat
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {isEditing ? (
          <form className="situation-edit-form" onSubmit={handleSave}>
            <input
              aria-label="Název situace"
              autoFocus
              className="situation-title-input"
              disabled={isSaving}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              value={titleDraft}
            />
            {error ? <p className="notebook-inline-error">{error}</p> : null}
            <div className="notebook-form-actions">
              <button className="notebook-text-button primary-notebook-action" disabled={isSaving} type="submit">
                {isSaving ? "Ukládám…" : "Uložit"}
              </button>
              <button className="notebook-text-button" disabled={isSaving} onClick={cancelEditing} type="button">
                Zrušit
              </button>
            </div>
          </form>
        ) : (
          <p
            className="situation-title-display"
            onDoubleClick={beginEditing}
            title={situation ? "Dvojklikem upravit název situace" : undefined}
          >
            {situation?.title || "Žádná situace není vybrána."}
          </p>
        )}
      </div>
    </section>
  );
}

function UserLayer({
  documentListRefreshKey,
  onOpenDocument,
  onSituationUpdated,
  selectedSituation,
  hiddenDocumentIds,
  onDocumentsChange,
  onDocumentVisibilityChange
}: {
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onSituationUpdated: (situation: Situation) => void;
  selectedSituation: Situation | null;
  hiddenDocumentIds: readonly string[];
  onDocumentsChange: (situationId: string, documentIds: string[]) => void;
  onDocumentVisibilityChange: (documentId: string, visible: boolean) => void;
}) {
  return (
    <div className="notebook-layer notebook-user-layer">
      <div className="notebook-layer-heading user-layer-heading">
        <span>Uživatel</span>
      </div>
      <SituationCard onSituationUpdated={onSituationUpdated} situation={selectedSituation} />
      <SituationDocumentsSection
        onOpenDocument={onOpenDocument}
        refreshKey={documentListRefreshKey}
        selectedSituationId={selectedSituation?.id ?? null}
        hiddenDocumentIds={hiddenDocumentIds}
        onDocumentsChange={onDocumentsChange}
        onDocumentVisibilityChange={onDocumentVisibilityChange}
      />
    </div>
  );
}

export function JournalPanel({ caseItem, documentListRefreshKey, onOpenDocument, onSelectSituation,
  onStartBookmarkLink, pendingBookmarkTargetJournalItemId, selectedSituationId, onContextualPinsChange
}: {
  caseItem: CaseSummary; documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onOpenSource: (source: JournalSource) => Promise<boolean>;
  onSelectSituation: (id: string | null) => void;
  onStartBookmarkLink: (id: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
  selectedSituationId: string | null;
  onContextualPinsChange: (situationId: string | null, pinIds: string[]) => void;
  // Keep the workspace callback contract; analytical cards expose no source controls.
  onOpenBookmark?: (documentId: string, pinId: string) => void;
  onBookmarkHover?: (pinId: string) => void;
  onBookmarkLeave?: () => void;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [isLoadingSituations, setIsLoadingSituations] = useState(true);
  const [isCreatingSituation, setIsCreatingSituation] = useState(false);
  const [situationError, setSituationError] = useState<string | null>(null);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<{ situationId: string | null; items: JournalItem[]; evidence: JournalEvidence }>({ situationId: null, items: [], evidence: EMPTY_EVIDENCE });
  const [documentSelection, setDocumentSelection] = useState<{ situationId: string | null; documentIds: string[]; hiddenIds: string[] }>({ situationId: null, documentIds: [], hiddenIds: [] });
  const selection = useRef(selectedSituationId);
  useLayoutEffect(() => {
    selection.current = selectedSituationId;
    setDocumentSelection({ situationId: selectedSituationId, documentIds: [], hiddenIds: [] });
  }, [caseItem.id, selectedSituationId]);
  const onDocumentsChange = useCallback((situationId: string, documentIds: string[]) => {
    if (selection.current !== situationId) return;
    setDocumentSelection((current) => ({ situationId, documentIds,
      hiddenIds: current.situationId === situationId && documentIds.length > 1
        ? current.hiddenIds.filter((id) => documentIds.includes(id)) : [] }));
  }, []);
  const onDocumentVisibilityChange = (documentId: string, visible: boolean) => {
    if (selection.current !== selectedSituationId) return;
    setDocumentSelection((current) => {
      if (current.situationId !== selectedSituationId || current.documentIds.length <= 1 || !current.documentIds.includes(documentId)) return current;
      return { ...current, hiddenIds: visible ? current.hiddenIds.filter((id) => id !== documentId)
        : [...new Set([...current.hiddenIds, documentId])] };
    });
  };
  const selectedDocumentIds = useMemo(() => documentSelection.situationId === selectedSituationId && documentSelection.hiddenIds.length
    ? documentSelection.documentIds.filter((id) => !documentSelection.hiddenIds.includes(id)) : null, [documentSelection, selectedSituationId]);
  const items = snapshot.situationId === selectedSituationId ? snapshot.items : EMPTY_ITEMS;
  const evidence = snapshot.situationId === selectedSituationId ? snapshot.evidence : EMPTY_EVIDENCE;
  const contextualPins = useMemo(() => selectedSituationId ? contextualJournalPinIds(items, evidence, selectedSituationId) : [], [items, evidence, selectedSituationId]);
  useEffect(() => { onContextualPinsChange(selectedSituationId, contextualPins); }, [selectedSituationId, contextualPins, onContextualPinsChange]);

  useEffect(() => {
    let active = true, version = 0;
    async function load() {
      const request = ++version;
      if (!selectedSituationId) { setSnapshot({ situationId: null, items: [], evidence: EMPTY_EVIDENCE }); setLoading(false); setJournalError(null); return; }
      setLoading(true);
      try {
        const response = await fetch(`/api/cases/${caseItem.id}/journal?situationId=${encodeURIComponent(selectedSituationId)}`, { cache: "no-store" });
        const data = await response.json() as { journal?: JournalItem[]; evidence?: JournalEvidence };
        if (!response.ok || !Array.isArray(data.journal)) throw new Error();
        if (active && request === version) {
          setSnapshot({ situationId: selectedSituationId, items: data.journal.filter((item) => item.status !== "obsolete"), evidence: data.evidence ?? EMPTY_EVIDENCE });
          setJournalError(null);
        }
      } catch {
        if (active && request === version) {
          setSnapshot({ situationId: selectedSituationId, items: [], evidence: EMPTY_EVIDENCE });
          setJournalError("Přehled situace se nepodařilo načíst.");
        }
      } finally { if (active && request === version) setLoading(false); }
    }
    const refresh = () => { void load(); };
    refresh();
    window.addEventListener("bureaucat:journal-refresh", refresh);
    window.addEventListener("bureaucat:journal-item-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("bureaucat:journal-refresh", refresh);
      window.removeEventListener("bureaucat:journal-item-updated", refresh);
    };
  }, [caseItem.id, selectedSituationId]);

  useEffect(() => {
    let active = true;
    setIsLoadingSituations(true);
    fetch(`/api/cases/${caseItem.id}/situations`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as SituationsResponse;
      if (!response.ok || !Array.isArray(data.situations)) throw new Error();
      if (!active) return;
      setSituations(data.situations); setSituationError(null);
      if (!data.situations.some((situation) => situation.id === selection.current && situation.status === "active")) {
        onSelectSituation(data.situations.find((situation) => situation.status === "active")?.id ?? null);
      }
    }).catch(() => { if (active) setSituationError("Situace se nepodařilo načíst."); })
      .finally(() => { if (active) setIsLoadingSituations(false); });
    return () => { active = false; };
  }, [caseItem.id, onSelectSituation]);

  async function createSituation() {
    if (situations.filter((situation) => situation.status === "active").length >= 10) return;
    setIsCreatingSituation(true); setSituationError(null);
    try {
      const response = await fetch(`/api/cases/${caseItem.id}/situations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Situace ${situations.length + 1}` }) });
      const data = await response.json() as SituationResponse;
      if (!response.ok || !data.situation) throw new Error();
      setSituations((current) => [...current, data.situation!]); onSelectSituation(data.situation.id);
    } catch { setSituationError("Situaci se nepodařilo vytvořit."); }
    finally { setIsCreatingSituation(false); }
  }
  async function save(id: string, fields: { title: string; value: string | null }) {
    const response = await fetch(`/api/journal/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    if (!response.ok) throw new Error("Uložení selhalo.");
    window.dispatchEvent(new Event("bureaucat:journal-refresh"));
  }
  async function archive(id: string) {
    const response = await fetch(`/api/journal/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Mazání selhalo.");
    window.dispatchEvent(new Event("bureaucat:journal-refresh"));
  }
  async function createNote(title: string) {
    if (!selectedSituationId) throw new Error("Chybí situace.");
    const response = await fetch(`/api/cases/${caseItem.id}/journal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ situation_id: selectedSituationId, section: "description", item_type: "FACT", title, value: null, source_links_json: "[]" }) });
    if (!response.ok) throw new Error("Vytvoření selhalo.");
    window.dispatchEvent(new Event("bureaucat:journal-refresh"));
  }
  const selectedSituation = situations.find((situation) => situation.id === selectedSituationId) ?? null;
  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <div className="journal-panel-title-row">
        <h2 className="journal-panel-title" id="journal-title">Zápisník</h2>
        <SituationPager situations={situations} selectedSituationId={selectedSituationId} onSelectSituation={onSelectSituation}
          onCreateSituation={createSituation} isLoading={isLoadingSituations} isCreating={isCreatingSituation} error={situationError} />
      </div>
      <div className="notebook-page">
        <UserLayer key={`user-layer:${selectedSituationId}`} selectedSituation={selectedSituation} documentListRefreshKey={documentListRefreshKey} onOpenDocument={onOpenDocument}
          hiddenDocumentIds={documentSelection.situationId === selectedSituationId ? documentSelection.hiddenIds : []}
          onDocumentsChange={onDocumentsChange} onDocumentVisibilityChange={onDocumentVisibilityChange}
          onSituationUpdated={(updated) => setSituations((current) => current.map((situation) => situation.id === updated.id ? updated : situation))} />
        {journalError ? <p className="notebook-inline-error" role="alert">{journalError}</p> : null}
        {loading ? <p className="journal-empty-message" role="status">Načítám přehled…</p> : null}
        {selectedSituationId ? <CompactJournal key={`compact-journal:${selectedSituationId}`} situationId={selectedSituationId} items={items} evidence={evidence}
          selectedDocumentIds={selectedDocumentIds} onSave={save} onArchive={archive} onCreate={createNote} onStartBookmarkLink={onStartBookmarkLink}
          pendingBookmarkTargetJournalItemId={pendingBookmarkTargetJournalItemId} /> : <p>Vyberte situaci.</p>}
      </div>
    </aside>
  );
}
