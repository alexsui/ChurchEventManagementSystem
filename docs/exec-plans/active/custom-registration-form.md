# Custom Registration Form

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds. This document must be maintained in accordance with `docs/PLANS.md`.

Design spec: `docs/design-docs/features/custom-registration-form.md` (v1.1, Approved).

## Purpose / Big Picture

Today, event registration is a one-click action — the user presses "立即報名" and is immediately registered. There is no way for admins to collect additional information (dietary preferences, transportation, emergency contacts, etc.) during registration.

After this change, admins can optionally design a custom registration form per event. When a form exists, registrants see a modal dialog with custom fields (text, yes/no, single-choice) that must be completed before registration is finalized. Admins view the collected responses in the registrations panel, and responses are included in the Excel export. Events without custom fields continue to work exactly as before (one-click registration).

## Progress

- [x] (2026-03-21) Milestone 0: Install missing shadcn/ui components (Collapsible, RadioGroup)
- [x] (2026-03-21) Milestone 1: Prisma schema migration (FormFieldType enum, EventFormField, EventFormResponse tables)
- [x] (2026-03-21) Milestone 2: Backend services and Zod validation
- [x] (2026-03-21) Milestone 3: API route changes
- [x] (2026-03-21) Milestone 4: Admin form builder UI in event create/edit form
- [x] (2026-03-21) Milestone 5: Public registration modal with custom fields
- [x] (2026-03-21) Milestone 6: Admin responses viewer (horizontally scrollable table)
- [x] (2026-03-21) Milestone 7: Excel export update (custom field columns on 報名 sheet)
- [x] (2026-03-21) Milestone 8: Tests (200 tests passing, 11 new)
- [ ] Final validation and cleanup

## Surprises & Discoveries

(None yet — to be filled during implementation.)

## Decision Log

- Decision: Follow the approved design spec v1.1 exactly for data model, API shape, and UI behavior.
  Rationale: Spec was reviewed and approved in previous sessions. No new requirements have emerged.
  Date/Author: 2026-03-21 / Claude

- Decision: Use separate `form-field.service.ts` file rather than expanding `event.service.ts`.
  Rationale: Event service already handles sessions, status, CRUD. Adding form field logic (including cascade behavior for responses) would make it too large. A focused service keeps concerns separated.
  Date/Author: 2026-03-21 / Claude

- Decision: Build the form builder as a standalone `FormFieldsBuilder` component imported into `EventForm`, rather than inlining all form-builder logic directly.
  Rationale: `event-form.tsx` is already 556 lines with session management. A separate component keeps both files readable and testable independently.
  Date/Author: 2026-03-21 / Claude

- Decision: Event creation/update + formFields upsert are separate calls in the API route, not wrapped in a single transaction.
  Rationale: If `upsertFormFields` fails after event creation, the admin can simply re-submit the edit form to retry. The risk is low (orphan event without fields, easily recoverable), and wrapping both in a transaction would require restructuring the event service's internal transaction logic for sessions. Keeping them separate is simpler and matches the existing pattern where event + sessions is already one transaction, and form fields are a separate concern.
  Date/Author: 2026-03-21 / Claude

- Decision: `sortOrder` is derived from the array index at form submission, not user-provided.
  Rationale: The admin reorders fields via up/down arrows in the UI, which rearranges the array. The `handleSubmit` function assigns `sortOrder = index` before sending to the API. This avoids exposing sortOrder as an editable number input, which would be confusing UX.
  Date/Author: 2026-03-21 / Claude

- Decision: The `?admin=true` query param on the form-fields endpoint requires `hasPermission(role, "events", "read")`.
  Rationale: This matches the permission model used by the existing event detail GET endpoint. Any user who can read events in the admin panel should be able to see form field definitions regardless of event status.
  Date/Author: 2026-03-21 / Claude

## Outcomes & Retrospective

All 8 milestones completed in one session. 200 tests passing (11 new). Key files created: `form-field.service.ts`, `form-fields-builder.tsx`, `registration-form-modal.tsx`, form-fields API endpoint. Key files modified: Prisma schema, registration service, event routes, registration routes, RegisterButton, public event page, registrations panel, Excel export. No new npm packages needed beyond shadcn/ui components (Collapsible, RadioGroup).

## Context and Orientation

This is a Next.js 16 App Router project with a Prisma ORM + PostgreSQL backend, deployed on Vercel with a Neon database. The project manages church events, including registration, attendance, assignments, budgets, and teams.

### Key files and modules

**Prisma schema** (`prisma/schema.prisma`): Defines all database models. The `Event` model (line 190) owns `eventSessions`, `registrations`, `eventTeams`, and `budgetItems`. The `Registration` model (line 228) has a unique constraint on `[userId, eventId]` and cascading delete from both User and Event. We will add two new models (`EventFormField`, `EventFormResponse`) and one new enum (`FormFieldType`) here.

**Event service** (`src/services/event.service.ts`): Business logic for event CRUD. The `createEvent()` function creates an Event with EventSessions in one Prisma call. The `updateEvent()` function uses a `$transaction` to upsert sessions. The event service itself will not be modified — form field handling lives in a separate `form-field.service.ts` and is called from the API route after the event is created/updated.

**Registration service** (`src/services/registration.service.ts`): `registerForEvent(userId, eventId)` checks event status, existing registration, capacity, and creates/updates the registration row. For re-registration after cancellation, it updates the existing row's status. We will extend this to accept `formResponses` and handle the cascade (delete old responses on re-registration).

**Event form component** (`src/components/shared/event-form.tsx`): A react-hook-form + Zod form used for both create and edit modes. Uses `useFieldArray` for dynamic series sessions. Has types `EventFormDefaultValues` and `EventFormSubmitData`. We will add a collapsible "報名表單設計" section below the session section.

**Register button** (`src/components/shared/register-button.tsx`): Client component on the public event detail page. Currently, clicking "立即報名" sends `POST /api/registrations` with just `{ eventId }`. We will change this to open a modal when form fields exist, or remain as a one-click button when there are no form fields.

**Public event detail page** (`src/app/(public)/events/[eventId]/page.tsx`): Server component that fetches event data, registration counts, and user's registration status. Renders the `RegisterButton`. We will add a fetch for form fields and pass them (plus any existing responses) to the RegisterButton/modal.

**Registrations panel** (`src/components/admin/registrations-panel.tsx`): Admin component showing a table of registrations for an event. Columns: name, phone, status, registration time, actions. We will add custom field response columns after the existing columns, with horizontal scrolling.

**Excel export** (`src/lib/excel-export.ts`): Generates a multi-sheet .xlsx file. The `addRegistrationsSheet()` function creates the 報名 sheet with columns: 姓名, 電話, 狀態, 報名時間. We will add custom field columns after these.

**Export data fetcher** (`src/lib/export-event-data.ts`): Client-side function that fetches all event data from APIs and assembles an `ExportData` object. We will extend the registrations section to include form field metadata and response values.

**Validations** (`src/lib/validations.ts`): Zod schemas using `zod/v4`. Contains `createEventSchema` and `updateEventSchema`. We will add form field schemas here.

**API routes** (`src/app/api/`): Thin handlers that authenticate, authorize, call services, and return JSON. The events routes are at `src/app/api/events/route.ts` and `src/app/api/events/[eventId]/route.ts`. The registrations route is at `src/app/api/registrations/route.ts`.

**Constants** (`src/lib/constants.ts`): Chinese UI labels. We will add `formFieldTypeLabels`.

### Terms

- **FormFieldType**: A Prisma enum with three values — `TEXT` (free text), `YES_NO` (是/否), `SINGLE_CHOICE` (pick one from a list of options).
- **EventFormField**: A custom question defined by an admin for an event's registration form.
- **EventFormResponse**: A registrant's answer to one EventFormField, linked to their Registration.
- **sortOrder**: An integer determining the display order of form fields within an event.

## Plan of Work

### Milestone 0: Install Missing UI Components

The form builder (Milestone 4) requires a Collapsible component for the expandable section, and the registration modal (Milestone 5) requires RadioGroup for YES_NO and SINGLE_CHOICE fields. Neither is currently installed in the project's `src/components/ui/` directory. Before any UI work begins, install both components using the shadcn CLI. After installation, verify the files exist at `src/components/ui/collapsible.tsx` and `src/components/ui/radio-group.tsx`.

    npx shadcn@latest add collapsible radio-group

### Milestone 1: Prisma Schema Migration

This milestone adds the database tables that store custom form field definitions and registrant responses. At the end, the Prisma Client will have the new `EventFormField` and `EventFormResponse` types, and the database will have the corresponding tables. No application code changes yet.

Add three things to `prisma/schema.prisma`:

1. A `FormFieldType` enum with values `TEXT`, `YES_NO`, `SINGLE_CHOICE`.

2. An `EventFormField` model with columns: `id` (cuid PK), `eventId` (FK to Event, onDelete Cascade), `type` (FormFieldType), `label` (String), `options` (String array, for SINGLE_CHOICE choices), `required` (Boolean, default false), `sortOrder` (Int), `createdAt`, `updatedAt`. Add a relation `event Event @relation(...)`.

3. An `EventFormResponse` model with columns: `id` (cuid PK), `registrationId` (FK to Registration, onDelete Cascade), `fieldId` (FK to EventFormField, onDelete Cascade), `value` (String), `createdAt`. Add a unique constraint on `[registrationId, fieldId]`.

4. Add the reverse relations: `Event` gains `formFields EventFormField[]` and `Registration` gains `formResponses EventFormResponse[]`. `EventFormField` gains `responses EventFormResponse[]`.

Run the migration:

    npx prisma migrate dev --name add_event_form

After this milestone, the new tables exist in the database and Prisma Client is regenerated with the new types. Verify by checking that `npx prisma studio` shows the new EventFormField and EventFormResponse tables.

### Milestone 2: Backend Services and Validation

This milestone builds the backend foundation: Zod schemas for input validation, a new form-field service for CRUD operations, and an update to the registration service to handle form responses atomically. At the end, the backend can create/read/update/delete form fields, validate registration form submissions, and store responses. No API routes or UI yet.

#### 2a: Zod validation schemas (`src/lib/validations.ts`)

Add the following schemas:

- `formFieldSchema`: Validates a single form field input from the admin form builder. Shape: `{ id: string (optional, present for existing fields during edit), type: enum("TEXT","YES_NO","SINGLE_CHOICE"), label: string (min 1), options: string[] (optional), required: boolean (optional, default false), sortOrder: number (int, min 0) }`. The `sortOrder` is assigned by the frontend from the array index at submission time, not user-provided. Add a refinement: if type is SINGLE_CHOICE, options must have at least 2 items and no duplicates.

- `formFieldsArraySchema`: An array of `formFieldSchema` with max length 20.

- `formResponseSchema`: Validates a single response from a registrant. Shape: `{ fieldId: string (cuid), value: string }`.

- `formResponsesArraySchema`: An array of `formResponseSchema`.

Update `createEventSchema` and `updateEventSchema` to add an optional `formFields` property using `formFieldsArraySchema.optional()`.

#### 2b: Form field service (`src/services/form-field.service.ts`)

Create a new service file with these functions:

- `getFormFieldsByEvent(eventId: string)`: Returns all EventFormField rows for the event, ordered by `sortOrder` ascending. Used by both the admin form builder (to populate defaults) and the public registration page (to render the form).

- `upsertFormFields(eventId: string, fields: FormFieldInput[])`: Accepts the full list of fields from the admin form builder. Uses a transaction to: (a) delete all existing EventFormField rows for the event that are not in the input list (by comparing IDs), (b) upsert each field (create if no ID, update if ID exists). This "sync" approach means the admin form builder sends the complete desired state, and the service reconciles. Cascade delete on EventFormField handles removing orphaned responses.

- `getFormResponsesByRegistration(registrationId: string)`: Returns all EventFormResponse rows for a registration, including the field's label and type (for display).

#### 2c: Update registration service (`src/services/registration.service.ts`)

Modify `registerForEvent()` to accept an optional third parameter `formResponses?: { fieldId: string; value: string }[]`.

Before creating responses, validate server-side:

1. All `fieldId` values must belong to the target event's form fields.
2. All fields marked `required: true` must have a non-empty value in the responses.
3. For YES_NO fields, the value must be exactly `"是"` or `"否"` (per the spec's value encoding).
4. For SINGLE_CHOICE fields, the value must match one of the field's current `options`.

If validation fails, throw a `RegistrationServiceError` with code `INVALID_FORM_RESPONSES`.

When creating the registration (or updating from CANCELLED), also create the EventFormResponse rows. For re-registration (existing row with CANCELLED status): delete all old EventFormResponse rows for that registration, then create fresh ones.

Use a Prisma `$transaction` to ensure atomicity — the registration and all its responses succeed or fail together.

### Milestone 3: API Route Changes

This milestone wires the backend services to HTTP endpoints. Event create/update routes gain formFields handling, the registration route accepts and validates form responses, and a new public endpoint serves form field definitions. At the end, all backend functionality is accessible via API calls.

#### 3a: Modify event creation/update routes

In `src/app/api/events/route.ts` (POST) and `src/app/api/events/[eventId]/route.ts` (PUT):

After creating/updating the event, if `formFields` is present in the parsed body, call `upsertFormFields(eventId, formFields)`. The Zod schema already validates the shape (from Milestone 2a).

In the PUT route, the update happens in sequence: update event first (existing logic), then sync form fields.

#### 3b: Modify registration route

In `src/app/api/registrations/route.ts` (POST):

Accept optional `formResponses` in the request body. Pass them to `registerForEvent()`. If the service throws `INVALID_FORM_RESPONSES`, return 400 with the error message.

In the GET handler (when `?eventId=` is provided), include form responses in the registration data by adding an `include` for `formResponses` with the field relation (label, type, options).

#### 3c: New form-fields endpoint

Create `src/app/api/events/[eventId]/form-fields/route.ts`:

GET handler with two modes. By default (public, no auth), it fetches form fields for the event using `getFormFieldsByEvent()` but only returns fields when the event status is OPEN (per spec). If status is not OPEN, it returns an empty array. This prevents exposing form structure before the event is open for registration.

When called with `?admin=true`, the handler requires authentication and checks `hasPermission(role, "events", "read")`. If authorized, it returns all form fields regardless of event status. This is used by the admin registrations panel (Milestone 6) and the Excel export (Milestone 7) to display form field columns even for completed or planning events.

### Milestone 4: Admin Form Builder UI

This milestone adds the admin-facing form builder. At the end, admins can design custom registration forms when creating or editing events — adding, removing, reordering fields, and configuring field types, labels, required toggles, and options for single-choice fields. The form builder is entirely optional: events without custom fields continue to work exactly as before.

Create a new component `src/components/admin/form-fields-builder.tsx`. This is a collapsible section titled "報名表單設計" that appears in the `EventForm` after the session section and before the submit button.

Features:

- Starts collapsed by default (use a `Collapsible` from Radix/shadcn, or a simple disclosure with state toggle).
- Shows a count badge: "(N 個欄位)" next to the title when there are fields.
- "新增欄位" button to add a new field. Disabled when 20 fields already exist.
- Each field card shows:
  - Type selector (dropdown: 文字 / 是否 / 單選)
  - Label input (text input for the question text)
  - Required toggle (checkbox or switch)
  - Up/down arrow buttons to reorder (swap sortOrder with adjacent field)
  - Delete button (removes the field from the local array)
  - For SINGLE_CHOICE type: an options editor — a list of text inputs for each option, with add/remove buttons. Minimum 2 options enforced.

The form builder manages its own local state (array of field objects) and exposes the data via an `onChange` callback or by being controlled via react-hook-form's `useFieldArray`.

Integration with `EventForm`:

- Add `formFields` to `EventFormValues`, `EventFormDefaultValues`, and `EventFormSubmitData` interfaces.
- In the form schema, add `formFields` as optional array validated with a shape matching the Zod schema.
- In `handleSubmit`, include `formFields` in the submitted data.
- In the event create page (`src/app/admin/events/new/page.tsx`), the default is an empty array.
- In the event edit dialog (`src/app/admin/events/[eventId]/page.tsx`), fetch existing form fields and pass them as default values.

#### Chinese labels for `src/lib/constants.ts`

Add:

    export const formFieldTypeLabels: Record<string, string> = {
      TEXT: "文字",
      YES_NO: "是否",
      SINGLE_CHOICE: "單選",
    };

### Milestone 5: Public Registration Modal

This milestone adds the user-facing registration experience. When an event has custom form fields and the user clicks "立即報名", a modal dialog appears with the form fields that must be completed before registration. Events without custom fields remain one-click. Already-registered users see a read-only view of their submitted responses. At the end, the complete public registration flow with custom forms is functional.

#### 5a: Create registration form modal component

Create `src/components/shared/registration-form-modal.tsx`.

This is a Dialog (from shadcn/ui) that shows the custom form fields. Props:

- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `eventId: string`
- `formFields: FormField[]` (the event's form field definitions)
- `existingResponses?: FormResponse[]` (for already-registered users, read-only view)
- `onSubmit: (responses: { fieldId: string; value: string }[]) => Promise<void>`
- `isSubmitting: boolean`

The modal renders:

- A title: "報名表單"
- For each form field (ordered by sortOrder):
  - Label text, with a red asterisk if `required`
  - Input control based on type:
    - TEXT: `<Input>` or `<Textarea>` (use Input for simplicity)
    - YES_NO: Two radio buttons labeled "是" and "否"
    - SINGLE_CHOICE: Radio buttons for each option
- Client-side validation: required fields must have non-empty values.
- Submit button: "確認報名"
- If `existingResponses` is provided, render all fields as read-only (disabled inputs, no submit button). Show a title like "您的報名資料" instead.

#### 5b: Modify RegisterButton

Update `src/components/shared/register-button.tsx`:

Add new props:

- `formFields?: FormField[]` — the event's custom form fields (empty array = no custom fields)
- `existingResponses?: FormResponse[]` — the user's existing form responses (for already-registered view)

Behavior change:

- If `formFields` is empty or undefined: behavior is unchanged (one-click registration).
- If `formFields` has items AND the user is not registered: clicking "立即報名" opens the `RegistrationFormModal` instead of calling the API directly. The modal's `onSubmit` sends `POST /api/registrations` with `{ eventId, formResponses }`.
- If the user is already registered and has `existingResponses`: show the existing badge plus a "查看報名資料" link/button that opens the modal in read-only mode.

#### 5c: Update public event detail page

In `src/app/(public)/events/[eventId]/page.tsx`:

After fetching event and registration data, also fetch form fields using `getFormFieldsByEvent(eventId)` (direct service call since this is a server component). Only include fields if event status is OPEN.

If the user is registered, also fetch their form responses using `getFormResponsesByRegistration(registrationId)`.

Pass `formFields` and `existingResponses` as props to `RegisterButton`.

Serialize the data for the client component (form fields and responses are plain objects, so JSON serialization is straightforward).

### Milestone 6: Admin Responses Viewer

This milestone extends the admin registrations table to show custom field responses as additional columns. The result is a horizontally scrollable table where admins can see each registrant's responses alongside the standard name/phone/status/time columns.

Update `src/components/admin/registrations-panel.tsx`. The component needs two data sources: (1) form field definitions for column headers, fetched from `GET /api/events/{eventId}/form-fields?admin=true`, and (2) each registration's form responses, already included in the registration data from Milestone 3b. Fetch form fields in a separate `useEffect` or alongside the registrations fetch.

Note: the existing `Registration` interface in `registrations-panel.tsx` has a phantom `eventSession` property that is not actually returned by the `getRegistrationsByEvent` service. This does not affect our work, but be aware of it when extending the interface — add `formResponses` to match the actual API response shape.

Update the table:

- After the existing columns (姓名, 電話, 狀態, 報名時間), add one column per form field, ordered by `sortOrder`.
- Column header text is the field's `label`.
- Cell value: the response value for that field and registration. For YES_NO, display "是" or "否". For SINGLE_CHOICE, display the selected option text. For TEXT, display the text. Empty if no response.
- Wrap the table in a container with `overflow-x-auto` and a fixed max-width (e.g., `max-w-full`) so users can scroll horizontally when there are many columns.

### Milestone 7: Excel Export Update

This milestone adds custom field data to the Excel export. The 報名 sheet gains additional columns for each form field, so admins can download a complete spreadsheet of registration data including all custom responses. At the end, clicking "匯出 Excel" produces a file with the extended columns.

#### 7a: Update ExportData interfaces (`src/lib/excel-export.ts`)

Extend `RegistrationRow` with an optional `formResponses?: Record<string, string>` — a map of field label to response value.

Add an optional `formFields?: { label: string; sortOrder: number }[]` to the `registrations` object in `ExportData`.

#### 7b: Update addRegistrationsSheet

After the existing columns (姓名, 電話, 狀態, 報名時間), add one column per form field (ordered by sortOrder). The column header is the field label. Each row's cell is the response value from `formResponses[label]`, or empty string if absent.

#### 7c: Update fetchEventExportData (`src/lib/export-event-data.ts`)

After fetching registrations, also fetch form fields from `GET /api/events/{eventId}/form-fields?admin=true`.

For each registration, build the `formResponses` map from the included `formResponses` array in the registration data (which now includes field label from Milestone 3b).

### Milestone 8: Tests

This milestone adds unit tests for all new backend logic. Since form field handling is in its own service (not in the event service), tests focus on `form-field.service.ts` and the extended `registration.service.ts`.

Create `src/services/form-field.service.test.ts` with tests for `getFormFieldsByEvent` (returns sorted fields), `upsertFormFields` (create new fields, update existing fields, delete removed fields, cascade deletes responses), and `getFormResponsesByRegistration` (returns responses with field metadata).

Update `src/services/registration.service.test.ts` with tests for `registerForEvent` when form responses are provided: valid responses succeed, missing required field values throw `INVALID_FORM_RESPONSES`, invalid fieldId throws error, invalid SINGLE_CHOICE value throws error, invalid YES_NO value (not "是"/"否") throws error, and re-registration after cancellation deletes old responses and creates fresh ones.

Run all tests with `npm run test:run`. All existing tests should continue to pass, and all new tests should pass.

## Concrete Steps

Working directory: `/Users/samuel/Developer/church_event_management_system`

### Milestone 0

0.  Install missing shadcn/ui components:

        npx shadcn@latest add collapsible radio-group

    Expected: Files created at `src/components/ui/collapsible.tsx` and `src/components/ui/radio-group.tsx`.

### Milestone 1

1.  Edit `prisma/schema.prisma` to add the FormFieldType enum, EventFormField model, EventFormResponse model, and reverse relations on Event and Registration.

2.  Run the migration:

        npx prisma migrate dev --name add_event_form

    Expected: Migration file created in `prisma/migrations/`, Prisma Client regenerated.

3.  Verify the generated client has the new types:

        npx prisma validate

    Expected: "All good!"

### Milestone 2

4. Edit `src/lib/validations.ts` — add `formFieldSchema`, `formFieldsArraySchema`, `formResponseSchema`, `formResponsesArraySchema`. Update `createEventSchema` and `updateEventSchema`.

5. Create `src/services/form-field.service.ts` with `getFormFieldsByEvent`, `upsertFormFields`, `getFormResponsesByRegistration`.

6. Edit `src/services/registration.service.ts` — modify `registerForEvent` to accept and validate optional `formResponses`, create responses atomically, handle re-registration cleanup.

### Milestone 3

7. Edit `src/app/api/events/route.ts` (POST) — after creating the event, call `upsertFormFields` if formFields present.

8. Edit `src/app/api/events/[eventId]/route.ts` (PUT) — after updating the event, call `upsertFormFields` if formFields present. Also update GET to include `formFields` in the response.

9. Edit `src/app/api/registrations/route.ts` — POST accepts `formResponses`, GET includes form responses with field metadata.

10. Create `src/app/api/events/[eventId]/form-fields/route.ts` — GET handler, public but status-gated (OPEN only for public, all statuses with admin auth).

### Milestone 4

11. Add `formFieldTypeLabels` to `src/lib/constants.ts`.

12. Create `src/components/admin/form-fields-builder.tsx` — the form builder UI component.

13. Edit `src/components/shared/event-form.tsx` — add formFields to schema, types, default values, and render the FormFieldsBuilder component.

14. Edit `src/app/admin/events/[eventId]/page.tsx` — fetch existing form fields for the edit dialog default values.

### Milestone 5

15. Create `src/components/shared/registration-form-modal.tsx` — the registration modal with custom form fields.

16. Edit `src/components/shared/register-button.tsx` — add formFields/existingResponses props, open modal when fields exist.

17. Edit `src/app/(public)/events/[eventId]/page.tsx` — fetch form fields and responses, pass to RegisterButton.

### Milestone 6

18. Edit `src/components/admin/registrations-panel.tsx` — fetch form fields, add response columns to the table with horizontal scrolling.

### Milestone 7

19. Edit `src/lib/excel-export.ts` — extend interfaces and addRegistrationsSheet for custom field columns.

20. Edit `src/lib/export-event-data.ts` — fetch form fields and include response data in export.

### Milestone 8

21. Create `src/services/form-field.service.test.ts` — tests for all three service functions.

22. Update `src/services/registration.service.test.ts` with form response tests (valid, missing required, invalid fieldId, invalid SINGLE_CHOICE, invalid YES_NO, re-registration cleanup).

23. Run `npm run test:run` and verify all tests pass.

## Validation and Acceptance

After all milestones are complete:

1. **Schema**: `npx prisma validate` succeeds. `npx prisma studio` shows EventFormField and EventFormResponse tables.

2. **Admin create event with form**: Navigate to `/admin/events/new`. Expand "報名表單設計". Add a TEXT field ("飲食需求", required), a YES_NO field ("是否需要交通接送"), and a SINGLE_CHOICE field ("T-shirt尺寸", options: S/M/L/XL). Save. The event should be created with 3 form fields.

3. **Admin edit event form**: Navigate to the created event's admin page. Open the edit dialog. The form builder shows the 3 fields with their current values. Reorder, edit, delete a field, and save. Verify changes persist.

4. **Public registration with form**: Set the event status to OPEN. Navigate to the public event page as a logged-in user. Click "立即報名". A modal dialog appears with the 3 form fields. Fill in responses. Submit. Registration is created with form responses.

5. **Read-only responses for registered user**: Revisit the public event page as the same user. The button area shows the registration badge plus "查看報名資料". Clicking it opens the modal in read-only mode with the submitted responses.

6. **Re-registration**: Cancel the registration, then re-register. Old responses are deleted, new ones are created from fresh submission.

7. **Admin responses viewer**: In the admin registrations panel, the table shows custom field columns. Scroll horizontally to see all columns.

8. **Excel export**: Click "匯出 Excel". The 報名 sheet has additional columns for each custom field with response values.

9. **No-form events**: Events without custom fields continue to work as one-click registration (no modal).

10. **Tests**: `npm run test:run` — all tests pass, including new form field and registration response tests.

## Idempotence and Recovery

The Prisma migration is forward-only and additive (new enum, new tables). It can be safely re-run via `prisma migrate deploy`. No existing data is affected.

If the form builder is partially implemented and the event form breaks, the existing event create/edit flow still works because formFields is optional everywhere.

If the registration modal has issues, the one-click flow remains as fallback since it only activates when formFields is non-empty.

## Artifacts and Notes

### New files to create

- `src/services/form-field.service.ts` — Form field CRUD service
- `src/services/form-field.service.test.ts` — Tests for above
- `src/components/admin/form-fields-builder.tsx` — Admin form builder component
- `src/components/shared/registration-form-modal.tsx` — Public registration modal
- `src/app/api/events/[eventId]/form-fields/route.ts` — Form fields API endpoint

### Files to modify

- `prisma/schema.prisma` — Add enum + 2 models + relations
- `src/lib/validations.ts` — Add form field/response Zod schemas
- `src/lib/constants.ts` — Add formFieldTypeLabels
- `src/services/registration.service.ts` — Accept and validate formResponses
- `src/app/api/events/route.ts` — Handle formFields in POST
- `src/app/api/events/[eventId]/route.ts` — Handle formFields in PUT, include in GET
- `src/app/api/registrations/route.ts` — Handle formResponses in POST, include in GET
- `src/components/shared/event-form.tsx` — Add FormFieldsBuilder section, extend types/schema
- `src/components/shared/register-button.tsx` — Add formFields/existingResponses props, modal trigger
- `src/app/(public)/events/[eventId]/page.tsx` — Fetch form fields/responses, pass to RegisterButton
- `src/components/admin/registrations-panel.tsx` — Add response columns
- `src/lib/excel-export.ts` — Extend interfaces and 報名 sheet
- `src/lib/export-event-data.ts` — Fetch and include form data

## Interfaces and Dependencies

### Prisma models (after migration)

    enum FormFieldType { TEXT, YES_NO, SINGLE_CHOICE }

    model EventFormField {
      id        String        @id @default(cuid())
      eventId   String
      type      FormFieldType
      label     String
      options   String[]
      required  Boolean       @default(false)
      sortOrder Int
      createdAt DateTime      @default(now())
      updatedAt DateTime      @updatedAt
      event     Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
      responses EventFormResponse[]
    }

    model EventFormResponse {
      id             String         @id @default(cuid())
      registrationId String
      fieldId        String
      value          String
      createdAt      DateTime       @default(now())
      registration   Registration   @relation(fields: [registrationId], references: [id], onDelete: Cascade)
      field          EventFormField @relation(fields: [fieldId], references: [id], onDelete: Cascade)
      @@unique([registrationId, fieldId])
    }

### Service interfaces

    // src/services/form-field.service.ts
    function getFormFieldsByEvent(eventId: string): Promise<EventFormField[]>
    function upsertFormFields(eventId: string, fields: FormFieldInput[]): Promise<EventFormField[]>
    function getFormResponsesByRegistration(registrationId: string): Promise<FormResponseWithField[]>

    // Updated signature in src/services/registration.service.ts
    function registerForEvent(
      userId: string,
      eventId: string,
      formResponses?: { fieldId: string; value: string }[]
    ): Promise<Registration>

### Component interfaces

    // src/components/admin/form-fields-builder.tsx
    interface FormFieldsBuilderProps {
      fields: FormFieldValue[];
      onChange: (fields: FormFieldValue[]) => void;
      maxFields?: number; // default 20
    }

    // src/components/shared/registration-form-modal.tsx
    interface RegistrationFormModalProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      eventId: string;
      formFields: FormFieldForDisplay[];
      existingResponses?: FormResponseForDisplay[];
      onSubmit: (responses: { fieldId: string; value: string }[]) => Promise<void>;
      isSubmitting: boolean;
    }

### Zod schemas (src/lib/validations.ts)

    const formFieldSchema: z.ZodType<FormFieldInput>
    const formFieldsArraySchema: z.ZodType<FormFieldInput[]>  // max 20
    const formResponseSchema: z.ZodType<{ fieldId: string; value: string }>
    const formResponsesArraySchema: z.ZodType<{ fieldId: string; value: string }[]>

### Dependencies

The Collapsible and RadioGroup shadcn/ui components must be installed in Milestone 0 via `npx shadcn@latest add collapsible radio-group`. This will install the necessary Radix UI packages (`@radix-ui/react-collapsible`, `@radix-ui/react-radio-group`) and generate the wrapper components. All other UI components (Dialog, Input, Select, Switch, Checkbox) are already in `src/components/ui/`. SheetJS (xlsx) is already installed for Excel export. Zod v4 and react-hook-form are already in use.
