import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

export type ViewTransitionAnimation = "exponential-smooth";

export type ViewTransitionOptions = {
  name: string;
  animation?: ViewTransitionAnimation;
};

export type ViewTransitionSourceOptions =
  | string
  | (ViewTransitionOptions & {
      include?: string[];
    });

export type ViewTransitionTargetOptions = string | ViewTransitionOptions;

export function viewTransitionSource(
  element: HTMLElement,
  options: Accessor<ViewTransitionSourceOptions>
) {
  function select() {
    const source = options();
    setActiveNames(
      typeof source === "string" ? [source] : [source.name, ...(source.include ?? [])]
    );
  }

  element.addEventListener("click", select);

  createEffect(() => {
    const source = options();
    const name = getName(source);

    registerAnimation(name, getAnimation(source));
    element.style.setProperty("view-transition-name", activeNames().includes(name) ? name : "none");
  });

  onCleanup(() => {
    element.removeEventListener("click", select);
    element.style.removeProperty("view-transition-name");
  });
}

export function viewTransitionTarget(
  element: HTMLElement,
  options: Accessor<ViewTransitionTargetOptions>
) {
  createEffect(() => {
    const target = options();
    const name = getName(target);

    registerAnimation(name, getAnimation(target));
    element.style.setProperty("view-transition-name", name);
  });

  onCleanup(() => element.style.removeProperty("view-transition-name"));
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      viewTransitionSource: ViewTransitionSourceOptions;
      viewTransitionTarget: ViewTransitionTargetOptions;
    }
  }
}

const [activeNames, setActiveNames] = createSignal<readonly string[]>([]);
const animationNames = new Set<string>();

let style: HTMLStyleElement | undefined;

function getName(options: ViewTransitionTargetOptions) {
  return typeof options === "string" ? options : options.name;
}

function getAnimation(options: ViewTransitionTargetOptions) {
  return typeof options === "string" ? undefined : options.animation;
}

function registerAnimation(name: string, animation: ViewTransitionAnimation | undefined) {
  if (!animation) return;

  animationNames.add(name);
  updateAnimationStyles();
}

function updateAnimationStyles() {
  if (typeof document === "undefined" || animationNames.size === 0) return;

  style ??= document.createElement("style");
  style.id = "solid-view-transition-animations";

  if (!style.parentNode) document.head.append(style);

  const animations = Array.from(animationNames, name => {
    const transitionName = CSS.escape(name);

    return `
::view-transition-group(${transitionName}) {
  animation-duration: var(--solid-vt-exponential-duration);
  animation-timing-function: var(--solid-vt-exponential-ease);
}

::view-transition-old(${transitionName}) {
  animation: solid-vt-exponential-fade-out var(--solid-vt-exponential-duration) var(--solid-vt-exponential-ease) both;
}

::view-transition-new(${transitionName}) {
  animation: solid-vt-exponential-fade-in var(--solid-vt-exponential-duration) var(--solid-vt-exponential-ease) both;
}`;
  }).join("\n");

  style.textContent = `
:root {
  --solid-vt-exponential-duration: 320ms;
  --solid-vt-exponential-ease: cubic-bezier(0.16, 1, 0.3, 1);
}

@supports (animation-timing-function: linear(0, 1)) {
  :root {
    --solid-vt-exponential-ease: linear(
      0,
      0.336 10%,
      0.561 20%,
      0.711 30%,
      0.813 40%,
      0.881 50%,
      0.927 60%,
      0.956 70%,
      0.976 80%,
      0.991 90%,
      1
    );
  }
}

::view-transition-group(root),
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}

@keyframes solid-vt-exponential-fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes solid-vt-exponential-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

${animations}
`;
}
