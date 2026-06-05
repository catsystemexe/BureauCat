import type { MeetingPrepReport } from "@/components/types";

type MeetingPrepListSection = {
  items: string[];
  title: string;
};

function MeetingPrepList({ items, title }: MeetingPrepListSection) {
  const visibleItems = items.filter((item) => item.trim().length > 0);

  return (
    <section className="meeting-prep-card-section">
      <h4>{title}</h4>
      {visibleItems.length > 0 ? (
        <ul className="meeting-prep-list">
          {visibleItems.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="meeting-prep-empty">Bez položek.</p>
      )}
    </section>
  );
}

export function MeetingPrepCard({ meetingPrep }: { meetingPrep: MeetingPrepReport }) {
  return (
    <article className="meeting-prep-card" aria-labelledby="meeting-prep-card-title">
      <div className="meeting-prep-card-header">
        <p className="panel-kicker">Příprava na jednání</p>
        <h3 id="meeting-prep-card-title">Podklady k jednání</h3>
        <p className="panel-note">Tento pracovní výstup zůstává v konzultaci a neukládá se.</p>
      </div>

      <section className="meeting-prep-card-section">
        <h4>Shrnutí</h4>
        <p>{meetingPrep.summary}</p>
      </section>

      <MeetingPrepList items={meetingPrep.goals} title="Cíle" />
      <MeetingPrepList items={meetingPrep.risks} title="Rizika" />
      <MeetingPrepList items={meetingPrep.documents_to_bring} title="Dokumenty s sebou" />
      <MeetingPrepList items={meetingPrep.questions_to_ask} title="Otázky k položení" />

      <section className="meeting-prep-card-section">
        <h4>Postup</h4>
        <p>{meetingPrep.strategy}</p>
      </section>
    </article>
  );
}
