import Logo from "../ui/logo";
import { SidebarTrigger } from "../ui/sidebar";
import { PromptInputWithActions } from "./chat-input"

export default function ChatWindow() {
  // Define suggestion tiles data
  const suggestionTiles = [
    { id: 1, title: "Help me write", description: "Generate content or brainstorm ideas" },
    { id: 2, title: "Answer questions", description: "Get assistance with any topic" },
    { id: 3, title: "Summarize text", description: "Condense long documents" },
    { id: 4, title: "Code assistance", description: "Debug or create new code" }
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="sticky top-0 z-10 flex h-16 items-center border-b bg-background px-4">
        <SidebarTrigger className="mr-2" />
        <Logo />
      </div>
      <div className="p-6 flex-1 w-full flex flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Select or create a chat</h1>
            <p className="text-muted-foreground">Choose from your recent chats or start a new conversation</p>
          </div>
        </div>
        <div className="w-full max-w-3xl mx-auto">
          {/* Suggestion Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {suggestionTiles.map((tile) => (
              <button
                key={tile.id}
                className="bg-secondary/50 hover:bg-secondary/80 hover:cursor-pointer rounded-lg p-3 text-left transition-colors border border-blue-100"
              >
                <h3 className="font-medium text-sm">{tile.title}</h3>
                <p className="text-xs text-muted-foreground ">{tile.description}</p>
              </button>
            ))}
          </div>
          {/* Prompt Input */}
          <div className="w-full">
            <PromptInputWithActions />
          </div>
        </div>
      </div>
    </div>
  );
}