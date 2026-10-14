import re

files = [
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\staff_eligibility_loan_application\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\hr_approval_console\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\finance_approval_console\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\hr_disbursement_voucher\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\finance_disbursement_release\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\donor_funds_inflow_ledger\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\program_expenditure_budgets\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\executive_treasury_bank_balance\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\staff_payroll_statutory_schedule\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\staff_monthly_payslip_self_service\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\staff_loan_register_disbursements\code.html",
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bcf_staff_loan_management_system\payroll_integration\code.html"
]

header_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
    <title>{title} - BCF-SL</title>
    <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {{
            theme: {{
                extend: {{
                    colors: {{
                        primary: "#001428",
                        secondary: "#226b47",
                        "surface": "#f8f9ff",
                        "surface-container": "#e5eeff",
                        "surface-container-low": "#eff4ff",
                        "on-surface": "#0b1c30",
                        "on-surface-variant": "#43474d",
                        outline: "#c3c6ce",
                        error: "#ba1a1a"
                    }},
                    fontFamily: {{ sans: ['Public Sans', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }}
                }}
            }}
        }}
    </script>
    <style>
        body {{ background-color: #f1f5f9; }}
        .modal {{ transition: opacity 0.25s ease; }}
        body.modal-active {{ overflow-x: hidden; overflow-y: hidden !important; }}
    </style>
</head>
<body class="text-on-surface flex flex-col min-h-screen">

    <!-- Header -->
    <header class="bg-white border-b border-outline shadow-sm z-40 sticky top-0">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <img src="https://lh3.googleusercontent.com/aida/AEtjO1UjWKdxSztphZd7RTtP9Dakd0jP7-7cnj1OLQIRcKLhYCDTyRZ0hz_7tWzbJpgZXmwfbt-ndFek8ewobzCGFHM-qgCe9qmEbvNWbNP0tg3BHDrFFmARgJnrE-X3NfLZIOPGf6HhEUiCn6WvfzDQ94W01dKRl9ObbQLctt5Njy7l6Nkmyxrvd2h5fQEgQUPEzElDJyNqxQRxHuDnRN69sTO7Bdfr4gcwkSNjN30KenQ4GwASwXkKLN3Sa_c" onerror="this.src='https://placehold.co/100x100?text=BCF'" alt="BCF-SL Logo" class="h-10 w-auto object-contain"/>
                <div class="hidden sm:block">
                    <h1 class="font-bold text-lg text-primary leading-tight">{title}</h1>
                    <p class="text-[11px] font-semibold text-secondary">Bandama Charity Foundation SL</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-on-surface-variant">
                    <span class="material-symbols-outlined">notifications</span>
                </button>
            </div>
        </div>
    </header>

    <main class="flex-grow p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
"""

for file_path in files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        match = re.search(r'<title>(.*?)</title>', content)
        title = match.group(1) if match else "Admin"
        title = title.replace("- BCF-SL", "").strip()
        
        main_match = re.search(r'<main[^>]*>', content)
        if not main_match:
            print(f"Skipping {file_path}, no main tag found")
            continue
            
        main_start = main_match.end()
        new_header = header_template.format(title=title)
        new_content = new_header + content[main_start:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Reverted {file_path}")
    except Exception as e:
        print(f"Error on {file_path}: {e}")
