import { ReactNode } from "react";

// Application-wide sticky header. It knows nothing about features: the app decides what goes in.
export function HeaderView({ children }: { children: ReactNode }) {
  return <header className="header">{children}</header>;
}
