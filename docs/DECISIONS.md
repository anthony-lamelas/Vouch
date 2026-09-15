# VOUCH Decisions

A short record of some key decisions I made for this project.

## Product

**Saying yes means "I'll reach out".** 
- There is no separate "contacted" state. Originally, we had a contacted state after the employee agreed to reach out, but that introduced more traction. Instead, the next step is for the employee
to state if the candidate responded.

**The happy path ends with a booked screen.** 
- When the candidate is interested, the employee is instructed to send a booking link. In production, I think it would make most sense to integrate directly into
their ATS as that is where interview tracking and scheduling is usually done. However, for the sake of this demo ending the happy path with a booking is fine.

**One open request per candidate.** 
- Although it could make sense for a candidate to be hihgly qualified for multiple roles, I decided that having multiple recruiters chasing the same person
through potentially multiple employees is a mess that our tool should prevent. Closing frees the person.

## Matching

**Heuristic scoring, not embeddings.** 
- Match and strength scores are weighted sums of explicit signals (skills, employer, school tier, location, etc.). I made this choice over embeddings for a few reasons.
First off, every score has clear, human-readable reasons that appear in the UI, so the recruiter can trust a ranking. Secondly, the data is synthetic,
so there is no way to evaluate and confirm that an embedding model is better than the heuristic approach.

**Scores are precomputed.** `match_score` is a table that is filled on seed and it holds the precomputed scores between all candidates and all roles. This keeps the role page and filters instant. The cost is that scoring changes require a recompute for everyone. This could also become a problem at massive scale, but should be fine for a company with only a few hundred employees.                  

**Pedigree counts wherever it sits in the résumé.**
- A tier-1 employer three jobs ago is still a signal. The wording says "Previously at DeepMind" vs "Currently at DeepMind" so it never implies something false.

## Data

**Real roles, synthetic people.** 
- Roles come from Cognition's posted jobs. The people data is mocked because the CSV you can export from LinkedIn does not contain previous positions, education, and location. I'm sure this data
could be scraped but I decided that was out of scope for this demo.

**Canonical contacts keyed on LinkedIn URL.** 
- One `contact` row per person, many `connection` edges to employees. The alternative, one row per employee-contact pair, made "who else knows this person?" a join on names.

## Platform

**Supabase Auth, no signup** 
- Email and password JWTs are verified against the project's JWKS. There is no signup flow in the app as a real user would login via company credentials.

**CI** 
- GitHub Actions deploys only from a green `main` via a deploy hook. CI runs lint, strict typecheck, tests against Postgres, and the Docker build on every PR.

**Requests poll** 
- Lists refetch every 15s and the request page every 10s because state changes from Slack outside of the browser. Websockets would be used in production, but I decided against them for this demo as they
introduce extra work for little change.

## UI/UX

**Reasons, never scores.** 
- The recruiter sees "5 of 8 skills · same job family · Same city", not 0.74. The logic behind this choice is that showing scores for every person would confuse the user.

**Everyone can see all roles and requests.**
- In production, this would be left to a more senior recruiter or hiring manager keeping track of general progress. I let it be accessible by everyone as this demo will not have any users. Adding admin 
and user roles is an easy next step. 
