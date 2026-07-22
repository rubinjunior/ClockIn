export type ClientDebugEvent = {
  scope: string;
  status: "ok" | "error" | "info";
  message: string;
};

export function emitDebugEvent(detail: ClientDebugEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ClientDebugEvent>("clockin:debug", { detail }));
}
