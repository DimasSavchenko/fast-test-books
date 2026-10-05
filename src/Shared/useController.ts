import { useEffect, useState } from "react";

interface Controller {
  init?(): void;
  dispose(): void;
}

export function useController<T extends Controller>(create: () => T): T {
  const [controller] = useState(create);

  useEffect(() => {
    controller.init?.();
    return () => controller.dispose();
  }, [controller]);

  return controller;
}
