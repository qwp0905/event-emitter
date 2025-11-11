import type { Config } from "jest"

export default {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  roots: ["<rootDir>/tests"],
  testRegex: "^.*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testEnvironment: "node",
  verbose: true
} satisfies Config
