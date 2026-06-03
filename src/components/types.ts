export type CaseSummary = {
  id: string;
  title: string;
  area: string | null;
  status: "draft" | "active" | "closed";
  created_at?: string;
  updated_at?: string;
};
