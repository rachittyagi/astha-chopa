# Store listing drafts (TASK-67)

Drafts to paste into App Store Connect and the Play Console. The store name is typed by hand there; it does not come from `src/config/app.json` (R-I18N-03).

## Names and category

| Field | App Store | Google Play |
|---|---|---|
| Name | Astha Chopa | Astha Chopa |
| Subtitle / short description | Ashta Chamma for the whole family | Classic Indian board game for 1–4 players on one phone |
| Category | Games → Board | Games → Board |
| Price | Free | Free |
| Bundle ID / package | `com.asthachopa.app` (placeholder: confirm before the first build) | same |

## Description (English)

Astha Chopa brings Ashta Chamma, the traditional Indian race game, to your phone or tablet.

Throw four cowrie shells, race your four pawns round the board and into the centre, and send your rivals back to the start. Play with 2 to 4 people passing one device, or on your own against the computer at three levels.

- Real cowrie odds: Chamma (4) and Ashta (8) earn another throw
- Classic rules, plus house rules for entering pawns, doubles, hits and more
- 1 to 4 players on one device, with Easy, Medium and Hard computer opponents
- Chalk-on-floor, wooden board and modern themes
- English and Hindi
- Works completely offline: no account, no ads, no data collected

Also known as Chowka Bara, Daayam and Kanna Kauri.

## विवरण (हिन्दी)

अस्था चोपा पारंपरिक भारतीय खेल अष्टा चम्मा को आपके फ़ोन या टैबलेट पर लाता है।

चार कौड़ियाँ फेंकें, अपनी चारों गोटियों को बोर्ड पर घुमाकर बीच तक ले जाएँ, और विरोधियों को वापस शुरुआत पर भेजें। एक ही फ़ोन पर 2 से 4 लोग बारी-बारी से खेलें, या कंप्यूटर के ख़िलाफ़ तीन स्तरों पर अकेले खेलें।

- कौड़ियों की असली संभावनाएँ: चम्मा (4) और अष्टा (8) पर एक और बार फेंकें
- पारंपरिक नियम, और गोटी अंदर लाने, जोड़ी, मार जैसे घर के नियम
- एक ही फ़ोन पर 1 से 4 खिलाड़ी, आसान, मध्यम और कठिन कंप्यूटर विरोधी
- फ़र्श पर खड़िया, लकड़ी का बोर्ड और आधुनिक रूप
- अंग्रेज़ी और हिन्दी
- पूरी तरह बिना इंटरनेट: न खाता, न विज्ञापन, न कोई डेटा इकट्ठा

इसे चौका बारा, दायम और कन्ना कौड़ी भी कहते हैं।

(Have a native speaker review the Hindi before publishing.)

## Keywords (App Store, 100 characters)

`ashta chamma,chowka bara,ludo,pachisi,cowrie,board game,indian,family,offline,pass and play`

## Privacy

**App Store, App Privacy:** choose **Data Not Collected**. The app has no network code, no analytics, no crash reporter and no ads. The privacy manifest (`PrivacyInfo.xcprivacy`, generated from `app.config.ts`) declares no tracking, no collected data, and UserDefaults access with reason CA92.1 (the app's own saved game and settings).

**Google Play, Data safety:**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | No |
| Is all user data encrypted in transit? | Not applicable: the app sends no data |
| Do you provide a way for users to request that their data is deleted? | Not applicable: no data leaves the device. The saved game can be deleted in Settings → Reset saved game |

**Privacy policy URL:** both stores require one, even for apps that collect nothing. A one-paragraph page stating "Astha Chopa collects no personal data, makes no network requests, and stores your game and settings only on your device" is enough. It must be hosted somewhere public, which you need to decide.

## Ratings

- **App Store age rating:** 4+. No gambling: the shells are dice, with no money or prizes.
- **IARC (Play):** answer "No" to violence, gambling, purchases and user interaction; expected rating Everyone / PEGI 3.
- **Target audience (Play):** decide whether the app is aimed at children. If you include ages under 13, the Families policy applies; the app already meets it (no ads, no data), but the declaration is yours to make.

## Screenshots needed

| Store | Sizes |
|---|---|
| App Store | 6.9" iPhone (1320×2868), 6.5" iPhone (1284×2778), 13" iPad (2064×2752) |
| Google Play | Phone (at least 1080×1920), 7" tablet, 10" tablet; feature graphic 1024×500 |

Suggested shots: Home; Setup with bots; a 4-player game mid-move (chalk theme); a hit callout; the wooden theme; the Hindi How to play page; the tablet landscape layout.
