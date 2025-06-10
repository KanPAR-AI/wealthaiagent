import { SignedIn, UserButton, useUser } from "@clerk/clerk-react";
import {
  History,
  MessageSquareText, 
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom"; 
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar, 
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from "@/components/ui/sidebar"; 
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { Chat } from "@/types/chat";

// Define props for the Sidebar component
interface SidebarProps {
  currentChatId?: string;
}

// --- Mock Data (Replace with API calls) ---
const initialChats: Chat[] = [
  { id: "chat_1", title: "Project brainstorming", date: "2h ago", isFavorite: false },
  { id: "chat_2", title: "Marketing strategy", date: "5h ago", isFavorite: true },
  { id: "chat_3", title: "Website redesign ideas", date: "Yesterday", isFavorite: false },
  { id: "chat_4", title: "Product roadmap", date: "2 days ago", isFavorite: false },
  { id: "chat_5", title: "Content calendar", date: "3 days ago", isFavorite: false },
  { id: "chat_6", title: "Research summary", date: "Apr 15", isFavorite: true },
  { id: "chat_7", title: "Quarterly goals", date: "Mar 28", isFavorite: true },
  { id: "chat_8", title: "Competitor Analysis", date: "May 01", isFavorite: false },
  { id: "chat_9", title: "User Interview Notes", date: "May 03", isFavorite: false },

];
// --- End Mock Data ---

// Rename component to Sidebar and accept props
export default function ChatSidebar({ currentChatId }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>(initialChats); // State to hold chats
  const [isLoading, setIsLoading] = useState(false); // Loading state for chats
  const navigate = useNavigate(); // Hook for navigation actions
  const { user } = useUser(); // Get user info if needed elsewhere

  // --- Data Fetching Simulation ---
  useEffect(() => {
    setIsLoading(true);
    // TODO: Replace with actual API call to fetch user's chats
    console.log("Fetching chat history...");
    setTimeout(() => {
      // In a real app, you'd fetch based on the logged-in user
      setChats(initialChats);
      setIsLoading(false);
      console.log("Chat history loaded.");
    }, 1000); // Simulate network delay
  }, []); // Runs once on mount
  // --- End Data Fetching Simulation ---

  // --- Filtering Logic ---
  const filteredChats = useMemo(() => {
    if (!searchQuery) {
      return chats;
    }
    return chats.filter((chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [chats, searchQuery]);

  const favoriteChats = useMemo(() => {
      return filteredChats.filter(chat => chat.isFavorite);
  }, [filteredChats]);

  const recentChats = useMemo(() => {
       // Show non-favorites in recent, or all if search is active
      return filteredChats.filter(chat => !chat.isFavorite || searchQuery);
      // Add sorting by date if available/needed
  }, [filteredChats, searchQuery]);
  // --- End Filtering Logic ---

  // --- Action Handlers ---
  const handleRenameChat = (chatId: string) => {
      const newTitle = prompt("Enter new chat title:", chats.find(c => c.id === chatId)?.title);
      if (newTitle && newTitle.trim() !== "") {
          console.log(`Renaming chat ${chatId} to "${newTitle}"`);
          // TODO: Call API to rename chat
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim() } : c));
      }
  };

  const handleDeleteChat = (chatId: string) => {
      if (window.confirm("Are you sure you want to delete this chat?")) {
          console.log(`Deleting chat ${chatId}`);
          // TODO: Call API to delete chat
          setChats(prev => prev.filter(c => c.id !== chatId));
          // Optional: Navigate away if deleting the current chat
          if (currentChatId === chatId) {
              navigate("/new", { replace: true });
          }
      }
  };

  const handleToggleFavorite = (chatId: string) => {
      console.log(`Toggling favorite for chat ${chatId}`);
      // TODO: Call API to update favorite status
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, isFavorite: !c.isFavorite } : c));
  };
  // --- End Action Handlers ---


  const renderChatMenuItem = (chat: Chat) => (
     <SidebarMenuItem key={chat.id}>
        {/* Link wraps the button content */}
        <Link to={`/chat/${chat.id}`} className="flex-grow overflow-hidden">
           <SidebarMenuButton
              tooltip={chat.title}
              isActive={currentChatId === chat.id} // Highlight active chat
              className="w-full" // Ensure button takes full width within Link
           >
              {/* Use a consistent chat icon */}
              <MessageSquareText size={16} className="flex-shrink-0" />
              <span className="truncate">{chat.title}</span> {/* Ensure text truncates */}
           </SidebarMenuButton>
        </Link>

        {/* Dropdown for actions */}
        <DropdownMenu>
           <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover aria-label={`Actions for ${chat.title}`}>
                 <MoreHorizontal size={16} />
              </SidebarMenuAction>
           </DropdownMenuTrigger>
           <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={() => handleRenameChat(chat.id)}>
                 Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleFavorite(chat.id)}>
                 {chat.isFavorite ? "Remove from favorites" : "Add to favorites"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                 className="text-red-600 focus:text-red-700 focus:bg-red-50"
                 onClick={() => handleDeleteChat(chat.id)}
              >
                 Delete Chat
              </DropdownMenuItem>
           </DropdownMenuContent>
        </DropdownMenu>
     </SidebarMenuItem>
  );


  return (

    <Sidebar collapsible="offcanvas" variant="sidebar" className="border-r flex flex-col h-screen"> 
      <SidebarHeader className="flex-shrink-0"> {/* Prevent header shrinking */}
        {/* Changed link placement to match original placeholder */}
         <div className="p-2">
           <Button asChild className="w-full justify-start gap-2 " size="sm">
             <Link to="/new">
               <Plus size={16} />
               New Chat
             </Link>
           </Button>
         </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-8 h-8" // Adjusted height
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus={false}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-grow"> {/* Allow content to grow and scroll */}
        {/* Loading State */}
        {isLoading && (
             <div className="p-2 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-5 w-1/3 mt-4" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
             </div>
        )}

        {/* Favorites Section - Only show if not loading and favorites exist */}
        {!isLoading && favoriteChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center"> {/* Use flex for alignment */}
              <Star size={14} className="mr-2 text-yellow-500" /> {/* Adjusted size */}
              Favorites
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favoriteChats.map(renderChatMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isLoading && favoriteChats.length > 0 && recentChats.length > 0 && <SidebarSeparator />}

        {/* Recent Chats Section - Only show if not loading */}
        {!isLoading && recentChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center"> {/* Use flex */}
              <History size={14} className="mr-2" /> {/* Adjusted size */}
              Recent Chats
            </SidebarGroupLabel>
            {/* Removed redundant Plus action, covered by header button */}
            <SidebarGroupContent>
              <SidebarMenu>
                {recentChats.map(renderChatMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

         {/* Empty state when not loading and no results */}
         {!isLoading && chats.length > 0 && filteredChats.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                  No chats found matching "{searchQuery}".
              </div>
          )}
         {!isLoading && chats.length === 0 && (
             <div className="p-4 text-center text-sm text-muted-foreground">
                  No chat history yet. Start a new chat!
             </div>
          )}


      </SidebarContent>

      <SidebarFooter className="mt-auto flex-shrink-0"> {/* Prevent footer shrinking */}
        <SidebarSeparator />
        <SidebarMenu>
          {/* Settings Item (Example: Could link to a settings page) */}
          <SidebarMenuItem>
             <Link to="/settings" className="flex-grow"> {/* Example Link */}
                 <SidebarMenuButton tooltip="Settings">
                    <Settings size={16} />
                    <span>Settings</span>
                 </SidebarMenuButton>
             </Link>
          </SidebarMenuItem>

          {/* Clerk User Button */}
          <SidebarMenuItem>
             {/* Render UserButton only when signed in */}
              <div className="p-2 group-data-[collapsible=icon]:p-0"> {/* Adjust padding for collapsed state */}
                  <SignedIn>
                      <UserButton afterSignOutUrl="/" />
                      {/* Optionally show user name when expanded */}
                      <span className="text-sm ml-2 group-data-[collapsible=icon]:hidden">
                          {user?.primaryEmailAddress?.emailAddress}
                       </span>
                  </SignedIn>
              </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}