# CLAUDE.md - Project Context for AI Sessions

This file provides persistent context for Claude Code sessions. Read this at the start of every session.

## Project Identity

- **Project Name**: OTSP (On The Same Page)
- **Repository Name**: On-The-Same-Page
- **NOT**: "One True Screenwriting Platform" or "Re-Writer" (old name)

## What OTSP Is

OTSP is a complete film production ecosystem - from development to wrap. It's a web-based platform containing multiple production apps.

## Apps Within OTSP

The platform contains these apps (these names are correct and should not be changed):

| App ID | Display Name | Purpose |
|--------|--------------|---------|
| `blueprint` | BluePrint | Story Development |
| `corkboard` | CorkBoard | Visual Planning |
| `rewriter` | ReWriter | Screenwriting (the only thing called "ReWriter") |
| `breakdown` | BreakDown | Script Breakdown |
| `artcart` | ArtCart | Art Department |
| `viewfinder` | ViewFinder | Shot Planning |
| `basecamp` | BaseCamp | Scheduling |
| `onset` | OnSet | Live Production |
| `supervisor` | SuperVisor | Script Supervisor |

## Naming Rules

1. **Platform name**: "OTSP" or "On The Same Page"
2. **ReWriter**: ONLY refers to the screenwriting app within OTSP
3. **Never use**: "Re-Writer" (old project name), "One True Screenwriting Platform" (incorrect)

## Deployment

- **Vercel**: Primary deployment platform
- **Domain**: TBD (was re-writer.netlify.app, needs update)

## Tech Stack

- React 19 + TypeScript
- Vite
- Zustand (state management)
- Google OAuth + Drive integration for cloud storage

## Key Decisions Log

- 2026-02: Renamed from "Re-Writer" to "OTSP (On The Same Page)"
- ReWriter remains as the screenwriting app name only
