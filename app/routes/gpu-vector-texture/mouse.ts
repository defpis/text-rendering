import {
  fromEvent,
  map,
  merge,
  Observable,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";

export function registerMouseEvents(
  canvas: HTMLCanvasElement,
  callbacks?: {
    onResize?: (width: number, height: number) => void;
    onDrag?: (dx: number, dy: number) => void;
    onZoom?: (mouseX: number, mouseY: number, deltaY: number) => void;
    onDraw?: () => void;
  },
): Subscription {
  const container = canvas.parentElement;
  if (!container) {
    throw new Error("Canvas must have a parent element!");
  }

  const subscription = new Subscription();

  const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown");
  const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
  const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");
  const mouseWheel$ = fromEvent<WheelEvent>(canvas, "wheel");

  const resize$ = new Observable<{ width: number; height: number }>(
    (subscriber) => {
      // 处理窗口大小变化，比如拉伸窗口
      const resizeObserver = new ResizeObserver((entries) => {
        requestAnimationFrame(() => {
          const { width, height } = entries[0].contentRect;
          subscriber.next({ width, height });
        });
      });
      resizeObserver.observe(container);

      // 处理设备像素比变化，比如从一个高分辨率屏幕切换到一个低分辨率屏幕
      let remove: Function | null = null;
      const onPixelRatioChange = () => {
        remove?.();

        const query = `(resolution: ${devicePixelRatio}dppx)`;
        const media = matchMedia(query);

        media.addEventListener("change", onPixelRatioChange);
        remove = () => {
          media.removeEventListener("change", onPixelRatioChange);
          remove = null;
        };

        const { width, height } = container.getBoundingClientRect();
        subscriber.next({ width, height });
      };
      onPixelRatioChange();

      return () => {
        resizeObserver.disconnect();
        remove?.();
      };
    },
  );

  subscription.add(
    resize$.subscribe(({ width, height }) => {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;

      callbacks?.onResize?.(width, height);
    }),
  );

  const drag$ = mouseDown$.pipe(
    switchMap((startEvent) => {
      let lastX = startEvent.clientX;
      let lastY = startEvent.clientY;

      return mouseMove$.pipe(
        map((moveEvent) => {
          const dx = moveEvent.clientX - lastX;
          const dy = moveEvent.clientY - lastY;

          lastX = moveEvent.clientX;
          lastY = moveEvent.clientY;

          return { dx, dy };
        }),
        takeUntil(mouseUp$),
      );
    }),
  );

  subscription.add(
    drag$.subscribe(({ dx, dy }) => {
      callbacks?.onDrag?.(dx, dy);
    }),
  );

  const zoom$ = mouseWheel$.pipe(
    map((event) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const deltaY = event.deltaY;

      return { mouseX, mouseY, deltaY };
    }),
  );

  subscription.add(
    zoom$.subscribe(({ mouseX, mouseY, deltaY }) => {
      callbacks?.onZoom?.(mouseX, mouseY, deltaY);
    }),
  );

  const draw$ = merge(drag$, zoom$, resize$);

  subscription.add(draw$.subscribe(() => callbacks?.onDraw?.()));

  return subscription;
}
