
## V10.2 browser login / installed-app flow

- Opening the normal ClassCheck website URL now stays on the public login/install screen, even when that browser still has an active Supabase session.
- If a session already exists, the entry screen shows **Continue to ClassCheck** and **Log out** instead of silently jumping to the dashboard.
- The **Install ClassCheck** control remains available before entering the workspace.
- Launching the installed PWA restores the existing session and opens the workspace directly, matching normal installed-app behavior.
- Logging out from Teacher Profile returns to the login screen.
- No database or SQL change is required for this V10.2 update.
# ClassCheck V8.5 — Exact SF2 Template Preservation

ClassCheck is connected to the existing Supabase project but no longer depends on Mathside teacher profiles.

## Included
- Independent ClassCheck teacher account creation and sign-in.
- Adviser-owned classes for Grades 7–12.
- One private join code per class; only the adviser can retrieve it.
- Subject teachers join with the class code and choose their subject.
- Shared roster only; attendance remains separate per teacher.
- Adviser can preview each subject teacher's attendance in Reports.
- Only the adviser can add/archive learners or archive the class.
- SF1 Excel/CSV roster import with a preview before importing.
- Offline-first attendance sync remains enabled.
- Existing favicon, instant panel navigation, and action loading overlays are retained.

## Supabase
The required migrations are already live in the connected project. `sql/setup.sql` is a schema reference/backup, not something you need to run now.

## V5 update — smooth panel navigation + SF1 import fix
- Removed the full-root opacity fade that could reveal a white browser canvas between pages.
- Navigation now keeps the ClassCheck shell/background opaque and transitions only the main workspace when supported.
- Added page prefetch hints for Classes, Attendance, Calendar, Reports, and Profile.
- SF1 upload now uses a native label/file-input trigger that works more reliably on mobile browsers.
- Added a secondary SheetJS CDN fallback and a short loader wait before reporting a library failure.
- Reworked SF1 parsing using the proven Mathside-style detection flow: scans multiple sheets, recognizes official DepEd SF1/School Register files, handles Male/Female grouped sections, finds LRN rows even when headers vary, and supports simple Excel/CSV learner lists.
- Supabase configuration remains unchanged.

## V6 — panel continuity, SF1 names, adviser bulk delete
- Added `app.html`, a Mathside-style single-document ClassCheck workspace. Classes, Attendance, Calendar, Reports, and Profile now switch as in-page panels, so normal panel navigation does not reload the browser document or expose a white frame.
- Legacy panel pages automatically route into the unified workspace when you use ClassCheck navigation; login also opens the unified Attendance panel.
- Corrected the SF1 parser for official DepEd merged headers such as “Last Name, First Name, Extension Name, Middle Name”. The combined learner name is parsed once rather than repeated in every name field.
- Adviser roster supports Select all shown, individual/multiple selection, Delete selected, and permanent individual learner deletion.
- Adviser can permanently delete a class after a destructive-action confirmation. Supabase cascading foreign keys remove that class roster, shared-teacher links, and related attendance records.
- Subject teachers remain read-only for the shared roster and do not receive adviser deletion controls.


## V7 — mobile class sheet + downloadable SF2 + styled Excel
- Mobile adviser roster now opens as a full-screen sheet so underlying back controls do not show through.
- Grade/section title is larger and left-aligned on mobile; the join-code panel is also wider and uses maroon borders.
- Generate SF2 now creates an actual `.xlsx` workbook and opens a result panel with a **Download generated SF2** button.
- SF2 workbook includes school/class details, daily learner attendance, Male/Female daily totals, monthly absence/tardy totals, learner movement counts, school days, Average Daily Attendance, Percentage of Attendance, and Percentage of Enrolment.
- Export CSV was replaced by a separate **Export Excel** workbook with Attendance Summary and Daily Records sheets.
- Both Excel exports use maroon (`#7A1730`) borders and maroon/blush headers—no orange borders.
- Uses `xlsx-js-style` in-browser so exported workbooks retain borders, fills, and typography.
- Existing Supabase configuration remains unchanged.


## V8 – Exact SF2 template
- SF2 export now starts from the exact `assets/templates/SF2_SOURCE_TEMPLATE.xls` file supplied by the user.
- Attendance marks in the SF2 are blank for Present, **X** for Absent, and **L** for Late/Tardy.
- The original School Form 2 layout, instructions, summary/computation area, signature area, merges, widths, and formatting are preserved.
- Header details, learner names, dates, attendance totals, movement summary, and monthly computations are filled into the original template positions.
- SF2 downloads as `.xls`, matching the supplied template.


V8.3 fix: the user-supplied SF2 template is embedded locally in js/sf2-template.js, so Generate SF2 no longer fetches a separate .xls asset at runtime. SF2 daily codes remain blank=Present, X=Absent, L=Late/Tardy.


## V8.3 — Excel Daily Attendance Grid
- Regular Excel export Sheet 2 now mirrors the SF2 daily-attendance layout.
- Learners are rows and recorded dates are columns.
- Present is blank, Absent is X, and Late/Tardy is L.
- Male, Female, and Combined daily totals are included with maroon borders and styling.


## V8.3 exact SF2 + Excel form
- Uses the latest user-supplied `SF2_2026_Grade 10 (Year IV) - BERYL(1).xls` as the embedded SF2 source template.
- SF2 keeps the template's fixed learner rows, merged cells, borders, labels, Male/Female total rows, combined total, guidelines, signatures, and summary block.
- Attendance codes: blank = Present, `X` = Absent, `L` = Late/Tardy.
- SF2 summary block fills M/F/TOTAL for baseline enrolment, late enrolment, registered learners, percentage of enrolment, average daily attendance, percentage of attendance, 5-consecutive-day absences, dropped out, transferred out, and transferred in.
- Regular Excel export Sheet 2 now uses the same form-style daily attendance layout and computation block, with maroon borders, while remaining a separate ClassCheck workbook.


## V8.4 SF2 formatting fix
Generated SF2 files are now exported as `.xlsx` instead of re-writing the legacy `.xls` format. This is intentional: the browser-side `.xls` writer normalized the original template formatting. The generator still reads the exact uploaded SF2 template and only changes cell values (attendance marks/data/computations), leaving the template layout/style model untouched. Present = blank, Absent = X, Late/Tardy = L.

## V8.5 — converted exact SF2 template + value-only patching
- The user's original `.xls` SF2 template was converted once to `assets/templates/SF2_SOURCE_TEMPLATE.xlsx` using a spreadsheet converter, preserving the template layout and formatting.
- The converted `.xlsx` template is embedded in `js/sf2-template.js`; Generate SF2 does not fetch a separate template file at runtime.
- SF2 generation now patches only worksheet cell values inside the existing `.xlsx` package. It does **not** rebuild the worksheet, styles, borders, merged cells, row heights, column widths, fonts, fills, alignment, margins, or spacing.
- The template `styles.xml` and workbook structure remain untouched during SF2 generation; only `xl/worksheets/sheet1.xml` cell values are changed.
- Attendance codes remain blank = Present, `X` = Absent, `L` = Late/Tardy, with the existing monthly computations filled into the template's original cells.


## V8.6 SF2 computation update
- Late (`L`) remains counted as present for daily totals, Average Daily Attendance, and Percentage of Attendance.
- SF2 enrolment percentage now uses a fixed first-Friday baseline stored per class (male/female), rather than recomputing the baseline each month.
- The first SF1 roster import automatically establishes the baseline for new classes. Learners added after the baseline are dated as new enrolments for monthly movement counts.
- Number of Days of Classes now comes from completed attendance sessions for the selected teacher/subject, with attendance-record dates as a fallback.
- Five-consecutive-absence checks follow those completed class dates.


## V8.7 — SF2 Monthly Details
Before generating SF2, ClassCheck asks for optional monthly movement counts (Male/Female): enrollment beyond cut-off, transferred in, transferred out, and dropped out. All default to zero. Late attendance status (L) continues to count as present for daily totals, ADA, and attendance percentage.

## V8.8 — Weekday-only attendance
- Saturday and Sunday are disabled in the Attendance date rail and calendar picker.
- If ClassCheck is opened on a weekend, Attendance defaults to the previous Friday.
- Supabase rejects new/edited attendance records or sessions dated Saturday/Sunday.
- SF2 and regular Excel reports ignore any older weekend attendance rows and count only Monday–Friday completed sessions as school days.
- Late (`L`) remains attended: it is included in Present totals, ADA, and Percentage of Attendance.


## V8.9 — Calendar-aligned SF2 dates
- SF2 weekday headers remain exactly M, T, W, TH, F.
- Every Monday-Friday date in the selected month is prefilled under its actual weekday column.
- Saturdays and Sundays are omitted; after Friday, the next populated date is the following Monday.
- The month automatically stops at its real last calendar day (28/29/30/31).
- No. of Days of Classes is derived from the populated Monday-Friday date cells.
- X = absent, L = late/tardy, blank = present; L continues to count as present in calculations.


## V9.0 attendance-total rules
- SF2 school days are the count of Monday-Friday date slots in the selected month; weekends are excluded.
- A learner's monthly Absent total is the number of X marks.
- A learner's monthly Present total is School Days minus Absent; L (Late) remains included in Present.
- Registered Learners M/F/TOTAL comes directly from the current class roster counts.
- The regular Excel export uses the same Present/Absent logic and now contains one sheet only (Attendance Summary).
- The SF2-ready result panel no longer shows separate ADA or Attendance Percentage cards; those computations remain inside the official SF2 summary block.


## V9.1 SF2 identity fields
- Uses the fixed first-Friday enrolment baseline saved on each class.
- Adviser printed name comes from the adviser teacher profile and is synced to owned classes.
- Teacher Profile includes School head name; generated SF2 writes it to the School Head signature line.


## V9.2 SF2 identity fix
- Generate SF2 refreshes Teacher Profile directly from Supabase before creating the workbook.
- Adviser name is written to the original template cell AN80 from the class adviser / current owner Full Name.
- School Head Name is written to AN86 from Teacher Profile.
- Generation stops with a clear instruction if School Head Name is blank instead of silently exporting an empty name.
- The SF2 result panel previews Adviser and School Head before download.


## V9.3 — Persistent SF2 first-Friday enrolment
Before generating SF2, ClassCheck now asks for Male/Female enrolment as of the 1st Friday of June. The values are stored per class in Supabase and automatically pre-filled for future months. Only the class adviser can change the saved baseline; subject teachers can view it but cannot modify it.


## V9.4 create-class / learner fix
- Repairs stale cached-profile failure before the Create Class loading overlay.
- Forces fresh Supabase profile/state during class creation.
- Adds Mathside/EduCore-style loading overlay to manual learner creation.
- Refreshes class/roster cache after successful inserts.
- Bumps browser cache versions for storage/classes scripts.


## V9.5 — join-class fix
- Keeps the latest V9.5 shared-roster / Join Class corrections as the functional baseline.

## V10 — Installable PWA
- ClassCheck can now be installed from GitHub Pages as a Progressive Web App (PWA).
- Adds a maroon ClassCheck launcher icon, app manifest, service worker, offline fallback page, Home Screen / desktop shortcuts, and standalone display mode.
- Adds **Install ClassCheck** and **How to install / Installation guide** controls on the sign-in screen and Classes panel, plus an install card in Teacher Profile.
- Android/Chrome uses the native install prompt when available. iPhone/iPad shows Safari Add to Home Screen instructions. Desktop Chrome/Edge is supported.
- Existing local-first attendance behavior and Supabase configuration are preserved.
- `js/config.js` is unchanged.


## V10.1 Mobile Profile + Install Fix
- Adds **Profile** as the fifth mobile bottom-navigation tab.
- Restores access to **Teacher Profile** and **Log out** on phones.
- Adds a compact install/download button to the Classes header.
- Uses Android/iOS-specific install instructions similar to Mathside.
- Makes the service worker network-first and bumps the cache so updates appear reliably.
- No SQL/database changes are required.
