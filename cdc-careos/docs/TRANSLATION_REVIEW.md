# Telugu Translation Review

All interface text is in `src/i18n/te.ts` (mirrors `src/i18n/en.ts`; the build fails if a key is missing, and a unit test checks placeholders).

Approach used:
- Natural, parent-friendly Telugu as spoken in Andhra Pradesh.
- Clinical terms that families commonly hear in English are transliterated (థెరపీ, సెషన్, అసెస్‌మెంట్, స్పీచ్ థెరపిస్ట్) or given with the English term in brackets (e.g. "సూక్ష్మ కదలికలు (ఫైన్ మోటార్)").
- No diagnosis terms appear in the interface.

**Before production**, ask a fluent Telugu-speaking professional (ideally a speech therapist or special educator familiar with the families) to review:
1. `enum.domain.*`, `enum.assistance.*`, `workflow.*` — clinical vocabulary.
2. `portal.*`, `auth.*`, `validation.*` — text parents read.
3. `children.consent*`, `communication.teReviewHint` — consent and legal wording.

Edit `te.ts`, run `npm test` (parity check) and redeploy. Content written by staff (reports/messages) is separate and always reviewed before sharing.
