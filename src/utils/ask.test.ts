import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ask } from "./ask.ts";

const { mockClose, mockQuestion, mockCreateInterface } = vi.hoisted(() => {
  const mockClose = vi.fn();
  const mockQuestion = vi.fn();
  const mockCreateInterface = vi.fn(() => ({
    close: mockClose,
    question: mockQuestion,
  }));
  return { mockClose, mockQuestion, mockCreateInterface };
});

vi.mock("node:readline", () => ({
  createInterface: mockCreateInterface,
}));

describe("ask", () => {
  beforeEach(() => {
    mockClose.mockReset();
    mockQuestion.mockReset();
    mockCreateInterface.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return the user's answer", async () => {
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("my answer");
      },
    );

    const result = await ask("What is your name?");

    expect(result).toBe("my answer");
  });

  it("should trim whitespace from the answer", async () => {
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("  answer with spaces  ");
      },
    );

    const result = await ask("Enter something:");

    expect(result).toBe("answer with spaces");
  });

  it("should pass the question string to readline", async () => {
    const questionText = "Are you sure? (y/n)";
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("y");
      },
    );

    await ask(questionText);

    expect(mockQuestion).toHaveBeenCalledWith(
      questionText,
      expect.any(Function),
    );
  });

  it("should close the readline interface after receiving an answer", async () => {
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("yes");
      },
    );

    await ask("Close me?");

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should return an empty string when user enters nothing", async () => {
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("");
      },
    );

    const result = await ask("Press enter to continue:");

    expect(result).toBe("");
  });

  it("should create readline interface with process.stdin and process.stdout", async () => {
    mockQuestion.mockImplementation(
      (_question: string, onAnswer: (answer: string) => void) => {
        onAnswer("ok");
      },
    );

    await ask("Test stdio:");

    expect(mockCreateInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
    });
  });
});
