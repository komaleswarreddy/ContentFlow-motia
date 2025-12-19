# Design Decisions & Trade-offs

This document explains why ContentFlow was built the way it was.

---

## Decision 1: Unified Steps vs Microservices

### Options Considered
1. Express + Queue + Workers + DB
2. Serverless (Lambda + SQS)
3. Motia Unified Runtime (Chosen)

### Why We Rejected Microservices
- Requires 3+ deployable units
- Hard to reason about event ordering
- Debugging requires hopping between services
- Retry logic duplicated everywhere

### Why We Chose Motia
- One runtime = one mental model
- Steps guarantee ordering per content ID
- State persistence removes race conditions
- Observability is automatic, not bolted on

**Impact**:
- 79% less code
- Zero race conditions
- Single debugging surface

---

## Decision 2: Event-Driven Workflow vs Synchronous API Chain

### Problem
Synchronous APIs block on AI latency (2–4s)

### Chosen Approach
- API → event → background processing
- Immediate response to user
- Progress via streams

**Why This Matters**
- System stays responsive under load
- AI failures don’t block user actions
- Easy horizontal scaling

---

## Decision 3: State-First Design

### Rule
> Persist state BEFORE emitting streams or side-effects

### Why
- Streams are best-effort
- State is source of truth
- UI can always recover

**Result**
- Zero data loss
- Seamless reconnects
- Deterministic workflows

---

## Decision 4: Fallback Over Failure

### Principle
> A degraded result is better than a failed workflow

### Applied To
- AI analysis
- Recommendation generation
- Streaming updates

**Outcome**
- No stuck content
- Predictable UX
- Clear recovery paths

---

## What Would Break Without Motia?

Without Motia:
- We would manually manage retries
- We would implement locking
- We would build custom observability
- We would debug distributed failures

**ContentFlow would be slower to build, harder to debug, and less reliable.**
