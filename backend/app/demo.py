"""Demo scenarios (all SYNTHETIC). Lets judges and teammates reproduce every behaviour in seconds."""
from . import vision

SCENARIOS = {
    "widow_clean": {
        "title": "Widow, clean data, clear ID photo -> auto-approve (MOCK payment)",
        "login": "widow-clean@citizen.demo",
        "form": {"name": "Fatima Bibi", "father_name": "Muhammad Yousuf", "dob": "1978-03-14", "cnic": "42101-1234567-2", "gender": "F",
                 "district": "Karachi East", "marital_status": "widowed", "monthly_income": 14000, "household_size": 6, "phone": "0300-1110001"},
        "card": dict(name="Fatima Bibi", father="Muhammad Yousuf", cnic="42101-1234567-2", dob="1978-03-14", district="Karachi East"),
        "expect": "AUTO_APPROVE"},
    "widow_blurry_photo": {
        "title": "Same widow, blurry photo -> asks for a clearer photo (not a guess)",
        "login": "widow-blurry@citizen.demo",
        "form": {"name": "Zainab Bibi", "father_name": "Ghulam Hussain", "dob": "1982-06-18", "cnic": "42101-2223334-6", "gender": "F",
                 "district": "Karachi Central", "marital_status": "widowed", "monthly_income": 11000, "household_size": 5},
        "card": dict(name="Zainab Bibi", father="Ghulam Hussain", cnic="42101-2223334-6", dob="1982-06-18", district="Karachi Central", blur=True),
        "expect": "ASK_PROOF"},
    "forged_card": {
        "title": "Edited ID card (CNIC digit pasted over) -> human review with a fraud flag",
        "login": "widow-forged@citizen.demo",
        "form": {"name": "Ayesha Khatoon", "father_name": "Abdul Karim", "dob": "1979-12-01", "cnic": "42101-9990001-8", "gender": "F",
                 "district": "Karachi East", "marital_status": "widowed", "monthly_income": 13000, "household_size": 4},
        "card": dict(name="Ayesha Khatoon", father="Abdul Karim", cnic="42101-9990001-8", dob="1979-12-01", district="Karachi East", forged=True),
        "expect": "HUMAN_REVIEW"},
    "name_variant_missing_fields": {
        "title": "Name spelled differently, father spelled differently, DOB missing -> not sure -> asks/hands over (never a wrong match)",
        "login": "widow-variant@citizen.demo",
        "form": {"name": "Rukhsana Perveen", "father_name": "Abdur Rahman", "cnic": "42201-9876543-4", "gender": "F", "district": "Karachi West",
                 "marital_status": "widowed", "monthly_income": 12000, "household_size": 4},
        "card": None, "expect": "ASK_PROOF or HUMAN_REVIEW"},
    "claims_widow_but_married": {
        "title": "Claims to be a widow, registry shows living spouse -> human review with the conflict explained",
        "login": "liar-widow@citizen.demo",
        "form": {"name": "Nasreen Akhtar", "father_name": "Fazal Din", "dob": "1980-01-30", "cnic": "42101-7778889-2", "gender": "F",
                 "district": "Hyderabad", "marital_status": "widowed", "monthly_income": 18000, "household_size": 3},
        "card": dict(name="Nasreen Akhtar", father="Fazal Din", cnic="42101-7778889-2", dob="1980-01-30", district="Hyderabad"),
        "expect": "HUMAN_REVIEW"},
    "honestly_over_income": {
        "title": "Truthfully reports income above the limit -> declined WITH appeal (blocking a real person is a cost)",
        "login": "too-rich@citizen.demo",
        "form": {"name": "Shabana Kausar", "father_name": "Haji Rashid", "dob": "1975-09-09", "cnic": "42101-3334445-6", "gender": "F",
                 "district": "Karachi East", "marital_status": "widowed", "monthly_income": 52000, "household_size": 5},
        "card": dict(name="Shabana Kausar", father="Haji Rashid", cnic="42101-3334445-6", dob="1975-09-09", district="Karachi East"),
        "expect": "DECLINE_WITH_APPEAL"},
    "garbage_input": {
        "title": "Garbage / missing / duplicated / wrong data -> no crash, asks for the right things",
        "login": "widow-clean@citizen.demo",
        "form": {"name": "  ", "cnic": "abc-123", "monthly_income": "lots", "household_size": "N/A", "dob": "31/02/99", "gender": "??"},
        "card": None, "expect": "ASK_PROOF or HUMAN_REVIEW"},
}

SCAM_SAMPLES = [
    {"sender": "0300-1112223", "text": "BISP Relief Rs 25000 approved for you. Reply with CNIC and fee Rs 500 to JazzCash 0300-7654321 to receive payment."},
    {"sender": "8171", "text": "Your relief payment of Rs 25000 is ready at your nearest retailer. Take your original ID. No charges apply."},
    {"sender": "Ehsaas", "text": "آپ کا احساس پروگرام کا کھاتہ بند ہو جائے گا۔ فوری لنک پر کلک کریں http://ehsaas-pay.top/id"},
    {"sender": "03451234567", "text": "Aap ka benazir ka inaam nikla hai, apna CNIC aur OTP bhej dein jald"},
    {"sender": "K-Electric", "text": "Your bill of Rs 4,210 is due 28 Nov. Pay via the K-Electric app. Ignore if paid."},
]


def make_card(key: str) -> bytes | None:
    s = SCENARIOS.get(key)
    if not s or not s["card"]:
        return None
    return vision.make_sample_card(**s["card"])
