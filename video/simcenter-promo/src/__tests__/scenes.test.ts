import { describe, expect, it } from "vitest";
import { SCENES } from "../scenes";

describe("SCENES", () => {
  it("has exactly the 9 storyboard scenes", () => {
    expect(SCENES).toHaveLength(9);
  });

  it("has unique ids in storyboard order", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "title",
      "problem",
      "solution",
      "how-it-works-launch",
      "how-it-works-cases",
      "how-it-works-competencies",
      "pdf-report",
      "growth-pitch",
      "cta",
    ]);
  });

  it("durations sum to exactly 4500 frames (150s at 30fps)", () => {
    const total = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);
    expect(total).toBe(4500);
  });

  it("carries the approved storyboard copy for key beats", () => {
    const title = SCENES.find((s) => s.id === "title");
    const problem = SCENES.find((s) => s.id === "problem");
    const cta = SCENES.find((s) => s.id === "cta");

    expect(title?.kind).toBe("logo");
    if (title?.kind === "logo") {
      expect(title.props.title).toBe("DNS SimCenter");
    }

    expect(problem?.kind).toBe("text");
    if (problem?.kind === "text") {
      expect(problem.props.text).toBe(
        "Каждый день — решения, которые негде потренировать. Ошибка на практике стоит дорого.",
      );
    }

    expect(cta?.kind).toBe("logo");
    if (cta?.kind === "logo") {
      expect(cta.props.title).toBe("Участвуйте в SimCenter");
    }
  });
});
