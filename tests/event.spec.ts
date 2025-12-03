import { EventEmitter } from "../src"

describe("EventEmitter", () => {
  let ev: EventEmitter

  beforeEach(() => {
    ev = new EventEmitter()
  })

  it("should emit event", () => {
    const handler = jest.fn()
    const pattern = "test"
    ev.on(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)

    ev.emit("sdlkfj")
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should emit event with arguments", () => {
    const args = [1, 2, 3]
    const handler = jest.fn()
    const pattern = "test"
    ev.on(pattern, handler)
    ev.emit(pattern, ...args)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenNthCalledWith(1, ...args)
  })

  it("should emit event with wildcard", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()
    const handler4 = jest.fn()
    const handler5 = jest.fn()

    ev.on("abc", handler1)
    ev.on("a*", handler2)
    ev.on("*c", handler3)
    ev.on("*", handler4)
    ev.on("*cc", handler5)

    ev.emit("abc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(0)

    ev.emit("a")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(2)
    expect(handler5).toHaveBeenCalledTimes(0)

    ev.emit("c")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(3)
    expect(handler5).toHaveBeenCalledTimes(0)

    ev.emit("*")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(4)
    expect(handler5).toHaveBeenCalledTimes(0)

    ev.emit("abcd")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(3)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(5)
    expect(handler5).toHaveBeenCalledTimes(0)

    ev.emit("cc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(3)
    expect(handler3).toHaveBeenCalledTimes(3)
    expect(handler4).toHaveBeenCalledTimes(6)
    expect(handler5).toHaveBeenCalledTimes(1)
  })

  it("should emit event with nested wildcard", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()

    ev.on("a*a", handler1)
    ev.on("a", handler2)

    expect(ev.emit("a")).toBe(true)
    expect(handler1).toHaveBeenCalledTimes(0)
    expect(handler2).toHaveBeenCalledTimes(1)

    expect(ev.emit("aa")).toBe(true)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it("should emit event with symbol", () => {
    const pattern = Symbol()
    const handler = jest.fn()
    ev.on(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)

    ev.emit(Symbol())
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should emit event with multiple symbol", () => {
    const pattern1 = Symbol()
    const pattern2 = Symbol()
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()

    ev.on(pattern1, handler1)
    ev.on(pattern1, handler3)
    ev.on(pattern2, handler2)

    ev.emit(pattern1)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(0)
    expect(handler3).toHaveBeenCalledTimes(1)

    ev.emit(pattern2)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
  })

  it("should remove event handler", () => {
    const handler = jest.fn()
    const pattern = "test"
    ev.on(pattern, handler)

    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)

    ev.off(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should remove event handler with wildcard", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()
    const handler4 = jest.fn()
    const handler5 = jest.fn()

    ev.on("abcc", handler1)
    ev.on("a*c", handler2)
    ev.on("*c", handler3)
    ev.on("*b*", handler4)
    ev.on("*cc", handler5)

    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)

    ev.off("*b*", handler4)
    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(2)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(2)
  })

  it("should remove event handler with symbol", () => {
    const pattern = Symbol()
    const handler = jest.fn()
    ev.on(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)

    ev.off(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should remove event handler with multiple symbol", () => {
    const pattern1 = Symbol()
    const pattern2 = Symbol()
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()

    ev.on(pattern1, handler1)
    ev.on(pattern1, handler3)
    ev.on(pattern2, handler2)

    ev.emit(pattern1)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(0)
    expect(handler3).toHaveBeenCalledTimes(1)

    ev.off(pattern1, handler3)
    ev.emit(pattern1)
    expect(handler1).toHaveBeenCalledTimes(2)
    expect(handler2).toHaveBeenCalledTimes(0)
    expect(handler3).toHaveBeenCalledTimes(1)

    ev.off(pattern1, handler1)
    ev.emit(pattern1)
    expect(handler1).toHaveBeenCalledTimes(2)
    expect(handler2).toHaveBeenCalledTimes(0)
    expect(handler3).toHaveBeenCalledTimes(1)

    ev.emit(pattern2)
    expect(handler1).toHaveBeenCalledTimes(2)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)

    ev.off(pattern2, handler2)
    ev.emit(pattern2)

    expect(handler1).toHaveBeenCalledTimes(2)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
  })

  it("should remove all event handlers by pattern", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()
    const handler4 = jest.fn()
    const handler5 = jest.fn()

    const pattern = "abc"

    ev.on(pattern, handler1)
    ev.on(pattern, handler2)
    ev.on(pattern, handler3)
    ev.on(pattern, handler4)
    ev.on(pattern, handler5)

    ev.emit(pattern)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)

    ev.removeAllListeners(pattern)
    ev.emit(pattern)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)
  })

  it("should remove all event handlers by wildcard", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()
    const handler4 = jest.fn()
    const handler5 = jest.fn()

    ev.on("abcc", handler1)
    ev.on("a*c", handler2)
    ev.on("*c", handler3)
    ev.on("*b*", handler4)
    ev.on("*cc", handler5)

    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)

    ev.removeAllListeners("abcc")
    ev.removeAllListeners("a*c")
    ev.removeAllListeners("*c")
    ev.removeAllListeners("*b*")
    ev.removeAllListeners("*cc")
    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)
  })

  it("should no effect if remove event handler with wrong pattern", () => {
    const pattern = "abc"
    const handler = jest.fn()
    ev.on(pattern, handler)

    ev.off(pattern, jest.fn())
    expect(ev.emit(pattern)).toBe(true)

    expect(handler).toHaveBeenCalledTimes(1)

    ev.off("a*b*c**c", handler)
    expect(ev.emit(pattern)).toBe(true)

    expect(handler).toHaveBeenCalledTimes(2)

    ev.removeAllListeners("sdfk")
    expect(ev.emit(pattern)).toBe(true)
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it("should emit event once", () => {
    const handler = jest.fn()
    const pattern = "test"
    ev.once(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should emit event once with wildcard", () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    const handler3 = jest.fn()
    const handler4 = jest.fn()
    const handler5 = jest.fn()

    ev.once("abcc", handler1)
    ev.once("a*", handler2)
    ev.once("*c", handler3)
    ev.once("*", handler4)
    ev.once("*cc", handler5)

    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)

    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)

    ev.emit("abcc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)
    expect(handler5).toHaveBeenCalledTimes(1)
  })

  it("should remove once event handler", () => {
    const handler = jest.fn()
    const handler2 = jest.fn()
    ev.once("1", handler)
    ev.once("111", handler)
    ev.on("111", handler2)
    ev.once("112", handler)
    ev.once("1123", handler)

    ev.off("111", handler)
    ev.emit("111")
    expect(handler).toHaveBeenCalledTimes(0)
    expect(handler2).toHaveBeenCalledTimes(1)

    ev.off("111", handler2)
    ev.emit("111")
    expect(handler).toHaveBeenCalledTimes(0)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it("should emit event once with symbol", () => {
    const pattern = Symbol()
    const handler = jest.fn()
    ev.once(pattern, handler)
    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)

    ev.emit(pattern)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("should return event names", () => {
    const handler = jest.fn()
    ev.once("abcc", handler)
    ev.once("a*", handler)
    ev.once("*c", handler)
    ev.once("*", handler)
    ev.once("*cc", handler)

    const names = ev.eventNames()
    expect(names.length).toBe(5)
    expect(names.includes("abcc")).toBe(true)
    expect(names.includes("a*")).toBe(true)
    expect(names.includes("*c")).toBe(true)
    expect(names.includes("*")).toBe(true)
    expect(names.includes("*cc")).toBe(true)
  })

  it("should emit event with multiple patterns", () => {
    const patterns = Array.from({ length: 100 }, (_, i) => i.toString().padStart(3, "0"))
    const handlers = patterns.map(() => jest.fn())

    for (let i = 0; i < patterns.length; i += 1) {
      ev.once(patterns[i], handlers[i])
    }

    for (let i = 0; i < patterns.length; i += 1) {
      expect(ev.emit(patterns[i])).toBe(true)
      for (let j = 0; j <= i; j += 1) {
        expect(handlers[j]).toHaveBeenCalledTimes(1)
      }
      for (let j = i + 1; j < patterns.length; j += 1) {
        expect(handlers[j]).toHaveBeenCalledTimes(0)
      }
    }
    for (let i = 0; i < patterns.length; i += 1) {
      expect(ev.emit(patterns[i])).toBe(false)
      for (let j = 0; j < patterns.length; j += 1) {
        expect(handlers[j]).toHaveBeenCalledTimes(1)
      }
    }
  })
})
