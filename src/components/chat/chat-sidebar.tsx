import {
  BarChart3,
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
import { useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/config/environment"; // Assuming the function is in 'lib/utils'
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---
interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  isFavorite: boolean;
}

interface ChatSidebarProps {
  currentChatId?: string;
}

// --- Helper Functions ---
function formatChatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}


// --- Main Component ---
export default function ChatSidebar({ currentChatId }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { idToken: token, user, isAdmin, isSignedIn, signOut } = useAuth();

  // --- Data Fetching ---
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchChats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(getApiUrl('chats?page=1&limit=20'), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch chat history");
        
        const data: Chat[] = await response.json();
        const sortedData = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setChats(sortedData);

      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        console.error("Error fetching chats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, [token, currentChatId]);

  // --- Filtering Logic ---
  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    return chats.filter((chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [chats, searchQuery]);

  const favoriteChats = useMemo(() => {
    return filteredChats.filter(chat => chat.isFavorite).sort((a,b) => a.title.localeCompare(b.title));
  }, [filteredChats]);

  const recentChats = useMemo(() => {
    return filteredChats.filter(chat => !chat.isFavorite || searchQuery);
  }, [filteredChats, searchQuery]);


  // --- Action Handlers with Optimistic UI ---
  const handleToggleFavorite = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const originalChats = [...chats];
    const newFavoriteStatus = !chat.isFavorite;
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isFavorite: newFavoriteStatus } : c));

    try {
      const response = await fetch(getApiUrl(`/chats/${chatId}/favorite`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isFavorite: newFavoriteStatus }),
      });
      if (!response.ok) throw new Error('Failed to update favorite status.');
    } catch (err) {
      console.error(err);
      setChats(originalChats); // Revert on error
      alert("Error: Could not update favorite status.");
    }
  };

  const handleRenameChat = async (chatId: string) => {
    const originalChat = chats.find(c => c.id === chatId);
    const newTitle = prompt("Enter new chat title:", originalChat?.title);

    if (!newTitle || newTitle.trim() === "" || !originalChat) return;

    const originalChats = [...chats];
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle.trim() } : c));

    try {
      const response = await fetch(getApiUrl(`/chats/${chatId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!response.ok) throw new Error("Failed to rename chat.");
    } catch(err) {
      console.error(err);
      setChats(originalChats);
      alert("Error: Could not rename the chat.");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    
    const originalChats = [...chats];
    setChats(prev => prev.filter(c => c.id !== chatId));

    if (currentChatId === chatId) {
      navigate("/new", { replace: true });
    }

    try {
      // TODO: Replace with your actual delete endpoint
      // const response = await fetch(getApiUrl(`/chats/${chatId}`), {
      //   method: 'DELETE',
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      // if (!response.ok) throw new Error("Failed to delete chat.");
      console.log(`Simulating API call to delete chat ${chatId}`);
    } catch(err) {
      console.error(err);
      setChats(originalChats);
      alert("Error: Could not delete the chat.");
    }
  };

  // --- Render Functions ---
  const renderChatMenuItem = (chat: Chat) => (
     <SidebarMenuItem key={chat.id} className="group">
       <Link to={`/chat/${chat.id}`} className="flex-grow overflow-hidden text-sm">
           <SidebarMenuButton
             tooltip={chat.title}
             isActive={currentChatId === chat.id}
             className="w-full"
           >
             <MessageSquareText size={16} className="flex-shrink-0" />
             <span className="truncate flex-grow">{chat.title}</span>
             <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 group-hover:hidden">
                {formatChatDate(chat.updatedAt)}
             </span>
           </SidebarMenuButton>
       </Link>

       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <SidebarMenuAction showOnHover aria-label={`Actions for ${chat.title}`}>
               <MoreHorizontal size={16} />
           </SidebarMenuAction>
         </DropdownMenuTrigger>
         <DropdownMenuContent side="right" align="start">
           <DropdownMenuItem onClick={() => handleRenameChat(chat.id)}>Rename</DropdownMenuItem>
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

  const renderContent = () => {
    if (isLoading) {
      return (
         <div className="p-2 space-y-2">
           <Skeleton className="h-5 w-1/3" /><Skeleton className="h-8 w-full" />
           <Skeleton className="h-8 w-full" /><Skeleton className="h-5 w-1/3 mt-4" />
           <Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" />
         </div>
      );
    }
    if (error) {
      return <div className="p-4 text-center text-sm text-red-500">{error}</div>;
    }
    if (chats.length > 0 && filteredChats.length === 0) {
      return <div className="p-4 text-center text-sm text-muted-foreground">No chats found for "{searchQuery}".</div>;
    }
    if (chats.length === 0) {
      return <div className="p-4 text-center text-sm text-muted-foreground">No chat history yet. Start a new chat!</div>;
    }

    return (
      <>
        {favoriteChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center"><Star size={14} className="mr-2 text-yellow-500" /> Favorites</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{favoriteChats.map(renderChatMenuItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}
        {favoriteChats.length > 0 && recentChats.length > 0 && <SidebarSeparator />}
        {recentChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center"><History size={14} className="mr-2" /> Recent Chats</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{recentChats.map(renderChatMenuItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}
      </>
    );
  };

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" className="border-r border-border/50 flex flex-col h-screen bg-sidebar">
      <SidebarHeader className="flex-shrink-0">
        <div className="p-2">
          <Button asChild className="w-full justify-start gap-2" size="sm">
            <Link to="/new"><Plus size={16} /> New Chat</Link>
          </Button>
        </div>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-8 h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-grow">{renderContent()}</SidebarContent>

      <SidebarFooter className="mt-auto flex-shrink-0">
        <SidebarSeparator />
        <SidebarMenu>
          {isAdmin && (
            <>
              <SidebarMenuItem>
                <Link to="/admin" className="w-full">
                  <SidebarMenuButton tooltip="Admin Portal">
                    <Settings size={16} className="flex-shrink-0" />
                    <span className="truncate">Admin Portal</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <a
                  href="https://evals-dashboard-k5hhhgwp6a-uc.a.run.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <SidebarMenuButton tooltip="Evals Dashboard">
                    <BarChart3 size={16} className="flex-shrink-0" />
                    <span className="truncate">Evals Dashboard</span>
                  </SidebarMenuButton>
                </a>
              </SidebarMenuItem>
            </>
          )}
          <SidebarMenuItem>
            <div className="flex items-center justify-between p-2 w-full">
              <div className="flex items-center min-w-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium">
                      {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <span className="text-sm ml-2 truncate group-data-[collapsible=icon]:hidden">
                  {user?.displayName || user?.email || (user?.isAnonymous ? "Guest" : "User")}
                </span>
              </div>
              {isSignedIn ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs group-data-[collapsible=icon]:hidden flex-shrink-0"
                  onClick={() => { signOut(); navigate("/"); }}
                >
                  Sign out
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs group-data-[collapsible=icon]:hidden flex-shrink-0"
                  onClick={() => navigate("/")}
                >
                  Sign in
                </Button>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}