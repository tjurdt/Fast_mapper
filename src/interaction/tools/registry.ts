import type { Tool } from "./types";
import { selectTool } from "./select";
import { cutTool } from "./cut";
import { inspectTool } from "./inspect";

/** 加新工具：import 後放進這個陣列。 */
export const TOOLS: Tool[] = [selectTool, cutTool, inspectTool];

export const DEFAULT_TOOL_ID = selectTool.id;

export function toolById(id: string): Tool {
  return TOOLS.find((t) => t.id === id) ?? selectTool;
}
