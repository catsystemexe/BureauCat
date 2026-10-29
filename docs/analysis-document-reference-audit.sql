-- Open SQLite with -readonly. Set @analysis_document_id in the client first.
-- SELECT only: no allocation, renumbering, merging or repair of pins.
-- Offsets are JavaScript UTF-16 positions. Do not use SQLite substr() as a
-- quote validator: its Unicode code-point indexing differs for surrogate pairs.

SELECT i.id AS insight_id, i.document_id AS analysis_document_id,
       a.case_id, i.title, i.source_pin_id, p.id AS pin_id,
       p.case_bookmark_number, i.source_document_id,
       p.document_id AS pin_document_id,
       i.source_start_offset, i.source_end_offset,
       p.start_offset AS pin_start_offset, p.end_offset AS pin_end_offset,
       p.visual_offset, i.source_text, p.selected_text,
       CASE WHEN p.id IS NULL THEN 'missing-pin'
            WHEN p.document_id IS NOT i.source_document_id THEN 'document-mismatch'
            WHEN s.id IS NULL OR s.case_id IS NOT a.case_id THEN 'missing-or-other-case-source'
            WHEN p.case_bookmark_number IS NULL THEN 'missing-number'
            ELSE 'check-quote-and-range-in-reference-GET' END AS link_check
FROM DocumentInsight i
JOIN Document a ON a.id = i.document_id
LEFT JOIN DocumentPin p ON p.id = i.source_pin_id
LEFT JOIN Document s ON s.id = i.source_document_id
WHERE i.document_id = @analysis_document_id
ORDER BY i.created_at, i.id;

-- Different pins sharing one stored number anywhere in this Case.
SELECT p.case_bookmark_number, COUNT(DISTINCT p.id) AS different_pins,
       GROUP_CONCAT(p.id) AS pin_ids, GROUP_CONCAT(p.document_id) AS document_ids
FROM DocumentPin p JOIN Document d ON d.id = p.document_id
WHERE d.case_id = (SELECT case_id FROM Document WHERE id = @analysis_document_id)
  AND p.case_bookmark_number IS NOT NULL
GROUP BY p.case_bookmark_number HAVING COUNT(DISTINCT p.id) > 1;

-- Shared pin is a candidate for legitimate sharing, not proof of equal ranges.
SELECT source_pin_id, COUNT(*) AS insight_count, GROUP_CONCAT(id) AS insight_ids,
       GROUP_CONCAT(source_start_offset || ':' || source_end_offset) AS stored_ranges
FROM DocumentInsight WHERE document_id = @analysis_document_id AND source_pin_id IS NOT NULL
GROUP BY source_pin_id HAVING COUNT(*) > 1;

-- Stored overlap/same start is distinct from rendered geometry or a bad link.
SELECT a.id AS first_insight, b.id AS second_insight, a.source_document_id,
       a.source_pin_id AS first_pin, b.source_pin_id AS second_pin,
       a.source_start_offset AS first_start, a.source_end_offset AS first_end,
       b.source_start_offset AS second_start, b.source_end_offset AS second_end
FROM DocumentInsight a JOIN DocumentInsight b
  ON a.id < b.id AND a.document_id = b.document_id
 AND a.source_document_id = b.source_document_id
WHERE a.document_id = @analysis_document_id
  AND a.source_start_offset < b.source_end_offset
  AND b.source_start_offset < a.source_end_offset;
