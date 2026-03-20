"""
Build a fillable PDF replicating the Finance of America Reverse Mortgage Request Form.
Pre-fills LO fields with David Burson / NetRate Mortgage info.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfform
from reportlab.lib.enums import TA_LEFT

OUTPUT = r"D:\PROJECTS\netrate-pc-ops\Work\Products\FAR-Reverse-Mortgage-Request-Form.pdf"

# Colors matching the original form
BLUE = HexColor("#2E5FA1")
GREEN = HexColor("#4A7C3F")
ORANGE = HexColor("#D4820E")
RED = HexColor("#C41E1E")
DARK_RED = HexColor("#A01010")
LIGHT_GRAY = HexColor("#F5F5F5")
FIELD_BG = HexColor("#FFFFDD")
TEAL = HexColor("#0891b2")

W, H = letter  # 612 x 792

def draw_section_header(c, y, text, color):
    """Draw a colored section header bar."""
    c.setFillColor(color)
    c.rect(36, y - 2, W - 72, 16, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, y + 2, text)
    c.setFillColor(black)
    return y - 4

def draw_label(c, x, y, text, bold=False, size=7):
    """Draw a label."""
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font, size)
    c.setFillColor(black)
    c.drawString(x, y, text)

def draw_field(c, name, x, y, w, h=14, value=""):
    """Draw a text form field."""
    pdfform.textFieldRelative(c, name, x, y, w, h, value=value)

def draw_checkbox(c, name, x, y, size=10):
    """Draw a checkbox."""
    pdfform.buttonFieldRelative(c, name, "Off", x, y, width=size, height=size)

def draw_dropdown(c, name, x, y, w, options, value=""):
    """Draw a dropdown select field."""
    v = value if value else options[0]
    pdfform.selectFieldRelative(c, name, v, options, x, y, w, 14)

def draw_yes_no(c, prefix, x, y):
    """Draw YES / NO checkboxes side by side."""
    draw_checkbox(c, f"{prefix}_yes", x, y)
    draw_label(c, x + 12, y + 2, "YES", size=6)
    draw_checkbox(c, f"{prefix}_no", x + 35, y)
    draw_label(c, x + 47, y + 2, "NO", size=6)

def draw_gender(c, prefix, x, y):
    """Draw FEMALE / MALE checkboxes."""
    draw_checkbox(c, f"{prefix}_female", x, y)
    draw_label(c, x + 12, y + 2, "FEMALE", size=6)
    draw_checkbox(c, f"{prefix}_male", x + 55, y)
    draw_label(c, x + 67, y + 2, "MALE", size=6)

def draw_marital(c, prefix, x, y):
    """Draw marital status checkboxes."""
    draw_checkbox(c, f"{prefix}_married", x, y)
    draw_label(c, x + 12, y + 2, "MARRIED", size=6)
    draw_checkbox(c, f"{prefix}_not_married", x + 65, y)
    draw_label(c, x + 77, y + 2, "NOT MARRIED", size=6)
    draw_checkbox(c, f"{prefix}_separated", x + 150, y)
    draw_label(c, x + 162, y + 2, "LEGALLY SEPARATED", size=6)

# --- Borrower/Co-Borrower info block ---
def draw_person_block(c, y, prefix, label, color):
    """Draw a borrower or co-borrower information block."""
    y = draw_section_header(c, y, label, color)
    y -= 4

    row_h = 18  # row height
    lx = 42     # left col start
    mx = 220    # mid col start
    rx = 400    # right col start

    # Row 1: Name, Gender, Email
    draw_label(c, lx, y, "BWR FULL LEGAL NAME")
    draw_field(c, f"{prefix}_name", lx, y - 14, 150)
    draw_gender(c, prefix, mx, y - 12)
    draw_label(c, rx, y, "EMAIL ADDRESS")
    draw_field(c, f"{prefix}_email", rx, y - 14, 165)
    y -= row_h + 12

    # Row 2: DOB, Phone, Incapacitated
    draw_label(c, lx, y, "DATE OF BIRTH")
    draw_field(c, f"{prefix}_dob", lx, y - 14, 150)
    draw_label(c, mx, y, "PHONE #")
    draw_field(c, f"{prefix}_phone", mx, y - 14, 150)
    draw_label(c, rx, y, "BWR INCAPACITATED (PHYSICAL)")
    draw_yes_no(c, f"{prefix}_incapacitated", rx + 140, y - 2)
    y -= row_h + 12

    # Row 3: SSN, Monthly Income, Incompetent
    draw_label(c, lx, y, "SOCIAL SECURITY #")
    draw_field(c, f"{prefix}_ssn", lx, y - 14, 120)
    draw_label(c, mx, y, "TOTAL MONTHLY INCOME")
    draw_field(c, f"{prefix}_income", mx, y - 14, 120)
    draw_label(c, rx, y, "BWR INCOMPETENT (MENTAL)")
    draw_yes_no(c, f"{prefix}_incompetent", rx + 140, y - 2)
    y -= row_h + 12

    # Row 4: US Citizen, Available Assets, Outstanding Judgments
    draw_label(c, lx, y, "ARE YOU A US CITIZEN?")
    draw_yes_no(c, f"{prefix}_citizen", lx + 110, y - 2)
    draw_label(c, mx, y, "AVAILABLE ASSETS")
    draw_field(c, f"{prefix}_assets", mx, y - 14, 150)
    draw_label(c, rx, y, "OUTSTANDING JUDGMENTS")
    draw_yes_no(c, f"{prefix}_judgments", rx + 140, y - 2)
    y -= row_h + 12

    # Row 5: Perm Resident, (blank), Unresolved Bankruptcy
    draw_label(c, lx, y, "PERM RESIDENT ALIEN?")
    draw_yes_no(c, f"{prefix}_resident", lx + 110, y - 2)
    draw_label(c, rx, y, "UNRESOLVED BANKRUPTCY")
    draw_yes_no(c, f"{prefix}_bankruptcy", rx + 140, y - 2)
    y -= row_h + 12

    # Row 6: Marital, Intend Financial Product, Party to Lawsuit
    draw_marital(c, prefix, lx, y - 2)
    draw_label(c, mx, y, "INTEND TO BUY A FINANCIAL PRODUCT")
    draw_yes_no(c, f"{prefix}_financial_product", mx + 120, y - 2)
    draw_label(c, rx, y, "PARTY TO A LAWSUIT")
    draw_yes_no(c, f"{prefix}_lawsuit", rx + 140, y - 2)
    y -= row_h + 12

    # Row 7: Ethnicity, Existing FHA, Default Fed Debt
    eth_options = ["Select One", "Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"]
    draw_label(c, lx, y, "ETHNICITY")
    draw_dropdown(c, f"{prefix}_ethnicity", lx + 55, y - 12, 90, eth_options)
    draw_checkbox(c, f"{prefix}_ethnicity_na", lx + 150, y - 10)
    draw_label(c, lx + 162, y - 8, "N/A", size=6)
    draw_label(c, mx, y, "EXISTING FHA LOAN")
    draw_yes_no(c, f"{prefix}_fha", mx + 100, y - 2)
    draw_label(c, rx, y, "DEFAULT ON FEDERAL DEBT")
    draw_yes_no(c, f"{prefix}_fed_debt", rx + 140, y - 2)
    y -= row_h + 12

    # Row 8: Race, Power of Attorney, Endorser
    race_options = ["Select One", "American Indian or Alaska Native", "Asian",
                    "Black or African American", "Native Hawaiian or Pacific Islander",
                    "White", "Prefer not to say"]
    draw_label(c, lx, y, "RACE")
    draw_dropdown(c, f"{prefix}_race", lx + 55, y - 12, 90, race_options)
    draw_label(c, mx, y, "POWER OF ATTORNEY")
    draw_yes_no(c, f"{prefix}_poa", mx + 100, y - 2)
    draw_label(c, rx, y, "ENDORSER ON A NOTE")
    draw_yes_no(c, f"{prefix}_endorser", rx + 140, y - 2)
    y -= row_h + 6

    return y


def build_form():
    c = canvas.Canvas(OUTPUT, pagesize=letter)
    c.setTitle("Reverse Mortgage Request Form - NetRate Mortgage")

    # ── Title ──
    y = H - 40
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(TEAL)
    c.drawRightString(W - 36, y, "Reverse Mortgage Request Form")
    y -= 16
    c.setFont("Helvetica", 8)
    c.setFillColor(black)
    c.drawRightString(W - 36, y, "Christina Bitner, Account Executive  teamchristina@financeofamerica.com")
    y -= 11
    c.setFont("Helvetica-Oblique", 7)
    c.drawRightString(W - 36, y, "*Counseling must be done prior to application in TN and VT")
    y -= 10
    c.drawRightString(W - 36, y, "*No services can be ordered until the 7th day after counseling in CA")
    y -= 10
    c.drawRightString(W - 36, y, "*NBS in TX is not allowed")
    y -= 11
    c.setFont("Helvetica-BoldOblique", 7)
    c.setFillColor(RED)
    c.drawRightString(W - 36, y, "Items marked in RED are required.")
    c.setFillColor(black)

    # ── Checkboxes: Pricing/Counseling, Application, Credit Report ──
    y -= 18
    draw_checkbox(c, "pkg_pricing", 120, y)
    draw_label(c, 133, y + 2, "PRICING/COUNSELING PKG", bold=True, size=7)
    draw_checkbox(c, "pkg_application", 290, y)
    draw_label(c, 303, y + 2, "APPLICATION PACKAGE", bold=True, size=7)
    draw_checkbox(c, "pkg_credit", 430, y)
    draw_label(c, 443, y + 2, "ATTACH TRI-MERGE CREDIT REPORT", bold=True, size=7)

    # ── LO Information ──
    y -= 28
    lx = 42
    rx = 340

    # Row 1
    draw_label(c, lx, y, "LO NAME:", bold=True, size=7)
    draw_field(c, "lo_name", lx + 60, y - 4, 140, value="David Burson")
    draw_label(c, rx - 100, y, "LO NMLS ID:", bold=True, size=7)
    draw_field(c, "lo_nmls", rx - 35, y - 4, 100, value="641790")

    # Goal of Program dropdown
    goal_options = ["Select One", "Eliminate mortgage payment", "Access cash/equity",
                    "Purchase a home", "Refinance existing HECM", "Other"]
    draw_label(c, rx + 80, y, "GOAL OF PROGRAM:", bold=True, size=7)
    draw_dropdown(c, "goal_of_program", rx + 170, y - 12, 120, goal_options)

    y -= 22
    draw_label(c, lx, y, "LO COMPANY NAME:", bold=True, size=7)
    draw_field(c, "lo_company", lx + 100, y - 4, 100, value="NetRate Mortgage LLC")

    prog_options = ["Select One", "HECM Fixed", "HECM ARM", "HECM for Purchase",
                    "HomeSafe Standard", "HomeSafe Second", "EquityAvail"]
    draw_label(c, rx + 80, y, "REVERSE PROGRAM:", bold=True, size=7)
    draw_dropdown(c, "reverse_program", rx + 170, y - 12, 120, prog_options)

    y -= 22
    draw_label(c, lx, y, "LO EMAIL ADDRESS:", bold=True, size=7)
    draw_field(c, "lo_email", lx + 100, y - 4, 100, value="david@netratemortgage.com")

    purpose_options = ["Select One", "No cash out refinance", "Cash out refinance", "Purchase"]
    draw_label(c, rx + 80, y, "PURPOSE OF LOAN:", bold=True, size=7)
    draw_dropdown(c, "purpose_of_loan", rx + 170, y - 12, 120, purpose_options)

    y -= 22
    draw_label(c, lx, y, "LO CELL PHONE:", bold=True, size=7)
    draw_field(c, "lo_cell", lx + 100, y - 4, 100, value="303-444-5251")
    draw_label(c, rx - 100, y, "LO OFFICE PHONE:", bold=True, size=7)
    draw_field(c, "lo_office", rx - 35, y - 4, 100, value="303-444-5251")

    prop_options = ["Select One", "Single Family", "PUD", "Condo (FHA approved)",
                    "Condo (non-FHA)", "Manufactured", "2-4 Unit", "Townhouse"]
    draw_label(c, rx + 80, y, "PROPERTY TYPE:", bold=True, size=7)
    draw_dropdown(c, "property_type", rx + 170, y - 12, 120, prop_options)

    # ── Borrower Information ──
    y -= 30
    y = draw_person_block(c, y, "bwr", "BORROWER INFORMATION", BLUE)

    # ── Co-Borrower / NBS Information ──
    y -= 8
    y = draw_person_block(c, y, "cobwr",
                          "CO-BORROWER OR NBS (NON-BORROWING SPOUSE) INFORMATION", GREEN)

    # ── NEW PAGE for Property & remaining sections ──
    c.showPage()
    y = H - 40

    # ── Property Information ──
    y = draw_section_header(c, y, "PROPERTY INFORMATION", ORANGE)
    y -= 4
    lx = 42
    mx = 250
    rx = 420

    # Address row
    draw_label(c, lx, y, "ADDRESS")
    draw_field(c, "prop_address", lx, y - 14, 200)
    draw_label(c, mx, y, "CITY")
    draw_field(c, "prop_city", mx, y - 14, 120)
    draw_label(c, rx - 40, y, "STATE")
    draw_field(c, "prop_state", rx - 40, y - 14, 35)
    draw_label(c, rx + 5, y, "ZIP")
    draw_field(c, "prop_zip", rx + 5, y - 14, 50)
    draw_label(c, rx + 65, y, "YEAR BUILT")
    draw_field(c, "prop_year_built", rx + 65, y - 14, 55)
    y -= 30

    # Value row
    draw_label(c, lx, y, "ESTIMATE OF PROPERTY VALUE")
    draw_field(c, "prop_value", lx, y - 14, 160)
    draw_label(c, mx - 20, y, "PROPERTY SQUARE FOOTAGE")
    draw_field(c, "prop_sqft", mx - 20, y - 14, 100)
    draw_label(c, rx, y, "IS THIS THE PRIMARY RESIDENCE")
    draw_yes_no(c, "prop_primary", rx + 150, y - 2)
    y -= 30

    # Mortgage row
    draw_label(c, lx, y, "CURRENT MORTGAGE PAYOFF AMT")
    draw_field(c, "prop_mortgage_payoff", lx, y - 14, 160)
    draw_label(c, mx - 20, y, "PROPERTY TAX AMT/MO.")
    draw_field(c, "prop_tax", mx - 20, y - 14, 100)
    draw_label(c, rx, y, "TAXES ON TIME PAST 24 MOS")
    draw_yes_no(c, "prop_taxes_ontime", rx + 150, y - 2)
    y -= 30

    # Years at address row
    draw_label(c, lx, y, "YEARS AT PRESENT ADDRESS")
    draw_field(c, "prop_years", lx, y - 14, 160)
    draw_label(c, mx - 20, y, "HOMEOWNERS INS./MO.")
    draw_field(c, "prop_hoi", mx - 20, y - 14, 100)
    draw_label(c, rx, y, "HOI PAID ON TIME PAST 12 MOS")
    draw_yes_no(c, "prop_hoi_ontime", rx + 150, y - 2)
    y -= 30

    # Trust row
    draw_label(c, lx, y, "PROPERTY HELD IN TRUST")
    draw_yes_no(c, "prop_trust", lx + 120, y - 2)
    draw_label(c, mx - 20, y, "HOA AMT/MO.")
    draw_field(c, "prop_hoa", mx - 20, y - 14, 100)
    draw_label(c, rx, y, "HOA PAID ON TIME PAST 12 MOS")
    draw_yes_no(c, "prop_hoa_ontime", rx + 150, y - 2)
    y -= 30

    # Refi / Debt / Solar row
    draw_checkbox(c, "prop_refi_cashout", lx, y - 2)
    draw_label(c, lx + 13, y, "REFI IN PAST 12 MOS & RECEIVED $500+ CASH OUT", size=6)
    draw_label(c, mx - 20, y, "MIN DEBT PAYMENTS/MO.")
    draw_field(c, "prop_min_debt", mx - 20, y - 14, 100)
    draw_label(c, rx, y, "DOES THE HOME HAVE SOLAR LEASE")
    draw_yes_no(c, "prop_solar", rx + 150, y - 2)
    y -= 30

    # Additional properties row
    draw_label(c, lx, y, "BORROWER OWNS ADD'L PROPERTIES")
    draw_yes_no(c, "prop_addl_properties", lx + 160, y - 2)
    draw_label(c, mx - 20, y, "# OF ADULTS 18+ LIVING IN THE HOME")
    draw_field(c, "prop_adults", mx + 140, y - 4, 40)
    draw_label(c, rx, y, "ADD'L LIEN PAYOFF AMT")
    draw_field(c, "prop_addl_lien", rx + 110, y - 4, 55)
    y -= 24

    # ── Alternative Contact ──
    y -= 10
    c.setFillColor(RED)
    c.rect(36, y - 2, W - 72, 16, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, y + 2, "AN ALTERNATIVE CONTACT CANNOT RESIDE IN THE SUBJECT PROPERTY")
    c.setFillColor(black)
    y -= 22

    draw_label(c, lx, y, "ALTERNATIVE CONTACT NAME")
    draw_field(c, "alt_name", lx + 145, y - 4, 180)
    draw_label(c, rx, y, "PHONE NUMBER")
    draw_field(c, "alt_phone", rx + 80, y - 4, 95)
    y -= 22

    draw_label(c, lx, y, "ALTERNATIVE CONTACT ADDRESS")
    draw_field(c, "alt_address", lx + 145, y - 4, 180)
    draw_label(c, rx, y, "RELATIONSHIP")
    draw_field(c, "alt_relationship", rx + 80, y - 4, 95)
    y -= 30

    # ── Tell Us The Story ──
    c.setFillColor(RED)
    c.rect(36, y - 2, W - 72, 16, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, y + 2, "TELL US THE STORY")
    c.setFillColor(black)
    y -= 22

    # Multi-line text field for the story
    pdfform.textFieldRelative(c, "story", 42, y - 80, W - 84, 80,
                              value="", multiline=1)
    y -= 100

    # ── Footer ──
    y -= 20
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(W / 2, y,
                        "EMAIL THE COMPLETED FORM AND CREDIT REPORT TO TEAM CHRISTINA AT")
    y -= 16
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(W / 2, y, "TEAMCHRISTINA@FINANCEOFAMERICA.COM")
    c.setFillColor(black)

    y -= 30
    c.setFont("Helvetica-Bold", 9)
    c.drawString(42, y, "STEP-BY-STEP PROCESS")
    y -= 16
    c.setFont("Helvetica", 8)
    steps = "1. PROPOSAL   2. COUNSELING   3. APPLICATION   4. FHA CASE NUMBER   5. ORDER SERVICES   6. SUBMIT TO UW   7. CLOSE/FUND"
    c.drawString(42, y, steps)

    c.save()
    print(f"PDF saved to: {OUTPUT}")


if __name__ == "__main__":
    build_form()
