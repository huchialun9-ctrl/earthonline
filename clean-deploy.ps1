param([string]$Project)

$round = 0
while ($true) {
  $round++
  $json = npx wrangler pages deployment list --project-name $Project --json 2>&1 | Out-String
  $deps = $json | ConvertFrom-Json
  $count = ($deps | Measure-Object).Count
  if ($count -le 1) { Write-Host "Done - only 1 left"; break }
  Write-Host "Round $round : $count deployments"
  $deleted = 0
  $skipped = 0
  foreach ($dep in $deps) {
    $result = npx wrangler pages deployment delete $dep.Id --project-name $Project --force 2>&1
    if ($result -match "Successfully") { $deleted++ } 
    elseif ($result -match "cannot delete") { $skipped++ }
  }
  Write-Host "Round $round : deleted $deleted, skipped $skipped"
}
