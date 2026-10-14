import re
import os

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
    r"c:\Users\Albert J Bandama\Desktop\BCF-SL Administration System\frontend\public\apps\stitch_bandama_financial_operations_management_system\staff_monthly_payslip_self_service\code.html"
]

header_template = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" name="viewport"/>
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
<style>@layer base{{html,body{{width:100%;margin:0;padding:0;background-color:#f8f9ff;}}body{{overscroll-behavior-y:none;-webkit-tap-highlight-color:transparent;}}.pb-safe{{padding-bottom:env(safe-area-inset-bottom,0px);}}.pt-safe{{padding-top:env(safe-area-inset-top,0px);}}main>:first-child{{margin-top:0!important;}}main>:last-child{{margin-bottom:0!important;}}}}::-webkit-scrollbar{{display:none;}}body{{min-height:max(884px,100dvh);}}</style>
<script src="https://cdn.tailwindcss.com"></script>
<script id="tailwind-config">tailwind.config = {{ darkMode: 'class', theme: {{ extend: {{ colors: {{ 'surface-container-highest': '#d5e3fc', 'surface-container': '#e6eeff', 'on-primary-fixed-variant': '#005232', 'on-secondary-fixed-variant': '#3f465c', 'secondary': '#565e74', 'surface': '#f8f9ff', 'surface-variant': '#d5e3fc', 'on-error-container': '#93000a', 'outline': '#707971', 'primary-container': '#0d5c3a', 'surface-container-lowest': '#ffffff', 'background': '#f8f9ff', 'on-secondary': '#ffffff', 'primary-fixed': '#a9f3c5', 'surface-tint': '#226b47', 'secondary-fixed-dim': '#bec6e0', 'on-tertiary-fixed': '#2f1500', 'inverse-on-surface': '#eaf1ff', 'surface-dim': '#ccdbf3', 'tertiary-fixed-dim': '#ffb77d', 'on-primary-fixed': '#002111', 'inverse-primary': '#8ed6aa', 'on-primary': '#ffffff', 'on-surface': '#0d1c2e', 'on-secondary-fixed': '#131b2e', 'surface-container-low': '#eff4ff', 'on-tertiary-container': '#ffb273', 'outline-variant': '#bfc9c0', 'tertiary': '#5a2e00', 'surface-container-high': '#dce9ff', 'tertiary-fixed': '#ffdcc3', 'primary': '#004328', 'on-tertiary-fixed-variant': '#6e3900', 'on-surface-variant': '#404942', 'secondary-fixed': '#dae2fd', 'surface-bright': '#f8f9ff', 'on-tertiary': '#ffffff', 'on-error': '#ffffff', 'inverse-surface': '#233144', 'tertiary-container': '#7c4100', 'secondary-container': '#dae2fd', 'error': '#ba1a1a', 'on-background': '#0d1c2e', 'error-container': '#ffdad6', 'primary-fixed-dim': '#8ed6aa', 'on-primary-container': '#8ad2a7', 'on-secondary-container': '#5c647a' }}, borderRadius: {{ 'DEFAULT': '0.125rem', 'lg': '0.25rem', 'xl': '0.5rem', 'full': '0.75rem' }}, spacing: {{ 'space-sm': '0.5rem', 'space-2xs': '0.125rem', 'space-xl': '1.5rem', 'card-padding-compact': '0.75rem', 'space-md': '0.75rem', 'gutter-mobile': '0.75rem', 'gutter-desktop': '1.5rem', 'space-lg': '1.25rem', 'card-padding-default': '1.25rem', 'space-xs': '0.25rem', 'space-base': '1rem', 'space-2xl': '2rem', 'space-3xl': '3rem' }}, fontFamily: {{ 'display-lg': ['Inter'], 'currency-display': ['Inter'], 'title-lg': ['Inter'], 'body-sm': ['Inter'], 'tabular-ledger': ['Inter'], 'label-lg': ['Inter'], 'body-lg': ['Inter'], 'currency-md': ['Inter'], 'title-md': ['Inter'], 'label-md': ['Inter'], 'headline-md': ['Inter'], 'label-sm': ['Inter'], 'headline-lg': ['Inter'], 'body-md': ['Inter'] }}, fontSize: {{ 'display-lg': ['32px', {{ lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }}], 'currency-display': ['28px', {{ lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }}], 'title-lg': ['18px', {{ lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }}], 'body-sm': ['13px', {{ lineHeight: '18px', letterSpacing: '0.005em', fontWeight: '400' }}], 'tabular-ledger': ['13px', {{ lineHeight: '18px', letterSpacing: '0em', fontWeight: '500' }}], 'label-lg': ['13px', {{ lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '600' }}], 'body-lg': ['15px', {{ lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }}], 'currency-md': ['16px', {{ lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' }}], 'title-md': ['16px', {{ lineHeight: '24px', letterSpacing: '0em', fontWeight: '600' }}], 'label-md': ['12px', {{ lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '500' }}], 'headline-md': ['20px', {{ lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }}], 'label-sm': ['11px', {{ lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }}], 'headline-lg': ['24px', {{ lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }}], 'body-md': ['14px', {{ lineHeight: '20px', letterSpacing: '0em', fontWeight: '400' }}] }} }} }}</script>
</head>
<body class="bg-surface font-body-md text-body-md text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary selection:text-on-primary">
<header class="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(13,28,46,0.04)] pt-safe">
    <div class="h-16 px-gutter-mobile flex items-center justify-between gap-space-sm">
        <div class="flex items-center gap-space-xs min-w-0 flex-1">
            <img alt="Bandama Charity Foundation Logo" class="h-8 w-auto object-contain shrink-0" src="https://lh3.googleusercontent.com/aida/AEtjO1UjWKdxSztphZd7RTtP9Dakd0jP7-7cnj1OLQIRcKLhYCDTyRZ0hz_7tWzbJpgZXmwfbt-ndFek8ewobzCGFHM-qgCe9qmEbvNWbNP0tg3BHDrFFmARgJnrE-X3NfLZIOPGf6HhEUiCn6WvfzDQ94W01dKRl9ObbQLctt5Njy7l6Nkmyxrvd2h5fQEgQUPEzElDJyNqxQRxHuDnRN69sTO7Bdfr4gcwkSNjN30KenQ4GwASwXkKLN3Sa_c"/>
            <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-space-xs">
                    <span class="font-label-md text-label-md text-primary truncate tracking-tight uppercase">BCF</span>
                    <span class="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">SLE</span>
                </div>
                <h1 class="font-title-md text-title-md text-on-surface truncate leading-none">{title}</h1>
            </div>
        </div>
        <div class="flex items-center gap-space-xs shrink-0">
            <button aria-label="Notifications" class="relative w-11 h-11 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors" type="button">
                <span class="material-symbols-outlined text-[20px]">notifications</span>
                <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-error ring-2 ring-surface"></span>
            </button>
            <div class="flex items-center gap-space-xs pl-space-xs">
                <div class="relative flex items-center">
                    <img alt="Profile" class="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-outline-variant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD162K4KtincPTik7LnoU9QwUpSiho7afLo7POYhmtaARMQ3zMQBXUkQ4FhPbiNV7NtRo-KKWk4pPOYhxCyc38DifjsExRkGykZoSTEs9A058kwW2mUk2FHcRCJO98rPfOzNqXQKpOpGZaDcYirnTTy5mxWCrDcEtHLv9bhdplvKyFf_pALPCu9xm3nxTnFcFsD8Q7BsEf-go0_fVwyIFl4mUp-tTZSMtVHq1PRe0ebxdARAuXFq2Rr"/>
                </div>
            </div>
        </div>
    </div>
</header>
<main class="flex-1 flex flex-col relative w-full pt-20 pb-24 bg-surface px-gutter-mobile">
"""

for file_path in files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # extract title
        match = re.search(r'<title>(.*?)</title>', content)
        title = match.group(1) if match else "Admin"
        
        # strip out "- BCF-SL" if it's there
        title = title.replace("- BCF-SL", "").strip()
        
        # find where <main starts
        main_match = re.search(r'<main[^>]*>', content)
        if not main_match:
            print(f"Skipping {file_path}, no main tag found")
            continue
            
        main_start = main_match.end()
        before_main = content[:main_match.start()]
        
        # Replace 
        new_header = header_template.format(title=title)
        
        new_content = new_header + content[main_start:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")
    except Exception as e:
        print(f"Error on {file_path}: {e}")
