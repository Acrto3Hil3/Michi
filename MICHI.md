# MICHI

**The path from idea to software.**

From rough ideas to clear engineering decisions, architecture, and precise
instructions for your AI coding agent.

---

## 1. Document Purpose

This document is the **master source of truth** for MICHI.

It explains:

- What MICHI is
- Why MICHI exists
- Which problem it solves
- Who it is designed for
- What the creator is trying to achieve
- The philosophy behind the product
- How MICHI should behave
- How a nontechnical person should be able to use it
- How MICHI works with existing AI coding agents
- How project context and engineering decisions are stored
- How architecture and technology choices are made
- How tasks are planned and handed to coding agents
- How implementation should be reviewed, tested, debugged, and verified
- The seven initial skills
- CLI responsibilities
- Internal architecture
- Data models
- State management
- Context engineering
- Knowledge graph
- Prompt compilation
- Security and permissions
- Token/cost optimization
- Open-source philosophy
- What MICHI must NOT become
- Development roadmap
- MVP boundaries
- Long-term vision
- Engineering acceptance criteria

Treat this document as the product vision + product requirements + engineering
direction + architectural principles for MICHI.

If an implementation decision is not explicitly specified here, use the
principles in this document to propose the **smallest appropriate solution**
rather than inventing unnecessary complexity.

## 2. Product Identity

**Name:** MICHI

**Primary tagline:** The path from idea to software.

**Explanatory tagline:** From rough ideas to clear engineering decisions,
architecture, and precise instructions for your AI coding agent.

## 3. The Meaning Behind MICHI

The name MICHI is intentionally short, memorable, and conceptually connected to
the product.

"Michi" can evoke the Japanese concept of 道 (michi) — a way, path, road, or
journey. That fits the product extremely well.

MICHI represents the path between:

Human idea → Engineering understanding → Architecture → Plan → AI implementation → Verified software

MICHI is not the destination. MICHI is the engineering path.

The user does not need to understand every technical road that must be
travelled. MICHI helps create that road.

## 4. The Core Vision

MICHI exists because software development is changing.

Traditionally, if a nontechnical founder wanted to build software, they needed a
software company or technical team. The process looked approximately like:

```text
Client / Founder
        ↓
Product Manager
        ↓
Business Analyst
        ↓
UX / UI Designer
        ↓
Software Architect
        ↓
Frontend Engineer
        ↓
Backend Engineer
        ↓
Database Engineer
        ↓
Security Engineer
        ↓
QA / Tester
        ↓
DevOps / Cloud Engineer
        ↓
Code Review
        ↓
Production Software
```

The client did not need to know how PostgreSQL indexes work. The client did not
need to know how authentication middleware works. The client did not need to
understand API contracts. The client did not need to know how CI/CD works.

The client needed to communicate: *"This is what I want my software to do."*

The engineering team converted that business intention into technical execution.

## 5. The New AI Software Development World

AI coding agents have changed the execution layer.

Tools such as Claude Code, Codex, Kimi Code, Gemini CLI, Antigravity, OpenCode,
Cursor, Windsurf, Cline, Roo Code, Kilo, Qwen Code, local coding agents, and
other future agentic coding systems can already perform significant engineering
work.

They can inspect repositories, create files, modify code, install dependencies,
write tests, run commands, debug problems, refactor code, work across frontend
and backend, and interact with development environments.

But there is still a major problem.

## 6. The Problem MICHI Solves

The real problem is not primarily "AI cannot code." AI coding agents can already
code extremely well in many situations.

The problem is:

> Most people do not know how to communicate software engineering intent
> precisely enough to an AI coding agent.

A nontechnical founder might say:

*"I want an app where customers can register, buy products, track orders and
receive notifications."*

That sounds clear to a human. But technically it leaves hundreds of questions
unanswered.

**Product questions.** Who are the users? What is a customer? Is there an admin?
Are there vendors? Can guests purchase? What happens when an order is cancelled?
What happens when payment fails? What happens when inventory is unavailable?

**Authentication questions.** Email/password? OTP? OAuth? Social login?
Sessions? JWT? Third-party identity provider?

**Database questions.** PostgreSQL? MongoDB? SQLite? What entities exist? What
relationships exist? What constraints exist? What indexes are needed?

**API questions.** REST? GraphQL? What endpoints? What request/response
contracts? What errors? What authorization rules?

**Architecture questions.** Monolith? Modular monolith? Microservices?
Serverless? Background workers? Event-driven processing?

**Security questions.** Role-based access? Rate limiting? Input validation?
Password hashing? Secrets? Audit logs? File upload security?

**Testing questions.** Unit tests? Integration tests? E2E tests? What are the
critical flows?

**Deployment questions.** VPS? AWS? Cloudflare? Render? Railway? Docker? CI/CD?
Environment separation?

The user doesn't necessarily know that these questions exist. That is the
fundamental problem MICHI is designed to solve.

## 7. The Current Pain With AI Coding

Without a structured engineering layer, users often do this:

```text
User: "Build login."
AI:   creates login
User: "Now add Google login."
AI:   changes authentication
User: "Now add forgot password."
AI:   changes authentication again
User: "The UI doesn't look right."
AI:   changes files
User: "Why did you create these files?"
AI:   explains
User: "Fix this bug."
AI:   changes more files
User: "Now the previous feature is broken."
AI:   fixes another thing
```

This creates unnecessary tokens, unnecessary context, unnecessary files,
unnecessary dependencies, inconsistent architecture, repeated decisions,
accidental complexity, regressions, architectural drift, poor documentation,
unclear project state, wasted subscription usage, and frustration.

The user becomes the accidental software architect. That is exactly what MICHI
is trying to prevent.

## 8. MICHI's Fundamental Idea

MICHI introduces an engineering layer between the human and the coding agent.

Instead of:

```text
Human → AI Coding Agent → Code
```

MICHI creates:

```text
Human
  ↓
MICHI
  ↓
Engineering Understanding
  ↓
Requirements
  ↓
Decisions
  ↓
Architecture
  ↓
Implementation Plan
  ↓
Relevant Context
  ↓
Precise Agent Instruction
  ↓
Existing AI Coding Agent
  ↓
Code
  ↓
Testing / Review / Verification
  ↓
MICHI Project Knowledge
```

This is the central architecture of the product.

## 9. What MICHI Actually Is

> An open-source, local-first software engineering intelligence and
> orchestration layer that translates human software intent into structured
> requirements, engineering decisions, architecture, implementation plans,
> relevant project context, and precise instructions for existing AI coding
> agents.

MICHI is effectively a virtual software engineering company for AI-assisted
development. But it is not pretending to be a company. It implements the useful
engineering processes normally performed by that company.

## 10. What MICHI Is NOT

MICHI is NOT: a new AI coding agent · a replacement for Claude Code · a
replacement for Codex · a replacement for Kimi Code · a SaaS product · a website
· a hosted dashboard · a cloud platform · a mandatory LLM provider · a custom AI
model · an online IDE · a billing platform · a project management SaaS · a
hosted database · a vector database product · a mandatory API service · a
deployment platform · a code hosting platform.

MICHI should not compete with coding agents. It should make existing coding
agents significantly more effective.

## 11. The Primary User

> A nontechnical or semi-technical founder, product owner, entrepreneur,
> creator, or business user who wants to build software using AI coding agents
> but does not understand professional software engineering deeply enough to
> direct the implementation themselves.

They may know what their business does, what problem they want to solve, what
features they want, what customers need, and what the desired user experience
should feel like.

They may NOT know software architecture, databases, API design, security,
testing strategy, infrastructure, DevOps, system design, dependency management,
or context engineering.

MICHI should bridge that gap.

## 12. Secondary Users

**Junior developers** can learn professional engineering processes while using
AI. **Experienced developers** can reduce repetitive planning/context work.
**Technical founders** can use MICHI as a structured engineering control layer.
**AI coding power users** can use MICHI for project memory, architecture
decisions, context packets, task planning, verification, and agent handoff.
**Software teams** can eventually get standardized engineering workflows.

## 13. The Most Important UX Principle

> The user should NOT have to become a software engineer in order to use MICHI.

MICHI should speak in two layers.

**Human layer.** Explain things in understandable language:

*"We need to decide how users will log in."*

```text
A. Email + password
B. OTP
C. Google / Apple login
D. Authentication provider
```

*"For your current requirements, I recommend an authentication provider because
it reduces the amount of security-sensitive code we need to maintain."*

Then ask: *"Would you like to use this approach?"*

The user chooses. Only after confirmation does MICHI lock the decision.

## 14. MICHI's Decision Philosophy

The central interaction pattern is:

**Recommend → Explain → Ask → Confirm → Lock → Execute**

MICHI should never silently make important product decisions on behalf of the
user. The system may recommend. The user decides.

## 15. Decision Hierarchy

When conflicting information exists, use:

```text
1. Explicit user decision
2. Project constraints
3. Security / safety requirements
4. Existing locked architecture
5. Engineering recommendation
6. Default
```

A recommendation is NOT a decision. A proposed architecture is NOT an approved
architecture. Only an explicit user-approved decision becomes locked project
state.

## 16. Example Decision Flow

User says: *"I need login."*

MICHI should not immediately generate code. It should understand that
authentication architecture must be decided. Options:

```text
1. Session-based authentication
2. JWT authentication
3. OAuth/OIDC
4. Managed authentication provider
```

MICHI explains how each works, major advantages, tradeoffs, complexity, security
implications, cost implications, suitability for the current project. Then:

*"Based on your requirements, I recommend option 4. Do you want to use it?"*

User: *"Yes."* MICHI records:

```text
D001
Decision: Authentication
Choice: Managed authentication provider
Status: LOCKED
Reason: Reduces custom security implementation and maintenance.
Approved by: User
```

Future agents should not repeatedly reconsider the same question.

## 17. Decisions Are Project Memory

> Conversation is not project memory. Project artifacts are project memory.

Chat history is temporary. Project decisions must be persistent. Therefore
important decisions should become structured project artifacts:

```text
<project-brain>/
└── decisions/
    ├── index.yaml
    ├── ADR-001-frontend.md
    ├── ADR-002-backend.md
    ├── ADR-003-database.md
    └── ADR-004-authentication.md
```

This allows future agents to understand what was chosen, why, when, what
alternatives were rejected, and whether it is still active.

## 18. Decision Changes

Decisions must be changeable.

Initially `Database = PostgreSQL`. Later the user says *"I want MongoDB
instead."*

MICHI should NOT simply change every file. It should perform **impact
analysis**, identifying affected architecture, ORM changes, schema changes,
queries, migrations, services, tests, dependencies, deployment implications, and
existing features affected. Then explain the consequences.

The new decision only becomes active after user confirmation. The previous
decision becomes `SUPERSEDED` rather than disappearing. This creates an
architectural history.

## 19. Progressive Discovery

MICHI must not ask the user 50 technical questions at the beginning. It should
progressively discover information.

> Ask only what is necessary for the next meaningful decision.

User: *"I want to build a pharmacy management system."*

MICHI might first clarify: Who will use it? What is the primary workflow? Is it
for one pharmacy or multiple pharmacies?

It does not immediately ask *"Would you prefer PostgreSQL with Prisma or
Drizzle?"* — that decision may not yet matter.

```text
Understand
   ↓
Identify missing information
   ↓
Ask only relevant question
   ↓
Update understanding
   ↓
Determine next decision
   ↓
Recommend options
   ↓
Ask for confirmation
```

## 20. The Engineering Company Model

MICHI conceptually contains several software-company responsibilities. The
initial implementation should represent these as **skills/workflows** rather
than spawning dozens of permanent agents.

The first seven skills are:

```text
senior-engineer
architecture
product-planner
implementer
reviewer
tester
debugger
```

## 21. Skill 1 — senior-engineer

The main orchestrator and primary interface between the user and MICHI.

Responsibilities: understand user intent · inspect project · detect existing
technology · understand project state · identify ambiguity · ask clarification
questions · recommend engineering approaches · request confirmation · record
decisions · route work to appropriate skills · protect architectural consistency
· maintain project state · coordinate planning and implementation · ensure
verification.

It should behave like a senior software engineer / engineering lead. It should
NOT directly perform every task itself.

## 22. Skill 2 — product-planner

Transforms rough business ideas into structured product requirements.

Responsibilities: identify target users · identify business problem · identify
use cases · identify goals · define MVP · define future scope · define
functional requirements · define non-functional requirements · identify
assumptions · identify constraints · identify acceptance criteria · create PRD ·
create TRD.

Example transformation — *"I want an app where shop owners can manage stock."*
becomes:

```text
Product:        Inventory Management System
Primary user:   Shop owner
Core problem:   Manual inventory tracking causes stock inaccuracies.

MVP capabilities:
- product management
- stock in
- stock out
- stock adjustment
- low-stock alerts
- inventory history

Out of scope:
- accounting
- payroll
- advanced forecasting
```

## 23. Skill 3 — architecture

Responsible for engineering architecture: frontend · backend · database · API ·
authentication · authorization · security · scalability · caching · background
jobs · queues · file storage · third-party integrations · deployment ·
observability · technology selection · design patterns.

It should present options:

```text
Backend architecture:
A. Traditional monolith
B. Modular monolith
C. Microservices
D. Serverless
```

For a small product, MICHI might recommend a modular monolith. But the user
still decides.

## 24. Skill 4 — implementer

The implementer does not blindly code. Its job is to transform approved
engineering state into an implementation instruction for the user's coding
agent.

```text
Input:  User intent + Requirements + Approved decisions + Architecture
        + Task + Relevant project context + Acceptance criteria
Output: Precise implementation instruction
```

The existing coding agent then performs the actual coding.

## 25. Skill 5 — reviewer

Evaluates implementation against: requirement compliance · architecture
compliance · security · maintainability · performance · error handling · code
quality · unnecessary complexity · duplication · dependency additions · test
coverage · regressions · consistency with project decisions.

It returns `PASS` or `CHANGES_REQUIRED` with concrete findings. It must not
merely say "Looks good."

## 26. Skill 6 — tester

Handles appropriate testing across levels: Unit · Integration · API · E2E ·
Security · Regression · Performance.

MICHI should not blindly run every test type for every change. The testing
strategy depends on impact.

- Pure utility function change → unit tests
- API + database change → unit + integration + relevant API tests
- Complete checkout flow → unit + integration + E2E

## 27. Skill 7 — debugger

Follows a disciplined process:

```text
REPRODUCE → OBSERVE → FORM HYPOTHESES → TEST HYPOTHESES → IDENTIFY ROOT CAUSE
→ CREATE FIX PLAN → IMPLEMENT FIX → RUN TESTS → VERIFY → DOCUMENT
```

It must not randomly edit files until an error disappears. For bugs,
reproduction should be treated as evidence.

## 28. The Core MICHI Workflow

```text
USER IDEA → DISCOVERY → INTENT MODEL → USER CONFIRMATION → REQUIREMENTS
→ PRODUCT PLAN → TECHNICAL DECISIONS → USER CONFIRMATION → ARCHITECTURE
→ USER CONFIRMATION → IMPLEMENTATION PLAN → TASK GRAPH → CONTEXT RESOLUTION
→ PROMPT COMPILATION → EXISTING CODING AGENT → IMPLEMENTATION → TESTING
→ REVIEW → VERIFICATION → PROJECT STATE UPDATE
```

## 29. MICHI as a Compiler

> MICHI is a compiler for software engineering intent.

```text
Human Intent → Intent Model → Requirement Model → Decision Model
→ Architecture Model → Task Graph → Context Packet → Agent Instruction
```

Output goes to an existing AI coding agent. Then there is a reverse flow:

```text
Code → Tests → Review → Verification → Project State → Engineering Knowledge
```

MICHI should not be thought of as "just a prompt generator." It is a structured
engineering state compiler.

## 30. The MICHI Project Brain

Every initialized project should have a local MICHI directory:

```text
<project-brain>/
│
├── config.yaml
│
├── project/
│   ├── identity.md
│   ├── constraints.md
│   └── preferences.md
│
├── requirements/
│   ├── PRD.md
│   ├── TRD.md
│   └── requirements.yaml
│
├── architecture/
│   ├── SYSTEM.md
│   ├── COMPONENTS.md
│   ├── DATA.md
│   └── diagrams/
│
├── decisions/
│   ├── index.yaml
│   └── ADR-*.md
│
├── graph/
│   ├── nodes.json
│   └── edges.json
│
├── tasks/
│   ├── roadmap.yaml
│   ├── active/
│   └── completed/
│
├── context/
│   ├── packets/
│   └── summaries/
│
├── sessions/
│
└── state/
    └── state.yaml
```

This directory is the local project brain.

## 31. Why Local Project Memory?

MICHI should be local-first, portable, transparent, inspectable,
version-controllable, open-source, self-hosted.

A user should be able to `git clone` a project and the engineering knowledge
travels with it. No MICHI account. No hosted MICHI database. No internet
connection required for core functionality.

## 32. Project State

Project stages:

```text
DISCOVERY · SPECIFICATION · ARCHITECTURE · DESIGN · PLANNING
IMPLEMENTATION · VALIDATION · REVIEW · RELEASE · OPERATIONS
```

Task states:

```text
PENDING · READY · RUNNING · CHANGES_DETECTED · TESTING · REVIEWING
VERIFIED · DONE · FAILED · BLOCKED · STALLED · NEEDS_HUMAN
```

This prevents MICHI from relying entirely on conversation history.

## 33. Task State

Every meaningful implementation task should have:

```text
task_id · title · description · requirements · dependencies · decisions
context_hash · input_hash · status · attempt · agent · files_touched
tests · verification · created_at · updated_at
```

This makes work resumable and auditable.

## 34. Knowledge Graph

MICHI should maintain a lightweight project knowledge graph connecting
engineering concepts:

```text
Requirement → Feature → Use Case → Domain → Component → API → Database
→ Code → Test
```

Example:

```text
REQ-001
  └── AUTH-001
        ├── API-LOGIN
        │     └── src/auth/login.ts
        ├── DB-USER
        └── TEST-LOGIN
```

The first version should NOT introduce Neo4j or another external graph database.
Use local JSON adjacency/index structures. The goal is usefulness, not
infrastructure.

## 35. Code Intelligence

MICHI should understand the project structurally. Avoid relying only on regex.
Use Tree-sitter or an equivalent structural parser.

The scanner should identify files, modules, functions, classes, methods,
imports, exports, relationships, references, API boundaries, and relevant
symbols. This enables better context resolution.

## 36. Context Engineering

One of MICHI's most important responsibilities is deciding:

> What does the coding agent actually need to know for this task?

MICHI should NOT dump the entire repository, the entire conversation, every
project document, every source file, or every historical decision into the
coding agent's context. Instead it should **resolve** relevant context.

## 37. Context Layers

**Global context** — small and stable: project identity, current architecture,
core constraints, important locked decisions, current milestone.

**Domain context** — relevant subsystem: authentication, payments, inventory,
users, orders, etc.

**Task context** — specific to the task: requirements, relevant files, tests,
APIs, database models, acceptance criteria, constraints.

## 38. Context Packet

```text
CTX-104

TASK
Implement merchant inventory adjustment endpoint.

USER INTENT
Allow authorized merchants to increase or decrease stock.

RELEVANT REQUIREMENTS
REQ-021
REQ-024

ARCHITECTURE
Modular monolith
Inventory module owns stock mutations.

DECISIONS
D003 PostgreSQL
D004 Prisma
D007 REST API
D009 RBAC

RELEVANT FILES
src/modules/inventory/
src/modules/auth/
src/modules/products/

CONSTRAINTS
Do not change authentication architecture.
Do not create a second inventory service.

ACCEPTANCE CRITERIA
...

DO NOT CHANGE
...
```

## 39. Context Budgeting

MICHI should classify context as `MUST_INCLUDE` · `PREFERRED` · `OPTIONAL` ·
`EXCLUDED`, and rank information by relevance.

This reduces token usage, latency, model confusion, repeated explanations, and
irrelevant code changes.

## 40. Context Hashing

MICHI should support hashes for expensive work:

```text
task input hash + relevant project state hash + context hash
```

If nothing relevant changed, MICHI should detect that an expensive
context-generation operation does not need to run again. Implement carefully and
deterministically.

## 41. Prompt Compiler

MICHI compiles a technical instruction from structured state, containing
approximately:

```text
ROLE · PROJECT · TASK · USER REQUIREMENT · ENGINEERING INTERPRETATION
APPROVED DECISIONS · ARCHITECTURE · SCOPE · OUT OF SCOPE · RELEVANT FILES
IMPLEMENTATION RULES · SECURITY REQUIREMENTS · ACCEPTANCE CRITERIA
TESTING · VERIFICATION · STOP CONDITIONS · REPORT BACK
```

The prompt is a **generated artifact**. It is NOT the source of truth. The
structured project state is the source of truth.

## 42. Example Agent Instruction

A human may say *"Add inventory management."* MICHI should compile something
closer to:

```text
ROLE
You are implementing an approved inventory feature within the existing project.

PROJECT
Existing modular monolith.
Approved stack: React, Node.js, Express, PostgreSQL, Prisma

TASK
Implement stock adjustment for authorized merchants.

USER REQUIREMENT
Merchants must be able to increase or decrease product stock and see the
resulting inventory balance.

APPROVED DECISIONS
Authentication uses the existing authentication system.
Authorization uses existing merchant RBAC.
PostgreSQL is the approved database.
Prisma is the approved ORM.

ARCHITECTURE
Inventory mutations belong to the inventory module.

SCOPE
- stock adjustment API
- validation
- authorization
- persistence
- relevant UI
- tests

OUT OF SCOPE
- warehouse management
- forecasting
- accounting
- new authentication mechanisms

RELEVANT FILES
Inspect existing inventory, product, authorization and API modules before
creating new abstractions.

IMPLEMENTATION RULES
- Reuse existing patterns.
- Do not introduce a new framework.
- Do not duplicate existing validation.
- Do not create unnecessary abstractions.
- Validate all external input.
- Preserve existing architecture.

ACCEPTANCE CRITERIA
...

TESTING
Add appropriate unit/integration tests.

VERIFICATION
Run relevant tests and report results.

STOP CONDITIONS
Do not modify unrelated modules.

REPORT BACK
Report: files changed, decisions made, tests executed, verification results,
unresolved issues.
```

## 43. Minimal Engineering Principle

Before introducing something new, ask:

```text
1. Is it necessary?
2. Does the capability already exist?
3. Can the existing project handle it?
4. Can the platform handle it?
5. Can the standard library handle it?
6. Can the problem be solved more simply?
7. Does a new dependency genuinely provide enough value?
```

MICHI should strongly discourage unnecessary dependencies, duplicate utilities,
premature abstractions, unnecessary microservices, unnecessary databases,
unnecessary files, unnecessary frameworks, unnecessary configuration, and
unnecessary code.

The goal is not "write less code at all costs." The goal is:

> Use the minimum engineering complexity necessary to satisfy the approved
> requirements reliably.

## 44. Architecture Philosophy

MICHI should not force one architecture on every project.

```text
Understand requirements → Identify constraints → Generate viable architectures
→ Compare tradeoffs → Recommend → Ask user → Lock decision
```

Architecture should be proportional to the problem. A small application should
not automatically become a distributed system. A high-scale platform should not
automatically become a simple monolith if requirements genuinely demand more.

## 45. Technology Selection

Select technology based on requirements, project size, expected traffic, team
capability, budget, deployment constraints, ecosystem maturity, maintenance
burden, security, performance, and future requirements.

MICHI explains the differences in language the user can understand. Then the
user chooses.

## 46. User Preferences Must Be Respected

MICHI recommends PostgreSQL. The user says *"I want MongoDB."* MICHI should not
silently override. Instead:

1. Explain the tradeoffs
2. Identify architectural consequences
3. Adapt the architecture if possible
4. Ask for confirmation
5. Lock the decision

The user remains the decision-maker.

## 47. Token and Cost Optimization

1. **Prompt compression** — convert vague requests into precise instructions.
2. **Context compression** — provide only relevant project context.
3. **Conversation compression** — use persistent structured artifacts instead of
   repeatedly sending old conversation.
4. **Decision pre-resolution** — do not ask the coding agent to debate decisions
   already approved by the user.
5. **Context hashing** — avoid repeating unchanged expensive work.
6. **Fresh-context execution** — specialized tasks receive focused context
   rather than an enormous project history.

The objective: **maximum useful engineering work per AI token.**

## 48. Fresh Context Principle

A specialized worker should receive: task + relevant requirements + relevant
decisions + relevant architecture + relevant files + acceptance criteria.

It should NOT automatically receive: entire conversation + entire repository +
every historical decision + every project document.

This improves accuracy, speed, token efficiency, reasoning quality, and
reproducibility.

## 49. Verification Philosophy

"The agent says it is done" is never sufficient evidence.

> No completion without evidence.

Evidence may include unit tests, integration tests, API tests, E2E tests, type
checking, linting, build success, security checks, architecture review, runtime
verification, screenshots, logs, and reproduction of the original bug.

## 50. Acceptance Criteria

Every meaningful implementation task should have acceptance criteria:

```text
AC-001  Authorized merchants can increase stock.
AC-002  Authorized merchants can decrease stock.
AC-003  Stock cannot become negative unless explicitly permitted by business rules.
AC-004  Unauthorized users receive an authorization error.
AC-005  The change is persisted correctly.
AC-006  Relevant tests pass.
```

Acceptance criteria become the contract between User, MICHI, Coding Agent,
Reviewer, and Tester.

## 51. Security and Permission Model

MICHI operates on potentially sensitive source code. It should be local-first
and conservative. Actions have risk levels:

```text
READ · SAFE_WRITE · CODE_WRITE · DEPENDENCY_CHANGE · DATABASE_CHANGE
INFRA_CHANGE · DEPLOYMENT · DESTRUCTIVE
```

Example policy:

```yaml
source_read: AUTO
tests: AUTO
git_diff: AUTO
source_write: ASK
dependency_install: ASK
database_migration: ASK
deployment: ASK
production_database_change: BLOCK
```

Users should be able to configure these policies.

## 52. No Hidden Destructive Behavior

MICHI must never silently delete project data, modify production databases,
deploy production code, rotate credentials, remove dependencies, rewrite large
parts of the repository, or reset git history without appropriate authorization.

## 53. Local-First Privacy

```text
Source code stays local.
Project state stays local.
No telemetry.
No mandatory account.
No mandatory cloud service.
No mandatory LLM API.
```

If future integrations send information externally, that must be explicit.

## 54. Agent Agnosticism

MICHI must not depend on one AI provider. The architecture should support
Claude, Codex, Kimi, Gemini, OpenCode, Cursor, Windsurf, Cline, Roo Code, Qwen,
local LLM agents, and future agents.

The core should not know or care which model ultimately writes the code.

## 55. Agent Skills Integration

The primary integration mechanism should use a portable skill structure:

```text
skills/
├── senior-engineer/SKILL.md
├── architecture/SKILL.md
├── product-planner/SKILL.md
├── implementer/SKILL.md
├── reviewer/SKILL.md
├── tester/SKILL.md
└── debugger/SKILL.md
```

Skills contain instructions, references, templates, and scripts where
appropriate. But the deterministic engineering logic should live in the MICHI
core rather than becoming an enormous `SKILL.md`.

```text
AI Agent → MICHI Skill → MICHI Core / CLI → Project State
```

## 56. MICHI CLI

The CLI should remain intentionally small:

```bash
michi init
michi scan
michi status
michi discover
michi plan
michi decide
michi graph
michi context
michi task
michi review
michi test
michi debug
michi verify
michi explain
```

## 57. `michi init`

Initialize MICHI inside an existing project.

```bash
npx @michi/cli init
```

It should: detect project type · inspect package manager · detect framework ·
detect language · detect database · detect ORM · detect testing framework ·
detect deployment configuration · detect repository structure · detect supported
coding-agent integrations · show findings · ask permission · create the project
brain · create initial project map · create initial state.

It should not modify application source code during initialization unless
explicitly required.

## 58. `michi scan`

Scans the existing project. Potential sources: `package.json`, lockfiles,
`tsconfig`, `src/`, `app/`, `server/`, `client/`, `tests/`, `Dockerfile`,
`docker-compose`, `README`, environment examples, configuration, CI workflows,
database schema.

It should generate a structured project map.

## 59. `michi discover`

One of the most important commands. The user describes their idea — *"I want to
build software for small restaurants to manage inventory."*

MICHI should understand intent, restate understanding, identify ambiguity, ask
relevant questions, establish product boundaries, identify requirements, and
prepare the project for planning.

## 60. `michi plan`

Produces planning artifacts after sufficient discovery: PRD · TRD ·
Requirements · Architecture proposal · Database plan · API plan · Security plan
· Testing plan · Deployment plan · Implementation roadmap.

Planning must respect the decision workflow. MICHI should not silently lock
choices.

## 61. `michi decide`

Allows users to inspect and manage decisions:

```text
D001 Frontend     React          LOCKED
D002 Backend      Node.js        LOCKED
D003 Database     PostgreSQL     LOCKED
D004 ORM          Prisma         LOCKED
D005 Auth         Clerk          LOCKED
```

It can also explain why a decision exists.

## 62. `michi graph`

The first version can provide textual output. Optional
`michi graph --format mermaid`. No graphical application required for v1.

## 63. `michi context`

Allows users and agents to inspect context selection.

```bash
michi context TASK-034
```

```text
Context budget: 18,000 tokens

MUST INCLUDE
- requirement REQ-021
- ADR-004
- inventory service
- authorization module

PREFERRED
- product schema
- relevant API tests

EXCLUDED
- payment module
- marketing pages
- unrelated frontend components
```

This makes context engineering observable rather than magical.

## 64. `michi status`

```text
MICHI PROJECT STATUS

Stage:              IMPLEMENTATION
Current milestone:  Inventory MVP
Architecture:       LOCKED
Open decisions:     2
Active task:        TASK-034
Completed:          17
Blocked:            1
Verification:       14/17 verified
```

## 65. Suggested Core Architecture

```text
MICHI
│
├── packages/
│   ├── core/
│   │   ├── intent/
│   │   ├── decisions/
│   │   ├── context/
│   │   ├── graph/
│   │   ├── workflow/
│   │   ├── state/
│   │   ├── artifacts/
│   │   └── verification/
│   ├── cli/
│   ├── scanner/
│   └── adapters/
│
├── skills/
│   ├── senior-engineer/
│   ├── architecture/
│   ├── product-planner/
│   ├── implementer/
│   ├── reviewer/
│   ├── tester/
│   └── debugger/
│
├── schemas/
├── templates/
├── docs/
├── examples/
├── tests/
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

Initially avoid unnecessary package fragmentation. A simpler first
implementation may contain `@michi/core`, `@michi/cli`, `@michi/skills` and
expand only when real boundaries require it.

## 66. Recommended Technology Stack

| Concern | Choice | Reason |
|---|---|---|
| Core | TypeScript + Node.js | cross-platform, CLI ecosystem, typing, npm distribution, filesystem APIs, broad adoption, easy AI-tool integration |
| CLI | Commander | explicit and lightweight |
| Code intelligence | Tree-sitter | structural parsing, not regex-only |
| State storage | Markdown / YAML / JSON | no database in v1 |
| Validation | Zod + JSON Schema where appropriate | structured contracts validated |
| Graph | Custom local adjacency/index JSON | no graph database in v1 |
| Testing | Vitest | TDD for implementation |
| Package manager | pnpm | workspaces for the monorepo |
| Build | tsup | simple pipeline |
| Release | npm, GitHub, GitHub Actions, Changesets | |

## 67. Why No Database?

The project brain can live in Markdown, YAML and JSON: human-readable,
Git-friendly, portable, inspectable, easy to debug, easy to back up, no
migration system, no server, no database dependency.

If real-world usage later proves a database is necessary, that decision can be
made based on evidence.

## 68. Why No Vector Database?

MICHI should not introduce embeddings or vector search simply because it is an
AI-related product. The first version can use structured metadata, dependency
relationships, AST information, keyword search, graph relationships,
deterministic relevance scoring, and explicit context ranking.

Vector search should only be introduced if a concrete problem requires it.

## 69. Why No Mandatory LLM?

The user already has access to AI through their coding agent. MICHI's role is to
organize engineering work.

```text
MICHI Core       = Deterministic engineering state + workflow + context + artifacts
AI Coding Agent  = Reasoning + natural-language interaction + code execution
```

This makes MICHI cheaper, provider-neutral, offline-friendly, portable,
open-source, and future-proof.

## 70. Separation of Responsibilities

> MICHI decides and structures engineering work. The coding agent performs
> implementation.

MICHI: *"Implement merchant stock adjustment according to ADR-009."* Coding
agent: reads files, writes code, runs tests, modifies repository. MICHI: reviews
evidence and updates project state.

## 71. MICHI Should Not Become an Autonomous Monster

Avoid building 30 agents + agent manager + agent manager manager + LLM gateway +
vector database + message broker + cloud database + dashboard for the first
version. That would recreate the complexity MICHI is supposed to eliminate.

Instead: one core + small deterministic workflows + portable skills + existing
coding agents.

The system should be powerful because its engineering model is good, not because
it contains hundreds of services.

## 72. Traditional Team Simulation

Internally, MICHI can conceptually route responsibilities like Product Manager,
Business Analyst, Architect, UX Designer, Frontend Engineer, Backend Engineer,
Database Engineer, Security Engineer, DevOps Engineer, QA Engineer, Reviewer,
Debugger.

But these should initially be represented by workflows, skills, structured
tasks, and fresh contexts — not permanent autonomous agents.

## 73. State Machine

Project-level:

```text
DISCOVERY → SPECIFICATION → ARCHITECTURE → DESIGN → PLANNING
→ IMPLEMENTATION → VALIDATION → REVIEW → RELEASE → OPERATIONS
```

Tasks:

```text
PENDING → READY → RUNNING → CHANGES_DETECTED → TESTING → REVIEWING
→ VERIFIED → DONE
```

Failure paths: `FAILED` · `BLOCKED` · `STALLED` · `NEEDS_HUMAN`

## 74. Human-in-the-Loop Philosophy

Human approval should be required for meaningful choices: architecture ·
database · authentication · major dependencies · major infrastructure ·
production deployment · destructive operations · significant scope changes.

The system should not make the user approve every trivial implementation detail.

## 75. Product Decisions vs Engineering Decisions

**Product decision:** *"Customers should be able to cancel orders."*

**Engineering decision:** *"Order cancellation will be implemented using a state
transition model."*

The user primarily owns product decisions. MICHI recommends engineering
decisions. This separation is essential.

## 76. Scope Control

MICHI should explicitly track `IN SCOPE` · `OUT OF SCOPE` · `FUTURE` ·
`UNKNOWN`.

If the coding agent discovers a potentially useful feature, it should not
automatically implement it. Instead: *"This appears useful but is outside the
approved scope. Would you like to add it?"*

## 77. Change Management

When the user says *"Actually, I want multiple stores,"* MICHI should identify
affected areas — users, authentication, authorization, database, inventory,
orders, reporting, UI, API, deployment — then explain the impact.

The system should update requirements and architecture deliberately rather than
allowing architectural drift.

## 78. Agent Handoff Contract

```text
Input:  Task ID · Requirements · Architecture · Decisions · Relevant files
        · Constraints · Acceptance criteria · Testing requirements

Output: Implementation summary · Files changed · Tests executed
        · Tests passed/failed · Verification evidence · Remaining issues
        · New decisions requiring approval
```

If the coding agent encounters an architectural decision that is not already
locked, it should stop and request MICHI/user guidance rather than inventing a
major decision.

## 79. Stop Conditions

```text
Stop if:
- requirement is ambiguous
- architecture decision is missing
- required external credential is unavailable
- destructive action requires approval
- implementation would violate a locked decision
- task scope would expand materially
- tests reveal unrelated architectural problems
```

The correct behavior is: **ask, don't invent.**

## 80. Handling Existing Projects

MICHI must support new projects, existing projects, legacy projects, partially
built AI-generated projects, messy prototypes, and production codebases.

For an existing project:

```text
Scan → Understand → Map → Detect architecture → Identify inconsistencies
→ Create project brain
```

It should not immediately rewrite the project.

## 81. Existing Project Example

A repository contains React, Node, Express, MongoDB, JWT. MICHI should detect
this. It should not say *"I prefer PostgreSQL, so let's migrate."*

Instead: *"The existing project uses MongoDB and JWT. I detected the following
architecture. Would you like to preserve it or consider alternatives?"*

Existing reality matters.

## 82. Open-Source Philosophy

MICHI should be free, open-source, self-hostable, local-first, transparent,
extensible, agent-agnostic. No artificial lock-in.

Users should be able to inspect state, decisions, architecture, context, tasks,
graph, and configuration directly on disk.

## 83. Extensibility

MICHI should eventually support custom skills, templates, agents, decision
policies, architecture patterns, scanners, verification rules, and adapters.

But extensibility must not overcomplicate v1. First establish stable contracts.

## 84. API and Module Boundary Philosophy

Internal modules should have clear contracts: `IntentEngine` ·
`RequirementEngine` · `DecisionEngine` · `ArchitectureEngine` ·
`PlanningEngine` · `ContextEngine` · `PromptEngine` · `StateEngine` ·
`VerificationEngine` · `Scanner` · `GraphEngine`.

Each should have explicit input, explicit output, predictable errors,
deterministic behavior where possible, tests, and minimal coupling.

**Do not create a giant god-class called `MichiEngine`.**

## 85. Core Engines

```text
                    MICHI
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
   Intent Engine  Requirement   Decision Engine
                      Engine
        │             │             │
        └─────────────┼─────────────┘
                      ↓
              Architecture Engine
                      ↓
               Planning Engine
                      ↓
                Context Engine
                      ↓
                Prompt Engine
                      ↓
             Existing AI Agent
                      ↓
                 Source Code
                      ↓
          ┌───────────┴───────────┐
          ↓                       ↓
      Tester                   Reviewer
          ↓                       ↓
          └───────────┬───────────┘
                      ↓
               Verification
                      ↓
                 State Engine
```

## 86. Intent Engine

Input: natural language. Output: intent model.

The intent model should capture problem, goal, users, desired outcome,
constraints, known requirements, unknowns, and assumptions. It should preserve
uncertainty instead of pretending everything is known.

## 87. Requirement Engine

Transforms intent into functional requirements, non-functional requirements,
constraints, acceptance criteria, out-of-scope items, assumptions, and
dependencies.

Requirements should have stable identifiers: `REQ-001`, `REQ-002`, `REQ-003`.

## 88. Decision Engine

Responsibilities: discover · propose · explain · recommend · ask · validate ·
persist · lock · propagate · supersede.

```text
PROPOSED → USER_CONFIRMED → LOCKED        (later: SUPERSEDED)
```

## 89. Architecture Engine

Consumes requirements, constraints, decisions, project state. Produces
architecture options, recommendation, tradeoffs, architecture model, ADRs.

Architecture must remain traceable to requirements.

## 90. Planning Engine

Creates milestones, tasks, dependencies, task DAG, implementation waves,
acceptance criteria.

```text
TASK-001 Database schema → TASK-002 Repository layer → TASK-003 API
→ TASK-004 Frontend → TASK-005 Integration tests → TASK-006 Review
```

## 91. Task DAG

```text
AUTH-DATA → AUTH-SERVICE → AUTH-API → AUTH-UI → AUTH-E2E
```

Independent tasks can execute separately. The goal is not to maximize
parallelism blindly — it is to identify safe dependency boundaries.

## 92. Context Engine

Input: task, project state, requirements, decisions, architecture, graph,
repository. Output: context packet.

Optimizes for relevance, correctness, small size, traceability, repeatability.

## 93. Prompt Engine

Compiles intent + requirements + decisions + architecture + task + context +
acceptance criteria into an agent-ready instruction. The compiler should be
deterministic wherever possible.

## 94. State Engine

Persists project stage, tasks, decisions, requirements, milestones,
verification, agent runs, context hashes. It is the durable state layer.

## 95. Verification Engine

Answers: *"What evidence proves this work is actually complete?"*

Possible evidence: tests, build, lint, typecheck, review, runtime behavior,
screenshots, API responses, security checks. Verification results should be
persisted.

## 96. Agent Run Record

```text
run_id · task_id · agent · timestamp · input_hash · context_hash · attempt
files_touched · tests_run · tests_passed · tests_failed · verification_status
result
```

This creates traceability.

## 97. Architecture Decision Record

```markdown
# ADR-004 — Authentication Provider

Status: LOCKED

Date: 2026-09-26

Decision:
Use a managed authentication provider.

Reason:
The project requires secure authentication while minimizing custom
security-sensitive implementation.

Alternatives considered:
- Custom JWT
- Session authentication
- OAuth implementation

Consequences:
- Lower custom security maintenance
- External provider dependency
- Provider configuration required

Approved by:
User
```

## 98. Product Requirements Example

```yaml
id: REQ-021
title: Merchant Stock Adjustment
type: functional
priority: high
status: approved

description:
  Authorized merchants can increase or decrease product inventory.

acceptance_criteria:
  - Authorized merchants can increase stock
  - Authorized merchants can decrease stock
  - Unauthorized users cannot modify stock
  - Stock changes are persisted
  - Relevant tests pass
```

Structured data should be machine-readable.

## 99. Engineering Traceability

```text
User Request → Requirement → Decision → Architecture → Task → Code → Test
→ Verification
```

MICHI can eventually answer *"Why does this code exist?"*, *"Which requirement
does this implementation satisfy?"*, and *"What will break if we change this
decision?"*

This is a major long-term differentiator.

## 100. Explainability

User: *"Why are we using PostgreSQL?"*

MICHI: *"PostgreSQL was selected because the project has relational data,
transactional workflows, and reporting requirements. It was approved during
architecture planning and is recorded as ADR-003."*

The answer should come from actual project artifacts. Not hallucinated memory.

## 101. The Product Should Teach Without Requiring Learning

User: *"What is an API?"*

MICHI: *"An API is the agreed communication interface between parts of your
software. In this project, the frontend uses it to ask the backend for data and
perform actions."*

Then continue. The user should learn naturally while building.

## 102. MICHI's Personality

Should feel like: calm · professional · clear · practical · honest · structured
· non-judgmental · technically strong · user-controlled.

Should NOT feel like: a lecturer · a bureaucracy · an overcomplicated enterprise
PM tool · an AI that blindly agrees · an AI that silently takes control.

## 103. Communication Style

For technical users: precise technical details. For nontechnical users: plain
explanation plus technical detail only where useful.

The user should always be able to ask: *"Explain this simply."*

## 104. Error Handling

Distinguish `UNKNOWN` · `AMBIGUOUS` · `INVALID` · `BLOCKED` · `UNSUPPORTED` ·
`FAILED`. Do not convert uncertainty into false confidence.

Bad: *"The best database is PostgreSQL."*

Better: *"Based on the current requirements, PostgreSQL is my recommendation
because X and Y. MongoDB is also viable if Z becomes more important."*

## 105. No Fake Certainty

MICHI should clearly distinguish `FACT` · `USER DECISION` · `RECOMMENDATION` ·
`ASSUMPTION` · `UNKNOWN`.

```text
FACT:            The project currently uses MongoDB.
USER DECISION:   MongoDB must remain the database.
RECOMMENDATION:  Use Mongoose for the data layer.
ASSUMPTION:      Expected traffic is below 10k daily users.
UNKNOWN:         Whether multi-region deployment will eventually be required.
```

## 106. What MICHI Should Optimize For

```text
1. User intent accuracy
2. Engineering correctness
3. Architectural consistency
4. Minimal unnecessary complexity
5. Minimal unnecessary AI tokens
6. Project continuity
7. Traceability
8. Verification
9. User control
10. Portability
```

Do NOT optimize primarily for: maximum number of agents · maximum automation ·
maximum generated code · maximum dependencies · maximum features.

## 107. MVP Scope — Phase 0: Specification

Create:

```text
PRODUCT_VISION.md
DESIGN_PRINCIPLES.md
ARCHITECTURE.md
SKILL_CONTRACT.md
CLI_CONTRACT.md
STATE_MODEL.md
GRAPH_MODEL.md
CONTEXT_MODEL.md
DECISION_MODEL.md
AGENT_ADAPTER_MODEL.md
SECURITY_MODEL.md
```

## 108. Phase 1 — Filesystem Foundation

Implement `michi init`, `michi scan`, `michi status`.

Capabilities: project detection · project brain creation · config · state ·
basic scanner · initial project map.

## 109. Phase 2 — Senior Engineer

Implement `senior-engineer`.

Capabilities: intent understanding · clarification · recommendation ·
confirmation · decision recording · state updates.

## 110. Phase 3 — Product Planner

Implement `product-planner`.

Capabilities: discovery · PRD · TRD · requirements · acceptance criteria ·
scope.

## 111. Phase 4 — Architecture

Implement `architecture`.

Capabilities: architecture options · technology selection · tradeoffs · user
confirmation · ADR creation · architecture locking.

## 112. Phase 5 — Context Engine

Implement project map · code scanning · dependency relationships · graph ·
context selection · context ranking · context packets · token budgeting ·
hashes.

## 113. Phase 6 — Implementation

Implement task DAG · prompt compiler · agent handoff · execution tracking. The
output should be usable by existing coding agents.

## 114. Phase 7 — Review / Test / Debug

Implement `reviewer`, `tester`, `debugger`, verification.

## 115. Phase 8 — Agent Adapters

Support common environments through thin integrations: Claude, Codex, Kimi,
Gemini, OpenCode, Cursor, Cline, Roo Code, Qwen, local agents.

Do not allow agent-specific behavior to contaminate the core architecture.

## 116. Phase 9 — Open-Source Release

Prepare npm package · GitHub repository · documentation · examples ·
contribution guide · security policy · CI · release automation · tests ·
versioning.

## 117. V1 Non-Goals

Do NOT build: Website · SaaS · Dashboard · Hosted service · User accounts ·
Billing · Cloud database · Mandatory AI API · Custom LLM · Vector database ·
Hosted graph database · Online IDE · Deployment platform.

If a proposed feature requires one of these, challenge it against the v1
philosophy.

## 118. Quality Standard

Typed interfaces · validated schemas · tests · deterministic state · explicit
contracts · clear errors · documentation · reproducible behavior · migration
strategy where necessary · backward compatibility awareness · security
considerations · clean module boundaries.

## 119. Testing Philosophy

MICHI itself must be developed with strong testing: **RED → GREEN → REFACTOR**.

For new behavior: write a failing test · implement the smallest solution · make
the test pass · refactor · run the relevant suite · run the full suite before
completion.

For bugs: reproduce with a failing test · confirm the bug · fix it · verify the
test passes · run regression tests.

Tests should verify behavior, not implementation details.

## 120. Acceptance Criteria for MICHI

**User Experience.** A nontechnical user can initialize MICHI, describe a
software idea, understand MICHI's interpretation, answer questions,
approve/reject recommendations, understand architecture decisions, track project
progress, and request implementation — without needing to understand
professional software engineering terminology.

**Engineering.** MICHI can inspect a repository, understand project structure,
detect technology, store requirements, store decisions, create architecture
artifacts, build a task graph, resolve relevant context, compile implementation
instructions, record agent runs, run review/test/debug workflows, and verify
work.

**Persistence.** A new agent session can understand the project without
replaying the entire previous conversation.

**Portability.** The same MICHI project works with different AI coding agents.

**Safety.** Important destructive or architectural actions require appropriate
user approval.

**Efficiency.** MICHI reduces unnecessary context and repeated instructions.

## 121. The Most Important Product Rule

> The user decides WHAT they want. MICHI helps determine HOW it should be
> engineered. The existing coding agent executes the approved engineering work.

## 122. The Second Most Important Rule

> Never silently turn an AI recommendation into a user decision.

## 123. The Third Most Important Rule

> Never claim implementation is complete without verification evidence.

## 124. The Fourth Most Important Rule

> Do not add complexity unless the problem actually requires it.

## 125. The Fifth Most Important Rule

> Project artifacts, not conversation history, are the source of durable
> engineering truth.

## 126. The Sixth Most Important Rule

> Context should be resolved, not dumped.

## 127. The Seventh Most Important Rule

> Ask the user when an important decision is genuinely unknown. Do not invent
> it.

## 128. What Success Looks Like

A nontechnical founder says *"I want to build an online pharmacy management
system."*

With traditional development, they would need to hire a technical team. With a
raw coding agent, they need to learn how to prompt the agent effectively.

With MICHI, they should be able to simply explain: *"I want pharmacists to
manage medicines, stock, sales and customers."*

MICHI progressively guides them. It asks business questions. It understands the
product. It proposes architecture. It explains options. The founder approves
decisions. MICHI creates the engineering plan. The existing AI coding agent
implements it. Tests run. Review happens. Verification happens. The project
brain records what happened.

The founder can return later and say *"Add multi-store support."* MICHI
understands the existing system and can explain: *"This affects inventory,
users, permissions, reporting and database structure. Here is the proposed
approach."*

That is the experience MICHI should create.

## 129. Long-Term Vision

MICHI could eventually become a standard engineering control layer for
AI-assisted software development.

```text
Business → Product
Product → Requirements
Requirements → Architecture
Architecture → Implementation
Implementation → Verification
Verification → Operations
Operations → Feedback
Feedback → Requirements
```

This creates a continuous software engineering lifecycle. Eventually MICHI could
understand business goals, product requirements, architecture, code,
infrastructure, tests, deployments, incidents, performance, and user feedback —
and maintain the relationship between them.

But the foundation must remain simple.

## 130. Long-Term Concept

```text
                    HUMAN
                      │
                      ▼
                   MICHI
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    PRODUCT       ENGINEERING      PROJECT
       │              │              │
       ▼              ▼              ▼
 Requirements     Architecture     Knowledge
       │              │              │
       └──────────────┼──────────────┘
                      ▼
                 Task Planning
                      │
                      ▼
               Context Resolution
                      │
                      ▼
                Agent Compiler
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Claude       Codex       Kimi
          │           │           │
          └───────────┼───────────┘
                      ▼
                    CODE
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Testing      Review      Security
          │           │           │
          └───────────┼───────────┘
                      ▼
                 Verification
                      │
                      ▼
                Project Brain
```

## 131. MICHI's Competitive Positioning

MICHI should not position itself as "another AI coding agent." It should
position itself as:

> The engineering layer that makes AI coding agents easier to direct correctly.

```text
Coding Agent:
"Give me a task and I will build it."

MICHI:
"Let's understand what you actually want, decide how it should be engineered,
preserve those decisions, prepare the relevant context, and then give your
coding agent exactly what it needs."
```

## 132. Relationship to Existing Engineering Tools

MICHI can learn from concepts found in modern AI development workflows: context
engineering · specification-driven development · persistent project state ·
fresh-context execution · dependency graphs · deterministic loops · verification
· minimalism · project knowledge graphs.

However: **MICHI must be an original system, not a collection of copied tools.**
Do not clone another project's implementation, prompts, architecture,
terminology, or documentation. Use general engineering ideas and develop MICHI's
own model.

## 133. Implementation Philosophy

Do not immediately start generating large amounts of code. First:

```text
Understand repository → Inspect current state → Validate specification
→ Identify missing contracts → Create tests/contracts
→ Implement smallest vertical slice → Verify → Continue
```

Do not attempt to implement the entire product in one pass.

## 134. Vertical Slice Strategy

The first useful vertical slice should prove the central concept:

```text
michi init → michi discover → store user intent → create requirement
→ propose decision → user confirms → store ADR → generate task
→ compile agent prompt
```

Once this works reliably, expand the system. This is more valuable than
implementing 20 commands that are not integrated.

## 135. First Technical Milestone

```text
Human rough idea → MICHI understands it → MICHI asks clarification
→ MICHI creates structured requirement → MICHI proposes technical decision
→ User approves → MICHI stores decision → MICHI produces
implementation-ready instruction
```

If this flow works beautifully, the fundamental product hypothesis is validated.

## 136. Do Not Build Features for Their Own Sake

Before adding any feature, ask:

> Does this improve the path from idea to software?

If not, it probably does not belong in MICHI.

## 137. Product North Star

> A person should be able to describe the software they want in ordinary
> language, make understandable decisions when necessary, and rely on MICHI to
> transform that intent into disciplined engineering work for the AI coding
> agent they already use.

## 138. Final Product Definition

**MICHI — The path from idea to software.**

A free, open-source, local-first software engineering intelligence layer
designed primarily for nontechnical founders and AI-assisted developers. It sits
between human intent and existing AI coding agents.

It transforms a rough idea into: understood intent → requirements → decisions →
architecture → implementation plan → relevant context → precise agent
instructions → code → testing → review → verification.

MICHI does not replace the coding agent. It does not require its own cloud. It
does not require its own AI model. It does not require a hosted platform. It
does not take control away from the user.

> The human defines the vision. MICHI provides the engineering path. The
> existing AI coding agent builds the software.

## 139. Instructions to the AI Engineering Team Building MICHI

Treat this document as the product-level source of truth.

Before introducing any architectural change:

1. Determine whether it is required.
2. Check whether an existing design already solves the problem.
3. Prefer the simplest compatible solution.
4. Preserve the agent-agnostic architecture.
5. Preserve local-first behavior.
6. Preserve human approval for important decisions.
7. Preserve structured project memory.
8. Preserve context minimization.
9. Preserve verification.
10. Add tests for every behavioral change.

Do not silently redefine the product.

If a requirement appears ambiguous: identify ambiguity → explain it → propose
options → ask for approval. **Do not invent a product decision.**

If a technical implementation detail is ambiguous but does not materially affect
the user or architecture: choose the simplest reasonable implementation →
document it → continue.

If implementation would require a major change to the product philosophy: STOP →
explain the conflict → propose alternatives → request human approval.

## 140. Final Engineering Principle

MICHI should itself be built using the same philosophy it teaches:

```text
Intentional · Structured · Minimal · Tested · Traceable · Explainable
Modular · Agent-agnostic · Local-first · User-controlled · Verification-driven
```

> The tool that helps people build better software must itself be built like
> good software.
