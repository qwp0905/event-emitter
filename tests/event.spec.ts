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

    ev.on("abc", handler1)
    ev.on("a*", handler2)
    ev.on("*c", handler3)
    ev.on("*", handler4)

    ev.emit("abc")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(1)

    ev.emit("a")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(1)
    expect(handler4).toHaveBeenCalledTimes(2)

    ev.emit("c")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(3)

    ev.emit("*")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(2)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(4)

    ev.emit("abcd")
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(3)
    expect(handler3).toHaveBeenCalledTimes(2)
    expect(handler4).toHaveBeenCalledTimes(5)
  })
})
