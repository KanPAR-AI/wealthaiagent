// src/components/chat/ChatHeader.tsx
import { useState } from 'react';
import Logo from '@/components/ui/logo';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Edit, Bug, Calculator, SlidersHorizontal } from 'lucide-react';
import { JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ModeToggle } from '../theme/mode-toggle';
import { Button } from '../ui/button';
import CalcDebugModal from '../debug/calc-debug-modal';

export function ChatHeader(): JSX.Element {
  const { chatid } = useParams<{ chatid: string }>();
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

  return (
    <>
      <div className="flex h-14 flex-shrink-0 items-center bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 justify-between sticky top-0 z-20 w-full">
        <SidebarTrigger className="mr-2" />
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <Logo />
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {chatid && (
            <div className="hidden sm:flex items-center gap-1">
              <Link to={`/debug/${chatid}`} title="Slot Debug" aria-label="Slot Debug">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <SlidersHorizontal className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Slot Debug</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsCalcModalOpen(true)}
                title="Calculation Data"
                aria-label="Calculation Data"
              >
                <Calculator className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Calculation Data</span>
              </Button>
              <Link
                to="/logs"
                title="Debug Logs"
                aria-label="Debug Logs"
              >
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Bug className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Debug Logs</span>
                </Button>
              </Link>
            </div>
          )}
          <ModeToggle />
          <Link
            to="/new"
            title="New Chat"
            aria-label="New Chat"
          >
            <Button variant="outline" size="icon">
              <Edit className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">New Chat</span>
            </Button>
          </Link>
        </div>
      </div>

      <CalcDebugModal
        chatId={chatid || null}
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
      />
    </>
  );
}