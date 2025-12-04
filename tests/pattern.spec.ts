import { PatternMatcher } from "../src/node"

describe("PatternMatcher", () => {
  let node: PatternMatcher

  beforeEach(() => {
    node = new PatternMatcher()
  })

  it("should shrink when temporary called 1", () => {
    node.insert("abcc", () => {}, true)
    node.insert("a*c", () => {}, true)
    node.insert("*c", () => {}, true)
    node.insert("*", () => {}, true)
    node.insert("*cc", () => {}, true)
    node.insert("*b*", () => {}, true)

    expect(node.call("abcc", [])).toBe(true)
    expect(node["root"].isEmpty()).toBe(true)
  })

  it("should shrink when temporary called 2", () => {
    const c = 1_000
    for (let i = 0; i < c; i += 1) {
      const k = i.toString().split("").join("*")
      node.insert(k, () => {}, true)
    }

    for (let i = 0; i < c; i += 1) {
      expect(node.call(i.toString(), [])).toBe(true)
    }

    expect(node["root"].isEmpty()).toBe(true)
  })

  it("should remove when temporary called", () => {
    node.insert("abcc", () => {})
    node.insert("a*c", () => {})
    node.insert("*c", () => {})
    node.insert("*", () => {})
    node.insert("*cc", () => {})
    node.insert("*b*", () => {})

    node.remove("abcc")
    node.remove("a*c")
    node.remove("*c")
    node.remove("*")
    node.remove("*cc")
    node.remove("*b*")

    expect(node["root"].isEmpty()).toBe(true)
  })
})
