$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn) {
    $pid3000 = ($conn | Select-Object -First 1).OwningProcess
    Write-Host "Port 3000 in use by PID $pid3000 - killing..." -ForegroundColor Yellow
    taskkill /PID $pid3000 /F | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "Port 3000 freed." -ForegroundColor Green
}
Write-Host "Starting BCF-SL on http://localhost:3000" -ForegroundColor Cyan
npm run dev -- --port 3000
