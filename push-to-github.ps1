# Helper script to push to GitHub with authentication
# This script helps configure git credentials for pushing

Write-Host "`n=== Push to GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Check if we have pending changes
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  You have uncommitted changes. Commit them first!" -ForegroundColor Yellow
    git status
    exit 1
}

# Show what will be pushed
Write-Host "📦 Commits to push:" -ForegroundColor Green
git log origin/master..HEAD --oneline

Write-Host "`n📝 PUSH OPTIONS:`n" -ForegroundColor Yellow

Write-Host "Option 1 - Use Git Credential Manager (Recommended):" -ForegroundColor Cyan
Write-Host "  git push origin master" -ForegroundColor White
Write-Host "  (Will open browser for GitHub authentication)`n" -ForegroundColor Gray

Write-Host "Option 2 - Use Personal Access Token:" -ForegroundColor Cyan
Write-Host "  1. Get token from: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "  2. When prompted:" -ForegroundColor White
Write-Host "     Username: YOUR_GITHUB_USERNAME" -ForegroundColor White
Write-Host "     Password: YOUR_TOKEN (NOT your GitHub password)`n" -ForegroundColor White

Write-Host "Option 3 - Use SSH (if configured):" -ForegroundColor Cyan
Write-Host "  git remote set-url origin git@github.com:Maxr0895/Assignment_1.git" -ForegroundColor White
Write-Host "  git push origin master`n" -ForegroundColor White

Write-Host "Choose an option and run the command, or press Ctrl+C to cancel" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to proceed with Option 1
$response = Read-Host "Try Option 1 now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nPushing to GitHub..." -ForegroundColor Green
    git push origin master
} else {
    Write-Host "`nCancelled. Run the command manually when ready." -ForegroundColor Yellow
}
