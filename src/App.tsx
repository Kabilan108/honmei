import { ComponentExample } from "@/components/component-example";
import { Analytics } from "@vercel/analytics/next";

export function App() {
  return (
    <>
      <ComponentExample />
      <Analytics />
    </>
  );
}

export default App;

