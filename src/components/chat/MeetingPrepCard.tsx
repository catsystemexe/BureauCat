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
        <p className="meeting-prep-empty">None listed.</p>
      )}
    </section>
  );
}

export function MeetingPrepCard({ meetingPrep }: { meetingPrep: MeetingPrepReport }) {
  return (
    <article className="meeting-prep-card" aria-labelledby="meeting-prep-card-title">
      <div className="meeting-prep-card-header">
        <p className="panel-kicker">Meeting Prep</p>
        <h3 id="meeting-prep-card-title">Prepared meeting brief</h3>
        <p className="panel-note">This working output stays in the Chat panel and is not saved.</p>
      </div>

      <section className="meeting-prep-card-section">
        <h4>Summary</h4>
        <p>{meetingPrep.summary}</p>
      </section>

      <MeetingPrepList items={meetingPrep.goals} title="Goals" />
      <MeetingPrepList items={meetingPrep.risks} title="Risks" />
      <MeetingPrepList items={meetingPrep.documents_to_bring} title="Documents to bring" />
      <MeetingPrepList items={meetingPrep.questions_to_ask} title="Questions to ask" />

      <section className="meeting-prep-card-section">
        <h4>Strategy</h4>
        <p>{meetingPrep.strategy}</p>
      </section>
    </article>
  );
}
