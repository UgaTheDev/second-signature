# Reclamation rules: fact check

Checked 2026-10-24 against primary sources where reachable (10-fetch budget). The engine (`server/estate.py`) should cite these rules as written here. "Unverified" means no primary source was fetched; the rule is still sensible for the demo.

| # | Rule | Verdict |
|---|------|---------|
| 1 | SSA arrears / no benefit for month of death | correct, with one edge-case change |
| 2 | Certificate beats DNE/CRS on date of death | unverified (policy choice) |
| 3 | Return lesser of outstanding and on hand | correct, plus timing |
| 4 | Name every withdrawer | correct |
| 5 | Protest items not due or already returned (R15) | correct: R15 is excluded by definition |
| 6 | Prior knowledge means liability for the shortfall | correct, wording sharpened |
| 7 | No knowledge means the 45-day cap | needs change (formula and order) |
| 8 | Knowledge date = earliest of note, call or DNE | correct, plus "reasonable opportunity" |
| 9 | False death report: alive, no freeze, return nothing | unverified (policy choice) |
| 10 | Journal entries | unverified (accounting convention, not regulation) |
| 11 | 60-day FS-133 response window | correct (Green Book, per secondary quotes) |

## 1. SSA pays in arrears; no benefit for the month of death
**Verdict: correct. One edge case needs a change.**
Social Security Act s.202: benefits end with the month *before* the month of death. The deposit in month M+1 pays month M. For a death on 2026-03-14, the deposits from 2026-04-03 onward (for March onward) are not due. The 2026-03-03 deposit (for February) was received *before* death, so it is not a post-death payment under 31 CFR 210 and cannot be reclaimed.
**Change:** a deposit received *after* death that pays the month before death (e.g. died 03-01, deposit 03-03 for February) still counts as a "benefit payment received after death" under 31 CFR 210.2/210.10. Treasury may reclaim it, and SSA then reissues it to the survivor/estate as an underpayment. It is not cleanly "not due" for reclamation purposes. **For the 4th planted-error estate, put the over-claimed deposit *before* the date of death** (e.g. the FS-133 lists a deposit dated two weeks pre-death). That item is unambiguously protestable because it is not a post-death payment at all.
Sources: CRS 93-792 "Social Security Benefits Are Not Paid for the Month of Death" https://www.everycrsreport.com/reports/93-792.html ; reissue-as-underpayment example: https://www.maximizemysocialsecurity.com/ask-larry/does-payment-my-partner-received-month-her-death-need-be-returned-social-security (secondary).

## 2. Trust the state death certificate over DNE/CRS
**Verdict: unverified (policy choice, defensible).** The certificate is the primary vital record. The DNE is derived from SSA's death data, and the CRS from a bureau's reporting. Keep the rule and state the reason in `why`. Do not cite a CFR section for it. Cite "institution policy: primary vital record".

## 3. Return the lesser of the outstanding total and the balance on hand
**Verdict: correct.** Add the timing: the CU has a reasonable opportunity, "not to exceed one business day", after receiving the notice to act on it. The on-hand amount is the balance when the notice was received, plus any later agency payments received before the CU responds.
- "Outstanding total" = all benefit payments received after death *minus any amount returned to, or recovered by, the Federal Government* (31 CFR 210.2(n)).
Sources: https://www.law.cornell.edu/cfr/text/31/210.11 (a)(1); https://www.ecfr.gov/current/title-31/part-210/section-210.2

## 4. Name every withdrawer
**Verdict: correct. Broaden it.** The CU must give the name, last known address and phone number of: the recipient and any co-owners; anyone else authorised to withdraw; and anyone who withdrew after the death. If a subcategory has no information, the CU must certify that and say why. For Harold, list Dolores as both co-owner and withdrawer.
Source: 31 CFR 210.11(b)(3)(i) https://www.law.cornell.edu/cfr/text/31/210.11

## 5. Protest items not due or already returned (R15)
**Verdict: correct.** A payment the CU already returned (ACH R15, "beneficiary or account holder deceased") is excluded from the outstanding total by definition (210.2(n): "minus any amount returned to, or recovered by, the Federal Government"). A deposit dated before death is not a post-death payment. Both can be disputed on the FS-133 response. Cite 210.2(n) for R15 and 210.10(a) for the pre-death deposit. A 2010 proposed rule described written dispute notices with supporting documentation; finalisation was not verified.

## 6. Prior knowledge (actual or constructive) means liability
**Verdict: correct, wording sharpened.** Under 210.10(a), the CU is liable for *all* post-death benefit payments it received unless 210.11 limits that liability. The 210.11 limit is available only for payments received when the CU had *no* actual or constructive knowledge of the death. So for every payment received after the knowledge date, the CU owes whatever is not returned from the account; the 45-day cap does not apply.
- Actual knowledge: the CU "received information, by whatever means, of the death" and had a reasonable opportunity to act on it.
- Constructive knowledge: the CU would have known had it followed commercially reasonable business practices.
Source: 31 CFR 210.10(a)-(b) https://www.law.cornell.edu/cfr/text/31/210.10

## 7. No prior knowledge: limited liability and the 45-day amount
**Verdict: needs change.** Exact rule: a CU without knowledge first returns the on-hand amount (rule 3). Treasury then tries to collect the rest from the withdrawers. **Only if Treasury cannot collect** is the CU debited for the *lesser of* (a) the 45-day amount and (b) the outstanding total still unrecovered. The 45-day amount is the post-death benefit payments received within 45 calendar days after the death. Under 210.2(n), payments already returned leave the outstanding total, so they also drop out of (b).
- Engine formula: `cu_liability = min(forty_five_day_amount_not_returned, shortfall)`, with `liability_basis = "limited_45_day"`. A finding should say "contingent on Treasury failing to collect from withdrawers".
- Harold, for contrast: the 45-day window runs 03-14 to 04-28 and contains only the 04-03 deposit ($1,045). Without the 03-20 rep note, his liability would be min($1,045, $2,600) = $1,045 instead of $2,600.
Sources: 31 CFR 210.11(a)(2), (c) https://www.law.cornell.edu/cfr/text/31/210.11 ; DoD FMR vol.7B ch.32 (restates the cap and defines the 45-day amount) https://comptroller.defense.gov/Portals/45/documents/fmr/archive/07barch/07b_32_May22.pdf

## 8. Knowledge date = earliest of a rep note, a family call, or DNE receipt
**Verdict: correct.** Actual knowledge arises when information arrives "by whatever means", so a daughter's phone call logged by a rep counts. Optional refinement: allow a "reasonable opportunity to act", e.g. treat knowledge as effective the next business day. Harold's 03-20 note precedes the 04-03 deposit by two weeks either way. Agencies must also start a reclamation within 120 days of *their own* knowledge (210.10(d)); this is informational only.
Source: 31 CFR 210.10(b) https://www.law.cornell.edu/cfr/text/31/210.10

## 9. False death report: recipient alive
**Verdict: unverified (policy choice, sensible).** In-person activity after the DNE date is strong evidence that the DNE is wrong. Do not freeze the account, return nothing on the FS-133, and send the member to SSA to correct the record. Cite "institution policy", not CFR.

## 10. Journal entries
**Verdict: unverified (accounting convention).** The three balanced entries are standard double entry; the regulations prescribe none of them. One note: under 210.11(c), Treasury collects an unpaid liability by having the Federal Reserve debit the CU's settlement account. So the "settlement" entry (DR Due to US Treasury / CR Cash - Federal Reserve settlement) correctly models that debit.

## 11. 60-day FS-133 response window
**Verdict: correct.** The CU must respond so that Treasury receives the reply within 60 days of the notice date. If it does not respond, Treasury debits the CU, and the limit on liability is lost (secondary source). Treasury will not act on a notice more than 3 years old. Interest accrued from day 61 under the older FMS manual.
Sources: SSA POMS GN 02408.635 https://secure.ssa.gov/POMS.NSF/lnx/0202408635 ; DoD FMR 7B ch.32 (above). The Green Book ch.5 page (tfx.treasury.gov) returned 404 and was not read directly.

## Harold, re-derived under these rules
Post-death deposits: 04-03, 05-03, 06-03, 07-03, at $1,045 each = $4,180 claimed. The 07-03 deposit was returned R15, leaving an outstanding total of $3,135. On hand at the notice: $535, which is returned now. Shortfall: $2,600. Knowledge date 2026-03-20 precedes every post-death deposit, so `cu_liability` = $2,600 (`liability_basis` "knowledge"). That exceeds the $250 materiality threshold, so the controller must sign. Protest the $1,045 R15 item. The answer_key values should match these figures.
