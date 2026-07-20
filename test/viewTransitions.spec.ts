import { createRoot, createSignal } from "solid-js";
import { vi } from "vitest";
import { createRouterContext } from "../src/routing.js";
import type { LocationChange } from "../src/types.js";
import { viewTransitionSource, viewTransitionTarget } from "../src/viewTransitions.js";
import { waitFor } from "./helpers.js";

afterEach(() => {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: undefined
  });
  document.getElementById("solid-view-transition-animations")?.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("view transitions", () => {
  test("wrap enabled router navigation", async () => {
    const { start } = mockViewTransitions();
    const signal = createSignal<LocationChange>({ value: "/" });
    const { changed, dispose, router } = createRoot(dispose => {
      const router = createRouterContext({ signal }, () => [], undefined, {
        viewTransitions: true
      });
      return {
        changed: waitFor(() => signal[0]().value === "/about"),
        dispose,
        router
      };
    });

    router.navigatorFactory()("/about");

    await changed;
    expect(start).toHaveBeenCalledTimes(1);
    dispose();
  });

  test("skips an active transition when another navigation starts", async () => {
    const { skips } = mockViewTransitions();
    const signal = createSignal<LocationChange>({ value: "/" });
    const { changed, dispose, router } = createRoot(dispose => {
      const router = createRouterContext({ signal }, () => [], undefined, {
        viewTransitions: true
      });
      return {
        changed: waitFor(() => signal[0]().value === "/second"),
        dispose,
        router
      };
    });
    const navigate = router.navigatorFactory();

    navigate("/first");
    navigate("/second");

    expect(skips[0]).toHaveBeenCalledTimes(1);
    await changed;
    dispose();
  });

  test("skips a transition that exceeds the timeout", async () => {
    vi.useFakeTimers();
    const { skips } = mockViewTransitions(false);
    const signal = createSignal<LocationChange>({ value: "/" });
    const { dispose, router } = createRoot(dispose => ({
      dispose,
      router: createRouterContext({ signal }, () => [], undefined, { viewTransitions: true })
    }));

    router.navigatorFactory()("/about");
    await vi.advanceTimersByTimeAsync(3000);

    expect(skips[0]).toHaveBeenCalledTimes(1);
    dispose();
  });

  test("activates only the selected source names", async () => {
    const card = document.createElement("div");
    const title = document.createElement("span");
    const dispose = createRoot(dispose => {
      viewTransitionSource(card, () => ({ name: "card", include: ["title"] }));
      viewTransitionSource(title, () => "title");
      return dispose;
    });

    await Promise.resolve();
    expect(card.style.getPropertyValue("view-transition-name")).toBe("none");
    expect(title.style.getPropertyValue("view-transition-name")).toBe("none");

    card.dispatchEvent(new MouseEvent("click"));
    expect(card.style.getPropertyValue("view-transition-name")).toBe("card");
    expect(title.style.getPropertyValue("view-transition-name")).toBe("title");

    dispose();
    expect(card.style.getPropertyValue("view-transition-name")).toBe("");
    expect(title.style.getPropertyValue("view-transition-name")).toBe("");
  });

  test("names targets and registers their animation", async () => {
    vi.stubGlobal("CSS", { escape: (name: string) => name });
    const target = document.createElement("main");
    const dispose = createRoot(dispose => {
      viewTransitionTarget(target, () => ({
        name: "about-card",
        animation: "exponential-smooth"
      }));
      return dispose;
    });

    await Promise.resolve();
    expect(target.style.getPropertyValue("view-transition-name")).toBe("about-card");
    expect(document.getElementById("solid-view-transition-animations")?.textContent).toContain(
      "::view-transition-group(about-card)"
    );

    dispose();
    expect(target.style.getPropertyValue("view-transition-name")).toBe("");
  });
});

function mockViewTransitions(finish = true) {
  const skips: ReturnType<typeof vi.fn>[] = [];
  const start = vi.fn((update: ViewTransitionUpdateCallback) => {
    const updateCallbackDone = Promise.resolve(update()).then(() => undefined);
    const skipTransition = vi.fn();
    skips.push(skipTransition);

    return {
      finished: finish ? updateCallbackDone : new Promise<void>(() => {}),
      ready: Promise.resolve(),
      updateCallbackDone,
      skipTransition
    };
  });

  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: start
  });

  return { skips, start };
}
