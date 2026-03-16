// src/pages/TestChat.tsx
// Admin test chat page — wraps ChatWindow with agent pre-selection
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatWindow from "@/components/chat/chat-window";

export default function TestChat() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [chatId, setChatId] = useState<string | undefined>(undefined);

  if (!agentId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No agent selected.</p>
      </div>
    );
  }

  // The contextPrompt leverages the existing CONTEXT_MARKERS mechanism in the orchestrator
  // to force routing to the specified agent
  const contextPrompt = `[Using ${agentId} agent]`;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <Link
              to="/admin"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Admin
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-muted-foreground" />
              <h1 className="text-sm font-semibold">
                Test Chat: <span className="text-primary capitalize">{agentId.replace(/_/g, " ")}</span>
              </h1>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setChatId(undefined);
            }}
          >
            New Test
          </Button>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatWindow
          key={chatId || "new"}
          chatId={chatId}
          contextPrompt={contextPrompt}
          onNewChatCreated={(newChatId) => {
            setChatId(newChatId);
            navigate(`/admin/test/${agentId}`, { replace: true });
          }}
        />
      </div>
    </div>
  );
}
