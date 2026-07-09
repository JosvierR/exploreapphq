/** True when the current route is the Pioneros community home. */
export function isPioneersHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/pioneros";
}
