/** Existing upload + Situation link, without automatic analysis or criterion confirmation. */
export async function uploadToSituation(caseId: string, situationId: string, file: File): Promise<{ id: string; name: string }> {
  const body = new FormData(); body.append("file", file);
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/documents`, { method: "POST", body });
  const data = await response.json();
  if (!response.ok || !data.document?.id) throw new Error(data.error ?? "Dokument se nepodařilo nahrát.");
  const linked = await fetch(`/api/situations/${encodeURIComponent(situationId)}/documents`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: data.document.id })
  });
  if (!linked.ok) throw new Error("Soubor se nepodařilo připojit k situaci. Vazba k položce nebyla uložena.");
  return { id: data.document.id, name: data.document.display_name ?? data.document.filename };
}
