import { describe, expect, it, vi } from "vitest";
import { RenderScheduler } from "../src/render/scheduler";

describe("RenderScheduler", () => {
  it("flushNow 同步觸發並帶指定圖層", () => {
    const flush = vi.fn();
    const s = new RenderScheduler(flush);
    s.flushNow(["overlay"]);
    expect(flush).toHaveBeenCalledOnce();
    expect([...flush.mock.calls[0]![0]]).toEqual(["overlay"]);
  });

  it("多次 request 在一個影格內合併", async () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const s = new RenderScheduler(flush);
    s.request("base");
    s.request("base");
    s.request("overlay");
    expect(flush).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(flush).toHaveBeenCalledOnce();
    expect([...flush.mock.calls[0]![0]].sort()).toEqual(["base", "overlay"]);
    vi.useRealTimers();
  });
});
