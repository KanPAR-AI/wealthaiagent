"use client"

import { History, MessageSquarePlus, MoreHorizontal, Plus, Search, Settings, Star, User } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar"

// Mock data for chat history
const recentChats = [
  { id: "1", title: "Project brainstorming", date: "2h ago" },
  { id: "2", title: "Marketing strategy", date: "5h ago" },
  { id: "3", title: "Website redesign ideas", date: "Yesterday" },
  { id: "4", title: "Product roadmap", date: "2 days ago" },
  { id: "5", title: "Content calendar", date: "3 days ago" },
]

// Mock data for favorite chats
const favoriteChats = [
  { id: "6", title: "Research summary", date: "Apr 15" },
  { id: "7", title: "Quarterly goals", date: "Mar 28" },
]

export default function ChatSidebar() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <Sidebar variant="floating" className="border-r">
      <SidebarHeader>
        <div className="px-4 py-2">
          <Button className="w-full justify-start gap-2" size="sm">
            <MessageSquarePlus size={16} />
            New Chat
          </Button>
        </div>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Favorites Section */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Star size={16} className="mr-2 text-yellow-400" />
            Favorites
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {favoriteChats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton tooltip={chat.title}>
                    <MessageSquarePlus size={16} />
                    <span>{chat.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal size={16} />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem>
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Remove from favorites</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Recent Chats Section */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <History size={16} className="mr-2" />
            Recent Chats
          </SidebarGroupLabel>
          <SidebarGroupAction title="New Chat">
            <Plus size={16} />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentChats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton tooltip={chat.title}>
                    <MessageSquarePlus size={16} />
                    <span>{chat.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal size={16} />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem>
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Add to favorites</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings size={16} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User size={16} />
                  <span>User Profile</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuItem>
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Preferences</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
