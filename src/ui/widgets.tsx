import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { uiEvents } from "../store";

/** 四色圓形圖例 icon（沿用 legacy 的 conic-gradient）。 */
export function LegendIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      class="legendicon"
      aria-hidden="true"
      style={{ width: size, height: size, borderWidth: Math.max(1, size / 8) }}
    />
  );
}

/** 點一下就循環到下一個選項的按鈕（取代小型下拉選單）。 */
export function CycleButton<T extends string | number>({
  value,
  options,
  labels,
  onChange,
  className,
}: {
  value: T;
  options: readonly T[];
  labels: Record<string, ComponentChildren>;
  onChange: (v: T) => void;
  className?: string;
}) {
  const next = () => {
    const i = options.indexOf(value);
    onChange(options[(i + 1) % options.length]!);
  };
  return (
    <button type="button" class={"cyclebtn " + (className ?? "")} onClick={next}>
      {labels[String(value)] ?? String(value)}
    </button>
  );
}

/** 方向移動盤（十字排列）。 */
export function MovePad({ onMove }: { onMove: (dir: "up" | "down" | "left" | "right") => void }) {
  return (
    <span class="movepad">
      <button type="button" aria-label="上移" onClick={() => onMove("up")}>
        ↑
      </button>
      <button type="button" aria-label="左移" onClick={() => onMove("left")}>
        ←
      </button>
      <button type="button" aria-label="右移" onClick={() => onMove("right")}>
        →
      </button>
      <button type="button" aria-label="下移" onClick={() => onMove("down")}>
        ↓
      </button>
    </span>
  );
}

/** 監聽 uiEvents 的 toast，短暫顯示。 */
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = uiEvents.on("toast", (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2400);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return <div class="toast">{msg}</div>;
}
