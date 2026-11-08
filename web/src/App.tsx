import { Moon, Sun } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHarnessSSE, ConnectionStatus } from './useHarnessSSE';
import { useTheme } from './useTheme';
import { TaskPane } from './components/TaskPane';
import { InspectorPane } from './components/InspectorPane';

function ConnectionStatusComponent({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
  const getConnectionStatusLabel = () => {
    switch (connectionStatus) {
      case ConnectionStatus.CONNECTED:
        return 'connected';
      case ConnectionStatus.RECONNECTING:
        return 'reconnecting';
      case ConnectionStatus.DISCONNECTED:
      default:
        return 'disconnected';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case ConnectionStatus.CONNECTED:
        return 'text-emerald-600';
      case ConnectionStatus.RECONNECTING:
        return 'text-yellow-600';
      case ConnectionStatus.DISCONNECTED:
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <>
      <span className={cn('flex items-center gap-1.5 text-xs', getConnectionStatusColor())}>
        <span className={cn('size-2 rounded-full', getConnectionStatusColor())} />
        {getConnectionStatusLabel()}
      </span>
    </>
  );
}

export function App() {
  const { events, connectionStatus, resetEvents } = useHarnessSSE();
  const { theme, toggle } = useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold tracking-tight">
            Harness<span className="text-muted-foreground"> Inspector</span>
          </span>
          <div className="flex items-center gap-3">
            <ConnectionStatusComponent connectionStatus={connectionStatus} />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>
        <main className="grid min-h-0 flex-1 grid-cols-2">
          <TaskPane events={events} resetEvents={resetEvents} />
          <InspectorPane events={events} />
        </main>
      </div>
    </TooltipProvider>
  );
}
