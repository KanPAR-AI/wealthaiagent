// Corpus Studio — the shell that routes between the screens (docs/25).
//
// One component owns "where am I", so the back button, the breadcrumb and the
// tab state cannot disagree. The old Corpus tab stacked every panel vertically,
// which is why "am I looking at a video or a corpus?" had no answer.
//
// The rail owns the second axis: which SECTION of the studio, independent of
// how deep you are inside a corpus. Going Corpora → a corpus → an asset →
// Templates → back lands on the corpus you left, because the two are separate
// pieces of state rather than one stack.

import { useState } from "react";

import { VideoLibraryPanel } from "../video-library-panel";
import { AssetDetailView } from "./asset-detail";
import { StudioHome } from "./dashboard";
import { NotBuilt, StudioRail, type RailSection } from "./rail";
import { TemplatesPanel } from "./templates";

type View =
  | { screen: "home" }
  | { screen: "corpus"; corpusId: string }
  | { screen: "asset"; corpusId: string; source: string };

export function CorpusStudio() {
  const [section, setSection] = useState<RailSection>("corpora");
  const [view, setView] = useState<View>({ screen: "home" });

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <StudioRail active={section} onSelect={setSection} />
      <div className="min-w-0 flex-1">
        {section === "corpora" && <CorporaSection view={view} setView={setView} />}
        {section === "templates" && (
          <TemplatesPanel
            onUse={() => {
              // A template seeds a NEW corpus, so it hands off to the same
              // create flow the dashboard's "+ New corpus" uses rather than
              // opening a second one that would drift from it.
              setSection("corpora");
              setView({ screen: "corpus", corpusId: "" });
            }}
          />
        )}
        {(section === "analytics" || section === "playground") && (
          <NotBuilt section={section} />
        )}
      </div>
    </div>
  );
}

function CorporaSection({
  view,
  setView,
}: {
  view: View;
  setView: (v: View) => void;
}) {
  if (view.screen === "home") {
    return (
      <StudioHome
        onOpenCorpus={(corpusId) => setView({ screen: "corpus", corpusId })}
        onCreate={() => setView({ screen: "corpus", corpusId: "" })}
      />
    );
  }

  if (view.screen === "asset") {
    return (
      <AssetDetailView
        corpusId={view.corpusId}
        source={view.source}
        onBack={() => setView({ screen: "corpus", corpusId: view.corpusId })}
      />
    );
  }

  // The corpus workspace still uses the existing panel stack. It is the one
  // screen the mockup does not specify, and rewriting a working surface to
  // match a screen nobody drew would be redesigning by guess.
  return (
    <VideoLibraryPanel
      agentId={view.corpusId}
      onBackToStudio={() => setView({ screen: "home" })}
      onOpenAsset={(source) =>
        setView({ screen: "asset", corpusId: view.corpusId || "knee", source })
      }
    />
  );
}
