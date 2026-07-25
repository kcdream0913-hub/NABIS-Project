// BL-BIZ-02 — bilingual static data for the guided Nepal builder. Every string is
// a complete grammatical fragment in EN and NE so the deterministic bio assembler
// (bioAssembler.ts) can concatenate them verbatim (spec R5/§6). Store the `id`,
// never the label — relabelling must never rewrite a stored answer.
//
// NE strings are AI-drafted and unreviewed (R11): docs/i18n/ne-review-BL-BIZ-02.md
// lists them for a native-speaker pass. Do not treat them as final.

export const SECTOR_SLUGS = [
  "agriculture-food-systems", "education-human-capital", "energy-hydropower",
  "food-beverage", "healthcare-life-sciences", "infrastructure-logistics",
  "innovation-rd", "investment-finance", "manufacturing-industry",
  "media-creative-industries", "policy-immigration-legal",
  "real-estate-home-improvement", "retail-consumer", "technology-ai",
  "tourism-hospitality",
] as const;
export type SectorSlug = (typeof SECTOR_SLUGS)[number];

export type Chip = { id: string; en: string; ne: string };
export type Locale = "en" | "ne";

/** Look up a chip's label for a locale by id; "" when the id isn't in the list. */
export function chipLabel(chips: readonly Chip[], id: string, locale: Locale): string {
  return chips.find((c) => c.id === id)?.[locale] ?? "";
}

// Sector as a lowercase noun-phrase for "a {…} business" (distinct from the
// title-case display names in messages/*.json → the "sectors" namespace).
export const SECTOR_BIO_LABEL: Record<SectorSlug, { en: string; ne: string }> = {
  "agriculture-food-systems": { en: "agriculture and food systems", ne: "कृषि तथा खाद्य प्रणाली" },
  "education-human-capital": { en: "education", ne: "शिक्षा" },
  "energy-hydropower": { en: "energy and hydropower", ne: "ऊर्जा तथा जलविद्युत" },
  "food-beverage": { en: "food and beverage", ne: "खाद्य तथा पेय" },
  "healthcare-life-sciences": { en: "healthcare", ne: "स्वास्थ्य सेवा" },
  "infrastructure-logistics": { en: "infrastructure and logistics", ne: "पूर्वाधार तथा ढुवानी" },
  "innovation-rd": { en: "innovation and research", ne: "नवप्रवर्तन तथा अनुसन्धान" },
  "investment-finance": { en: "investment and finance", ne: "लगानी तथा वित्त" },
  "manufacturing-industry": { en: "manufacturing", ne: "उत्पादन" },
  "media-creative-industries": { en: "media and creative", ne: "मिडिया तथा सिर्जनात्मक" },
  "policy-immigration-legal": { en: "policy and legal", ne: "नीति तथा कानुनी" },
  "real-estate-home-improvement": { en: "real estate", ne: "घरजग्गा" },
  "retail-consumer": { en: "retail", ne: "खुद्रा" },
  "technology-ai": { en: "technology", ne: "प्रविधि" },
  "tourism-hospitality": { en: "tourism and hospitality", ne: "पर्यटन तथा आतिथ्य" },
};

// Generic fallback for the six sectors without an operator-validated catalog yet.
// TODO(BL-BIZ-02): sector-specific chips pending KC input for energy-hydropower,
// innovation-rd, investment-finance, media-creative-industries,
// policy-immigration-legal, real-estate-home-improvement.
const GENERIC_SERVICES: Chip[] = [
  { id: "consulting", en: "consulting", ne: "परामर्श" },
  { id: "services", en: "services", ne: "सेवा" },
  { id: "products", en: "products", ne: "उत्पादन" },
  { id: "project-work", en: "project work", ne: "परियोजना कार्य" },
  { id: "training", en: "training", ne: "तालिम" },
  { id: "other", en: "other", ne: "अन्य" },
];

export const SERVICE_CATALOG: Record<SectorSlug, Chip[]> = {
  "tourism-hospitality": [
    { id: "trekking", en: "trekking", ne: "ट्रेकिङ" },
    { id: "guided-tours", en: "guided tours", ne: "गाइड सहितको भ्रमण" },
    { id: "hotel-lodge", en: "hotel / lodge", ne: "होटल / लज" },
    { id: "homestay", en: "homestay", ne: "होमस्टे" },
    { id: "transport-transfers", en: "transport and transfers", ne: "यातायात तथा स्थानान्तरण" },
    { id: "permits-paperwork", en: "permits and paperwork", ne: "अनुमति तथा कागजात" },
    { id: "adventure-activities", en: "adventure activities", ne: "साहसिक गतिविधि" },
    { id: "cultural-tours", en: "cultural tours", ne: "सांस्कृतिक भ्रमण" },
  ],
  "food-beverage": [
    { id: "restaurant", en: "restaurant", ne: "रेस्टुरेन्ट" },
    { id: "cafe-teahouse", en: "café / tea house", ne: "क्याफे / चिया पसल" },
    { id: "catering", en: "catering", ne: "क्याटरिङ" },
    { id: "packaged-foods", en: "packaged foods", ne: "प्याकेज गरिएको खाना" },
    { id: "spices-condiments", en: "spices and condiments", ne: "मसला तथा अचार" },
    { id: "tea-coffee", en: "tea and coffee", ne: "चिया तथा कफी" },
    { id: "bakery", en: "bakery", ne: "बेकरी" },
    { id: "wholesale-supply", en: "wholesale supply", ne: "थोक आपूर्ति" },
  ],
  "retail-consumer": [
    { id: "handicrafts", en: "handicrafts", ne: "हस्तकला" },
    { id: "clothing-textiles", en: "clothing and textiles", ne: "लुगा तथा कपडा" },
    { id: "jewelry", en: "jewelry", ne: "गहना" },
    { id: "household-goods", en: "household goods", ne: "घरायसी सामान" },
    { id: "general-store", en: "general store", ne: "किराना पसल" },
    { id: "online-store", en: "online store", ne: "अनलाइन पसल" },
    { id: "souvenirs", en: "souvenirs", ne: "सम्झना उपहार" },
  ],
  "agriculture-food-systems": [
    { id: "farming", en: "farming", ne: "खेती" },
    { id: "organic-produce", en: "organic produce", ne: "जैविक उत्पादन" },
    { id: "herbs-medicinal", en: "herbs and medicinal plants", ne: "जडीबुटी तथा औषधीय बिरुवा" },
    { id: "dairy", en: "dairy", ne: "डेरी" },
    { id: "livestock", en: "livestock", ne: "पशुपालन" },
    { id: "cold-storage", en: "cold storage", ne: "शीत भण्डारण" },
    { id: "agro-processing", en: "agro-processing", ne: "कृषि प्रशोधन" },
    { id: "produce-export", en: "export of produce", ne: "उत्पादन निर्यात" },
  ],
  "manufacturing-industry": [
    { id: "garments", en: "garments", ne: "गार्मेन्ट" },
    { id: "metalwork", en: "metalwork", ne: "धातुकर्म" },
    { id: "furniture", en: "furniture", ne: "फर्निचर" },
    { id: "construction-materials", en: "construction materials", ne: "निर्माण सामग्री" },
    { id: "packaging", en: "packaging", ne: "प्याकेजिङ" },
    { id: "contract-manufacturing", en: "contract manufacturing", ne: "करार उत्पादन" },
    { id: "handicraft-production", en: "handicraft production", ne: "हस्तकला उत्पादन" },
  ],
  "infrastructure-logistics": [
    { id: "freight-forwarding", en: "freight forwarding", ne: "मालवाहक अग्रेषण" },
    { id: "customs-clearance", en: "customs clearance", ne: "भन्सार क्लियरेन्स" },
    { id: "warehousing", en: "warehousing", ne: "गोदाम सेवा" },
    { id: "courier-delivery", en: "courier and delivery", ne: "कुरियर तथा डेलिभरी" },
    { id: "transport-fleet", en: "transport fleet", ne: "यातायात बेडा" },
    { id: "import-export-docs", en: "import/export documentation", ne: "आयात/निर्यात कागजात" },
  ],
  "education-human-capital": [
    { id: "school-college", en: "school / college", ne: "विद्यालय / कलेज" },
    { id: "language-training", en: "language training", ne: "भाषा तालिम" },
    { id: "test-prep", en: "test preparation", ne: "परीक्षा तयारी" },
    { id: "vocational-training", en: "vocational training", ne: "व्यावसायिक तालिम" },
    { id: "study-abroad", en: "study-abroad counseling", ne: "विदेश अध्ययन परामर्श" },
    { id: "tutoring", en: "tutoring", ne: "ट्युसन" },
  ],
  "healthcare-life-sciences": [
    { id: "clinic", en: "clinic", ne: "क्लिनिक" },
    { id: "pharmacy", en: "pharmacy", ne: "फार्मेसी" },
    { id: "diagnostic-lab", en: "diagnostic lab", ne: "निदान प्रयोगशाला" },
    { id: "dental", en: "dental", ne: "दन्त सेवा" },
    { id: "traditional-medicine", en: "traditional medicine", ne: "परम्परागत औषधि" },
    { id: "medical-supplies", en: "medical supplies", ne: "चिकित्सा सामग्री" },
  ],
  "technology-ai": [
    { id: "software-development", en: "software development", ne: "सफ्टवेयर विकास" },
    { id: "web-app-development", en: "web and app development", ne: "वेब तथा एप विकास" },
    { id: "it-support", en: "IT support", ne: "आईटी सहयोग" },
    { id: "digital-marketing", en: "digital marketing", ne: "डिजिटल मार्केटिङ" },
    { id: "data-services", en: "data services", ne: "डाटा सेवा" },
    { id: "bpo", en: "outsourcing / BPO", ne: "आउटसोर्सिङ / बीपीओ" },
  ],
  // Generic (pending operator validation):
  "energy-hydropower": GENERIC_SERVICES,
  "innovation-rd": GENERIC_SERVICES,
  "investment-finance": GENERIC_SERVICES,
  "media-creative-industries": GENERIC_SERVICES,
  "policy-immigration-legal": GENERIC_SERVICES,
  "real-estate-home-improvement": GENERIC_SERVICES,
};

/** Sectors whose catalog is the shared generic list (for reporting/tests). */
export const GENERIC_SECTORS: SectorSlug[] = SECTOR_SLUGS.filter(
  (s) => SERVICE_CATALOG[s] === GENERIC_SERVICES,
);

export const CUSTOMER_CHIPS: Chip[] = [
  { id: "local", en: "local customers", ne: "स्थानीय ग्राहक" },
  { id: "tourists", en: "tourists and visitors", ne: "पर्यटक तथा आगन्तुक" },
  { id: "businesses", en: "other businesses", ne: "अन्य व्यवसाय" },
  { id: "buyers-abroad", en: "buyers abroad", ne: "विदेशका खरिदकर्ता" },
  { id: "diaspora", en: "Nepalis living abroad", ne: "विदेशमा रहेका नेपालीहरू" },
];

export const YEARS_CHIPS: Chip[] = [
  { id: "under-1", en: "less than a year", ne: "एक वर्षभन्दा कम" },
  { id: "1-3", en: "1 to 3 years", ne: "१ देखि ३ वर्ष" },
  { id: "3-10", en: "3 to 10 years", ne: "३ देखि १० वर्ष" },
  { id: "over-10", en: "more than 10 years", ne: "१० वर्षभन्दा बढी" },
];

export const CROSSBORDER_CHIPS: Chip[] = [
  { id: "yes", en: "yes", ne: "हो" },
  { id: "no", en: "no", ne: "होइन" },
  { id: "unsure", en: "not sure", ne: "थाहा छैन" },
];

// List joiners (spec §8): EN "a, b and c" · NE "a, b र c". Kept out of the
// assembler body so the connective is data, not a hardcode.
export const JOINERS: Record<Locale, { comma: string; and: string }> = {
  en: { comma: ", ", and: " and " },
  ne: { comma: ", ", and: " र " },
};

// Fixed sentence scaffolds. Every quantity is a written label (never formatted),
// so the assembler never touches Intl number/date formatting (R5).
export const BIO_SCAFFOLD = {
  en: {
    s1Prefix: "is a", // {name} is a {sector} business in {loc}
    s1Sector: "business in",
    s1Years: ", operating for", // + {yearsPhrase}
    offer: "We offer", // + {list}.
    work: "We work with", // + {list}.
    crossborder: "We are open to working with partners and buyers in the United States.",
    terminator: ".",
  },
  ne: {
    s1Suffix: "मा रहेको", // {name} {loc}मा रहेको {sector} क्षेत्रको व्यवसाय हो
    s1Sector: "क्षेत्रको व्यवसाय हो",
    s1Years: ", जुन", // जुन {yearsPhrase}देखि सञ्चालनमा छ
    s1YearsSuffix: "देखि सञ्चालनमा छ",
    offer: "हामी", // हामी {list} सेवा उपलब्ध गराउँछौं।
    offerSuffix: "सेवा उपलब्ध गराउँछौं",
    work: "हामी", // हामी {list}सँग काम गर्छौं।
    workSuffix: "सँग काम गर्छौं",
    crossborder: "हामी संयुक्त राज्य अमेरिकाका साझेदार तथा खरिदकर्ताहरूसँग काम गर्न इच्छुक छौं।",
    terminator: "।",
  },
} as const;
