"use client";

import { useEffect, useMemo, useState } from "react";
import type { JournalItem } from "@/components/types";
import { buildJournalOverview, JOURNAL_CATEGORIES, TIME_LABELS, type JournalEvidence } from "@/lib/journal/overview";

export function JournalRecordEditor({ item, onSave, onArchive, onStartBookmarkLink, pending }: {
  item: JournalItem;
  onSave: (id: string, fields: { title: string; value: string | null }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onStartBookmarkLink: (id: string) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const [value, setValue] = useState(item.value ?? "");
  const [valueChanged, setValueChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setTitle(item.title); setValue(item.value ?? ""); setValueChanged(false); }, [item.title, item.value]);
  return (
    <form className="compact-journal-editor" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(null);
      try { await onSave(item.id, { title: title.trim(), value: valueChanged ? value : item.value }); }
      catch { setError("Změnu se nepodařilo uložit."); }
      finally { setBusy(false); }
    }}>
      <label>Popisek<input value={title} required disabled={busy} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Sdělení / hodnota<textarea value={value} placeholder={item.explanation ?? undefined} disabled={busy} onChange={(event) => { setValue(event.target.value); setValueChanged(true); }} /></label>
      <div className="compact-journal-editor-actions">
        <button type="submit" disabled={busy || !title.trim()}>Uložit záznam</button>
        <button type="button" disabled={busy} onClick={() => { setTitle(item.title); setValue(item.value ?? ""); setValueChanged(false); }}>Vrátit změny</button>
        <button type="button" disabled={busy} onClick={() => onStartBookmarkLink(item.id)}>Připojit bookmark</button>
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await onArchive(item.id); } catch { setError("Záznam se nepodařilo smazat."); } finally { setBusy(false); }
        }}>Smazat záznam</button>
      </div>
      {pending ? <p>Klikni na konkrétní bookmark v dokumentu. Existující zdroje zůstanou zachované.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export function CompactJournal({ items, evidence, situationId, selectedDocumentIds = null, onSave, onArchive, onCreate, onStartBookmarkLink, pendingBookmarkTargetJournalItemId }: {
  items: JournalItem[]; evidence: JournalEvidence; situationId: string;
  selectedDocumentIds?: readonly string[] | null;
  onSave: (id: string, fields: { title: string; value: string | null }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onCreate: (title: string) => Promise<void>;
  onStartBookmarkLink: (id: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedPin, setHighlightedPin] = useState<string | null>(null);
  const [highlightedInsight, setHighlightedInsight] = useState<string | null>(null);
  const groups = useMemo(() => buildJournalOverview(items, evidence, situationId, selectedDocumentIds), [items, evidence, situationId, selectedDocumentIds]);
  useEffect(() => {
    const pin = (event: Event) => setHighlightedPin((event as CustomEvent<{ pinId: string }>).detail?.pinId ?? null);
    const insight = (event: Event) => setHighlightedInsight((event as CustomEvent<{ insightId: string }>).detail?.insightId ?? null);
    const leavePin = () => setHighlightedPin(null), leaveInsight = () => setHighlightedInsight(null);
    window.addEventListener("bureaucat:bookmark-pin-hover", pin);
    window.addEventListener("bureaucat:bookmark-pin-leave", leavePin);
    window.addEventListener("bureaucat:analysis-insight-hover", insight);
    window.addEventListener("bureaucat:analysis-insight-leave", leaveInsight);
    return () => {
      window.removeEventListener("bureaucat:bookmark-pin-hover", pin);
      window.removeEventListener("bureaucat:bookmark-pin-leave", leavePin);
      window.removeEventListener("bureaucat:analysis-insight-hover", insight);
      window.removeEventListener("bureaucat:analysis-insight-leave", leaveInsight);
    };
  }, []);
  return (
    <div className="compact-journal" aria-label="Přehled situace">
      <div className="compact-journal-heading">
        <h3>Přehled situace</h3>
      </div>
      {JOURNAL_CATEGORIES.map((category) => {
        const entries = groups.filter((group) => group.category === category.key);
        if (!entries.length) return null;
        const content = <ul className="compact-journal-groups">{entries.map((group) => (
          <li key={group.id} className={group.sources.some((source) => source.pinId === highlightedPin || source.insightId === highlightedInsight) && (highlightedPin || highlightedInsight) ? "compact-journal-group is-highlighted" : "compact-journal-group"}>
            {group.time ? <span className="compact-journal-kind">{TIME_LABELS[group.time]}</span> : null}
            {group.variants.length > 1 ? <p className="compact-journal-variants-label">{group.label} — rozdílné varianty, bez určení platnosti</p> : null}
            {group.variants.map((variant, index) => (
              <div className="compact-journal-variant" key={index}>
                <p>{variant.text}</p>
              </div>
            ))}
            {group.manual ? <details className="compact-journal-originals">
              <summary>Upravit poznámku</summary>
              {group.items.map((item) => <JournalRecordEditor key={item.id} item={item} onSave={onSave} onArchive={onArchive}
                onStartBookmarkLink={onStartBookmarkLink} pending={pendingBookmarkTargetJournalItemId === item.id} />)}
            </details> : null}
          </li>
        ))}</ul>;
        return category.collapsed ? (
          <details className="compact-journal-category" key={category.key}><summary>{category.title} ({entries.length})</summary>{content}</details>
        ) : <section className="compact-journal-category" key={category.key} aria-label={category.title}><h4>{category.title}</h4>{content}</section>;
      })}
      {selectedDocumentIds?.length === 0 ? <p className="journal-empty-message" role="status">Informace z dokumentů jsou skryté.</p> :
        !groups.length ? <p className="journal-empty-message">Zatím žádná sdělení pro tento výběr. Přidejte poznámku nebo dokument.</p> : null}
      {adding ? <form className="compact-journal-note" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError(null);
        try { await onCreate(note.trim()); setNote(""); setAdding(false); }
        catch { setError("Poznámku se nepodařilo uložit."); }
        finally { setBusy(false); }
      }}>
        <label>Ruční poznámka<textarea required value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
        <button type="submit" disabled={busy || !note.trim()}>Uložit poznámku</button>
        <button type="button" disabled={busy} onClick={() => setAdding(false)}>Zrušit</button>
        {error ? <p role="alert">{error}</p> : null}
      </form> : <button className="journal-add-inline-row" type="button" onClick={() => setAdding(true)}>+ Ruční poznámka</button>}
    </div>
  );
}
