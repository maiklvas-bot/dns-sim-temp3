# DNS SimCenter — Telegram control room

## Status

Outbound delivery and project-topic routing were verified on 2026-09-21. Telegram accepted a redacted test message in the dedicated **DNS SimCenter** topic. The project topic registry resolves that topic to the canonical repository; local roots and message identifiers are intentionally not published here.

## Intended binding

```text
Telegram topic: DNS SimCenter
thread_id: <LOCAL_THREAD_ID>
Project: hermes-dns-sim
Board: hermes-dns-sim
Repo: <LOCAL_REPO_ROOT>
Skill: project-development
```

The stable topic is registered in Hermes `dm_topics`, the CX Forge topic-workspace registry and the durable universal-routing store as project `sim`. `hermes send` may be used for explicit safe project notifications; lifecycle tasks can retain the same project destination snapshot. The local menu/router loads the topic registry for each action, so repository routing changes do not require a gateway restart.

Provider acknowledgement proves outbound submission to Telegram. A timeout must be recorded as `delivery_unknown`, never as delivered.

## Owner messages

```text
продолжай проект
исправь <проблему>
какой статус?
покажи блокеры
```

## Hermes behaviour

- resolve topic -> `hermes-dns-sim` project -> same board -> primary repository;
- load `.hermes.md` and `project-development` skill;
- substantial engineering -> Kanban + isolated project worktree;
- send only meaningful transitions: needs_input/BLOCK, review verdict, authorization boundary, PR/merge/post-merge result;
- append every material transition to the Obsidian worklog;
- no heartbeat/tool spam;
- no push/PR/merge/release/deploy without explicit owner authorization.

## Security

Never send credentials, secrets, auth headers, raw personal results, production tokens or full logs to Telegram or Obsidian. Refer to secure local paths and concise redacted evidence.
