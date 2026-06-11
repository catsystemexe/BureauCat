"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  Eraser,
  Eye,
  Highlighter,
  Maximize2,
  MessageCircle,
  Move,
  Palette,
  Bookmark,
  Pin,
  SquarePen,
  Trash2,
  TriangleAlert} from "lucide-react";
import type { CaseDocument, DocumentAnnotation, DocumentAnnotationType, DocumentPin } from "@/components/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

type DocumentResponse = {
  document?: CaseDocument;
  error?: string;
};

type AnnotationListResponse = {
  annotations?: DocumentAnnotation[];
  error?: string;
};

type AnnotationCreateResponse = {
  annotation?: DocumentAnnotation;
  annotations?: DocumentAnnotation[];
  error?: string;
};

type AnnotationUpdateResponse = {
  annotation?: DocumentAnnotation;
  error?: string;
};

type PinListResponse = {
  pins?: DocumentPin[];
  error?: string;
};

type PinCreateResponse = {
  pin?: DocumentPin;
  pins?: DocumentPin[];
  error?: string;
};

type PinUpdateResponse = {
  pin?: DocumentPin;
  error?: string;
};

const highlightColors = [
  { label: "Žlutá", value: "yellow", css: "#ffe766" },
  { label: "Zelená", value: "green", css: "#b7f7c2" },
  { label: "Modrá", value: "blue", css: "#bfe3ff" },
  { label: "Růžová", value: "pink", css: "#ffc6df" },
  { label: "Oranžová", value: "orange", css: "#ffd49a" },
  { label: "Transparent", value: "transparent", css: "transparent" }
];

function getHighlightCssColor(value: string | null | undefined) {
  return highlightColors.find((color) => color.value === value)?.css ?? "#ffe766";
}

const pinColors = [
  { label: "Červená", value: "red", css: "#ef4444" },
  { label: "Oranžová", value: "orange", css: "#f97316" },
  { label: "Zelená", value: "green", css: "#22c55e" },
  { label: "Žlutá", value: "yellow", css: "#eab308" },
  { label: "Modrá", value: "blue", css: "#3b82f6" }
];

function getPinCssColor(value: string | null | undefined) {
  return pinColors.find((color) => color.value === value)?.css ?? "#ef4444";
}

function getNoteCssColor(value: string | null | undefined) {
  return getHighlightCssColor(value ?? "yellow");
}

export function DocumentViewPanel({ document: initialDocument }: { document: CaseDocument }) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [isOriginalVisible, setIsOriginalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [originalWindow, setOriginalWindow] = useState({
    x: 24,
    y: 96,
    width: 760,
    height: 620,
    zoom: 1
  });

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const documentTextRef = useRef<HTMLPreElement | null>(null);
  const documentTextShellRef = useRef<HTMLDivElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pinTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pinEditorRef = useRef<HTMLDivElement | null>(null);
  const hoveredPinRef = useRef<HTMLDivElement | null>(null);
  const pinMeasurementFrameRef = useRef<number | null>(null);
  const pinDragFrameRef = useRef<number | null>(null);

  const [draftText, setDraftText] = useState(
    initialDocument.processed_markdown ?? initialDocument.processed_text ?? initialDocument.extracted_text ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [pins, setPins] = useState<DocumentPin[]>([]);
  const [pinPositions, setPinPositions] = useState<Record<string, number>>({});
  const [isPinDragging, setIsPinDragging] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [annotationNote, setAnnotationNote] = useState("");
  const [isAnnotationNoteOpen, setIsAnnotationNoteOpen] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [hoveredNote, setHoveredNote] = useState<{
    annotation: DocumentAnnotation;
    x: number;
    y: number;
  } | null>(null);
  const [noteEditorPosition, setNoteEditorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isNoteColorPaletteOpen, setIsNoteColorPaletteOpen] = useState(false);
  const noteEditorDragRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const noteEditDraftRef = useRef<{ noteText: string; color: string } | null>(null);
  const [isHighlightPaletteOpen, setIsHighlightPaletteOpen] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState("yellow");
  const [activeNoteColor, setActiveNoteColor] = useState("yellow");
  const [activePinColor, setActivePinColor] = useState("red");
  const [isPinEditorOpen, setIsPinEditorOpen] = useState(false);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinNote, setPinNote] = useState("");
  const [pinEditorPosition, setPinEditorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPin, setHoveredPin] = useState<{
    pin: DocumentPin;
    x: number;
    y: number;
  } | null>(null);
  const suppressPinClickRef = useRef(false);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const dragPinRef = useRef<{
    pinId: string | null;
    lastOffset: number | null;
    lastBoxPosition: { x: number; y: number } | null;
    pendingPoint: { x: number; y: number } | null;
    marker: HTMLButtonElement | null;
    initialMarkerTop: string;
    didMove: boolean;
  }>({
    pinId: null,
    lastOffset: null,
    lastBoxPosition: null,
    pendingPoint: null,
    marker: null,
    initialMarkerTop: "",
    didMove: false
  });
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<"highlight" | "note" | "pin" | "erase" | null>(null);

  const displayText =
    currentDocument.processed_markdown ?? currentDocument.processed_text ?? currentDocument.extracted_text ?? "";
  const isValidated = currentDocument.validation_status === "validated";
  const orderedPins = useMemo(
    () => [...pins].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [pins]
  );
  const pinNumberById = useMemo(
    () => new Map(orderedPins.map((pin, index) => [pin.id, index + 1])),
    [orderedPins]
  );
  const pinGeometryKey = pins
    .map((pin) => `${pin.id}:${pin.visual_offset ?? pin.start_offset}`)
    .join("|");
  const renderedDisplayText = useMemo(
    () => renderDisplayTextWithHighlights(displayText),
    [annotations, displayText, isAnnotationNoteOpen]
  );

  useEffect(() => {
    setCurrentDocument(initialDocument);
    setDraftText(
      initialDocument.processed_markdown ?? initialDocument.processed_text ?? initialDocument.extracted_text ?? ""
    );
    setError(null);
    setIsEditing(false);
    setIsOriginalVisible(false);
    setIsFullscreen(false);
  }, [initialDocument]);

  useEffect(() => {
    async function loadAnnotations() {
      try {
        const response = await fetch(`/api/documents/${initialDocument.id}/annotations`);
        const data = (await response.json()) as AnnotationListResponse;

        if (response.ok && data.annotations) {
          setAnnotations(data.annotations);
        }
      } catch {
        setAnnotations([]);
      }
    }

    void loadAnnotations();
  }, [initialDocument.id]);

  useEffect(() => {
    measurePinPositions();
  }, [pinGeometryKey, displayText, isEditing, isFullscreen]);

  useEffect(() => {
    return () => {
      if (pinMeasurementFrameRef.current !== null) {
        window.cancelAnimationFrame(pinMeasurementFrameRef.current);
      }

      if (pinDragFrameRef.current !== null) {
        window.cancelAnimationFrame(pinDragFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadPins() {
      try {
        const response = await fetch(`/api/documents/${initialDocument.id}/pins`);
        const data = (await response.json()) as PinListResponse;

        if (response.ok && data.pins) {
          setPins(data.pins);
        }
      } catch {
        setPins([]);
      }
    }

    void loadPins();
  }, [initialDocument.id]);

  useEffect(() => {
    if (!isAnnotationNoteOpen && !isPinEditorOpen) {
      return;
    }

    window.setTimeout(() => {
      resizeNoteTextarea();

      const textarea = noteTextareaRef.current;

      if (!textarea) {
        return;
      }

      const endPosition = textarea.value.length;

      textarea.focus();
      textarea.setSelectionRange(endPosition, endPosition);
      textarea.scrollTop = textarea.scrollHeight;
      resizeNoteTextarea();
    }, 0);
  }, [isAnnotationNoteOpen, editingAnnotationId]);

  useEffect(() => {
    resizeNoteTextarea();
  }, [annotationNote, isAnnotationNoteOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
        setIsOriginalVisible(false);
        closeNoteEditor();
    closePinEditor();
    setHoveredPin(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnnotationNoteOpen, editingAnnotationId]);

  async function patchDocument(payload: Record<string, string>) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as DocumentResponse;

      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "Dokument se nepodařilo uložit.");
      }

      setCurrentDocument(data.document);
      setDraftText(data.document.processed_markdown ?? data.document.processed_text ?? data.document.extracted_text ?? "");
      return data.document;
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Dokument se nepodařilo uložit.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveText() {
    const updatedDocument = await patchDocument({ processed_text: draftText });

    if (updatedDocument) {
      setIsEditing(false);
    }
  }

  function getSelectionOffsets() {
    const root = documentTextRef.current;
    const selection = window.getSelection();

    if (!root || !selection || selection.rangeCount === 0) {
      return { selectedText: selectedText.trim(), startOffset: null, endOffset: null };
    }

    const range = selection.getRangeAt(0);
    const selected = selection.toString().trim();

    if (!selected || !root.contains(range.commonAncestorContainer)) {
      return { selectedText: selectedText.trim(), startOffset: null, endOffset: null };
    }

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(root);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const startOffset = beforeRange.toString().length;
    const endOffset = startOffset + selection.toString().length;

    return { selectedText: selected, startOffset, endOffset };
  }

  function captureSelectedText() {
    const result = getSelectionOffsets();

    if (result.selectedText.length > 0) {
      setSelectedText(result.selectedText);
      return result.selectedText;
    }

    return selectedText.trim();
  }

  function renderDisplayTextWithHighlights(text: string) {
    const highlightRanges = annotations
      .filter((annotation) => annotation.annotation_type === "highlight" && annotation.highlight_color !== "transparent")
      .map((annotation) => {
        if (annotation.start_offset !== null && annotation.end_offset !== null) {
          return { start: annotation.start_offset, end: annotation.end_offset, color: getHighlightCssColor(annotation.highlight_color) };
        }

        const index = text.indexOf(annotation.selected_text);
        return index >= 0 ? { start: index, end: index + annotation.selected_text.length, color: getHighlightCssColor(annotation.highlight_color) } : null;
      })
      .filter((range): range is { start: number; end: number; color: string } => Boolean(range))
      .filter((range) => range.start >= 0 && range.end > range.start && range.end <= text.length)
      .sort((a, b) => a.start - b.start);

    const noteMarkers = annotations
      .filter((annotation) => annotation.annotation_type === "note")
      .map((annotation) => {
        const markerOffset =
          annotation.end_offset !== null
            ? annotation.end_offset
            : annotation.start_offset !== null
              ? annotation.start_offset
              : text.indexOf(annotation.selected_text) >= 0
                ? text.indexOf(annotation.selected_text) + annotation.selected_text.length
                : null;

        return markerOffset === null
          ? null
          : {
              offset: Math.min(Math.max(markerOffset, 0), text.length),
              annotation,
              number: 0
            };
      })
      .filter((marker): marker is { offset: number; annotation: DocumentAnnotation; number: number } => Boolean(marker))
      .sort((a, b) => a.offset - b.offset)
      .map((marker, index) => ({ ...marker, number: index + 1 }));

    if (highlightRanges.length === 0 && noteMarkers.length === 0) {
      return text;
    }

    const breakpoints = new Set<number>();
    breakpoints.add(0);
    breakpoints.add(text.length);

    for (const range of highlightRanges) {
      breakpoints.add(range.start);
      breakpoints.add(range.end);
    }

    for (const marker of noteMarkers) {
      breakpoints.add(marker.offset);
    }

    const points = [...breakpoints].sort((a, b) => a - b);
    const parts: React.ReactNode[] = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const segment = text.slice(start, end);
      const activeHighlight = highlightRanges.find((range) => range.start <= start && range.end >= end);

      if (segment.length > 0) {
        if (activeHighlight) {
          parts.push(
            <mark
              className="document-inline-highlight"
              key={`highlight-${index}-${start}`}
              style={{ backgroundColor: activeHighlight.color }}
            >
              {segment}
            </mark>
          );
        } else {
          parts.push(segment);
        }
      }

      const markersAtPoint = noteMarkers.filter((marker) => marker.offset === end);

      for (const marker of markersAtPoint) {
        parts.push(
          <button
            className="document-note-marker"
            key={`note-${marker.annotation.id}`}
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              setHoveredNote(null);
              setNoteEditorPosition({ x: rect.left, y: Math.max(12, rect.top - 12) });
              openExistingAnnotationNote(marker.annotation);
            }}
            onMouseEnter={(event) => {
              if (isAnnotationNoteOpen) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setHoveredNote({
                annotation: marker.annotation,
                x: rect.left,
                y: Math.max(12, rect.top - 12)
              });
            }}
            onMouseLeave={() => setHoveredNote(null)}
            style={{ backgroundColor: getNoteCssColor(marker.annotation.highlight_color) }}
            title="Otevřít poznámku"
            type="button"
          >
            {marker.number}
          </button>
        );
      }
    }

    const markersAtStart = noteMarkers.filter((marker) => marker.offset === 0);

    for (const marker of markersAtStart) {
      parts.unshift(
        <button
          className="document-note-marker"
          key={`note-start-${marker.annotation.id}`}
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setHoveredNote(null);
            setNoteEditorPosition({ x: rect.left, y: Math.max(12, rect.top - 12) });
            openExistingAnnotationNote(marker.annotation);
          }}
          onMouseEnter={(event) => {
            if (isAnnotationNoteOpen) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setHoveredNote({
              annotation: marker.annotation,
              x: rect.left,
              y: Math.max(12, rect.top - 12)
            });
          }}
          onMouseLeave={() => setHoveredNote(null)}
          style={{ backgroundColor: getNoteCssColor(marker.annotation.highlight_color) }}
          title="Otevřít poznámku"
          type="button"
        >
          {marker.number}
        </button>
      );
    }

    return parts;
  }

  function getTextOffsetFromPoint(clientX: number, clientY: number) {
    const root = documentTextRef.current;

    if (!root) {
      return null;
    }

    const documentWithCaret = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };

    let node: Node | null = null;
    let offset = 0;

    const caretPosition = documentWithCaret.caretPositionFromPoint?.(clientX, clientY);

    if (caretPosition) {
      node = caretPosition.offsetNode;
      offset = caretPosition.offset;
    } else {
      const caretRange = documentWithCaret.caretRangeFromPoint?.(clientX, clientY);

      if (caretRange) {
        node = caretRange.startContainer;
        offset = caretRange.startOffset;
      }
    }

    if (!node || !root.contains(node)) {
      return null;
    }

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(root);
    beforeRange.setEnd(node, offset);

    return beforeRange.toString().length;
  }

  function getSentenceRangeAtOffset(text: string, offset: number) {
    const clampedOffset = Math.min(Math.max(offset, 0), text.length);
    const hardBoundary = /[.!?。！？\n]/;

    let start = clampedOffset;
    while (start > 0 && !hardBoundary.test(text[start - 1])) {
      start -= 1;
    }

    let end = clampedOffset;
    while (end < text.length && !hardBoundary.test(text[end])) {
      end += 1;
    }

    if (end < text.length && hardBoundary.test(text[end])) {
      end += 1;
    }

    while (start < end && /\s/.test(text[start])) {
      start += 1;
    }

    while (end > start && /\s/.test(text[end - 1])) {
      end -= 1;
    }

    if (end <= start) {
      return null;
    }

    return {
      selectedText: text.slice(start, end),
      startOffset: start,
      endOffset: end
    };
  }

  async function createAnnotationFromOffsets(
    annotationType: DocumentAnnotationType,
    selectedTextValue: string,
    startOffset: number | null,
    endOffset: number | null,
    noteText?: string | null,
    highlightColor?: string | null,
    eraseAll?: boolean
  ) {
    if (!selectedTextValue.trim()) {
      setError("Nejdřív označ text v dokumentu.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_text: selectedTextValue,
          start_offset: startOffset,
          end_offset: endOffset,
          annotation_type: annotationType,
          highlight_color: highlightColor ?? null,
          note_text: noteText ?? null,
          erase_all: eraseAll === true
        })
      });

      const data = (await response.json()) as AnnotationCreateResponse;

      if (!response.ok || (!data.annotation && !data.annotations)) {
        throw new Error(data.error ?? "Anotaci se nepodařilo uložit.");
      }

      if (data.annotations) {
        setAnnotations(data.annotations);
      } else if (data.annotation) {
        setAnnotations((current) => [data.annotation!, ...current]);

        if (data.annotation.annotation_type === "note") {
          setSelectedText(data.annotation.selected_text);
          setAnnotationNote(data.annotation.note_text ?? "");
          setEditingAnnotationId(data.annotation.id);
          setActiveNoteColor(data.annotation.highlight_color ?? activeNoteColor);
          noteEditDraftRef.current = {
            noteText: data.annotation.note_text ?? "",
            color: data.annotation.highlight_color ?? activeNoteColor
          };
          setIsAnnotationNoteOpen(true);
          return;
        }
      }

      setSelectedText("");
      setAnnotationNote("");
      setIsAnnotationNoteOpen(false);
      setEditingAnnotationId(null);
      setIsHighlightPaletteOpen(false);
      window.getSelection()?.removeAllRanges();
    } catch (annotationError) {
      setError(annotationError instanceof Error ? annotationError.message : "Anotaci se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  function getTextNodeAtOffset(root: HTMLElement, targetOffset: number) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let node = walker.nextNode();

    while (node) {
      const length = node.textContent?.length ?? 0;

      if (currentOffset + length >= targetOffset) {
        return {
          node,
          offset: Math.max(0, Math.min(length, targetOffset - currentOffset))
        };
      }

      currentOffset += length;
      node = walker.nextNode();
    }

    return null;
  }

  function measurePinPositions() {
    if (pinMeasurementFrameRef.current !== null) {
      return;
    }

    pinMeasurementFrameRef.current = window.requestAnimationFrame(() => {
      pinMeasurementFrameRef.current = null;
      measurePinPositionsNow();
    });
  }

  function measurePinPositionsNow() {
    const root = documentTextRef.current;

    if (!root) {
      return;
    }

    const nextPositions: Record<string, number> = {};
    const shell = documentTextShellRef.current;
    const shellRect = shell?.getBoundingClientRect() ?? root.getBoundingClientRect();
    const computedLineHeight = Number.parseFloat(window.getComputedStyle(root).lineHeight);
    const pinsByOffset = pinsRef.current
      .map((pin) => ({ id: pin.id, offset: pin.visual_offset ?? pin.start_offset }))
      .sort((a, b) => a.offset - b.offset);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    let currentOffset = 0;

    // Pin layer is outside the scrolling <pre>, so use visible viewport position, not document-scroll position.
    for (const pin of pinsByOffset) {
      while (currentNode && currentOffset + (currentNode.textContent?.length ?? 0) < pin.offset) {
        currentOffset += currentNode.textContent?.length ?? 0;
        currentNode = walker.nextNode();
      }

      if (!currentNode) {
        continue;
      }

      const nodeLength = currentNode.textContent?.length ?? 0;
      const nodeOffset = Math.max(0, Math.min(nodeLength, pin.offset - currentOffset));
      const range = document.createRange();
      range.setStart(currentNode, nodeOffset);
      range.setEnd(currentNode, nodeOffset);

      const rect = range.getBoundingClientRect();
      const lineHeight = computedLineHeight || rect.height || 22;
      nextPositions[pin.id] = rect.top - shellRect.top + lineHeight / 2;
    }

    setPinPositions((currentPositions) => {
      const nextPinIds = Object.keys(nextPositions);
      const positionsAreEqual =
        nextPinIds.length === Object.keys(currentPositions).length &&
        nextPinIds.every((pinId) => currentPositions[pinId] === nextPositions[pinId]);

      return positionsAreEqual ? currentPositions : nextPositions;
    });
  }

  function updateDraggedPinPosition() {
    pinDragFrameRef.current = null;

    const drag = dragPinRef.current;
    const point = drag.pendingPoint;
    const marker = drag.marker;

    if (!drag.pinId || !point || !marker) {
      return;
    }

    drag.pendingPoint = null;
    const offset = getTextOffsetFromPoint(point.x, point.y);

    if (offset === null) {
      return;
    }

    const root = documentTextRef.current;
    const shell = documentTextShellRef.current;

    if (!root || !shell) {
      return;
    }

    const target = getTextNodeAtOffset(root, offset);

    if (!target) {
      return;
    }

    const range = document.createRange();
    range.setStart(target.node, target.offset);
    range.setEnd(target.node, target.offset);

    // Complete layout reads before applying any transient visual writes.
    const rect = range.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const lineHeight = Number.parseFloat(window.getComputedStyle(root).lineHeight) || rect.height || 22;
    const nextPinY = rect.top - shellRect.top + lineHeight / 2;
    const nextBoxPosition = { x: markerRect.right + 12, y: Math.max(12, rect.top) };

    drag.lastOffset = offset;
    drag.lastBoxPosition = nextBoxPosition;
    drag.didMove = true;

    marker.style.top = `${nextPinY}px`;

    if (isPinEditorOpen && editingPinId === drag.pinId && pinEditorRef.current) {
      pinEditorRef.current.style.left = `${nextBoxPosition.x}px`;
      pinEditorRef.current.style.top = `${nextBoxPosition.y}px`;
    }

    if (hoveredPin?.pin.id === drag.pinId && hoveredPinRef.current) {
      hoveredPinRef.current.style.left = `${nextBoxPosition.x}px`;
      hoveredPinRef.current.style.top = `${nextBoxPosition.y}px`;
    }
  }

  function scheduleDraggedPinPosition(x: number, y: number) {
    dragPinRef.current.pendingPoint = { x, y };

    if (pinDragFrameRef.current !== null) {
      return;
    }

    pinDragFrameRef.current = window.requestAnimationFrame(updateDraggedPinPosition);
  }

  function flushDraggedPinPosition() {
    if (pinDragFrameRef.current !== null) {
      window.cancelAnimationFrame(pinDragFrameRef.current);
      pinDragFrameRef.current = null;
    }

    updateDraggedPinPosition();
  }

  function cancelDraggedPinPosition() {
    if (pinDragFrameRef.current !== null) {
      window.cancelAnimationFrame(pinDragFrameRef.current);
      pinDragFrameRef.current = null;
    }

    const drag = dragPinRef.current;

    if (drag.marker) {
      drag.marker.style.top = drag.initialMarkerTop;
    }

    if (pinEditorRef.current && pinEditorPosition) {
      pinEditorRef.current.style.left = `${pinEditorPosition.x}px`;
      pinEditorRef.current.style.top = `${pinEditorPosition.y}px`;
    }

    if (hoveredPinRef.current && hoveredPin) {
      hoveredPinRef.current.style.left = `${hoveredPin.x}px`;
      hoveredPinRef.current.style.top = `${hoveredPin.y}px`;
    }
  }

  function getPinNumber(pin: DocumentPin) {
    return pinNumberById.get(pin.id) ?? 0;
  }

  async function movePinToOffset(pinId: string, visualOffset: number) {
    setPins((current) =>
      current.map((pin) =>
        pin.id === pinId
          ? {
              ...pin,
              visual_offset: visualOffset
            }
          : pin
      )
    );

    await fetch(`/api/document-pins/${pinId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visual_offset: visualOffset
      })
    });

  }
  function closePinEditor() {
    setIsPinEditorOpen(false);
    setEditingPinId(null);
    setPinNote("");
    setPinEditorPosition(null);
  }

  function openPinEditor(pin: DocumentPin, x: number, y: number) {
    setHoveredPin(null);
    setEditingPinId(pin.id);
    setPinNote(pin.note_text ?? "");
    setActivePinColor(pin.color ?? "red");
    setPinEditorPosition({ x, y });
    setIsPinEditorOpen(true);

    window.setTimeout(() => {
      pinTextareaRef.current?.focus();
      pinTextareaRef.current?.setSelectionRange(
        pinTextareaRef.current.value.length,
        pinTextareaRef.current.value.length
      );
    }, 0);
  }

  async function createPinAtOffsets(
    selectedTextValue: string,
    startOffset: number,
    endOffset: number,
    clientX: number,
    clientY: number
  ) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_text: selectedTextValue,
          start_offset: startOffset,
          end_offset: endOffset,
          color: activePinColor,
          note_text: ""
        })
      });

      const data = (await response.json()) as PinCreateResponse;

      if (!response.ok || (!data.pin && !data.pins)) {
        throw new Error(data.error ?? "Pin se nepodařilo uložit.");
      }

      if (data.pins) {
        setPins(data.pins);
      } else if (data.pin) {
        setPins((current) =>
          [...current, data.pin!].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        );
      }

      if (data.pin) {
        openPinEditor(data.pin, clientX, Math.max(12, clientY - 12));
      }
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Pin se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePin(pinId: string, noteText: string, color: string) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/document-pins/${pinId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: noteText, color })
      });

      const data = (await response.json()) as PinUpdateResponse;

      if (!response.ok || !data.pin) {
        throw new Error(data.error ?? "Pin se nepodařilo uložit.");
      }

      setPins((current) => current.map((pin) => (pin.id === pinId ? data.pin! : pin)));
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Pin se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePin(pinId: string) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/document-pins/${pinId}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Pin se nepodařilo smazat.");
      }

      setPins((current) => current.filter((pin) => pin.id !== pinId));
      closePinEditor();
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Pin se nepodařilo smazat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDocumentTextClick(event: React.MouseEvent<HTMLPreElement>) {
    if (!activeAnnotationTool || isSaving || isEditing) {
      return;
    }

    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }

    const offset = getTextOffsetFromPoint(event.clientX, event.clientY);

    if (offset === null) {
      return;
    }

    const sentenceRange = getSentenceRangeAtOffset(displayText, offset);

    if (!sentenceRange) {
      return;
    }

    if (activeAnnotationTool === "highlight") {
      await createAnnotationFromOffsets(
        "highlight",
        sentenceRange.selectedText,
        sentenceRange.startOffset,
        sentenceRange.endOffset,
        null,
        activeHighlightColor
      );
      return;
    }

    if (activeAnnotationTool === "erase") {
      await createAnnotationFromOffsets(
        "highlight",
        sentenceRange.selectedText,
        sentenceRange.startOffset,
        sentenceRange.endOffset,
        null,
        "transparent",
        true
      );
      return;
    }

    if (activeAnnotationTool === "note") {
      setNoteEditorPosition({ x: event.clientX, y: Math.max(12, event.clientY - 12) });
      const noteOffset = offset;
      await createAnnotationFromOffsets(
        "note",
        "Poznámka",
        noteOffset,
        noteOffset,
        "",
        activeNoteColor
      );
      return;
    }

    if (activeAnnotationTool === "pin") {
      await createPinAtOffsets(
        displayText.slice(offset, Math.min(displayText.length, offset + 1)) || " ",
        offset,
        offset,
        event.clientX,
        event.clientY
      );
    }
  }

  async function createAnnotation(
    annotationType: DocumentAnnotationType,
    noteText?: string | null,
    highlightColor?: string | null
  ) {
    const text = captureSelectedText();

    if (!text) {
      setError("Nejdřív označ text v dokumentu.");
      return;
    }

    const selectionOffsets = getSelectionOffsets();

    await createAnnotationFromOffsets(
      annotationType,
      text,
      selectionOffsets.startOffset,
      selectionOffsets.endOffset,
      noteText,
      highlightColor
    );
  }

  function closeNoteEditor() {
    if (editingAnnotationId && noteEditDraftRef.current) {
      const originalDraft = noteEditDraftRef.current;

      setAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === editingAnnotationId
            ? {
                ...annotation,
                note_text: originalDraft.noteText,
                highlight_color: originalDraft.color
              }
            : annotation
        )
      );

      setAnnotationNote(originalDraft.noteText);
      setActiveNoteColor(originalDraft.color);
    }

    noteEditDraftRef.current = null;
    setIsAnnotationNoteOpen(false);
    setEditingAnnotationId(null);
    setAnnotationNote("");
    setSelectedText("");
    setNoteEditorPosition(null);
    setIsNoteColorPaletteOpen(false);
  }

  function openExistingAnnotationNote(annotation: DocumentAnnotation) {
    setSelectedText(annotation.selected_text);
    setAnnotationNote(annotation.note_text ?? "");
    setEditingAnnotationId(annotation.id);
    setActiveNoteColor(annotation.highlight_color ?? "yellow");
    noteEditDraftRef.current = {
      noteText: annotation.note_text ?? "",
      color: annotation.highlight_color ?? "yellow"
    };
    setIsAnnotationNoteOpen(true);
  }

  async function updateAnnotationNote(annotationId: string, noteText: string) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/document-annotations/${annotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: noteText, highlight_color: activeNoteColor })
      });

      const data = (await response.json()) as AnnotationUpdateResponse;

      if (!response.ok || !data.annotation) {
        throw new Error(data.error ?? "Poznámku se nepodařilo uložit.");
      }

      setAnnotations((current) =>
        current.map((annotation) => (annotation.id === annotationId ? data.annotation! : annotation))
      );
      noteEditDraftRef.current = null;
      setAnnotationNote("");
      setSelectedText("");
      setEditingAnnotationId(null);
      setIsAnnotationNoteOpen(false);
      setNoteEditorPosition(null);
      setIsNoteColorPaletteOpen(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Poznámku se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAnnotation(annotationId: string) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/document-annotations/${annotationId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Anotaci se nepodařilo smazat.");
      }

      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    } catch (annotationError) {
      setError(annotationError instanceof Error ? annotationError.message : "Anotaci se nepodařilo smazat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleValidation() {
    const nextStatus = isValidated ? "pending_validation" : "validated";
    const updatedDocument = await patchDocument({ validation_status: nextStatus });

    if (updatedDocument?.validation_status === "validated") {
      setIsEditing(false);
    }
  }

  function handleOriginalDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;

    dragOffsetRef.current = {
      x: event.clientX - originalWindow.x,
      y: event.clientY - originalWindow.y
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOriginalDragMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    setOriginalWindow((current) => ({
      ...current,
      x: Math.max(8, event.clientX - dragOffsetRef.current.x),
      y: Math.max(8, event.clientY - dragOffsetRef.current.y)
    }));
  }

  function handleOriginalDragEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleOriginalResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();

    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: originalWindow.width,
      height: originalWindow.height
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOriginalResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const deltaX = event.clientX - resizeStartRef.current.x;
    const deltaY = event.clientY - resizeStartRef.current.y;

    setOriginalWindow((current) => ({
      ...current,
      width: Math.max(420, resizeStartRef.current.width + deltaX),
      height: Math.max(320, resizeStartRef.current.height + deltaY)
    }));
  }

  function handleOriginalResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function zoomOriginalWindow(delta: number) {
    setOriginalWindow((current) => ({
      ...current,
      zoom: Math.min(2, Math.max(0.5, Number((current.zoom + delta).toFixed(2))))
    }));
  }

  async function handleDocumentTextMouseUp() {
    if (!activeAnnotationTool || isSaving || isEditing) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
      return;
    }

    const selectionOffsets = getSelectionOffsets();

    if (
      !selectionOffsets.selectedText ||
      selectionOffsets.startOffset === null ||
      selectionOffsets.endOffset === null
    ) {
      return;
    }

    if (activeAnnotationTool === "highlight") {
      await createAnnotationFromOffsets(
        "highlight",
        selectionOffsets.selectedText,
        selectionOffsets.startOffset,
        selectionOffsets.endOffset,
        null,
        activeHighlightColor
      );
      return;
    }

    if (activeAnnotationTool === "erase") {
      await createAnnotationFromOffsets(
        "highlight",
        selectionOffsets.selectedText,
        selectionOffsets.startOffset,
        selectionOffsets.endOffset,
        null,
        "transparent"
      );
      return;
    }

    if (activeAnnotationTool === "note") {
      const selectionRange = selection.getRangeAt(0);
      const rect = selectionRange.getBoundingClientRect();
      setNoteEditorPosition({ x: rect.left, y: Math.max(12, rect.top - 12) });

      await createAnnotationFromOffsets(
        "note",
        selectionOffsets.selectedText,
        selectionOffsets.startOffset,
        selectionOffsets.endOffset,
        "",
        activeNoteColor
      );
      return;
    }

    if (activeAnnotationTool === "pin") {
      const selectionRange = selection.getRangeAt(0);
      const rect = selectionRange.getBoundingClientRect();

      await createPinAtOffsets(
        selectionOffsets.selectedText,
        selectionOffsets.startOffset,
        selectionOffsets.endOffset,
        rect.left,
        rect.top
      );
    }
  }

  function handleNoteEditorMoveStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    noteEditorDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: noteEditorPosition?.x ?? 120,
      startY: noteEditorPosition?.y ?? 120
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNoteEditorMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const deltaX = event.clientX - noteEditorDragRef.current.x;
    const deltaY = event.clientY - noteEditorDragRef.current.y;

    setNoteEditorPosition({
      x: Math.max(12, noteEditorDragRef.current.startX + deltaX),
      y: Math.max(12, noteEditorDragRef.current.startY + deltaY)
    });
  }

  function handleNoteEditorMoveEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDocumentRootPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!isAnnotationNoteOpen && !isPinEditorOpen) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest(".document-note-floating-editor, .document-note-marker, .document-pin-floating-editor, .document-pin-marker")) {
      return;
    }

    closeNoteEditor();
    closePinEditor();
    setHoveredPin(null);
  }

  function resizeNoteTextarea() {
    const textarea = noteTextareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.rows = Math.max(1, textarea.value.split("\n").length);
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  async function handleDeleteDocument() {
    const confirmed = window.confirm(
      `Smazat dokument?\n\n${currentDocument.filename}\n\nBude odstraněn originál, zpracovaný text a budoucí anotace. Tuto akci nelze vrátit.`
    );

    if (!confirmed) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Dokument se nepodařilo smazat.");
      }

      window.location.reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Dokument se nepodařilo smazat.");
      setIsSaving(false);
    }
  }

  return (
    <article
      className={`document-view-panel${isFullscreen ? " document-view-panel-fullscreen" : ""}`}
      aria-labelledby="document-view-title"
      onPointerDown={handleDocumentRootPointerDown}
    >
      <div className="document-view-header">
        <div className="document-title-row document-review-title-row">
          <div className="document-title-meta">
            <h2 id="document-view-title">{currentDocument.filename}</h2>
            <span className="document-upload-date">Dokument nahrán {formatDate(currentDocument.created_at)}</span>
          </div>

          <div className="document-main-actions" aria-label="Akce dokumentu">
            <button
              aria-pressed={isFullscreen}
              className={`document-icon-action${isFullscreen ? " active" : ""}`}
              onClick={() => setIsFullscreen((current) => !current)}
              title="Zobrazit obsah na celou obrazovku"
              type="button"
            >
              <Maximize2 aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              aria-pressed={isEditing}
              className={`document-icon-action${isEditing ? " active" : ""}`}
              disabled={isValidated || isSaving}
              onClick={() => setIsEditing((current) => !current)}
              title={isValidated ? "Validovaný text je zamčený" : "Editovat zpracovaný text"}
              type="button"
            >
              <SquarePen aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              aria-pressed={isOriginalVisible}
              className={`document-icon-action${isOriginalVisible ? " active" : ""}`}
              onClick={() => setIsOriginalVisible((current) => !current)}
              title="Zobrazit originál"
              type="button"
            >
              <Eye aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              className="document-icon-action danger"
              disabled={isSaving}
              onClick={handleDeleteDocument}
              title="Smazat dokument"
              type="button"
            >
              <Trash2 aria-hidden="true" className="document-action-icon" />
            </button>

            <div className="document-validation-control">
              <button
                aria-label={isValidated ? "Schváleno" : "Čeká na schválení"}
                className={`document-validation-icon-button ${isValidated ? "validated" : "pending"}`}
                disabled={isSaving}
                onClick={handleToggleValidation}
                title={isValidated ? "Vrátit do stavu čeká na schválení" : "Schválit zpracovaný text"}
                type="button"
              >
                {isValidated ? (
                  <CircleCheck aria-hidden="true" className="document-action-icon" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="document-action-icon" />
                )}
              </button>
              {!isValidated ? <span className="document-validation-floating-label">Čeká na schválení</span> : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="status-message error-message document-review-error">{error}</p> : null}

      {currentDocument.processing_error ? (
        <p className="status-message error-message document-review-error">
          Normalizace dokumentu selhala: {currentDocument.processing_error}
        </p>
      ) : null}

      {isOriginalVisible ? (
        <div
          className="document-original-overlay"
          role="dialog"
          aria-label="Originál dokumentu"
          style={{
            left: originalWindow.x,
            top: originalWindow.y,
            width: originalWindow.width,
            height: originalWindow.height
          }}
        >
          <div
            className="document-original-overlay-header"
            onPointerDown={handleOriginalDragStart}
            onPointerMove={handleOriginalDragMove}
            onPointerUp={handleOriginalDragEnd}
            onPointerCancel={handleOriginalDragEnd}
          >
            <strong>Originál: {currentDocument.filename}</strong>
            <div className="document-original-window-controls">
              {currentDocument.filetype !== "pdf" ? (
                <>
                  <button type="button" onClick={() => zoomOriginalWindow(-0.1)}>− zoom</button>
                  <button type="button" onClick={() => zoomOriginalWindow(0.1)}>+ zoom</button>
                  <span>{Math.round(originalWindow.zoom * 100)}%</span>
                </>
              ) : (
                <span>Zoom použij v PDF toolbaru</span>
              )}
              <button className="secondary-action" onClick={() => setIsOriginalVisible(false)} type="button">
                Zavřít
              </button>
            </div>
          </div>

          {currentDocument.filetype === "pdf" ? (
            <object
              className="document-original-frame"
              data={`/api/documents/${currentDocument.id}/original#toolbar=1&navpanes=0&zoom=${Math.round(originalWindow.zoom * 100)}`}
              type="application/pdf"
            >
              <div className="document-original-download">
                <p>PDF se nepodařilo zobrazit přímo.</p>
                <a
                  className="primary-action"
                  href={`/api/documents/${currentDocument.id}/original`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Otevřít PDF v nové kartě
                </a>
              </div>
            </object>
          ) : ["txt", "md", "jpg", "jpeg", "png"].includes(currentDocument.filetype) ? (
            <iframe
              className="document-original-frame"
              style={{
                transform: `scale(${originalWindow.zoom})`,
                transformOrigin: "top left",
                width: `${100 / originalWindow.zoom}%`,
                height: `${100 / originalWindow.zoom}%`
              }}
              src={`/api/documents/${currentDocument.id}/original`}
              title={`Originál dokumentu ${currentDocument.filename}`}
            />
          ) : ["docx", "rtf"].includes(currentDocument.filetype) ? (
            <div className="document-original-docx-preview">
              <div className="document-original-docx-preview-note">
                Tento formát nejde v prohlížeči spolehlivě zobrazit jako skutečný originál. Zde je normalizovaný text pro rychlé porovnání.
                <a
                  href={`/api/documents/${currentDocument.id}/original`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Otevřít skutečný originál
                </a>
              </div>
              {displayText.trim().length > 0 ? (
                <pre
                  className="document-original-docx-preview-text"
                  style={{
                    transform: `scale(${originalWindow.zoom})`,
                    transformOrigin: "top left",
                    width: `${100 / originalWindow.zoom}%`
                  }}
                >
                  {displayText}
                </pre>
              ) : (
                <div className="document-original-docx-preview-empty">
                  Normalizovaný text není k dispozici. Otevři skutečný originál v nové kartě.
                </div>
              )}
            </div>
          ) : (
            <div className="document-original-download">
              <p>Náhled tohoto typu souboru prohlížeč nemusí umět zobrazit přímo.</p>
              <a
                className="primary-action"
                href={`/api/documents/${currentDocument.id}/original`}
                rel="noreferrer"
                target="_blank"
              >
                Otevřít originál v nové kartě
              </a>
            </div>
          )}

          <div
            aria-hidden="true"
            className="document-original-resize-handle"
            onPointerDown={handleOriginalResizeStart}
            onPointerMove={handleOriginalResizeMove}
            onPointerUp={handleOriginalResizeEnd}
            onPointerCancel={handleOriginalResizeEnd}
          />
        </div>
      ) : null}

      <section className="document-view-section document-content-section" aria-label="Obsah dokumentu">
        <div className="document-annotation-toolbar" aria-label="Anotace dokumentu">
          {activeAnnotationTool ? (
            <div className="document-tool-color-rail" aria-label="Barvy aktivního nástroje">
              {(activeAnnotationTool === "pin" ? pinColors : highlightColors).map((color) => {
                const activeColor =
                  activeAnnotationTool === "pin"
                    ? activePinColor
                    : activeAnnotationTool === "note"
                      ? activeNoteColor
                      : activeHighlightColor;

                return (
                  <button
                    aria-label={color.label}
                    className={`document-tool-color-button${activeColor === color.value ? " active" : ""}`}
                    key={color.value}
                    onClick={() => {
                      if (activeAnnotationTool === "pin") {
                        setActivePinColor(color.value);
                      } else if (activeAnnotationTool === "note") {
                        setActiveNoteColor(color.value);
                      } else {
                        setActiveHighlightColor(color.value);
                      }
                    }}
                    style={{
                      backgroundColor:
                        "css" in color && color.css === "transparent" ? "white" : color.css
                    }}
                    title={color.label}
                    type="button"
                  />
                );
              })}
            </div>
          ) : null}

          <div className="document-highlight-tool">
            <button
              className={activeAnnotationTool === "highlight" ? "active" : ""}
              disabled={isSaving}
              onClick={() => {
                const text = captureSelectedText();

                if (text) {
                  void createAnnotation("highlight", null, activeHighlightColor);
                  return;
                }

                setError(null);
                setIsHighlightPaletteOpen(false);
                setActiveAnnotationTool((current) => current === "highlight" ? null : "highlight");
              }}
              title="Zapnout/vypnout zvýrazňování"
              type="button"
            >
              <Highlighter aria-hidden="true" className="document-mini-icon" />
            </button>
          </div>
          <button
            className={activeAnnotationTool === "note" ? "active" : ""}
            disabled={isSaving}
            onClick={() => {
              const text = captureSelectedText();
              if (text) {
                void createAnnotation("note", "", activeNoteColor);
                return;
              }

              setError(null);
              setIsHighlightPaletteOpen(false);
              setActiveAnnotationTool((current) => current === "note" ? null : "note");
            }}
            title="Zapnout/vypnout poznámkování"
            type="button"
          >
            <MessageCircle aria-hidden="true" className="document-mini-icon" />
          </button>
          <button
            className={activeAnnotationTool === "pin" ? "active" : ""}
            disabled={isSaving}
            onClick={() => {
              setError(null);
              setIsHighlightPaletteOpen(false);
              setActiveAnnotationTool((current) => current === "pin" ? null : "pin");
            }}
            title="Zapnout/vypnout špendlík"
            type="button"
          >
            <Pin aria-hidden="true" className="document-mini-icon" />
          </button>
          <button
            className={activeAnnotationTool === "erase" ? "active" : ""}
            disabled={isSaving}
            onClick={() => {
              setError(null);
              setIsHighlightPaletteOpen(false);
              setActiveAnnotationTool((current) => current === "erase" ? null : "erase");
            }}
            title="Zapnout/vypnout gumu"
            type="button"
          >
            <Eraser aria-hidden="true" className="document-mini-icon" />
          </button>
        </div>

        {isAnnotationNoteOpen ? (
          <div
            className="document-note-floating-editor"
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: noteEditorPosition?.x ?? 120,
              top: noteEditorPosition?.y ?? 120,
              transform: "translateY(-100%)",
              "--note-color": getNoteCssColor(activeNoteColor)
            } as React.CSSProperties}
          >
            <div className="document-note-floating-content">
              <strong>{editingAnnotationId ? "Upravit poznámku" : "Nová poznámka"}</strong>
              <textarea
                ref={noteTextareaRef}
                aria-label="Text poznámky"
                onChange={(event) => {
                  setAnnotationNote(event.target.value);
                }}
                placeholder="Napiš poznámku…"
                rows={Math.max(1, annotationNote.split("\n").length)}
                value={annotationNote}
              />
            </div>

            <div className="document-note-floating-actions" aria-label="Akce poznámky">
              <button
                aria-label="Barva poznámky"
                onClick={() => setIsNoteColorPaletteOpen((current) => !current)}
                title="Barva"
                type="button"
              >
                <Palette aria-hidden="true" className="document-mini-icon" />
              </button>

              <button
                aria-label="Přesunout poznámku"
                onPointerDown={handleNoteEditorMoveStart}
                onPointerMove={handleNoteEditorMove}
                onPointerUp={handleNoteEditorMoveEnd}
                onPointerCancel={handleNoteEditorMoveEnd}
                title="Přesunout"
                type="button"
              >
                <Move aria-hidden="true" className="document-mini-icon" />
              </button>

              <button
                aria-label="Potvrdit"
                disabled={isSaving}
                onClick={() => {
                  if (editingAnnotationId) {
                    void updateAnnotationNote(editingAnnotationId, annotationNote);
                  } else {
                    void createAnnotation("note", annotationNote, activeNoteColor);
                  }
                }}
                title="Potvrdit"
                type="button"
              >
                <Check aria-hidden="true" className="document-mini-icon" />
              </button>

              <div className="document-note-floating-spacer" />

              {editingAnnotationId ? (
                <button
                  aria-label="Smazat poznámku"
                  className="danger"
                  disabled={isSaving}
                  onClick={() => {
                    void deleteAnnotation(editingAnnotationId);
                    setIsAnnotationNoteOpen(false);
                    setEditingAnnotationId(null);
                    setAnnotationNote("");
                    setNoteEditorPosition(null);
                    setIsNoteColorPaletteOpen(false);
                  }}
                  title="Smazat"
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="document-mini-icon" />
                </button>
              ) : null}
            </div>

            {isNoteColorPaletteOpen ? (
              <div className="document-note-floating-color-panel">
                {highlightColors.map((color) => (
                  <button
                    aria-label={color.label}
                    className={`document-tool-color-button${activeNoteColor === color.value ? " active" : ""}`}
                    key={color.value}
                    onClick={() => {
                      setActiveNoteColor(color.value);

                      if (editingAnnotationId) {
                        setAnnotations((current) =>
                          current.map((annotation) =>
                            annotation.id === editingAnnotationId
                              ? { ...annotation, highlight_color: color.value }
                              : annotation
                          )
                        );
                      }

                      setIsNoteColorPaletteOpen(false);
                    }}
                    style={{ backgroundColor: color.css === "transparent" ? "white" : color.css }}
                    title={color.label}
                    type="button"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {isEditing ? (
          <div className="document-edit-shell">
            <textarea
              aria-label="Zpracovaný text dokumentu"
              className="document-text-editor"
              disabled={isSaving}
              onChange={(event) => setDraftText(event.target.value)}
              value={draftText}
            />
            <div className="document-edit-actions">
              <button
                className="secondary-action"
                disabled={isSaving}
                onClick={() => {
                  setDraftText(displayText);
                  setIsEditing(false);
                }}
                type="button"
              >
                Zrušit
              </button>
              <button className="primary-action" disabled={isSaving} onClick={handleSaveText} type="button">
                {isSaving ? "Ukládám…" : "Uložit text"}
              </button>
            </div>
          </div>
        ) : displayText.trim().length > 0 ? (
          <div className={`document-text-pin-shell${isPinDragging ? " pin-dragging" : ""}`} ref={documentTextShellRef}>
          <pre
            ref={documentTextRef}
            className={`document-extracted-text${activeAnnotationTool ? ` sentence-tool-mode sentence-tool-${activeAnnotationTool}` : ""}`}
            onClick={(event) => {
              void handleDocumentTextClick(event);
            }}
            onScroll={measurePinPositions}
            onMouseUp={() => {
              window.setTimeout(() => {
                void handleDocumentTextMouseUp();
              }, 0);
            }}
          >
            {renderedDisplayText}
          </pre>
          <div className="document-pin-layer" aria-label="Piny dokumentu">
            {orderedPins.map((pin) => (
              <button
                className="document-pin-marker"
                key={pin.id}
                onPointerDown={(event) => {
                  event.stopPropagation();

                  if (isPinEditorOpen && editingPinId !== pin.id) {
                    closePinEditor();
                    setHoveredPin(null);
                  }

                  dragPinRef.current = {
                    pinId: pin.id,
                    lastOffset: pin.visual_offset ?? pin.start_offset,
                    lastBoxPosition: null,
                    pendingPoint: null,
                    marker: event.currentTarget,
                    initialMarkerTop: event.currentTarget.style.top,
                    didMove: false
                  };
                  setIsPinDragging(true);
                  window.getSelection()?.removeAllRanges();

                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (dragPinRef.current.pinId !== pin.id) {
                    return;
                  }

                  scheduleDraggedPinPosition(event.clientX, event.clientY);
                }}
                onPointerUp={async (event) => {
                  if (dragPinRef.current.pinId !== pin.id) {
                    return;
                  }

                  event.stopPropagation();
                  flushDraggedPinPosition();

                  const didMove = dragPinRef.current.didMove;
                  const finalOffset = dragPinRef.current.lastOffset;
                  const finalBoxPosition = dragPinRef.current.lastBoxPosition;

                  dragPinRef.current = {
                    pinId: null,
                    lastOffset: null,
                    lastBoxPosition: null,
                    pendingPoint: null,
                    marker: null,
                    initialMarkerTop: "",
                    didMove: false
                  };

                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }

                  if (didMove && finalOffset !== null) {
                    suppressPinClickRef.current = true;

                    window.setTimeout(() => {
                      suppressPinClickRef.current = false;
                    }, 120);

                    if (finalBoxPosition && isPinEditorOpen && editingPinId === pin.id) {
                      setPinEditorPosition(finalBoxPosition);
                    }

                    if (finalBoxPosition) {
                      setHoveredPin((current) =>
                        current?.pin.id === pin.id ? { ...current, ...finalBoxPosition } : current
                      );
                    }

                    await movePinToOffset(pin.id, finalOffset);
                  }

                  setIsPinDragging(false);
                }}
                onPointerCancel={(event) => {
                  cancelDraggedPinPosition();
                  dragPinRef.current = {
                    pinId: null,
                    lastOffset: null,
                    lastBoxPosition: null,
                    pendingPoint: null,
                    marker: null,
                    initialMarkerTop: "",
                    didMove: false
                  };

                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }

                  setIsPinDragging(false);
                }}
                
                onClick={(event) => {
                  if (suppressPinClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }

                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoveredPin(null);
                  openPinEditor(pin, rect.right + 12, rect.top);
                }}
                onMouseEnter={(event) => {
                  if (isPinEditorOpen) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoveredPin({ pin, x: rect.right + 12, y: rect.top });
                }}
                onMouseLeave={() => setHoveredPin(null)}
                style={{
                  "--pin-color": getPinCssColor(pin.color),
                  top: `${pinPositions[pin.id] ?? -9999}px`,
                  visibility: pinPositions[pin.id] === undefined ? "hidden" : "visible"
                } as React.CSSProperties}
                title={pin.note_text?.trim() || "Pin dokumentu"}
                type="button"
              >
                <Bookmark aria-hidden="true" className="document-pin-icon" />
                <span className="document-pin-index">{getPinNumber(pin)}</span>
              </button>
            ))}
          </div>
          </div>
        ) : (
          <p className="panel-note">Zpracovaný text pro tento dokument není k dispozici.</p>
        )}

        {/* Annotation cards are intentionally hidden. Highlights, notes and pins stay contextual in the document only. */}
      </section>


      {isPinEditorOpen && editingPinId ? (
        <div
          className="document-pin-floating-editor"
          ref={pinEditorRef}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            left: pinEditorPosition?.x ?? 240,
            top: pinEditorPosition?.y ?? 120,
            "--pin-color": getPinCssColor(activePinColor)
          } as React.CSSProperties}
        >
          <div className="document-pin-editor-toolbar" aria-label="Akce pinu">
            <div className="document-pin-editor-colors">
              {pinColors.map((color) => (
                <button
                  aria-label={color.label}
                  className={`document-tool-color-button${activePinColor === color.value ? " active" : ""}`}
                  key={color.value}
                  onClick={() => {
                    setActivePinColor(color.value);
                    setPins((current) =>
                      current.map((pin) =>
                        pin.id === editingPinId ? { ...pin, color: color.value } : pin
                      )
                    );
                    void updatePin(editingPinId, pinNote, color.value);
                  }}
                  style={{ backgroundColor: color.css }}
                  title={color.label}
                  type="button"
                />
              ))}
            </div>

            <button
              aria-label="Smazat pin"
              className="document-pin-delete-button"
              disabled={isSaving}
              onClick={() => void deletePin(editingPinId)}
              title="Smazat pin"
              type="button"
            >
              <Trash2 aria-hidden="true" className="document-mini-icon" />
            </button>
          </div>

          <div className="document-pin-floating-content">
            <strong>Pin {getPinNumber(pins.find((pin) => pin.id === editingPinId)!)}</strong>
            <textarea
              ref={pinTextareaRef}
              aria-label="Krátký popis pinu"
              onBlur={() => {
                if (editingPinId) {
                  void updatePin(editingPinId, pinNote, activePinColor);
                }
              }}
              onChange={(event) => {
                setPinNote(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void updatePin(editingPinId, pinNote, activePinColor);
                  closePinEditor();
                }
              }}
              placeholder="Krátký popis pro zápisník…"
              rows={Math.max(1, pinNote.split("\n").length)}
              value={pinNote}
            />
          </div>
        </div>
      ) : null}

      {hoveredPin && !isPinEditorOpen ? (
        <div
          className="document-pin-hover-box"
          ref={hoveredPinRef}
          style={{
            left: hoveredPin.x,
            top: hoveredPin.y,
            "--pin-color": getPinCssColor(hoveredPin.pin.color)
          } as React.CSSProperties}
        >
          <strong>Pin {getPinNumber(hoveredPin.pin)}</strong>
          <p>{hoveredPin.pin.note_text?.trim() || "Bez popisu"}</p>
        </div>
      ) : null}

      {hoveredNote ? (
        <div
          className="document-note-hover-box"
          style={{
            left: hoveredNote.x,
            top: hoveredNote.y,
            transform: "translateY(-100%)",
            "--note-color": getNoteCssColor(hoveredNote.annotation.highlight_color)
          } as React.CSSProperties}
        >
          <strong>Poznámka</strong>
          <p>{hoveredNote.annotation.note_text?.trim() || "Prázdná poznámka"}</p>
        </div>
      ) : null}
    </article>
  );
}
