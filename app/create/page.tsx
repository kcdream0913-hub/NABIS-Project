import { Suspense } from "react";
import Composer from "./composer";

export default function CreatePage() {
  return (
    <Suspense>
      <Composer />
    </Suspense>
  );
}
