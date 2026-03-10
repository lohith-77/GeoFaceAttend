Write-Host "🔄 Resetting port 5001..." -ForegroundColor Cyan

# Force kill all Node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing Node process: $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force
}

# Wait a moment
Start-Sleep -Seconds 3

# Check if port is free
$check = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
if (!$check) {
    Write-Host "✅ Port 5001 is now free" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Port still in use. Try changing port in .env file" -ForegroundColor Yellow
}

# Ask if user wants to start server
$response = Read-Host "Start server on port 5001? (y/n)"
if ($response -eq 'y') {
    cd C:\GeoFaceAttend\email-api
    npm start
}