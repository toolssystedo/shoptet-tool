# Project Role

Act as a Senior AI Engineer & Full Stack Developer. We need to build an intelligent product data enrichment tool specifically for E-commerce exports (Shoptet).

# Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **UI:** Shadcn/ui + Tailwind CSS
- **File Parsing:** `xlsx` (SheetJS) or `papaparse` for CSV/Excel handling.
- **AI Integration:** Vercel AI SDK (with OpenAI/Anthropic provider).
- **Validation:** Zod.

# Core Objective

The app takes a product export file (.csv/.xlsx), analyzes product descriptions using AI, generates structured attributes (Filtering Properties and Text Properties), and returns a modified file ready for import.

# Architectural Requirement: The Strategy Pattern

Since we will support 'Shoptet' now and 'UpGates' later (with totally different logic), you must implement a **Platform Adapter Pattern**.

- Create an interface `PlatformAdapter` with methods like `validateFile`, `parseRow`, `formatOutput`.
- Implement `ShoptetAdapter` class specifically for the logic below.

# Specific Logic: Shoptet Adapter

## 1. File Validation

Before processing, check if the uploaded file contains these required headers:

- `shortDescription`
- `description`
- `textProperty` (base column)

## 2. Filtering Properties (`filteringProperty`)

- **Format:** In Shoptet, dynamic columns are named `filteringProperty:NameOfParam`. The cell value is just the value.
- **Logic:** The user specifies _which_ parameters to extract (e.g., "Color", "Material") and the maximum number of parameters.
- **AI Task:** Extract specific attributes from descriptions and map them to these columns.

## 3. Text Properties (`textProperty`)

- **Format:** These are informational parameters.
  - Column 1: `textProperty`
  - Column 2: `textProperty2`
  - Column 3: `textProperty3`, etc.
  - **Cell Content Format:** `Key;Value` (e.g., "Warranty;Lifetime").
- **Logic:** The system must find the first _empty_ textProperty column for each row to avoid overwriting existing data.
- **AI Task:** Extract informational data (defined by user) and format it strictly as `Key;Value`.

# User Flow & UI Requirements

## Step 1: Upload & Platform Selection

- Select Platform (Start with Shoptet).
- Upload File (Drag & drop).

## Step 2: Configuration (The "Brain")

- **Mode Selection:** Checkboxes for [ ] Generate Filtering Properties, [ ] Generate Text Properties.
- **Custom Instructions:**
  - Input field: "What to extract for Filtering?" (e.g., Color, Size).
  - Input field: "What to extract for Text Properties?" (e.g., Warranty, Care Instructions).
- **Source Selection:** Choose source column: `shortDescription`, `description`, or both combined.

## Step 3: AI Preview (Crucial)

- Before processing the whole file, show a "Test Run" button.
- Pick 3 random rows, run the AI extraction, and show a side-by-side comparison (Original vs. Enriched).
- Allow the user to tweak instructions if results are bad.

## Step 4: Batch Processing & Download

- Process the full file with a progress bar.
- Generate the new `.xlsx` file.
- **Important:** Ensure headers for `filteringProperty` are added dynamically based on AI findings if not pre-defined.

# Technical Constraints

- Use Structured Output (JSON Mode) for the AI prompt to ensure it returns data arrays, not text.
- Example AI Output JSON:
  ```json
  {
    "filtering": [{ "name": "Barva", "value": "Modrá" }],
    "text": [{ "key": "Záruka", "value": "2 roky" }]
  }
  ```
