# NE review — BL-FEEDBACK-02 (in-product feedback)

38 new/changed Nepali strings, for a native-speaker (KC) pass. `scripts/emit-ne-review.ts` is
BL-BIZ-02-scoped (service catalog + `guided`/`businessEdit`) and does NOT cover these UI
namespaces, so this list is authored directly from the two bundles. en/ne symmetry + no-empty are
already enforced by `messages/__tests__/parity.test.ts`; this doc is only about wording quality.
`{count}` is an interpolation placeholder — keep it verbatim.

## `admin` + `adminFeedback` (admin surface, KC-only)

| key | EN | NE (draft) |
|---|---|---|
| `admin.feedbackNav` | Feedback | प्रतिक्रिया |
| `adminFeedback.eyebrow` | Admin | प्रशासन |
| `adminFeedback.title` | Feedback | प्रतिक्रिया |
| `adminFeedback.backToDashboard` | Back to dashboard | ड्यासबोर्डमा फर्कनुहोस् |
| `adminFeedback.newCount` | {count} new | {count} नयाँ |
| `adminFeedback.loading` | Loading feedback… | प्रतिक्रिया लोड हुँदैछ… |
| `adminFeedback.empty` | No feedback yet. | अहिलेसम्म कुनै प्रतिक्रिया छैन। |
| `adminFeedback.member` | Member | सदस्य |
| `adminFeedback.deletedAccount` | Deleted account | मेटिएको खाता |
| `adminFeedback.kindBug` | Bug | बग |
| `adminFeedback.kindIdea` | Idea | सुझाव |
| `adminFeedback.kindConfusing` | Confusing | अलमल |
| `adminFeedback.kindOther` | Other | अन्य |
| `adminFeedback.statusNew` | New | नयाँ |
| `adminFeedback.statusTriaged` | Triaged | छानबिन गरिएको |
| `adminFeedback.statusClosed` | Closed | बन्द |

## `settings.support` (member-facing feedback form) — `description` + `body` are edited, the rest new

| key | EN | NE (draft) |
|---|---|---|
| `description` | Send feedback, or get help with your account. | प्रतिक्रिया पठाउनुहोस्, वा आफ्नो खातामा सहयोग पाउनुहोस्। |
| `body` | Your feedback goes straight to the team — it's the main way we learn what to fix during the pilot. | तपाईंको प्रतिक्रिया सिधै टोलीकहाँ पुग्छ — पाइलटको समयमा के सुधार्ने भन्ने कुरा हामी यसैबाट सिक्छौं। |
| `kindLabel` | What kind of feedback? | कस्तो प्रकारको प्रतिक्रिया? |
| `kindBug` | Something's broken | केही बिग्रेको छ |
| `kindIdea` | I have an idea | मसँग एउटा सुझाव छ |
| `kindConfusing` | This is confusing | यो अलमल्ल पार्ने छ |
| `kindOther` | Something else | अरू केही |
| `messageLabel` | Your feedback | तपाईंको प्रतिक्रिया |
| `messagePlaceholder` | What happened, or what would help? | के भयो, वा के भए सहयोग हुन्थ्यो? |
| `charsRemaining` | {count} characters left | {count} अक्षर बाँकी |
| `pagePathLabel` | Where did this happen? (optional) | यो कहाँ भयो? (वैकल्पिक) |
| `pagePathPlaceholder` | e.g. the members page | जस्तै, सदस्यहरूको पृष्ठ |
| `submit` | Send feedback | प्रतिक्रिया पठाउनुहोस् |
| `submitting` | Sending… | पठाउँदै… |
| `successTitle` | Thanks — we got it. | धन्यवाद — हामीले पायौं। |
| `successBody` | Your feedback is in front of the team. | तपाईंको प्रतिक्रिया टोलीसामु छ। |
| `sendAnother` | Send another | अर्को पठाउनुहोस् |
| `errorGeneric` | Something went wrong. Try again, or email us below. | केही गडबड भयो। फेरि प्रयास गर्नुहोस्, वा तल इमेल गर्नुहोस्। |
| `errorTooShort` | Please write at least 10 characters. | कृपया कम्तीमा १० अक्षर लेख्नुहोस्। |
| `errorTooLong` | Please keep it under 4000 characters. | कृपया ४००० अक्षरभित्र राख्नुहोस्। |
| `errorRate` | You've sent a few just now — please try again in a little while. | तपाईंले भर्खरै केही पठाउनुभयो — कृपया केही बेरपछि फेरि प्रयास गर्नुहोस्। |
| `orEmailBody` | Prefer email? You can reach us directly: | इमेल रुचाउनुहुन्छ? हामीलाई सिधै सम्पर्क गर्न सक्नुहुन्छ: |
