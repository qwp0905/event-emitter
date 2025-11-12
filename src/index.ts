import { EventHandler, HandlerNode } from "./node"

type EventPattern = string | symbol

export class EventEmitter {
  private readonly patterns = new HandlerNode()
  private readonly persists = new Map<symbol, Set<EventHandler>>()
  private readonly temporaries = new Map<symbol, Set<EventHandler>>()

  on(pattern: EventPattern, handler: EventHandler) {
    if (typeof pattern === "string") {
      this.patterns.insert(pattern, handler, false)
      return this
    }

    const exists = this.persists.get(pattern)
    if (!exists) {
      this.persists.set(pattern, new Set([handler]))
    } else {
      exists.add(handler)
    }

    return this
  }
  once(pattern: EventPattern, handler: EventHandler) {
    if (typeof pattern === "string") {
      this.patterns.insert(pattern, handler, true)
      return this
    }

    const exists = this.temporaries.get(pattern)
    if (!exists) {
      this.temporaries.set(pattern, new Set([handler]))
    } else {
      exists.add(handler)
    }
    return this
  }
  off(pattern: EventPattern, handler: EventHandler) {
    if (typeof pattern === "string") {
      this.patterns.remove(pattern, handler)
      return this
    }

    const handlers = this.persists.get(pattern) ?? this.temporaries.get(pattern)
    if (!handlers) {
      return this
    }

    handlers.delete(handler)
    return this
  }

  emit(pattern: EventPattern, ...args: any[]) {
    if (typeof pattern === "string") {
      this.patterns.call(pattern, args)
      return
    }

    const handlers = this.persists.get(pattern) ?? this.temporaries.get(pattern)
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      handler(...args)
    }
  }

  addListener = this.on
  removeListener = this.off

  removeAllListeners(pattern?: EventPattern) {
    switch (typeof pattern) {
      case "string":
        this.patterns.remove(pattern)
        break
      case "symbol":
        this.persists.delete(pattern)
        this.temporaries.delete(pattern)
        break
      case "undefined":
        this.patterns.clear()
        this.persists.clear()
        this.temporaries.clear()
        break
    }

    return this
  }

  eventNames(): EventPattern[] {
    return [...this.persists.keys(), ...this.temporaries.keys(), ...this.patterns.patterns()]
  }
}
