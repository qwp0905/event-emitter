import { EventHandler } from "./node"
import { PatternMatcher } from "./pattern"

type EventPattern = string | symbol

export class EventEmitter {
  private readonly patterns = new PatternMatcher()
  private readonly permanent = new Map<symbol, Set<EventHandler>>()
  private readonly temporary = new Map<symbol, Set<EventHandler>>()

  on<T extends any[] = any[], R = any>(pattern: EventPattern, handler: EventHandler<T, R>): this {
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
  once<T extends any[] = any[], R = any>(pattern: EventPattern, handler: EventHandler<T, R>): this {
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
  off<T extends any[] = any[], R = any>(pattern: EventPattern, handler: EventHandler<T, R>): this {
    if (typeof pattern === "string") {
      this.patterns.remove(pattern, handler)
      return this
    }

    const permanent = this.permanent.get(pattern)
    if (permanent?.delete(handler)) {
      if (permanent.size > 0) {
        return this
      }
      this.permanent.delete(pattern)
      return this
    }

    const temporary = this.temporary.get(pattern)
    if (!temporary) {
      return this
    }
    if (!temporary.delete(handler)) {
      return this
    }
    if (temporary.size > 0) {
      return this
    }
    this.temporary.delete(pattern)
    return this
  }

  emit(pattern: EventPattern, ...args: any[]): boolean {
    if (typeof pattern === "string") {
      return this.patterns.call(pattern, args)
    }

    let called = false

    const permanent = this.permanent.get(pattern)
    if (permanent) {
      for (const handler of permanent) {
        handler(...args)
        called ||= true
      }
    }

    const temporary = this.temporary.get(pattern)
    if (temporary) {
      for (const handler of temporary) {
        handler(...args)
        called ||= true
      }
      this.temporary.delete(pattern)
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
      return Array.from(this.patterns.handlers(pattern))
    }

    return [...(this.permanent.get(pattern) ?? []), ...(this.temporary.get(pattern) ?? [])]
  }
  rawListeners = this.listeners

  listenerCount(pattern: EventPattern) {
    if (typeof pattern === "string") {
      return this.patterns.handlersCount(pattern)
    }
    return (this.permanent.get(pattern)?.size ?? 0) + (this.temporary.get(pattern)?.size ?? 0)
  }

  eventNames(): EventPattern[] {
    return [...this.permanent.keys(), ...this.temporary.keys(), ...this.patterns.patterns()]
  }
}
