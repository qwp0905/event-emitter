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

    ev.removeAllListeners()
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
    ev.emit(pattern)

    expect(handler).toHaveBeenCalledTimes(1)
  })
})
