// pages/index.jsx
import ChatSidebar from "@/components/molecules/chat-sidebar"
import ChatWindow from "@/components/molecules/chat-window"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function Home() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ChatSidebar />
        <ChatWindow />
      </div>
    </SidebarProvider>
  )
}