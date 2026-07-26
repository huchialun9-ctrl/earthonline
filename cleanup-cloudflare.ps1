# 清除 earthonline1 所有部署（保留 production）
$project1 = "earthonline1"
Write-Host "=== 清除 $project1 部署 ===" -ForegroundColor Cyan
$prod_id = ""
while ($true) {
  $ids = $(npx wrangler pages deployment list --project-name $project1 --json 2>&1 | Select-String -Pattern '"id"')
  if (-not $ids) { break }
  $to_delete = @()
  foreach ($line in $ids) {
    $id = ($line -split '"')[3]
    if ($id -ne $prod_id) { $to_delete += $id }
  }
  if ($to_delete.Count -eq 0) { break }
  Write-Host "刪除 $($to_delete.Count) 個部署..."
  foreach ($id in $to_delete) {
    npx wrangler pages deployment delete $id --project-name $project1 --force 2>&1 | Out-Null
  }
}

# 清除 earthonline 所有部署
$project2 = "earthonline"
Write-Host "=== 清除 $project2 部署 ===" -ForegroundColor Cyan
$prod_id = ""
while ($true) {
  $ids = $(npx wrangler pages deployment list --project-name $project2 --json 2>&1 | Select-String -Pattern '"id"')
  if (-not $ids) { break }
  $to_delete = @()
  foreach ($line in $ids) {
    $id = ($line -split '"')[3]
    if ($id -ne $prod_id) { $to_delete += $id }
  }
  if ($to_delete.Count -eq 0) { break }
  Write-Host "刪除 $($to_delete.Count) 個部署..."
  foreach ($id in $to_delete) {
    npx wrangler pages deployment delete $id --project-name $project2 --force 2>&1 | Out-Null
  }
}

Write-Host "完成！現在可以去 Cloudflare dashboard 手動刪除這兩個 Pages 專案了。" -ForegroundColor Green
