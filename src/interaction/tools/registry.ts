import type { Tool } from "./types";
import { gridTool } from "./select";
import { cutTool } from "./cut";
import { inspectTool } from "./inspect";
import { objSelectTool } from "./objselect";

/** 加新工具：import 後放進這個陣列。 */
export const TOOLS: Tool[] = [gridTool, cutTool, inspectTool, objSelectTool];

export const DEFAULT_TOOL_ID = gridTool.id;

export function toolById(id: string): Tool {
  return TOOLS.find((t) => t.id === id) ?? gridTool;
}
