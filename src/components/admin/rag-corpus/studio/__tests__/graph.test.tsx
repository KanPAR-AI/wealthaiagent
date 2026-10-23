// The debugging graph: every chapter on the strip (missing ones marked), the
// ladder for the chosen chapter, the note on the selected node, gaps named.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CorpusGraphView } from "../graph";

const fetchCorpusGraph = jest.fn();
jest.mock("@/services/corpus-video-service", () => ({
  fetchCorpusGraph: (...a: unknown[]) => fetchCorpusGraph(...a),
}));

const G = {
  corpus_id: "gita",
  counts: { talks: 2, passages: 3, chapters: 1, verses: 2, talk_notes: 1, verse_notes: 1, chapter_notes: 1, minutes: 35 },
  chapters: [
    { chapter: 1, present: false, talks: [], verses: [], verse_max: 0, note: null },
    { chapter: 2, present: true, title: "Chapter 2 — Series", talks: ["s35", "s36"], verse_max: 2, note: { text: "ch2 overview", chars: 12 },
      verses: [{ verse: 1, ref: "2.1", talks: [], note: null }, { verse: 2, ref: "2.2", talks: ["s35", "s36"], note: { text: "note on 2.2", chars: 11, model: "pro#p2" } }],
      coverage: { verses_with_talk: 1, verses_with_note: 1, talks: 2, talks_with_note: 1, minutes: 35 } },
  ],
  talks: {
    s35: { source: "s35", title: "Talk 35", chapter: 2, talk: 35, verses: [2], spans: [], placed_by: "title", passages: 2, duration_s: 1200, language: "hi", url: "https://youtu.be/s35", video_id: "s35", content_sha: "a", note: { text: "talk 35 note", chars: 12 } },
    s36: { source: "s36", title: "Talk 36", chapter: 2, talk: 36, verses: [2], spans: [{ verse: 2, start_s: 65, end_s: null }], placed_by: "transcript", passages: 1, duration_s: 900, language: "hi", url: "https://youtu.be/s36", video_id: "s36", content_sha: "b", note: null },
  },
  gaps: { chapters_missing: [1], verses_without_talk: ["2.1"], verses_without_note: [], talks_without_note: ["s36"], talks_without_canon: [], talks_without_verses: [], chapters_without_note: [] },
};

beforeEach(() => { fetchCorpusGraph.mockReset(); fetchCorpusGraph.mockResolvedValue(G); });

test("every chapter is on the strip, a missing one marked, and the first present one opens", async () => {
  render(<CorpusGraphView corpusId="gita" onBack={() => {}} />);
  await waitFor(() => expect(screen.getByTestId("chapter-strip")).toBeInTheDocument());
  expect(fetchCorpusGraph).toHaveBeenCalledWith("gita", 18);
  expect(screen.getByTestId("chapter-1")).toHaveTextContent("none");
  expect(screen.getByTestId("chapter-2")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("ladder")).toBeInTheDocument();
  expect(screen.getByTestId("verse-2.2")).toBeInTheDocument();
  expect(screen.getByTestId("talk-s36")).toBeInTheDocument();
});

test("clicking a verse shows its note and the talks that take it up; a talk shows its own", async () => {
  render(<CorpusGraphView corpusId="gita" onBack={() => {}} />);
  await waitFor(() => screen.getByTestId("verse-2.2"));
  fireEvent.click(screen.getByTestId("verse-2.2"));
  expect(screen.getByTestId("note-text")).toHaveTextContent("note on 2.2");
  expect(screen.getByText("Talk 36 @ 1:05")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("talk-s36"));
  expect(screen.getByTestId("node-panel")).toHaveTextContent("placed by transcript");
  expect(screen.getByTestId("note-empty")).toHaveTextContent("No talk note yet.");
  fireEvent.click(screen.getByTestId("verse-2.1"));
  expect(screen.getByText("no talk takes this verse up")).toBeInTheDocument();
});

test("gaps are listed by name and jump to the node", async () => {
  render(<CorpusGraphView corpusId="gita" onBack={() => {}} />);
  await waitFor(() => screen.getByTestId("gaps"));
  expect(screen.getByText("verses without talk · 1")).toBeInTheDocument();
  fireEvent.click(screen.getByText("verses without talk · 1"));
  fireEvent.click(screen.getByText("2.1"));
  expect(screen.getByTestId("node-panel")).toHaveTextContent("Verse 2.1");
  fireEvent.change(screen.getByTestId("jump-input"), { target: { value: "2.2" } });
  fireEvent.click(screen.getByTestId("jump"));
  expect(screen.getByTestId("note-text")).toHaveTextContent("note on 2.2");
});
