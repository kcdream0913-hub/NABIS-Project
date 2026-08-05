# Nepali review — BL-PROFILE-01 (professional member profile, Tier 1)

**AI-drafted, unreviewed.** These are the new Nepali strings added by BL-PROFILE-01
(headline, profile links, member-since, bio prompts). `scripts/emit-ne-review.ts` is
BL-BIZ-02-scoped (guided/businessEdit + serviceCatalog) and does not cover these
namespaces, so they are listed here for one native-speaker pass before the pilot
(spec R11 / D-001), same as `ne-review-BL-FEEDBACK-02.md`.

Brand names (Facebook / Instagram / LinkedIn / TikTok / YouTube / X) are intentionally
left in Latin script, matching the existing `businessNew.social.*` convention — they are
NOT listed here (nothing to review). `US–Nepal` inside the placeholders is likewise the
product's own bilingual label; review only the surrounding Nepali.

Open question for the reviewer: `शीर्षक` (headline) vs an alternative like `परिचय हरफ`.

Rows: 8

| key | EN (source) | NE (draft) | corrected NE |
|---|---|---|---|
| `links.heading` | Links | लिंकहरू | |
| `links.hint` | Add your website and social profiles. Full URLs only. | आफ्नो वेबसाइट र सामाजिक प्रोफाइलहरू थप्नुहोस्। पूरा URL मात्र। | |
| `links.website` | Website | वेबसाइट | |
| `person.memberSince` | Member since {date} | {date} देखि सदस्य | |
| `profile.headline` / `welcome.headline` | Headline | शीर्षक | |
| `profile.headlinePlaceholder` | What you do in one line — e.g. Founder, Himalaya Freight · US–Nepal logistics | एक हरफमा तपाईं के गर्नुहुन्छ — जस्तै संस्थापक, हिमालय फ्रेट · US–Nepal लजिस्टिक्स | |
| `welcome.headlinePlaceholder` | What you do in one line | एक हरफमा तपाईं के गर्नुहुन्छ | |
| `profile.bioEnPlaceholder` / `welcome.bioEnPlaceholder` | What you work on · what you're looking for · your US–Nepal connection | तपाईं केमा काम गर्नुहुन्छ · तपाईं के खोज्दै हुनुहुन्छ · तपाईंको US–Nepal सम्बन्ध | |
