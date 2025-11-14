import { EventHandler, HandlerNode } from "./node"

type EventPattern = string | symbol

export class EventEmitter {
  private readonly patterns = new HandlerNode()
  private readonly permanent = new Map<symbol, Set<EventHandler>>()
  private readonly temporary = new Map<symbol, Set<EventHandler>>()

  on(pattern: EventPattern, handler: EventHandler) {
    if (typeof pattern === "string") {
      this.patterns.insert(pattern, handler, false)
      return this
    }

    const exists = this.permanent.get(pattern)
    if (!exists) {
      this.permanent.set(pattern, new Set([handler]))
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

    const exists = this.temporary.get(pattern)
    if (!exists) {
      this.temporary.set(pattern, new Set([handler]))
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

    const handlers = this.permanent.get(pattern) ?? this.temporary.get(pattern)
    if (!handlers) {
      return this
    }

    handlers.delete(handler)
    return this
  }

  emit(pattern: EventPattern, ...args: any[]): boolean {
    if (typeof pattern === "string") {
      return this.patterns.call(pattern, args)
    }

    const handlers = this.permanent.get(pattern) ?? this.temporary.get(pattern)
    if (!handlers) {
      return false
    }

    let called = false
    for (const handler of handlers) {
      handler(...args)
      called ||= true
    }
    return called
  }

  addListener = this.on
  removeListener = this.off

  removeAllListeners(pattern?: EventPattern) {
    switch (typeof pattern) {
      case "string":
        this.patterns.remove(pattern)
        break
      case "symbol":
        this.permanent.delete(pattern)
        this.temporary.delete(pattern)
        break
      case "undefined":
        this.patterns.clear()
        this.permanent.clear()
        this.temporary.clear()
        break
    }

    return this
  }

  listeners(pattern: EventPattern): EventHandler[] {
    if (typeof pattern === "string") {
      return this.patterns.find(pattern)
    }

    return [...(this.permanent.get(pattern) ?? []), ...(this.temporary.get(pattern) ?? [])]
  }
  rawListeners = this.listeners

  listenerCount(pattern: EventPattern) {
    return this.listeners(pattern).length
  }

  eventNames(): EventPattern[] {
    return [...this.permanent.keys(), ...this.temporary.keys(), ...this.patterns.patterns()]
  }
}
