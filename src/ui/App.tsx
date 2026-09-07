import * as store from "../store";
import { ProjectHub } from "./ProjectHub";
import { Editor } from "./Editor";

export function App() {
  if (!store.ready.value) return <div class="loading">…</div>;
  return store.project.value ? <Editor /> : <ProjectHub />;
}
