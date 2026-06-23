---
name: ui-redesign
description: Use when changing visual layout, interface structure, dashboard screens, cards, panels, or responsive behavior.
---

# UI Redesign Skill

## Purpose

Use this skill when changing screens, layouts, panels, cards, controls, dashboards, or responsive behavior.

The goal is not to make the screen decorative. The goal is to make it clearer while preserving the product logic.

## Before Changing UI

List:
- every existing visible element;
- every existing interaction;
- every route or state affected by the screen;
- what must be preserved;
- what may change: placement, size, hierarchy, wording, visual style.

If the design reference conflicts with the actual engine or data model, the engine is the source of truth.

## Rules

Do not:
- remove functionality;
- hide controls;
- break active states;
- break empty, loading, disabled, or error states;
- create horizontal scroll;
- create unreadable dense layouts;
- copy generic AI dashboard patterns blindly;
- prioritize visual novelty over workflow clarity.

Prefer:
- clear hierarchy;
- readable FullHD layout;
- stable spacing;
- predictable controls;
- short labels;
- visible status and feedback;
- project-specific visual language.

## After Changing UI

Verify:
- build/check/test pass where applicable;
- the screen opens in browser;
- no console errors appear;
- no horizontal scroll appears;
- all original interactions still work;
- active states and counters still work;
- responsive layout remains acceptable.

## Final Report Additions

For UI work, include:
- preserved elements;
- moved or redesigned elements;
- removed elements, only if explicitly approved;
- browser verification result;
- layout risks.
