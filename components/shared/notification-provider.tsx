"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Notification = { id: number; kind: "success" | "error"; message: string };
const NotificationContext = createContext<((kind: Notification["kind"], message: string) => void) | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextId = useRef(0);
  const notify = useCallback((kind: Notification["kind"], message: string) => {
    const notification = { id: ++nextId.current, kind, message };
    setNotifications(current => [...current.slice(-3), notification]);
  }, []);
  return <NotificationContext.Provider value={notify}>
    <Toast.Provider label="Notification" swipeDirection="right">
      {children}
      {notifications.map(notification => <Toast.Root key={notification.id} type="foreground" duration={notification.kind === "error" ? 8000 : 5000}
        onOpenChange={open => { if (!open) setNotifications(current => current.filter(item => item.id !== notification.id)); }}
        className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-background p-4 shadow-lg ${notification.kind === "error" ? "border-destructive/50" : "border-border"}`}>
        <div className="min-w-0 flex-1">
          <Toast.Title className={`text-sm font-semibold ${notification.kind === "error" ? "text-destructive" : "text-foreground"}`}>{notification.kind === "error" ? "Unable to complete action" : "Success"}</Toast.Title>
          <Toast.Description className="mt-1 break-words text-sm text-muted-foreground">{notification.message}</Toast.Description>
        </div>
        <Toast.Close asChild><Button type="button" variant="ghost" size="icon" aria-label="Dismiss notification"><X aria-hidden="true" className="size-4" /></Button></Toast.Close>
      </Toast.Root>)}
      <Toast.Viewport className="pointer-events-none fixed top-4 right-4 z-[100] m-0 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm list-none flex-col gap-2 overflow-y-auto outline-none" />
    </Toast.Provider>
  </NotificationContext.Provider>;
}

export function useNotification() {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error("useNotification requires NotificationProvider.");
  return notify;
}
