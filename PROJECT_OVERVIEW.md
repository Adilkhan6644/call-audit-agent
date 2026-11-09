# What is this project? (Plain-English overview)

This document is for anyone on the team who isn't writing the code —
product, QA, support, a new hire's first day, or just "what are we actually
building." No technical background assumed.

## The one-sentence version

This is a tool that **listens to a recorded phone call and automatically
grades it** against a checklist the business defines — the way a call
center quality manager would, but done by AI, instantly, for every call.

## The problem it solves

Call centers (medical billing, sales, customer support, collections — this
tool ships with built-in categories for all of these) need to check: did
the agent follow the script? Were they polite? Did they handle the
objection correctly? Today that means a human listens to a sample of calls
and scores them by hand — slow, expensive, and only ever a small sample.

This system instead:
1. Takes an uploaded call recording.
2. Turns it into text (a transcript) automatically.
3. Hands that transcript, plus a set of instructions ("score politeness
   1–10, flag if the agent mentioned X"), to an AI model.
4. Gets back a score, a summary, and a list of findings.
5. Stores that result so it can be reviewed, exported, and tracked over
   time.

Every single call can be checked, not just a sample.

## The three pieces, in plain terms

```
 ┌──────────────┐        ┌──────────────────────┐        ┌───────────────────┐
 │   Frontend    │ ─────▶ │   Main Backend         │ ─────▶ │   AI Engine         │
 │  (not built   │        │  ("server")            │        │  ("ai-service")     │
 │   yet)        │        │                         │        │                     │
 │  what a user  │        │  Everything the         │        │  Does ONE thing:    │
 │  would click  │        │  business "owns":       │        │  turn audio into    │
 │  through      │        │  accounts, uploaded      │        │  text, and turn     │
 │               │        │  recordings, scores,     │        │  text + instructions│
 │               │        │  who's allowed to do     │        │  into a score. No   │
 │               │        │  what                    │        │  memory of its own. │
 └──────────────┘        └──────────────────────┘        └───────────────────┘
```

- **The main backend** is where everything "lives" — who the users are,
  what recordings they've uploaded, what the scoring instructions say, what
  the results were. It's the only piece that remembers anything.
- **The AI engine** is deliberately dumb and forgetful on purpose — it's
  handed a transcript and an instruction, and it hands back a score. It
  doesn't know who the user is, doesn't store anything, and can be swapped
  to use a different AI provider without anyone else noticing. Think of it
  like a translator you call on the phone: you give them a sentence, they
  give you a translation, and they forget the conversation the moment they
  hang up.
- **The frontend** — the actual web page someone would click around in —
  **hasn't been built yet.** Right now this system only has an API: the
  underlying machinery a frontend would eventually talk to. You can exercise
  every feature today via its built-in API documentation page, just not
  through a polished screen.

## What the system can actually do today

- **Accounts**: sign up, log in. An admin role exists for the handful of
  people who need to manage API keys and see system alerts.
- **Categories**: 5 built-in call types (Medical Billing, Sales Support,
  Front Desk/Patient Services, Customer Support, Collections/Payment
  Follow-up), plus the ability to add custom ones.
- **Instructions**: write (and revise) the grading criteria for each
  category. Old versions are kept, never overwritten — so you can always
  see exactly what instructions were in force when a specific call was
  graded, even after you've since tweaked them.
- **Upload a recording**: `.mp3`, `.wav`, `.m4a`, or `.ogg`, up to 100MB.
  The system checks the file is genuinely that format, not just named that
  way.
- **Run an audit**: pick a recording and a category, and the system
  transcribes the call and scores it against that category's current
  instructions. Comes back with a summary, a numeric score, and a list of
  specific findings.
- **See history**: list past audits, filter by status or category, export
  the whole list as a CSV or a PDF report.
- **Track usage**: how many audits has a given account run, over any date
  range.
- **Admin tools**:
  - Swap or update which AI provider's access key is in use, without
    anyone needing to touch server configuration or restart anything.
  - Automatic protection against any one account overloading the system
    with requests (and a polite "slow down, try again in N seconds"
    message when that happens, instead of a silent failure).
  - If the AI provider being used runs out of credit/quota, the system
    raises a flag an admin can see and clear — instead of audits just
    silently failing with no one noticing why.

## What it deliberately does NOT do (yet)

- **No billing or payments.** There's no subscription plan, no credit
  card, no Stripe integration. This was a conscious decision to leave out
  for now — it's tracked as explicitly descoped, not forgotten.
  Everything else in this list works without it.
- **No frontend screens.** As above — the "backend" (the brains) is built
  and tested; the visual interface someone would actually click through
  hasn't been started.
- **No email notifications.** The "AI provider ran out of credit" alert
  shows up when an admin checks a list — it doesn't yet send anyone an
  email or text message. A deliberate simplicity choice for now, not a
  missing feature by accident.

## Which AI providers does it use?

The system can plug into any of three different AI companies to do the
actual "reading the transcript and scoring it" work — OpenAI, Google
(Gemini), or Groq (which runs very fast, cheap, open-source AI models).
Only one is "live" at a time, and an admin can switch between them or swap
in a new access key without any downtime. There's also a safe "practice
mode" that returns a fake, deterministic score with no real AI call and no
cost, used for testing.

## Who would use this day to day

- A **quality/compliance manager** reviewing call scores and exporting
  reports for their team or for a client.
- A **team lead** setting up or adjusting the grading instructions for
  their department.
- An **admin/IT person** keeping an eye on whether the AI provider is
  running low on credits, and managing access keys.

## Status, in one line

The "engine room" — everything needed to upload a call, grade it with AI,
and track the results — is built and automatically tested. What's left to
make this usable by an actual non-technical team member day to day is a
real web interface (the frontend) and, eventually, a way to pay for it
(billing).
