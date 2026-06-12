"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CaseDocument, CaseSummary, JournalItem, JournalItemType, Situation } from "@/components/types";
import { GoalsSection } from "@/components/journal/GoalsSection";
import { SituationDocumentsSection } from "@/components/journal/SituationDocumentsSection";
import { SituationPager } from "@/components/journal/SituationPager";
import { Bookmark } from "lucide-react";
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  BookmarkIcon,
  TrashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

const JOURNAL_SECTIONS: Array<{
  title: string;
  message: string;
  section: "description" | "risks" | "open_questions" | "strategy";
  itemType: JournalItemType;
  Icon: typeof MagnifyingGlassIcon;
}> = [
  { title: "Analýza", message: "Zatím bez analýzy.", section: "description", itemType: "CLAIM", Icon: MagnifyingGlassIcon },
  { title: "Poznatky", message: "Zatím bez poznatků.", section: "description", itemType: "FACT", Icon: LightBulbIcon },
  { title: "Otázky", message: "Zatím bez otázek.", section: "open_questions", itemType: "QUESTION", Icon: QuestionMarkCircleIcon },
  { title: "Rizika", message: "Zatím bez rizik.", section: "risks", itemType: "RISK", Icon: ExclamationTriangleIcon },
  { title: "Postup", message: "Zatím bez návrhu postupu.", section: "strategy", itemType: "ACTION", Icon: ArrowPathIcon }
];

type JournalResponse = {
  journal?: JournalItem[];
  error?: string;
};

type JournalCreateResponse = {
  journalItem?: JournalItem;
  error?: string;
};

type JournalUpdateResponse = {
  journalItem?: JournalItem;
  error?: string;
};

type BookmarkSourceLink = {
  type: "bookmark";
  pinId: string;
  documentId: string;
  caseBookmarkNumber: number | null;
  color?: string | null;
};

function parseBookmarkSourceLinks(sourceLinksJson: string): BookmarkSourceLink[] {
  try {
    const parsed = JSON.parse(sourceLinksJson) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((link): link is BookmarkSourceLink => {
      if (!link || typeof link !== "object") return false;

      const candidate = link as Partial<BookmarkSourceLink>;

      return (
        candidate.type === "bookmark" &&
        typeof candidate.pinId === "string" &&
        typeof candidate.documentId === "string" &&
        (typeof candidate.caseBookmarkNumber === "number" || candidate.caseBookmarkNumber === null) &&
        (candidate.color === undefined || typeof candidate.color === "string" || candidate.color === null)
      );
    });
  } catch {
    return [];
  }
}

function JournalLinkedBookmarks({ item }: { item: JournalItem }) {
  const bookmarkLinks = parseBookmarkSourceLinks(item.source_links_json);

  if (bookmarkLinks.length === 0) {
    return null;
  }

  return (
    <div className="journal-linked-bookmarks" aria-label="Připojené bookmarky">
      {bookmarkLinks.map((link) => (
        <span
          className="journal-linked-bookmark-marker"

            data-color={link.color}
          key={`${link.documentId}-${link.pinId}`}
          style={{ "--bookmark-color": link.color ?? "#ef4444" } as React.CSSProperties}
          title={`Bookmark #${link.caseBookmarkNumber ?? "?"}`}
        >
          <Bookmark aria-hidden="true" className="journal-linked-bookmark-icon" />
          <span className="journal-linked-bookmark-index">{link.caseBookmarkNumber ?? "?"}</span>
        </span>
      ))}
    </div>
  );
}

type DraftJournalItem = {
  id: string;
  section: typeof JOURNAL_SECTIONS[number];
};

type SituationsResponse = {
  situations?: Situation[];
};

type SituationResponse = {
  situation?: Situation;
};

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
  selectedSituation
}: {
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onSituationUpdated: (situation: Situation) => void;
  selectedSituation: Situation | null;
}) {
  return (
    <div className="notebook-layer notebook-user-layer">
      <div className="notebook-layer-heading user-layer-heading">
        <span>Uživatel</span>
      </div>
      <SituationCard onSituationUpdated={onSituationUpdated} situation={selectedSituation} />
      <GoalsSection selectedSituationId={selectedSituation?.id ?? null} />
      <SituationDocumentsSection
        onOpenDocument={onOpenDocument}
        refreshKey={documentListRefreshKey}
        selectedSituationId={selectedSituation?.id ?? null}
      />
    </div>
  );
}

function JournalInlineItem({
  item,
  forceEdit = false,
  isPendingBookmarkTarget = false,
  onArchive,
  onCreateDraft,
  onDiscardDraft,
  onStartBookmarkLink,
  onUpdate
}: {
  item: JournalItem;
  forceEdit?: boolean;
  isPendingBookmarkTarget?: boolean;
  onArchive: (itemId: string) => void;
  onCreateDraft?: (itemId: string, title: string) => void;
  onDiscardDraft?: (itemId: string) => void;
  onStartBookmarkLink?: (itemId: string) => void;
  onUpdate: (itemId: string, title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(forceEdit);
  const [draft, setDraft] = useState(forceEdit ? "" : item.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(forceEdit ? "" : item.title);
    setIsEditing(forceEdit);
  }, [forceEdit, item.id, item.title]);

  useEffect(() => {
    if (!isEditing) return;

    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;

      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }, [isEditing]);

  function confirmEdit() {
    const nextTitle = draft.trim();

    if (!nextTitle) {
      if (forceEdit) {
        onDiscardDraft?.(item.id);
      } else {
        setDraft(item.title);
        setIsEditing(false);
      }
      return;
    }

    setIsEditing(false);

    if (forceEdit) {
      onCreateDraft?.(item.id, nextTitle);
      return;
    }

    if (nextTitle !== item.title) {
      onUpdate(item.id, nextTitle);
    }
  }

  if (isEditing) {
    return (
      <div className="journal-inline-edit-shell">
        {!forceEdit ? (
          <div className="journal-inline-edit-toolbar" aria-label="Akce položky zápisníku">
            <button
              aria-label="Připojit bookmark"
              className="notebook-icon-button journal-inline-toolbar-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onStartBookmarkLink?.(item.id)}
              title="Připojit bookmark: potom klikni bookmark v otevřeném dokumentu"
              type="button"
            >
              <BookmarkIcon aria-hidden="true" className="journal-inline-toolbar-icon" />
              <span aria-hidden="true" className="journal-inline-toolbar-plus">+</span>
            </button>
            <button
              aria-label="Odebrat bookmark"
              className="notebook-icon-button journal-inline-toolbar-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                // Bookmark unlinking will be implemented in the next step.
              }}
              title="Odebrat bookmark – bude doplněno v dalším kroku"
              type="button"
            >
              <BookmarkIcon aria-hidden="true" className="journal-inline-toolbar-icon" />
              <XMarkIcon aria-hidden="true" className="journal-inline-toolbar-mini-icon" />
            </button>
            <button
              aria-label="Smazat položku"
              className="notebook-icon-button journal-inline-toolbar-button danger"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onArchive(item.id)}
              title="Smazat položku"
              type="button"
            >
              <TrashIcon aria-hidden="true" className="journal-inline-toolbar-icon" />
            </button>
            {isPendingBookmarkTarget ? (
              <span className="journal-bookmark-linking-state">Klikni bookmark v dokumentu</span>
            ) : null}
          </div>
        ) : null}
        <div className="journal-inline-item editing">
          <input
            aria-label="Text položky zápisníku"
            className="journal-inline-input"
          onBlur={confirmEdit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirmEdit();
            }

            if (event.key === "Escape") {
              event.preventDefault();

              if (forceEdit) {
                onDiscardDraft?.(item.id);
              } else {
                setDraft(item.title);
                setIsEditing(false);
              }
            }
          }}
          ref={inputRef}
          value={draft}
        />
        </div>
        <JournalLinkedBookmarks item={item} />
      </div>
    );
  }

  return (
    <div className="journal-inline-item">
      <div className="journal-inline-read-content">
        <div className="journal-inline-read-row">
          <button
            className="journal-inline-text"
            onDoubleClick={() => setIsEditing(true)}
            title="Dvojklikem upravit"
            type="button"
          >
            {item.title}
          </button>
          <JournalLinkedBookmarks item={item} />
        </div>
      </div>
      {/* Delete is intentionally hidden in read mode. It appears only while editing. */}
    </div>
  );
}

function AILayer({
  draftItems,
  journalItems,
  onArchiveItem,
  onCreateItem,
  onCreateDraftItem,
  onDiscardDraftItem,
  onStartBookmarkLink,
  onUpdateItem,
  pendingBookmarkTargetJournalItemId
}: {
  draftItems: DraftJournalItem[];
  journalItems: JournalItem[];
  onArchiveItem: (itemId: string) => void;
  onCreateItem: (section: typeof JOURNAL_SECTIONS[number]) => void;
  onCreateDraftItem: (draftId: string, title: string) => void;
  onDiscardDraftItem: (draftId: string) => void;
  onStartBookmarkLink: (itemId: string) => void;
  onUpdateItem: (itemId: string, title: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
}) {
  return (
    <div className="notebook-layer notebook-ai-layer" aria-label="Zápisník situace">
      <div className="notebook-layer-heading ai-layer-heading">
        <span>Zápisník</span>
      </div>
      {JOURNAL_SECTIONS.map((section) => {
        const items = journalItems.filter((item) => item.item_type === section.itemType);
        const sectionDraftItems = draftItems.filter((draftItem) => draftItem.section.title === section.title);

        return (
          <section className="notebook-card notebook-ai-card" key={section.title}>
            <section.Icon className="notebook-section-icon ai-section-icon" />
            <div className="notebook-section-content">
              <div className="notebook-card-header">
                <h3>{section.title}</h3>
              </div>
              {items.length > 0 || sectionDraftItems.length > 0 ? (
                <div className="journal-inline-list">
                  {items.map((item) => (
                    <JournalInlineItem
                      item={item}
                      key={item.id}
                      isPendingBookmarkTarget={pendingBookmarkTargetJournalItemId === item.id}
                      onArchive={onArchiveItem}
                      onStartBookmarkLink={onStartBookmarkLink}
                      onUpdate={onUpdateItem}
                    />
                  ))}
                  {sectionDraftItems.map((draftItem) => (
                    <JournalInlineItem
                      forceEdit
                      item={{
                        id: draftItem.id,
                        case_id: "",
                        section: draftItem.section.section,
                        item_type: draftItem.section.itemType,
                        title: "",
                        value: null,
                        explanation: null,
                        evidence_state: "unverified",
                        status: "active",
                        display_order: 0,
                        source_links_json: "[]",
                        created_at: "",
                        updated_at: ""
                      }}
                      key={draftItem.id}
                      onArchive={onArchiveItem}
                      onCreateDraft={onCreateDraftItem}
                      onDiscardDraft={onDiscardDraftItem}
                      onUpdate={onUpdateItem}
                    />
                  ))}
                  <button
                    aria-label={`Přidat položku: ${section.title}`}
                    className="journal-add-inline-row"
                    onClick={() => onCreateItem(section)}
                    type="button"
                  >
                    + {section.title.toLowerCase().replace("cíle", "cíl").replace("dokumenty", "dokument").replace("otázky", "otázka").replace("rizika", "riziko")}
                  </button>
                </div>
              ) : (
                <div className="journal-inline-list">
                  <p className="journal-empty-message">{section.message}</p>
                  <button
                    aria-label={`Přidat položku: ${section.title}`}
                    className="journal-add-inline-row"
                    onClick={() => onCreateItem(section)}
                    type="button"
                  >
                    + {section.title.toLowerCase().replace("cíle", "cíl").replace("dokumenty", "dokument").replace("otázky", "otázka").replace("rizika", "riziko")}
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function JournalPanel({
  caseItem,
  documentListRefreshKey,
  onOpenDocument,
  onSelectSituation,
  onStartBookmarkLink,
  pendingBookmarkTargetJournalItemId,
  selectedSituationId
}: {
  caseItem: CaseSummary;
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onSelectSituation: (situationId: string | null) => void;
  onStartBookmarkLink: (journalItemId: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
  selectedSituationId: string | null;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [isLoadingSituations, setIsLoadingSituations] = useState(true);
  const [isCreatingSituation, setIsCreatingSituation] = useState(false);
  const [situationError, setSituationError] = useState<string | null>(null);
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);
  const [draftJournalItems, setDraftJournalItems] = useState<DraftJournalItem[]>([]);
  const [journalError, setJournalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJournalItems() {
      try {
        const response = await fetch(`/api/cases/${caseItem.id}/journal`, {
          cache: "no-store"
        });
        const data = (await response.json()) as JournalResponse;

        if (!response.ok || !Array.isArray(data.journal)) {
          throw new Error(data.error ?? "Nepodařilo se načíst zápisník.");
        }

        if (isMounted) {
          setJournalItems(data.journal.filter((item) => item.status !== "obsolete"));
          setJournalError(null);
        }
      } catch {
        if (isMounted) {
          setJournalItems([]);
          setJournalError("Nepodařilo se načíst zápisník.");
        }
      }
    }

    void loadJournalItems();

    function handleExternalJournalRefresh() {
      void loadJournalItems();
    }

    function handleExternalJournalItemUpdated(event: Event) {
      const customEvent = event as CustomEvent<JournalItem | undefined>;
      const updatedItem = customEvent.detail;

      if (!updatedItem) {
        return;
      }

      setJournalItems((current) =>
        current.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
    }

    window.addEventListener("bureaucat:journal-refresh", handleExternalJournalRefresh);
    window.addEventListener("bureaucat:journal-item-updated", handleExternalJournalItemUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener("bureaucat:journal-refresh", handleExternalJournalRefresh);
      window.removeEventListener("bureaucat:journal-item-updated", handleExternalJournalItemUpdated);
    };
  }, [caseItem.id]);

  function handleCreateJournalItem(section: typeof JOURNAL_SECTIONS[number]) {
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraftJournalItems((current) => [...current, { id: draftId, section }]);
  }

  async function handleCreateDraftJournalItem(draftId: string, title: string) {
    const draftItem = draftJournalItems.find((item) => item.id === draftId);

    if (!draftItem) {
      return;
    }

    try {
      setJournalError(null);

      const response = await fetch(`/api/cases/${caseItem.id}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: draftItem.section.section,
          item_type: draftItem.section.itemType,
          title,
          value: null,
          explanation: null,
          evidence_state: "unverified",
          status: "active",
          source_links_json: "[]"
        })
      });
      const data = (await response.json()) as JournalCreateResponse;

      if (!response.ok || !data.journalItem) {
        throw new Error(data.error ?? "Položku se nepodařilo vytvořit.");
      }

      setDraftJournalItems((current) => current.filter((item) => item.id !== draftId));
      setJournalItems((current) => [...current, data.journalItem!]);
    } catch {
      setJournalError("Položku se nepodařilo vytvořit.");
    }
  }

  function handleDiscardDraftJournalItem(draftId: string) {
    setDraftJournalItems((current) => current.filter((item) => item.id !== draftId));
  }

  async function handleUpdateJournalItem(itemId: string, title: string) {
    const previousItems = journalItems;

    setJournalItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, title } : item))
    );

    try {
      setJournalError(null);

      const response = await fetch(`/api/journal/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      const data = (await response.json()) as JournalUpdateResponse;

      if (!response.ok || !data.journalItem) {
        throw new Error(data.error ?? "Položku se nepodařilo uložit.");
      }

      setJournalItems((current) =>
        current.map((item) => (item.id === itemId ? data.journalItem! : item))
      );
    } catch {
      setJournalItems(previousItems);
      setJournalError("Položku se nepodařilo uložit.");
    }
  }

  async function handleArchiveJournalItem(itemId: string) {
    const previousItems = journalItems;

    setJournalItems((current) => current.filter((item) => item.id !== itemId));

    try {
      setJournalError(null);

      const response = await fetch(`/api/journal/${itemId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Položku se nepodařilo smazat.");
      }
    } catch {
      setJournalItems(previousItems);
      setJournalError("Položku se nepodařilo smazat.");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSituations() {
      try {
        setIsLoadingSituations(true);
        const response = await fetch(`/api/cases/${caseItem.id}/situations`, {
          cache: "no-store"
        });
        const data = (await response.json()) as SituationsResponse;

        if (!response.ok || !Array.isArray(data.situations)) {
          throw new Error("Nepodařilo se načíst situace.");
        }

        if (isMounted) {
          const activeSituations = data.situations.filter(
            (situation) => situation.status === "active"
          );
          setSituations(data.situations);
          onSelectSituation(activeSituations[0]?.id ?? null);
          setSituationError(null);
        }
      } catch {
        if (isMounted) {
          setSituations([]);
          onSelectSituation(null);
          setSituationError("Nepodařilo se načíst situace.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSituations(false);
        }
      }
    }

    loadSituations();

    return () => {
      isMounted = false;
    };
  }, [caseItem.id, onSelectSituation]);

  async function handleCreateSituation() {
    const activeSituationCount = situations.filter((situation) => situation.status === "active").length;

    if (activeSituationCount >= 10) {
      return;
    }

    try {
      setIsCreatingSituation(true);
      setSituationError(null);
      const response = await fetch(`/api/cases/${caseItem.id}/situations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Situace ${situations.length + 1}` })
      });
      const data = (await response.json()) as SituationResponse;

      if (!response.ok || !data.situation) {
        throw new Error("Nepodařilo se vytvořit situaci.");
      }

      setSituations((currentSituations) => [...currentSituations, data.situation as Situation]);
      onSelectSituation(data.situation.id);
    } catch {
      setSituationError("Nepodařilo se vytvořit situaci.");
    } finally {
      setIsCreatingSituation(false);
    }
  }

  const selectedSituation = useMemo(
    () =>
      situations.find(
        (situation) => situation.status === "active" && situation.id === selectedSituationId
      ) ?? null,
    [selectedSituationId, situations]
  );

  function handleSituationUpdated(updatedSituation: Situation) {
    setSituations((currentSituations) =>
      currentSituations.map((situation) =>
        situation.id === updatedSituation.id ? updatedSituation : situation
      )
    );
  }

  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <div className="journal-panel-title-row">
        <h2 className="journal-panel-title" id="journal-title">Zápisník</h2>
        <SituationPager
          error={situationError}
          isCreating={isCreatingSituation}
          isLoading={isLoadingSituations}
          onCreateSituation={handleCreateSituation}
          onSelectSituation={onSelectSituation}
          selectedSituationId={selectedSituationId}
          situations={situations}
        />
      </div>
      <div className="notebook-page">
        <UserLayer
          documentListRefreshKey={documentListRefreshKey}
          onOpenDocument={onOpenDocument}
          onSituationUpdated={handleSituationUpdated}
          selectedSituation={selectedSituation}
        />
        {journalError ? <p className="notebook-inline-error">{journalError}</p> : null}
        <AILayer
          draftItems={draftJournalItems}
          journalItems={journalItems}
          onArchiveItem={handleArchiveJournalItem}
          onCreateDraftItem={handleCreateDraftJournalItem}
          onCreateItem={handleCreateJournalItem}
          onDiscardDraftItem={handleDiscardDraftJournalItem}
          onStartBookmarkLink={onStartBookmarkLink}
          onUpdateItem={handleUpdateJournalItem}
          pendingBookmarkTargetJournalItemId={pendingBookmarkTargetJournalItemId}
        />
      </div>
    </aside>
  );
}
