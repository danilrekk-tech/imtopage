const KEY = "i2ip-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
