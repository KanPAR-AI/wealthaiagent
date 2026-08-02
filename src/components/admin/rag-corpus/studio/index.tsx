// Corpus Studio — the shell that routes between the screens (docs/25).
//
// One component owns "where am I", so the back button, the breadcrumb and the
// tab state cannot disagree. The old Corpus tab stacked every panel vertically,
// which is why "am I looking at a video or a corpus?" had no answer.

import { useState } from "react";

import { VideoLibraryPanel } from "../video-library-panel";
import { AssetDetailView } from "./asset-detail";
import { StudioHome } from "./dashboard";

type View =
  | { screen: "home" }
  | { screen: "corpus"; corpusId: string }
  | { screen: "asset"; corpusId: string; source: string };

export function CorpusStudio() {
  const [view, setView] = useState<View>({ screen: "home" });

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
