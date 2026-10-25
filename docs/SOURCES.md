# Sources and credits

Two lists: everything the project is built with, as the contest rules ask, and every outside source behind a claim in the README or docs.

## Built with

Every outside library, data source, and service the project uses, as the contest rules ask.

| Part | Open-source libraries (license) |
|---|---|
| App | Expo SDK and Expo Router (MIT) · React Native and React Native Web (MIT) · TypeScript (Apache-2.0) · @supabase/supabase-js (MIT) · TanStack Query (MIT) · react-native-maps (MIT) · @gorhom/bottom-sheet (MIT) · Reanimated and Gesture Handler (MIT) · react-native-mmkv (MIT) · react-native-svg (MIT) · qrcode-generator (MIT, the QR beside the web iPhone frame) |
| Database | PostgreSQL (PostgreSQL License) · PostGIS (GPL-2.0) · pgTAP for tests (PostgreSQL License) |
| Pipeline | Python 3.12 · httpx (BSD-3) · pydantic (MIT) · psycopg 3 (LGPL-3.0) · structlog (MIT / Apache-2.0) · pytest, ruff, mypy for checks |
| App tests | Jest and jest-expo (MIT) · React Native Testing Library (MIT) · Maestro flows for the simulator |

| Data or service | Used for |
|---|---|
| [data.texas.gov](https://data.texas.gov), Texas HHSC Child Care Regulation | Every daycare, visit, and finding (public open data) |
| U.S. Census Geocoder and TIGERweb CD119 | Map points for addresses, and the TX-04 boundary (U.S. Government works, not subject to copyright, 17 U.S.C. §105) |
| Esri World Imagery | Aerial view on the place page, credited on screen |
| Apple Maps (MapKit) | Map, 3D view, and directions on iPhone |
| Mapillary (CC BY-SA 4.0) | Street photos, shown only after a person checks the photo shows that daycare, with the photographer credited |
| OpenStreetMap (ODbL), © OpenStreetMap contributors | Building outlines used once, during the hand review, to find street photos that face a daycare's building. Not shipped in the app |
| Supabase · GitHub Actions · Expo Push · Vercel | Database hosting · the daily sync · push alerts · the web link |

## Sources and claim map

**Result:** 56 primary or official sources opened on Oct 25 2026, each with the exact URL used. The README's legal, dataset, district, and contest claims hold up, with three exceptions that need new wording before submission. (1) H.R. 2425 does not "line up with" the Texas law on drop-in visits, because it has no drop-in right. (2) "Days to weeks" and "1 to 3 weeks" are not the state's figures. (3) The TX-04 boundary comes from TIGERweb, not TIGER/Line, and "public domain" and "address matched with corrections" are not the Census Bureau's words. Of 111 claims mapped: 81 VERIFIED, 22 WORDING CHANGE NEEDED, 5 NO SOURCE FOUND, and 3 not re-checked today (carried over from `OFFICIAL_SOURCES.md`).

**Applied 13:29 CDT Oct 25 2026:** every WORDING CHANGE NEEDED and NO SOURCE FOUND row below has been applied to `README.md` and `docs/*.md` with the suggested wording. The Esri imagery credit (row for README:376) is fixed in the app too: it now reads "Imagery © Esri, Vantor, Earthstar Geographics", checked against Esri's live service credit. The "Operations update: about 300 to 450 rows a day" figure stays, under a column now headed "What we observed (Oct 2026)".

Line numbers refer to the longer `README.md` of Oct 25 2026, 13:15 CDT (commit f0b23f2); its methods, data, and credits sections now live in [`METHODS.md`](METHODS.md) and the Built with list above. They refer to it as it stood at 13:15 CDT on Oct 25 2026 and to `docs/*.md` at the same time (`QA_MATRIX.md` is skipped). Numbers from our own database cite the dataset IDs; the SQL behind them is documented separately.

## References

All accessed **Oct 25 2026**. Quotes are kept under 15 words.

### Texas law and rules

| # | Source | URL opened | Supports |
|---|---|---|---|
| 1 | Texas Legislature, *Human Resources Code* ch. 42 (§§42.002, 42.04271, 42.052, 42.071, 42.072, 42.078), current codified text | https://statutes.capitol.texas.gov/Docs/HR/htm/HR.42.htm (renders by script; the same text was read from the static file it loads: https://tcss.legis.texas.gov/resources/HR/htm/HR.42.htm) | §42.04271(a) coverage ("day-care center, group day-care home, ... or registered family home"); (b)(1) to (11) rights; (c) notice before video; (e) written copy by the first day. History note: "Added by Acts 2023, 88th Leg., R.S., Ch. 1158 (S.B. 1098)". §42.052(c) defines listed homes, which (a) does not cover. Also §42.071(c) probation, §42.072(b) SOAH hearing, §42.078 penalties |
| 2 | Texas Legislature Online, *88(R) SB 1098 bill history* | https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB1098 | Caption, author Paxton, coauthor Zaffirini, sponsor Hull; signed by the Governor 06/18/2023; effective 9/1/23 |
| 3 | Texas Legislature Online, *88(R) SB 1098, enrolled version* | https://capitol.texas.gov/tlodocs/88R/billtext/html/SB01098F.htm | "may be cited as the Kairo and the Kids' Law"; adds §42.04271; Senate 30-1, House 137-1; effective September 1, 2023 |
| 4 | Texas Legislature Online, *89(R) SB 1098 bill history* | https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB1098 | 89(R) SB 1098 is an unrelated pharmacy price-disclosure bill (author Blanco) |
| 5 | 26 TAC §746.521, *Parent rights* (centers), via Cornell LII | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-521 | Rule version of the 11 rights; eff. 8/19/2024 (49 TexReg 6231) |
| 6 | 26 TAC §746.501, *Written operational policies* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-501 | (a)(9) safe sleep policy for infants birth to 12 months; (a)(20) parent rights consistent with Division 5 |
| 7 | 26 TAC §746.601, *Access to children's records* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-601 | (b) "access their own child's record during a parent conference" |
| 8 | 26 TAC §746.405, *Required postings* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-405 | Centers post 911, Poison Control, and the Texas Abuse and Neglect Hotline (1-800-252-5400) |
| 9 | 26 TAC §746.701, *Accident and incident records* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-701 | (1) injury needing medical treatment is recorded on Incident/Illness Report Form 7239 or equivalent |
| 10 | 26 TAC §746.2905, *Naptime* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-2905 | "You must not: (1) Force a child to sleep" (wording continues with restrictive devices in (2)) |
| 11 | 26 TAC §746.5007, *Pool fence* | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-746-5007 | (b) pool gates need "self-closing and self-latching hardware out of children's reach" |
| 12 | 26 TAC §744.521, *Parent rights* (school-age and before/after-school programs) | https://www.law.cornell.edu/regulations/texas/26-Tex-Admin-Code-SS-744-521 | The same 11 rights for ch. 744 programs; eff. 8/19/2024 (49 TexReg 6226) |
| 13 | Texas HHSC Child Care Regulation, *Minimum Standards for Child-Care Centers*, December 2024, revised December 2025 (PDF) | https://www.hhs.texas.gov/sites/default/files/documents/doing-business-with-hhs/provider-portal/protective-services/ccl/min-standards/chapter-746-centers.pdf | Introduction, "Weights" (p. 6): five weights from high to low, based on "the risk to children" if violated; the weight rates the rule, not the operation. The weight tags printed in the PDF: §746.5007(b) High; §746.2905(1) Medium, (2) Medium-High; §746.501(a)(9) High; §746.701(1) Medium; §746.521(1) Medium-High, (8) Medium, (11) Medium-High |

### State agency pages (HHSC, DFPS)

| # | Source | URL opened | Supports |
|---|---|---|---|
| 14 | HHSC, *Child Care Regulation Handbook: Definitions of Terms*, Revision 25-3, eff. Aug 1 2025 | https://fhb.hhs.texas.gov/handbooks/child-care-regulation-handbook/ccrh-definitions-terms | A licensed child care home is "group day care home" under HRC ch. 42, so §42.04271 covers it. Also defines listed and registered homes, corrective action (probation only since 9/1/2019), adverse action, and condition |
| 15 | HHSC, *CCRH 7400 Probation* | https://fhb.hhs.texas.gov/handbooks/child-care-regulation-handbook/7400-probation | Cites 26 TAC §§745.8603, 745.8611, 745.8631(2), 745.8637; probation lasts "a maximum of twelve months" |
| 16 | HHSC, *CCRH sections 4500, 5500, 7100, 7600* | https://fhb.hhs.texas.gov/handbooks/child-care-regulation-handbook/ (sections as linked in `OFFICIAL_SOURCES.md` §6) | Enforcement definitions. **Not re-opened Oct 25**; they were verified Oct 24 per `OFFICIAL_SOURCES.md` |
| 17 | HHSC, *Search Texas Child Care, Operation Details*, operation 1459611 (a Licensed Center) | https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=1459611 (renders by script; read in a browser) | "inspection and compliance history over a five-year period"; history excludes violations "until after ... due process or waived its rights"; "Sign Up for or Unsubscribe from Updates"; the state labels risk "Medium-High" and "Medium-Low"; shows counts by weight but no grade |
| 18 | HHSC CCR, *Make a Report* form | https://childcare.hhs.texas.gov/Public/makeAReport | The form is for regulation concerns, not abuse or neglect; it requires a name; anonymous reports go through the local CCR office |
| 19 | HHSC, *Child Care* (family safety resources) | https://www.hhs.texas.gov/services/family-safety-resources/child-care | "Reports on every inspection are available online" (links txchildcaresearch.org) |
| 20 | HHSC, *Contact Child Care Regulation* | https://www.hhs.texas.gov/services/family-safety-resources/child-care/contact-child-care-regulation | Plano office address and 469-229-6900 Ext. 6901; Dallas 214-583-4253 / 800-582-6036; CCRQuestions@hhs.texas.gov |
| 21 | HHSC CCR, *Provider Guidance Letter PGL-26-9001: Daycare Intake Prioritization Process*, pub. Mar 5 2026, eff. Mar 6 2026 (PDF) | https://www.hhs.texas.gov/sites/default/files/documents/pgl-26-9001.pdf | "Regional phone lines will automatically route caller to the new Intake" Prioritization Unit |
| 22 | Texas DFPS, *Report Abuse* | https://www.dfps.texas.gov/Contact_Us/report_abuse.asp | 1-800-252-5400, 24/7. Since September 1, 2023, "DFPS cannot accept anonymous reports" |
| 23 | Texas DFPS, *Texas Abuse Hotline* website | https://www.txabusehotline.org/Login/Default.aspx | Online reports are not for urgent cases; call 911 in an emergency; Relay Texas 7-1-1 |

### Open data (data.texas.gov, Socrata)

| # | Source | URL opened | Supports |
|---|---|---|---|
| 24 | Texas HHSC, *HHSC CCL Daycare and Residential Operations Data* (`bc5r-88dy`), license CC0 1.0 | https://data.texas.gov/d/bc5r-88dy · metadata https://data.texas.gov/api/views/bc5r-88dy.json | Daycare columns (`operation_type`, `operation_status`, `corrective_action`, `adverse_action`, `temporarily_closed`, `conditions_on_permit`, ...). `rowsUpdatedAt` 2026-10-24 09:08 UTC. Live counts Oct 25: Licensed Center 9,605 · Licensed Child-Care Home 1,593 · Registered Child-Care Home 1,742 · Listed Family Home 1,370 (= 14,310) of 14,977 rows. The page states no update schedule |
| 25 | Texas HHSC, *HHSC CCL Inspection Investigation Assessment Data* (`m5q4-3y3d`), CC0 1.0 | https://data.texas.gov/d/m5q4-3y3d · https://data.texas.gov/api/views/m5q4-3y3d.json | Visits: `activity_type`, `violation_found`, `self_report`. 205,457 rows on Oct 25; `rowsUpdatedAt` 2026-10-24 09:02 UTC |
| 26 | Texas HHSC, *HHSC CCL Non-Compliance Data* (`tqgd-mf4x`), CC0 1.0 | https://data.texas.gov/d/tqgd-mf4x · https://data.texas.gov/api/views/tqgd-mf4x.json | Findings: `standard_risk_level` (live values High, Medium High, Medium, Medium Low, Low), `corrected_date`, `date_correction_verified`, `narrative`. 133,739 rows on Oct 25; `rowsUpdatedAt` 2026-10-24 09:07 UTC |
| 27 | Texas **DFPS** Data & Decision Support, *CCI 4.1 Abuse/Neglect Day Care Investigations (DCI) FY 2016-2025* (`txmx-ceda`) | https://data.texas.gov/d/txmx-ceda · https://data.texas.gov/api/views/txmx-ceda.json | Closed abuse/neglect investigation counts by county and fiscal year. Published by DFPS, not HHSC; last updated 2026-02-09. No code in the repo uses it |
| 28 | Socrata (Tyler Technologies), *SODA API Endpoints* | https://dev.socrata.com/docs/endpoints.html | Each dataset has a documented API endpoint |

### Federal bill and background

| # | Source | URL opened | Supports |
|---|---|---|---|
| 29 | U.S. Congress, *H.R. 2425, Kairo Act of 2025*, Introduced in House (IH) text | https://www.congress.gov/119/bills/hr2425/BILLS-119hr2425ih.htm | Covers providers getting "any amount of Federal funding" (CCDBG, Head Start). Sec. 3(a)(8): video access "within 2 business days from time of written request". The bill has **no** right to enter without notice and **no** complaint right; it adds hotline and database information |
| 30 | GPO, *BILLSTATUS-119hr2425* (XML) and govinfo details page | https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr2425.xml · https://www.govinfo.gov/app/details/BILLS-119hr2425ih | Sponsor Rep. Fallon [R-TX-4]; cosponsors Hayes, Van Duyne, Gooden, Nehls (all 2025-03-27); latest action 2025-03-27, referred to Education and Workforce; record updated 2025-07-21. (The congress.gov all-actions page returned HTTP 403 to automated fetch) |
| 31 | Rep. Pat Fallon, "Abuse in day care: Congress can affirm parents' right to transparency," *The Hill* (opinion), May 6 2025. **Secondary (news outlet); the sponsor's own words** | https://digital-release.thehill.com/opinion/5284296-kairo-act-child-safety/amp/ (thehill.com returned 403) | Background: in 2018 a 2-month-old named Kairo was injured at a McKinney day care; doctors found several broken bones; the center refused his mother the footage. The op-ed gives no bill number and no video deadline |
| 32 | M. Hurst, "North Texas mother grateful congressman's bill could give parents federal rights at daycare centers," CBS News Texas, updated Dec 2 2024. **Secondary; used only for the child's full name** | https://www.cbsnews.com/texas/news/north-texas-mother-grateful-congressmans-bill-could-give-parents-federal-rights-at-daycare-centers/ | The child is named "Kairo Grant"; injuries in December 2018 (broken ribs and femur). This article is about the earlier filing, before H.R. 2425 |

### Congressional App Challenge

| # | Source | URL opened | Supports |
|---|---|---|---|
| 33 | Congressional App Challenge, *2026 CAC Rules* (complete rulebook, PDF) | https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf | Any platform; open-source libraries allowed but entrants "must clearly document any such usage"; demo video 1 to 3 minutes, public on YouTube or Vimeo; judging on idea, implementation, and coding; judges "have the right to request access to the App and source code"; deadline "12:00 pm EDT, Monday, October 26th, 2026" (= 11:00 am CT). It never requires an app-store listing |
| 34 | Congressional App Challenge, *Rules* page | https://www.congressionalappchallenge.us/students/rules/ | "ANY PLATFORM", any language; links the rulebook PDF |
| 35 | Congressional App Challenge, *Participating Districts* (2026) | https://www.congressionalappchallenge.us/students/participating-districts/ | "TX04 (Pat Fallon)" is marked as participating in 2026 |
| 36 | Congressional App Challenge, *Judges* | https://www.congressionalappchallenge.us/get-involved/judges/ | Judges watch the demo videos and score them on a rubric; judging runs Oct 30 to Nov 23 |
| 37 | Congressional App Challenge, "Medicable wins Rep. Pat Fallon's 2024 Congressional App Challenge in Texas' Fourth District," Jan 16 2025 | https://www.congressionalappchallenge.us/24-TX04/ | TX-04 has run the challenge before |

### Geography (U.S. Census Bureau)

| # | Source | URL opened | Supports |
|---|---|---|---|
| 38 | U.S. Census Bureau, *Census Geocoder User Guide*, May 2026 (PDF) | https://www2.census.gov/geo/pdfs/maps-data/data/Census_Geocoder_User_Guide.pdf | Coordinates are "approximate" and are interpolated "along an address range"; address ranges include numbers where no building may exist; match indicator is Match, tie, or no match; match type is "Exact or Non-Exact" (Non-Exact is not defined further) |
| 39 | U.S. Census Bureau, *Geocoding Services Web API* | https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html | Benchmark `Public_AR_Current`; "upper limit of 10,000 records per batch file" |
| 40 | U.S. Census Bureau, *TIGERweb Legislative MapServer, layer 4: 119th Congressional Districts* (January 1, 2026 vintage) | https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4 | The TX-04 polygon the pipeline loads (GEOID 4804; `services/pipeline/scripts/fetch_district.py`) |
| 41 | U.S. Census Bureau, *2025 TIGER/Line Shapefiles Technical Documentation* (PDF) | https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2025/TGRSHP2025_TechDoc.pdf | The 2025 TIGER/Line files include the 119th Congressional Districts. Disclaimer: boundaries are "for statistical data collection and tabulation purposes only". The document makes no public-domain statement |
| 42 | U.S. Census Bureau, *CD119 to county relationship file, Texas* | https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_county20_st48.txt | TX-04's land area by county. Collin: 389.9 of 2,178.8 km² inside TX-04 (17.9%). Denton: 43.0 of 2,275.3 km² (1.9%) |
| 43 | 17 U.S.C. §105, via Cornell LII | https://www.law.cornell.edu/uscode/text/17/105 | "Copyright protection under this title is not available for any work of the United States Government" (Census files) |

### Platform, maps, and imagery

| # | Source | URL opened | Supports |
|---|---|---|---|
| 44 | Expo, *Send notifications with the Expo Push Service* | https://docs.expo.dev/push-notifications/sending-notifications/ | "up to 100 message objects" per request; receipts come after delivery to FCM or APNs; `DeviceNotRegistered` means stop sending; 600 notifications/second limit |
| 45 | Expo, *Notifications* SDK reference | https://docs.expo.dev/versions/latest/sdk/notifications/ | Remote push is unavailable "in Expo Go on Android from SDK 53"; "A development build is required" |
| 46 | Expo, *FCM credentials* | https://docs.expo.dev/push-notifications/fcm-credentials/ | Android notifications through Expo use FCM, with a Google service account key |
| 47 | Expo, *MapView* (react-native-maps) | https://docs.expo.dev/versions/latest/sdk/map-view/ | "Google Maps on Android and Apple Maps or Google Maps on iOS"; included in Expo Go. API-key steps apply only to the Google provider |
| 48 | react-native-maps, GitHub README | https://github.com/react-native-maps/react-native-maps | MIT license |
| 49 | Apple, *MKLookAroundSnapshotter* | https://developer.apple.com/documentation/mapkit/mklookaroundsnapshotter (text via https://developer.apple.com/tutorials/data/documentation/mapkit/mklookaroundsnapshotter.json) | "create a static image from a LookAround scene"; iOS 16.0+ |
| 50 | Apple, *MKLookAroundSceneRequest* | https://developer.apple.com/documentation/mapkit/mklookaroundscenerequest | Requests a Look Around scene at a location; iOS 16.0+ |
| 51 | Mapillary (Meta), *Terms of Use*, effective Feb 15 2024 | https://www.mapillary.com/terms | Other users' imagery is under CC BY-SA (links creativecommons.org/licenses/by-sa/4.0) |
| 52 | OpenStreetMap Foundation, *Copyright and License* | https://www.openstreetmap.org/copyright | Data under ODbL; attribution required |
| 53 | Esri, *World Imagery* item | https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9 (JSON: https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json) | Esri Master License Agreement. The item's credit line reads "Esri, Vantor, Earthstar Geographics, and the GIS User Community" |
| 54 | Supabase, *Edge Functions limits* | https://supabase.com/docs/guides/functions/limits | Wall clock limit 150 s on the free plan, 400 s on paid plans; request idle timeout 150 s |
| 55 | GitHub, *Events that trigger workflows* (`schedule`) | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows | Scheduled runs "can be delayed during periods of high loads", and queued jobs may be dropped |
| 56 | StatCounter, *Mobile OS market share, United States*. **Secondary (web-traffic sample); no primary source exists** | https://gs.statcounter.com/os-market-share/mobile/united-states-of-america | September 2026: Android 46.39%, iOS 53.59% |

## Claim map

Status: **VERIFIED**: the source says it. **WORDING CHANGE NEEDED**: the source supports a narrower or different statement (suggested wording given). **NO SOURCE FOUND**: no primary source says it.

### README.md

| Claim (as worded) | file:line | Cite | Status · suggested wording |
|---|---|---|---|
| "Real Texas state records" / "from data.texas.gov only" | README.md:8, :21 | 24, 25, 26 | VERIFIED |
| "at least 379 daycares inside TX-04 · 118,294 findings loaded" | README.md:21 | 24, 25, 26, 40 + our query | VERIFIED (sources); the figures come from our query |
| "2026 Congressional App Challenge · Texas's 4th District" | README.md:23 | 33, 35 | VERIFIED: TX04 (Pat Fallon) is listed for 2026 |
| "Texas publishes every inspection finding, but in a state search site few parents ever open." | README.md:44 | 17, 19 | **NO SOURCE FOUND** for "few parents ever open". → "Texas posts every inspection report online [19], but only on a search site, one daycare at a time, and only after due process [17]." |
| "how serious the state rates the rule" | README.md:45 | 13, 26 | VERIFIED |
| "Kairo and the Kids' Law (88(R) SB 1098, 2023)" | README.md:46 | 2, 3 | VERIFIED |
| "which line up with Rep. Pat Fallon's proposed federal Kairo Act (H.R. 2425, not law)" | README.md:46 | 29, 30 | **WORDING CHANGE NEEDED**: H.R. 2425 has no drop-in right, and the README's three requests include a drop-in visit. → "which overlap with Rep. Pat Fallon's proposed federal Kairo Act (H.R. 2425, introduced Mar 27 2025, not law; it adds a 2-business-day video deadline but no drop-in right)" |
| "against the Census CD119 boundary" | README.md:52 | 40 | VERIFIED |
| "about 5 years of history" | README.md:53 | 17 | VERIFIED ("five-year period") |
| "Android push needs a standalone build" | README.md:56, :126 | 45 | **WORDING CHANGE NEEDED** (Expo's term): → "Android push needs a development or standalone build, not Expo Go (Expo SDK 53+)" |
| Each finding shows "the state's risk level for the rule" | README.md:70 | 13, 26 | VERIFIED |
| Push on "a permit status change, or a corrective or adverse action" | README.md:71 | 24 | VERIFIED (columns `operation_status`, `corrective_action`, `adverse_action`) |
| Requests quote "HRC §42.04271 (drop in during open hours, records and inspection reports, video only after an alleged abuse or neglect incident involving their child)" | README.md:72 | 1, 3 | VERIFIED: (b)(1), (b)(4)-(5), (b)(8). The video right is to *inspect*, and only if a recording exists |
| "Uses rights that already exist in Texas law" | README.md:72 | 1, 3 | VERIFIED (effective Sep 1 2023) |
| Operations "row-level daily updates"; inspections and violations "full nightly reload" | README.md:93-95 | 24, 25, 26 | **WORDING CHANGE NEEDED**: the state publishes no schedule. The metadata shows reloads near 09:00 UTC Oct 24 and none since, which matches :342 ("not every night"). → "full reload, usually overnight (observed)" |
| "Census TIGER CD119 · TX-04 boundary" | README.md:98 | 40, 41 | **WORDING CHANGE NEEDED**: the pipeline pulls the polygon from TIGERweb, not TIGER/Line files. → "Census TIGERweb CD119 (Jan 1 2026 vintage)" |
| "Expo Push → APNs / FCM" | README.md:111 | 44 | VERIFIED |
| "Tokens Apple or Google reject are disabled" | README.md:129, :163 | 44 | VERIFIED (`DeviceNotRegistered`) |
| "checked against all 133,739 findings in the state file" | README.md:139 | 26 | VERIFIED (live count Oct 25: 133,739) |
| "Reloads visits and findings (usually overnight)" | README.md:154 | 25, 26 | VERIFIED (`rowsUpdatedAt` 09:02 and 09:07 UTC Oct 24) |
| "batches of ≤ 100" | README.md:161 | 44 | VERIFIED |
| Operations update: "about 300 to 450 rows a day statewide" | README.md:198 | 24 | **NO SOURCE FOUND**: this is our measurement; the state publishes no figure. → rename the column "What we observed (Oct 2026)" |
| Activities: "Full reload nightly, about 205,000 rows" | README.md:199 | 25 | **WORDING CHANGE NEEDED**: the count is VERIFIED (205,457), but "nightly" conflicts with :342. → "Full reload, usually overnight; about 205,000 rows" |
| Violations: "Full reload nightly, about 134,000 rows" | README.md:200 | 26 | **WORDING CHANGE NEEDED**, as above (count 133,739 VERIFIED) |
| In-scope daycares statewide: 14,310 | README.md:206 | 24 | VERIFIED (9,605 + 1,593 + 1,742 + 1,370) |
| "1,456 non-exact (address matched with corrections)" | README.md:209 | 38 | **WORDING CHANGE NEEDED**: the Census Bureau names the type "Non-Exact" but does not say "with corrections". → "1,456 non-exact (the Census Geocoder's 'Non_Exact' match type)" |
| Apple Look Around street-level picture | README.md:211, :236 | 49, 50 | VERIFIED (the API exists); the counts are ours |
| "Another 23 are still marked 'Pending', which fits findings being posted 1 to 3 weeks after a visit" | README.md:219 | 25 | **NO SOURCE FOUND** for "1 to 3 weeks", and :343 says the lag is not measured. → "Another 23 are still marked 'Pending' (findings not posted yet)." |
| "31 under rules the state rates High risk, 55 Medium High, 47 Medium" | README.md:220 | 13, 26 | VERIFIED (state scale) + our query |
| "the state does not publish one [a verdict]" | README.md:233 | 17 | VERIFIED: the state page shows counts by weight and no grade |
| "124 findings carry a `corrected_date` in the future" | README.md:234 | 26 | VERIFIED (dataset column) + our query |
| "most of Collin and Denton counties are outside TX-04" | README.md:235 | 42 | VERIFIED: 82% of Collin's land and 98% of Denton's are outside TX-04 |
| "a Census address point sits on the street, not the building" | README.md:236 | 38 | VERIFIED (interpolated along the street's address range) |
| "Home daycares (4,705 statewide)" | README.md:237 | 24 | VERIFIED (1,593 + 1,742 + 1,370) |
| Homes "are private residences, often listed under a person's name" | README.md:237 | 1 (§42.002(9)), 14 | "private residences" VERIFIED. **NO SOURCE FOUND** for "often listed under a person's name". → "They are the caregiver's own home [1, 14]", or give a count from our query |
| "HRC §42.04271(a) does not cover [listed family homes]" | README.md:239 | 1, 14 | VERIFIED. (a) lists registered family homes; licensed child-care homes are covered as "group day-care home" [14] |
| "Findings appear only after state due process, and the state already offers email updates per daycare" | README.md:240 | 17 | VERIFIED |
| "about an hour after the state usually reloads its files" | README.md:258 | 24, 25, 26 | VERIFIED (observed `rowsUpdatedAt` about 09:00 UTC) |
| "GitHub does start scheduled runs late" | README.md:258 | 55 | VERIFIED |
| "Expo Go on Android cannot receive remote pushes" | README.md:325 | 45 | VERIFIED (SDK 53 and later) |
| "14,310 of 14,977 rows in the operations file" | README.md:337 | 24 | VERIFIED (live Oct 25) |
| "1,456 non-exact" · "inside the Census CD119 boundary" | README.md:341 | 38, 40 | **WORDING CHANGE NEEDED**, as at :209 and :98 |
| "The state reloads usually overnight, not every night" | README.md:342 | 25, 26 | VERIFIED (no `rowsUpdatedAt` change since 2026-10-24 09:0x UTC) |
| "can post days to weeks after a visit, which is the state's own due-process rule" | README.md:343 | 17 | **WORDING CHANGE NEEDED**: the state's rule sets no time span. → "The state posts violations only after the daycare has had due process or waived it [17]; the state gives no time frame, and we have not measured one yet." |
| "the state publishes findings only after due process" | README.md:344 | 17 | VERIFIED; for full accuracy add "or the daycare waived its rights" |
| "the state offers email updates" | README.md:348 | 17 | VERIFIED |
| "Every outside library ... as the contest rules ask" | README.md:363 | 33 | VERIFIED ("must clearly document any such usage") |
| react-native-maps (MIT) | README.md:367 | 48 | VERIFIED |
| data.texas.gov "(public open data)" | README.md:374 | 24, 25, 26 | VERIFIED (CC0 1.0) |
| "U.S. Census Geocoder and TIGER/Line CD119 ... (public domain)" | README.md:375 | 40, 41, 43 | **WORDING CHANGE NEEDED**: the Census files make no public-domain statement, and the boundary comes from TIGERweb. → "U.S. Census Geocoder and TIGERweb CD119: U.S. Government works, not subject to copyright (17 U.S.C. §105)" |
| "Esri World Imagery ... credited on screen" | README.md:376 | 53 | **WORDING CHANGE NEEDED** (in the app, not the README): the code credits "Imagery © Esri, Maxar" (`PlaceGallery.tsx:55`, `MapSnapshot.tsx:161`), but the item's credit line now reads "Esri, Vantor, Earthstar Geographics, and the GIS User Community" |
| "Apple Maps (MapKit) · Map, 3D view, and directions on iPhone" | README.md:377 | 47, 49 | VERIFIED |
| "Mapillary (CC BY-SA 4.0)" | README.md:378 | 51 | VERIFIED |
| "State records are public data published by the Texas Health and Human Services Commission" | README.md:383 | 24, 25, 26 | VERIFIED (attribution HHSC; CC0) |

### docs/ARCHITECTURE.md

| Claim | file:line | Cite | Status · suggested wording |
|---|---|---|---|
| Kairo and the Kids' Law (SB 1098) gives records, video, and visit requests | ARCHITECTURE.md:20 | 1, 3 | VERIFIED |
| "investig. txmx-ceda (county totals)" listed under "data.texas.gov (Texas HHSC Child Care Regulation)" | ARCHITECTURE.md:25, :30 | 27 | **WORDING CHANGE NEEDED**: published by DFPS, not HHSC; covers FY 2016 to 2025, last updated Feb 9 2026; no code uses it. → remove the line, or "DFPS `txmx-ceda` (closed abuse/neglect investigations by county, FY2016-2025; not used yet)" |
| "SODA API, nightly ~09:00 UTC" | ARCHITECTURE.md:32 | 24, 25, 26 | VERIFIED (observed) |
| "About 4 in 10 US phones are Android" | ARCHITECTURE.md:56 | 56 | **WORDING CHANGE NEEDED**: the only source is secondary and says 46%. → "Close to half of US mobile web traffic is Android (46%, StatCounter, Sep 2026)" |
| "react-native-maps (Apple Maps on iPhone with no API key, Google Maps on Android), which also runs inside the Expo Go test app" | ARCHITECTURE.md:56 | 47 | **WORDING CHANGE NEEDED** (Expo does not say "no API key"; it puts key steps only under the Google provider). → "Apple Maps on iPhone, Google Maps on Android (a key is needed only for Google); included in Expo Go" |
| "Android push needs an FCM credential" | ARCHITECTURE.md:57 | 46 | VERIFIED |
| "no 150-second timeout" (Edge Functions) | ARCHITECTURE.md:59 | 54 | VERIFIED (free plan; paid plans allow 400 s) |
| "The SODA API is documented" | ARCHITECTURE.md:60 | 28 | VERIFIED |
| "the Congressional App Challenge rules allow any platform. Nothing has to be on the App Store or Google Play. Judges watch the video and may ask for the code." | ARCHITECTURE.md:62 | 33, 36 | VERIFIED (the rules never require a store listing) |
| "alerts arrive days to weeks after an inspection, never when an investigation opens" | ARCHITECTURE.md:72 | 17 | **WORDING CHANGE NEEDED** ("days to weeks" is not sourced). → "alerts arrive only after the state posts findings, which it does after due process, never when an investigation opens" |
| "activities about 205,000 rows · violations about 134,000 rows" | ARCHITECTURE.md:75 | 25, 26 | VERIFIED |
| "activities and violations: full reload nightly, about 09:00 UTC" | ARCHITECTURE.md:76 | 25, 26 | **WORDING CHANGE NEEDED** → "full reload, usually overnight around 09:00 UTC (observed)" |
| "Census Geocoder ... (exact or non-exact match kept)" | ARCHITECTURE.md:91 | 38 | VERIFIED |
| "TX-04 polygon (Census TIGER CD119)" | ARCHITECTURE.md:109 | 40 | **WORDING CHANGE NEEDED** → "Census TIGERweb CD119, Jan 1 2026 vintage" |

### docs/DATA.md

| Claim | file:line | Cite | Status · suggested wording |
|---|---|---|---|
| Dataset names "Child Care Regulation operations / activities / non-compliance" | DATA.md:7-9 | 24, 25, 26 | **WORDING CHANGE NEEDED** → use the official titles: "HHSC CCL Daycare and Residential Operations Data", "HHSC CCL Inspection Investigation Assessment Data", "HHSC CCL Non-Compliance Data" |
| Census Geocoder batch API (`Public_AR_Current`) | DATA.md:10 | 39 | VERIFIED |
| "TIGER/Line CD119, Texas district 4" | DATA.md:11 | 40 | **WORDING CHANGE NEEDED** → "TIGERweb 119th Congressional Districts (GEOID 4804)" |
| Mapillary CC BY-SA 4.0 | DATA.md:12 | 51 | VERIFIED |
| Four types in scope (Licensed Center, Licensed Child-Care Home, Registered Child-Care Home, Listed Family Home) | DATA.md:21 | 24 | VERIFIED (exact `operation_type` values) |
| State record URL `OperationDetails?operationId=<id>` | DATA.md:30 | 17 | VERIFIED |
| `activity_type`: INSPECTION, REPORT, ASSESSMENT | DATA.md:37 | 25 | VERIFIED (the dataset covers "Inspections, Investigations, Assessments") |
| Risk level: "High, Medium High, Medium, Medium Low, Low. It rates the rule, not the daycare" | DATA.md:45 | 13, 26 | VERIFIED |
| "`non_exact` (address matched with corrections)" | DATA.md:61 | 38 | **WORDING CHANGE NEEDED**, as at README:209 |
| "inside the CD119 polygon" | DATA.md:62 | 40 | VERIFIED |
| Candidates face "the building's footprint (OpenStreetMap)" | DATA.md:65 | 52 | **NO SOURCE FOUND in the repo**: no pipeline code mentions OpenStreetMap or footprints. If OSM is used, ODbL needs credit, and the README "Built with" table must list "OpenStreetMap (ODbL)". If it is not used, drop the clause |
| "The state reloads visits and findings in full, usually overnight around 09:00 UTC" | DATA.md:69 | 25, 26 | VERIFIED (observed) |
| "Findings appear only after the daycare has had due process, so they can post days to weeks after a visit" | DATA.md:69 | 17 | **WORDING CHANGE NEEDED**, as at README:343 |

### docs/PRIVACY.md

| Claim | file:line | Cite | Status |
|---|---|---|---|
| Look Around request sends a center's name and map point | PRIVACY.md:33 | 49, 50 | VERIFIED (the API takes a location or map item) |
| "The geocode sits along the street's address range, not on the rooftop" | PRIVACY.md:46 | 38 | VERIFIED |

### docs/OFFICIAL_SOURCES.md (re-checked Oct 25)

| Rows | file:line | Cite | Status |
|---|---|---|---|
| Hotline phone, 24/7, no anonymous reports since Sep 1 2023 | OFFICIAL_SOURCES.md:8, :15, :19 | 22 | VERIFIED |
| Online hotline not for urgent cases; 911; Relay 7-1-1 | :16-18, :20 | 23 | VERIFIED |
| CCR form: for regulation concerns, not abuse; requires a name; anonymous route is the local office | :21-23 | 18 | VERIFIED |
| Plano and Dallas offices; CCRQuestions email | :24, :26 | 20 | VERIFIED |
| Regional lines route to the Intake Prioritization Unit, eff. Mar 6 2026 | :25 | 21 | VERIFIED |
| Centers must post the hotline number (§746.405) | :28 | 8, 13 | VERIFIED |
| 88(R) SB 1098: caption, authors, short title, votes 30-1 / 137-1, signed Jun 18 2023, effective Sep 1 2023, adds §42.04271 | :6, :34, :36-40 | 2, 3 | VERIFIED |
| 89(R) SB 1098 is a pharmacy bill | :6, :35 | 4 | VERIFIED |
| §42.04271(a) facilities and (b)(1) to (11), (c), (e); no Texas camera mandate or video deadline | :7, :41-53 | 1, 3 | VERIFIED |
| H.R. 2425: title, sponsor, cosponsors, status Introduced, not law | :59-62, :64 | 29, 30 | VERIFIED (status read from govinfo BILLSTATUS; the congress.gov page returned 403) |
| H.R. 2425 "closely tracks Texas HRC §42.04271 and adds a 2-business-day deadline" | :63 | 29 | **WORDING CHANGE NEEDED** → "tracks §42.04271(b)(3)-(11) (records, inspection reports, court orders, regulator contact, video, policies, training records, no retaliation), omits the drop-in and complaint rights, and adds hotline and inspection-database information plus a 2-business-day video deadline" |
| OperationDetails URL; five-year history; due-process lag; email updates | :9, :70, :72-74 | 17 | VERIFIED |
| Search page redirect (curl -I) | :75 | n/a | Not re-checked Oct 25 |
| "texreg ... could not be fetched as text" | :79 | 5-12 | Now resolved: Cornell LII serves the current TAC text (URLs [5]-[12]); cite those alongside the HHSC PDF [13] |
| §746.521(1), (5), (8), (11) with weights; §746.601(b); §746.501(a)(20) | :83-89 | 5, 6, 7, 13 | VERIFIED ((1) Medium-High, (8) Medium, (11) Medium-High) |
| "Reports on every inspection are available online" | :90 | 19 | VERIFIED |
| Parallel rule for school-age programs, 26 TAC §744.521 | :91 | 12 | **Now VERIFIED** (was UNVERIFIED): the same 11 rights, eff. 8/19/2024 |
| `bc5r-88dy` enforcement columns | :99, :105, :117, :123 | 24 | VERIFIED (columns present) |
| Corrective action definition; probation only since 9/1/2019; 12-month maximum | :100-103 | 14, 15 | VERIFIED |
| Probation (§42.071(c)), hearing (§42.072(b)), penalties (§42.078) | :104, :116, :128 | 1 | VERIFIED |
| Adverse action definition and types; condition definition | :106-107, :118 | 14 | VERIFIED |
| CCRH 4500, 5530, 7100, 7610, 7626, 7633 quotes | :108-115, :125, :129 | 16 | Not re-opened Oct 25 (verified Oct 24 per that file) |

### Rules cited in the video (not in README or docs)

| Claim | Cite | Status |
|---|---|---|
| §746.5007(b): pool gates self-closing and self-latching, out of children's reach | 11, 13 | VERIFIED (weight High) |
| §746.2905: a center must not force a child to sleep | 10, 13 | VERIFIED: "You must not: (1) Force a child to sleep" (Medium); (2) restrictive devices (Medium-High) |
| §746.501(a)(9): written safe sleep policy for infants | 6, 13 | VERIFIED (High) |
| §746.701(1): record an injury needing medical treatment (Form 7239) | 9, 13 | VERIFIED (Medium) |
| Kairo's case: 2018, McKinney, 2-month-old, broken bones; footage refused | 31, 32 | VERIFIED from secondary sources only (the sponsor's op-ed and CBS News). No daycare name or sentence is used here |
| Federal bill's video deadline is 2 business days from a written request | 29 | VERIFIED (Sec. 3(a)(8)); it is not Texas law |
