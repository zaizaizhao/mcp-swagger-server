import {
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  watch,
  shallowRef,
  triggerRef,
  type Ref,
  type ComputedRef,
  type WatchStopHandle,
} from "vue";

export interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  memoryUsage: number;
  updateCount: number;
  lastUpdate: number;
}

export interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  buffer?: number;
  dynamic?: boolean;
}

/**
 * 性能监控组合函数
 */
export function usePerformanceMonitor() {
  const metrics = ref<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    memoryUsage: 0,
    updateCount: 0,
    lastUpdate: Date.now(),
  });

  const isMonitoring = ref(false);
  let performanceObserver: PerformanceObserver | null = null;
  let memoryMonitorTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 开始性能监控
   */
  const startMonitoring = () => {
    if (isMonitoring.value) return;

    isMonitoring.value = true;

    // 监控渲染性能
    if ("PerformanceObserver" in window) {
      performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "measure") {
            metrics.value.renderTime = entry.duration;
            metrics.value.lastUpdate = Date.now();
          }
        });
      });

      performanceObserver.observe({ entryTypes: ["measure"] });
    }

    // 监控内存使用
    if ("memory" in performance) {
      const monitorMemory = () => {
        const memory = (performance as any).memory;
        metrics.value.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      };

      monitorMemory();
      memoryMonitorTimer = setInterval(monitorMemory, 5000);
    }
  };

  /**
   * 停止性能监控
   */
  const stopMonitoring = () => {
    isMonitoring.value = false;

    if (performanceObserver) {
      performanceObserver.disconnect();
      performanceObserver = null;
    }

    if (memoryMonitorTimer) {
      clearInterval(memoryMonitorTimer);
      memoryMonitorTimer = null;
    }
  };

  /**
   * 记录组件更新
   */
  const recordUpdate = () => {
    metrics.value.updateCount++;
    metrics.value.lastUpdate = Date.now();
  };

  /**
   * 测量函数执行时间
   */
  const measureFunction = async <T>(
    name: string,
    fn: () => Promise<T> | T,
  ): Promise<T> => {
    const start = performance.now();
    performance.mark(`${name}-start`);

    try {
      const result = await fn();
      const end = performance.now();
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);

      console.log(`${name} took ${end - start} milliseconds`);
      return result;
    } catch (error) {
      performance.mark(`${name}-error`);
      throw error;
    }
  };

  /**
   * 获取性能报告
   */
  const getPerformanceReport = () => {
    const report = {
      ...metrics.value,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    return report;
  };

  onUnmounted(() => {
    stopMonitoring();
  });

  return {
    metrics: computed(() => metrics.value),
    isMonitoring: computed(() => isMonitoring.value),
    startMonitoring,
    stopMonitoring,
    recordUpdate,
    measureFunction,
    getPerformanceReport,
  };
}

/**
 * 懒加载组合函数
 */
export function useLazyLoad(options: LazyLoadOptions = {}) {
  const { threshold = 0.1, rootMargin = "50px", triggerOnce = true } = options;

  const isVisible = ref(false);
  const target = ref<Element | null>(null);
  let observer: IntersectionObserver | null = null;

  const observe = () => {
    if (!target.value || observer) return;

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          isVisible.value = true;

          if (triggerOnce && observer) {
            observer.disconnect();
            observer = null;
          }
        } else if (!triggerOnce) {
          isVisible.value = false;
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(target.value);
  };

  const unobserve = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  watch(target, (newTarget) => {
    unobserve();
    if (newTarget) {
      observe();
    }
  });

  onUnmounted(() => {
    unobserve();
  });

  return {
    isVisible: computed(() => isVisible.value),
    target,
    observe,
    unobserve,
  };
}

/**
 * 虚拟滚动组合函数
 */
export function useVirtualScroll<T>(
  items: Ref<T[]>,
  options: VirtualScrollOptions,
) {
  const { itemHeight, containerHeight, buffer = 5, dynamic = false } = options;

  const scrollTop = ref(0);
  const containerRef = ref<HTMLElement | null>(null);

  // 计算可见范围
  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + buffer,
      items.value.length,
    );

    return {
      start: Math.max(0, start - buffer),
      end,
    };
  });

  // 可见项目
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value;
    return items.value.slice(start, end).map((item, index) => ({
      item,
      index: start + index,
      top: (start + index) * itemHeight,
    }));
  });

  // 容器样式
  const containerStyle = computed(() => ({
    height: `${containerHeight}px`,
    overflow: "auto",
  }));

  // 内容样式
  const contentStyle = computed(() => ({
    height: `${items.value.length * itemHeight}px`,
    position: "relative" as const,
  }));

  // 滚动处理
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    scrollTop.value = target.scrollTop;
  };

  // 滚动到指定项目
  const scrollToItem = (index: number) => {
    if (containerRef.value) {
      const top = index * itemHeight;
      containerRef.value.scrollTop = top;
    }
  };

  // 滚动到顶部
  const scrollToTop = () => {
    scrollToItem(0);
  };

  // 滚动到底部
  const scrollToBottom = () => {
    scrollToItem(items.value.length - 1);
  };

  return {
    containerRef,
    visibleItems,
    visibleRange,
    containerStyle,
    contentStyle,
    scrollTop: computed(() => scrollTop.value),
    handleScroll,
    scrollToItem,
    scrollToTop,
    scrollToBottom,
  };
}

/**
 * 防抖组合函数
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = (...args: Parameters<T>) => {
    cancel();
    return fn(...args);
  };

  onUnmounted(() => {
    cancel();
  });

  return {
    debouncedFn: debouncedFn as T,
    cancel,
    flush,
  };
}

/**
 * 节流组合函数
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;

  const throttledFn = (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecTime >= delay) {
      lastExecTime = now;
      return fn(...args);
    }

    if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          lastExecTime = Date.now();
          timeoutId = null;
          fn(...args);
        },
        delay - (now - lastExecTime),
      );
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  onUnmounted(() => {
    cancel();
  });

  return {
    throttledFn: throttledFn as T,
    cancel,
  };
}

/**
 * 内存泄漏检测组合函数
 */
export function useMemoryLeakDetection() {
  const watchers = new Set<WatchStopHandle>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();

  /**
   * 注册监听器
   */
  const registerWatcher = (watcher: WatchStopHandle) => {
    watchers.add(watcher);
    return watcher;
  };

  /**
   * 注册定时器
   */
  const registerTimer = (timerId: ReturnType<typeof setTimeout>) => {
    timers.add(timerId);
    return timerId;
  };

  /**
   * 注册事件监听器
   */
  const registerListener = (cleanup: () => void) => {
    listeners.add(cleanup);
    return cleanup;
  };

  /**
   * 清理所有资源
   */
  const cleanup = () => {
    // 清理监听器
    watchers.forEach((watcher) => watcher());
    watchers.clear();

    // 清理定时器
    timers.forEach((timerId) => clearTimeout(timerId));
    timers.clear();

    // 清理事件监听器
    listeners.forEach((cleanup) => cleanup());
    listeners.clear();
  };

  onUnmounted(() => {
    cleanup();
  });

  return {
    registerWatcher,
    registerTimer,
    registerListener,
    cleanup,
    getResourceCount: () => ({
      watchers: watchers.size,
      timers: timers.size,
      listeners: listeners.size,
    }),
  };
}

/**
 * 组件缓存组合函数
 */
export function useComponentCache<T>() {
  const cache = new Map<string, T>();
  const maxSize = ref(100);

  /**
   * 获取缓存项
   */
  const get = (key: string): T | undefined => {
    return cache.get(key);
  };

  /**
   * 设置缓存项
   */
  const set = (key: string, value: T): void => {
    // 如果缓存已满，删除最旧的项
    if (cache.size >= maxSize.value) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, value);
  };

  /**
   * 删除缓存项
   */
  const remove = (key: string): boolean => {
    return cache.delete(key);
  };

  /**
   * 清空缓存
   */
  const clear = (): void => {
    cache.clear();
  };

  /**
   * 检查是否存在
   */
  const has = (key: string): boolean => {
    return cache.has(key);
  };

  /**
   * 获取缓存大小
   */
  const size = computed(() => cache.size);

  /**
   * 获取缓存使用率
   */
  const usage = computed(() => (cache.size / maxSize.value) * 100);

  return {
    get,
    set,
    remove,
    clear,
    has,
    size,
    usage,
    maxSize,
    cache: computed(() => Array.from(cache.entries())),
  };
}

/**
 * 批量更新组合函数
 */
export function useBatchUpdate() {
  const pendingUpdates = new Set<() => void>();
  let updateScheduled = false;

  /**
   * 添加更新任务
   */
  const addUpdate = (updateFn: () => void) => {
    pendingUpdates.add(updateFn);

    if (!updateScheduled) {
      updateScheduled = true;
      nextTick(() => {
        // 执行所有更新
        pendingUpdates.forEach((updateFn) => updateFn());
        pendingUpdates.clear();
        updateScheduled = false;
      });
    }
  };

  /**
   * 立即执行所有更新
   */
  const flushUpdates = () => {
    pendingUpdates.forEach((updateFn) => updateFn());
    pendingUpdates.clear();
    updateScheduled = false;
  };

  /**
   * 取消所有更新
   */
  const cancelUpdates = () => {
    pendingUpdates.clear();
    updateScheduled = false;
  };

  return {
    addUpdate,
    flushUpdates,
    cancelUpdates,
    pendingCount: computed(() => pendingUpdates.size),
  };
}
