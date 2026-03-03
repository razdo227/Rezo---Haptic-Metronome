# Fact-Check Protocol (Research + Engineering)

## Rule set
1. **Two-source minimum** for factual/technical claims that affect design or paper conclusions.
2. Prefer source hierarchy:
   - Primary literature / datasheets / official specs
   - Standards docs / vendor app notes
   - Reputable technical summaries
3. Any unresolved conflict -> mark as `OPEN QUESTION` and do not treat as final.

## Output format in notes
- Claim:
- Confidence: High / Medium / Low
- Evidence:
  - Source 1
  - Source 2
- Decision impact:

## Red flags requiring extra validation
- Battery safety limits
- BLE RF layout/antenna guidance
- Human-subject study interpretation
- Statistical claims in paper

## Quick policy
- If confidence < High and decision is irreversible (PCB fab / study protocol lock), escalate before finalizing.
