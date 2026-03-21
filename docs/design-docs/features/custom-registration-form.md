# Custom Registration Form — Design Document

| Item    | Details                                                    |
| :------ | :--------------------------------------------------------- |
| Version | v1.1                                                       |
| Date    | 2026-03-21                                                 |
| Status  | Approved                                                   |
| Scope   | Per-event custom registration form with admin form builder |

---

## 1. Problem

Currently, event registration is a one-click action with no way to collect additional
information from registrants. Admins need to gather data like dietary preferences,
transportation needs, or emergency contacts per event.

## 2. Solution

Allow admins to optionally design a custom registration form per event. When a member
registers, they fill out the custom fields before completing registration. Responses
are stored, viewable in the admin panel, and included in the Excel export.

## 3. Data Model

### Enum: FormFieldType

```prisma
enum FormFieldType {
  TEXT
  YES_NO
  SINGLE_CHOICE
}
```

### EventFormField

Defines a custom field for an event's registration form.

| Column    | Type          | Description                                       |
| :-------- | :------------ | :------------------------------------------------ |
| id        | String        | Primary key (cuid)                                |
| eventId   | String        | FK → Event (onDelete: Cascade)                    |
| type      | FormFieldType | TEXT, YES_NO, or SINGLE_CHOICE                    |
| label     | String        | Question text                                     |
| options   | String[]      | Choices for SINGLE_CHOICE (empty for other types) |
| required  | Boolean       | Whether the field must be filled (default: false) |
| sortOrder | Int           | Display order                                     |
| createdAt | DateTime      | Creation timestamp                                |
| updatedAt | DateTime      | Update timestamp (@updatedAt)                     |

### EventFormResponse

Stores a registrant's answer to a custom field.

| Column         | Type     | Description                              |
| :------------- | :------- | :--------------------------------------- |
| id             | String   | Primary key (cuid)                       |
| registrationId | String   | FK → Registration (onDelete: Cascade)    |
| fieldId        | String   | FK → EventFormField (onDelete: Cascade)  |
| value          | String   | Answer text (all types stored as string) |
| createdAt      | DateTime | Creation timestamp                       |

Unique constraint: `[registrationId, fieldId]` — one answer per field per registration.

Value encoding: TEXT as-is, YES_NO as `"是"`/`"否"`, SINGLE_CHOICE as the selected
option text.

### Relation additions on existing models

- `Event` gains: `formFields EventFormField[]`
- `Registration` gains: `formResponses EventFormResponse[]`

### Cascade delete behavior

- Deleting an Event cascades to EventFormField (and their responses)
- Deleting a Registration cascades to EventFormResponse
- Deleting an EventFormField cascades to its EventFormResponse records
  (admin "delete field" = hard delete; historical responses are not preserved
  after field deletion since the field metadata is also gone)

## 4. Admin Form Builder UI

A collapsible "報名表單設計" section inside the event create/edit form. Starts empty
by default — events without custom fields work exactly as before.

Features:

- Add field: choose type (文字/是否/單選), enter label
- Reorder: up/down arrows change sortOrder
- Delete: removes field and its responses
- Required toggle: per field
- Options editor: for SINGLE_CHOICE, add/remove option strings
- Maximum 20 fields per event

Validation rules for SINGLE_CHOICE:

- Minimum 2 options
- No duplicate option strings within a field
- When an admin removes an option that registrants already selected, existing
  responses are preserved as-is (the string value remains in the DB)

## 5. Public Registration Flow

- **No custom fields**: one-click registration (unchanged)
- **Has custom fields**: modal dialog with the form fields, validated before submit
- Required fields marked with \*, validated both client-side and server-side
- Registration + responses created in one API call
- Already-registered users see their existing responses (read-only)
- Form fields are only shown when event status is OPEN (matching registration availability)

### Re-registration after cancellation

When a user re-registers after cancelling, old form responses are deleted and fresh
ones are created from the new submission. The form may have changed since the original
registration.

### Server-side validation

- All `fieldId` values must belong to the target event
- All `required: true` fields must have non-empty values
- SINGLE_CHOICE values must match one of the field's current options
- Validated with Zod schema in the registration route

## 6. Admin Viewing Responses

The registrations panel shows custom field responses in a horizontally scrollable
table with fixed container width. Each custom field is a column. Users drag/scroll
to see all columns when there are many fields.

## 7. Excel Export

The "報名" sheet gains additional columns for each custom field:

- Columns ordered by field `sortOrder`
- Column header text is the field `label`
- Registrants who didn't answer show empty cells
- The `ExportData.registrations` interface gains an optional `formFields` array
  with labels, and each `RegistrationRow` gains an optional `formResponses` map

## 8. API Changes

### Modified endpoints

- `POST /api/events` — accept optional `formFields` array
- `PUT /api/events/[eventId]` — accept optional `formFields` array (create/update/delete)
- `POST /api/registrations` — accept optional `formResponses: { fieldId, value }[]`,
  server-side validated against required fields and valid fieldIds
- `GET /api/registrations?eventId=xxx` — include form responses in the response

### New endpoint

- `GET /api/events/[eventId]/form-fields` — returns custom fields for an event.
  Public but only returns fields when event status is OPEN.

## 9. Schema Migration

`npx prisma migrate dev --name add_event_form` — adds FormFieldType enum,
EventFormField table, and EventFormResponse table.

## 10. Non-Goals

- File upload fields
- Conditional logic (show field X only if field Y = "是")
- Multi-select / checkbox fields
- Form templates (reuse a form across events)
- Editing responses after registration (registrants see read-only view)
